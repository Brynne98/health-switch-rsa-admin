const ZONE = 'Africa/Johannesburg';

export const DAY_MS = 86_400_000;

// Spelt out here: en-GB now writes September as "Sept".
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** 2026-09-30 in South Africa. */
const ymd = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: ZONE });

/** "Today", "Yesterday" or "29 Sep": the one way every date on the site is written. */
export function shortDate(ms: number) {
  const day = ymd(ms);
  if (day === ymd(Date.now())) return 'Today';
  if (day === ymd(Date.now() - DAY_MS)) return 'Yesterday';
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function time(ms: number) {
  return new Date(ms).toLocaleTimeString('en-ZA', { timeZone: ZONE, hour: '2-digit', minute: '2-digit' });
}

export function when(ms: number) {
  return `${shortDate(ms)} ${time(ms)}`;
}

export function longToday() {
  return new Date().toLocaleDateString('en-GB', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });
}

export function count(n: number) {
  return n.toLocaleString('en-US');
}

/** Rand written as the stores write it, R29.99: no space after the R (HSR-173). */
export function cash(n: number, currency: string, digits: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(n).replace(/^(-?R)\s/, '$1');
}

/** To the cent: with sums this small, rounding to whole rand turns R1.84 into R2. */
export function money(n: number, currency = 'ZAR') {
  return cash(n, currency, 2);
}
