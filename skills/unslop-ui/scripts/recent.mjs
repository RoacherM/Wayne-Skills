#!/usr/bin/env node
// Local addition to unslop-ui (not part of upstream unslop).
// Downloads the newest curated work from recent.design so the agent can look at it before setting a direction.
// Needs Node 20+ and network access. No dependencies.
//
//   node recent.mjs <category> [outDir] [--count 12]
//   categories: design, websites, app-store-screenshots, app-icons, og-images, launch-videos
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CATEGORIES = ['design', 'websites', 'app-store-screenshots', 'app-icons', 'og-images', 'launch-videos'];
const SITE = 'https://recent.design';
const WANT_WIDTH = 640;

const unescape = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/** Featured items of one recent.design page, in page order: `{ id, title, link, image }`. */
export function parseItems(html) {
  const items = new Map();
  // One item has several media kinds (poster, screenshots/1, …) and widths. Keep the first kind, nearest to 640 wide.
  for (const m of html.matchAll(/https:\/\/cdn\.recent\.design\/items\/([a-z0-9]+)\/([^"\s,]*?)\/?(\d+)\.(webp|jpe?g|png)/g)) {
    const [image, id, kind, width] = m;
    const seen = items.get(id);
    if (!seen) items.set(id, { id, kind, width: +width, image });
    else if (seen.kind === kind && Math.abs(+width - WANT_WIDTH) < Math.abs(seen.width - WANT_WIDTH)) Object.assign(seen, { width: +width, image });
  }
  return [...items.values()].map(({ id, image }) => {
    const slug = html.match(new RegExp(`href="(/i/${id}-([^"]*))"`));
    const label = html.match(new RegExp(`aria-label="View post: ([^"]+)" href="/i/${id}-`));
    const title = label ? unescape(label[1]) : slug ? slug[2].replace(/-/g, ' ') : id;
    return { id, title, link: slug ? SITE + slug[1] : SITE, image };
  });
}

async function main(argv) {
  const count = argv.includes('--count') ? Number(argv[argv.indexOf('--count') + 1]) : 12;
  const [category, outArg] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--count');
  if (!CATEGORIES.includes(category)) {
    console.error(`usage: node recent.mjs <${CATEGORIES.join('|')}> [outDir] [--count 12]`);
    return 2;
  }
  const out = outArg ?? join('unslop', 'recent', category);
  const page = `${SITE}/${category === 'design' ? '' : category}`;
  const res = await fetch(page);
  if (!res.ok) throw new Error(`${page} answered ${res.status}`);
  const items = parseItems(await res.text()).slice(0, count);
  if (!items.length) throw new Error(`no items found on ${page}: the page markup changed, open it in a browser instead`);

  mkdirSync(out, { recursive: true });
  const lines = [`# recent.design / ${category}, fetched ${new Date().toISOString().slice(0, 10)}`, ''];
  for (const [i, item] of items.entries()) {
    const img = await fetch(item.image);
    if (!img.ok) continue;
    const file = `${String(i + 1).padStart(2, '0')}-${item.id}.${item.image.split('.').pop()}`;
    writeFileSync(join(out, file), Buffer.from(await img.arrayBuffer()));
    lines.push(`- ${file}: ${item.title} (${item.link})`);
  }
  writeFileSync(join(out, 'index.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\nsaved to ${out}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main(process.argv.slice(2)));
