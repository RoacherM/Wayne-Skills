import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseItems } from '../skills/unslop-ui/scripts/recent.mjs';

const cdn = 'https://cdn.recent.design/items';

test('one entry per item, in page order, with the width nearest 640 of its first media kind', () => {
  const html = `
    <article><img src="${cdn}/aaa1/0/poster/1091.webp" srcSet="${cdn}/aaa1/0/poster/360.webp 360w, ${cdn}/aaa1/0/poster/640.webp 640w, ${cdn}/aaa1/0/poster/960.webp 960w"/>
      <img src="https://cdn.recent.design/entities/x/avatar/y/400.webp"/>
      <a aria-label="View post: CO&#x27;WATCH &amp; Co" href="/i/aaa1-co-watch"></a></article>
    <article><img srcSet="${cdn}/bbb2/app-store/screenshots/0/400.jpg 400w, ${cdn}/bbb2/app-store/screenshots/0/800.jpg 800w, ${cdn}/bbb2/app-store/screenshots/1/640.jpg 640w"/>
      <a href="/i/bbb2-linear-mobile"></a></article>
    <img src="https://cdn.recent.design/sponsors/zzz/campaign/c/poster/640.webp"/>`;
  assert.deepEqual(parseItems(html), [
    { id: 'aaa1', title: "CO'WATCH & Co", link: 'https://recent.design/i/aaa1-co-watch', image: `${cdn}/aaa1/0/poster/640.webp` },
    { id: 'bbb2', title: 'linear mobile', link: 'https://recent.design/i/bbb2-linear-mobile', image: `${cdn}/bbb2/app-store/screenshots/0/800.jpg` },
  ]);
});

test('a page without item images gives an empty list, so the script can say the markup changed', () => {
  assert.deepEqual(parseItems('<html><body>Recent</body></html>'), []);
});
