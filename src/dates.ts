const DAY = 86400000;

export function ms(d: string): number {
  return Date.parse(d + 'T00:00:00Z');
}

export function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date of now, YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Local time with offset, e.g. 2026-09-03T20:45:12+08:00. */
export function nowIso(d = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return (
    `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}` +
    `T${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}` +
    `${sign}${two(Math.floor(a / 60))}:${two(a % 60)}`
  );
}

/** Accepts YYYY-MM-DD (taken as noon local) or any ISO string. Always returns the instant in the local offset, or null. */
export function parseTs(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (Number.isNaN(ms(s))) return null;
    const [y, m, d] = s.split('-').map(Number);
    return nowIso(new Date(y, m - 1, d, 12, 0, 0));
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return nowIso(new Date(t));
}

/** The one timestamp shape the files accept: local time with a numeric offset, so dayOf() is the writer's calendar day. */
export function isValidTs(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Instant of a timestamp in ms; malformed ones sort first instead of throwing. */
export function tsMs(ts: string): number {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? Number.MIN_SAFE_INTEGER : t;
}

/** Order by instant (offset-aware), ties keep the order given, i.e. file order. */
export function sortEvents<T extends { ts: string }>(events: readonly T[]): T[] {
  return events
    .map((e, i) => ({ e, i, t: tsMs(e.ts) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e);
}

/** Calendar day an event belongs to: the writer's local date carried in the timestamp. */
export function dayOf(ts: string): string {
  return ts.slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((ms(dayOf(b)) - ms(dayOf(a))) / DAY);
}

export function addDays(d: string, n: number): string {
  return iso(ms(d) + n * DAY);
}

/** Monday of the ISO week containing d. */
export function weekStart(d: string): string {
  const t = ms(d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Mon=0
  return iso(t - dow * DAY);
}

export function monthStart(d: string): string {
  return d.slice(0, 7) + '-01';
}

export function nextMonth(d: string): string {
  const y = +d.slice(0, 4);
  const m = +d.slice(5, 7);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${two(m + 1)}-01`;
}

/** ISO week label, e.g. 2026-W36. */
export function weekLabel(d: string): string {
  const t = new Date(ms(d));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3); // the Thursday decides year and week
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${two(week)}`;
}

/** Monday of an ISO week label, or null when malformed. */
export function weekMonday(label: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!m) return null;
  const y = +m[1];
  const jan4 = Date.UTC(y, 0, 4);
  const mon1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  const monday = iso(mon1 + (+m[2] - 1) * 7 * DAY);
  return weekLabel(monday) === label ? monday : null; // rejects W00 / W54 / W53 in a 52-week year
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(ms(s));
}

export function isValidWeek(s: string): boolean {
  return weekMonday(s) !== null;
}
