const ZONE = 'Africa/Johannesburg';

export const DAY_MS = 86_400_000;

export function when(ms: number) {
  const d = new Date(ms);
  const day = (x: Date) => x.toLocaleDateString('en-ZA', { timeZone: ZONE });
  const time = d.toLocaleTimeString('en-ZA', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
  if (day(d) === day(new Date())) return `Today ${time}`;
  if (day(d) === day(new Date(Date.now() - DAY_MS))) return `Yesterday ${time}`;
  return d.toLocaleDateString('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short' });
}

export function time(ms: number) {
  return new Date(ms).toLocaleTimeString('en-ZA', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
}

/** "Today", "Yesterday" or "Monday 28 September", for grouping a list by day. */
export function dayHeading(ms: number) {
  const w = when(ms);
  if (w.startsWith('Today')) return 'Today';
  if (w.startsWith('Yesterday')) return 'Yesterday';
  return new Date(ms).toLocaleDateString('en-GB', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });
}

export function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short' });
}

export function longToday() {
  return new Date().toLocaleDateString('en-GB', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });
}

export function count(n: number) {
  return n.toLocaleString('en-ZA').replace(/ /g, ',');
}

export function money(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}
