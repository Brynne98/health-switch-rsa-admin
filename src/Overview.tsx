import { useQuery } from 'convex/react';
import { useState } from 'react';

import { api, type Overview, type RevenueChart } from './api';
import { count, DAY_MS, longToday, money, shortDate, when } from './format';

type Range = 'week' | 'month' | 'life';
const RANGES: { id: Range; label: string; days: number | null; line: string }[] = [
  { id: 'week', label: '7 days', days: 7, line: 'last 7 days' },
  { id: 'month', label: '30 days', days: 30, line: 'last 30 days' },
  { id: 'life', label: 'Lifetime', days: null, line: 'since launch' },
];

type Pt = { t: number; v: number; incomplete?: boolean };

/** One measure of a chart as dated points, oldest first; its total, or one plan's share of a split chart. RevenueCat dates are in seconds. */
function series(chart: RevenueChart | undefined, match: RegExp, fallback = 0, plan?: string): Pt[] {
  if (!chart) return [];
  const found = chart.measures.findIndex((m) => match.test(m.name));
  const m = found < 0 ? fallback : found;
  const s = plan === undefined ? undefined : chart.segments?.indexOf(plan) ?? -1;
  return chart.points
    .filter((p) => p.m === m && p.s === s)
    .map((p) => ({ t: p.t < 1e12 ? p.t * 1000 : p.t, v: p.v, incomplete: p.incomplete }))
    .sort((a, b) => a.t - b.t);
}

const within = (pts: Pt[], from: number, to = Infinity) => pts.filter((p) => p.t >= from && p.t < to);
const sum = (pts: Pt[]) => pts.reduce((n, p) => n + p.v, 0);

/** The value, then what it is: "$1.84", "29 Sep". */
type Fmt = (p: Pt) => [string, string];

/** A date inside a sentence: "by 29 Sep", "by yesterday". */
const inline = (ms: number) => { const d = shortDate(ms); return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : d; };

// A finger lifting counts as leaving, so on a phone a tapped tooltip stays until the next tap elsewhere (blur).

/** Tooltips sit beside the mark, inside the chart, so they never cover the numbers above it; past halfway they flip to the left. */
const tipSide = (x: number) => (x > 50 ? 'flip' : '');

function Spark({ pts, floor, fmt, label }: { pts: Pt[]; floor?: number; fmt: Fmt; label: string }) {
  const [at, setAt] = useState<number | null>(null);
  // A period still running would dip the end of the line.
  pts = pts.filter((p) => !p.incomplete);
  if (pts.length < 2) return <div className="spark-empty" />;
  const vals = pts.map((p) => p.v);
  const lo = floor ?? Math.min(...vals), hi = Math.max(...vals);
  const top = (v: number) => 52 - ((v - lo) / (hi - lo || 1)) * 44;
  const xy = vals.map((v, i) => `${((i / (vals.length - 1)) * 300).toFixed(1)},${top(v).toFixed(1)}`);
  const line = 'M' + xy.join(' L');
  const n = pts.length;
  // The crosshair snaps to the nearest day, so the reader aims at a date, not at a 2px line.
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (n - 1)));
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (step) { e.preventDefault(); setAt((i) => Math.min(n - 1, Math.max(0, (i ?? n - 1) + step))); }
  };
  const x = at === null ? 0 : (at / (n - 1)) * 100;
  const [value, what] = at === null ? ['', ''] : fmt(pts[at]);
  return (
    <div
      className="spark-box" tabIndex={0} aria-label={`${label}: use the arrow keys to read each day`}
      onPointerDown={pick} onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAt(null); }} onFocus={() => setAt(n - 1)} onBlur={() => setAt(null)} onKeyDown={key}
    >
      <svg className="spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
        <path d={`${line} L300,56 L0,56 Z`} className="spark-area" />
        <path d={line} className="spark-line" vectorEffect="non-scaling-stroke" />
      </svg>
      {at !== null && (
        <>
          <div className="spark-cross" style={{ left: `${x}%` }} />
          <div className="spark-dot" style={{ left: `${x}%`, top: `${(top(vals[at]) / 56) * 100}%` }} />
          <div className={`tip ${tipSide(x)}`} style={{ left: `${x}%` }} role="status"><b>{value}</b><span>{what}</span></div>
        </>
      )}
    </div>
  );
}

function Revenue({ charts, range }: { charts: RevenueChart[]; range: (typeof RANGES)[number] }) {
  const [bar, setBar] = useState<number | null>(null);
  const by = (id: RevenueChart['chart']) => charts.find((c) => c.chart === id);
  if (charts.length === 0) {
    return (
      <div className="card tile-wide">
        <div className="h2">Revenue</div>
        <p className="muted">No data from RevenueCat yet. It updates every hour; if it stays empty, check the key and project in the Convex environment.</p>
      </div>
    );
  }
  const last = (pts: Pt[]) => pts[pts.length - 1]?.v ?? 0;
  const currency = by('revenue')?.currency ?? by('mrr')?.currency ?? 'USD';
  const now = Date.now();
  const from = range.days === null ? 0 : now - range.days * DAY_MS;

  const revenue = series(by('revenue'), /revenue|proceeds/i);
  const got = within(revenue, from);
  const before = range.days === null ? [] : within(revenue, from - range.days * DAY_MS, from);
  const delta = before.length && sum(before) > 0 ? Math.round(((sum(got) - sum(before)) / sum(before)) * 100) : null;
  // A running total: day by day, one sale is a lone spike.
  let run = 0;
  const built = got.map((p) => ({ t: p.t, v: (run += p.v) }));

  const mrr = within(series(by('mrr'), /mrr/i), from);
  const actives = within(series(by('actives'), /active/i), from);
  // Monthly and yearly plans as they stand today, whatever the range.
  const planNow = (id: 'mrr' | 'actives', match: RegExp, plan: string) => last(series(by(id), match, 0, plan));

  const moves = by('actives_movement');
  const joined = [...within(series(moves, /^new/i, 0), from), ...within(series(moves, /resub/i, 1), from)];
  const ended = within(series(moves, /churn/i, 2), from).map((p) => ({ t: p.t, v: Math.max(0, p.v) }));
  // Days for a week; weeks for anything longer, widened so the whole range fits in ten bars.
  // From the first day's data, not from `now`: `now` moves on every render, and bars keyed on it would be rebuilt under the pointer.
  const start = joined.length ? Math.min(...joined.map((p) => p.t)) : from;
  const span = now - start;
  const step = range.id === 'week' ? DAY_MS : Math.max(7, Math.ceil(span / DAY_MS / 10 / 7) * 7) * DAY_MS;
  const buckets = new Map<number, { up: number; down: number }>();
  const add = (p: Pt, k: 'up' | 'down') => {
    const b = start + Math.floor((p.t - start) / step) * step;
    const cur = buckets.get(b) ?? { up: 0, down: 0 };
    cur[k] += p.v;
    buckets.set(b, cur);
  };
  joined.forEach((p) => add(p, 'up'));
  ended.forEach((p) => add(p, 'down'));
  const cols = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  // What one bar covers: a day, or "15 Sep to 21 Sep".
  const covers = (t: number) => (step === DAY_MS ? shortDate(t) : `${shortDate(t)} to ${inline(Math.min(t + step - DAY_MS, now))}`);
  // One scale for both directions, so an ending is as tall as a join.
  const px = Math.min(40 / Math.max(1, ...cols.map(([, c]) => c.up)), 22 / Math.max(1, ...cols.map(([, c]) => c.down)));
  const updated = Math.max(...charts.map((c) => c.fetchedAt));
  // The job runs hourly, so two hours without an update means it has stopped.
  const stale = now - updated > 2 * 60 * 60 * 1000;
  const fromLabel = got[0] ? shortDate(got[0].t) : '';

  return (
    <>
      <div className="card tile wide">
        <div className="tile-head"><span className="tile-label">You get</span></div>
        <div className="tile-value">
          <span className="big-num">{money(sum(got), currency)}</span>
          {delta !== null && <span className={`chip ${delta >= 0 ? 'good' : 'bad'}`}>{delta >= 0 ? '+' : '−'}{Math.abs(delta)}% on the {range.days} days before</span>}
        </div>
        <div className="lbl">{range.line}, after VAT and Apple’s cut</div>
        <Spark pts={built} floor={0} label="You get" fmt={(p) => [money(p.v, currency), `in total by ${inline(p.t)}`]} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile small">
        <div className="tile-head"><span className="tile-label">Monthly recurring</span></div>
        <div className="tile-value"><span className="big-num">{money(last(mrr), currency)}</span></div>
        <div className="lbl"><span className="nowrap">{money(planNow('mrr', /mrr/i, 'P1M'), currency)} monthly</span> · <span className="nowrap">{money(planNow('mrr', /mrr/i, 'P1Y'), currency)} yearly</span></div>
        <div className="lbl">a month if nobody cancels, after VAT and Apple’s cut</div>
        <Spark pts={mrr} floor={0} label="Monthly recurring" fmt={(p) => [money(p.v, currency), shortDate(p.t)]} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile small">
        <div className="tile-head"><span className="tile-label">People on Pro</span></div>
        <div className="tile-value"><span className="big-num">{count(last(actives))}</span></div>
        <div className="lbl"><span className="nowrap">{count(planNow('actives', /active/i, 'P1M'))} monthly</span> · <span className="nowrap">{count(planNow('actives', /active/i, 'P1Y'))} yearly</span></div>
        <div className="lbl">paying for Pro right now</div>
        <Spark pts={actives} floor={0} label="People on Pro" fmt={(p) => [`${count(p.v)} on Pro`, shortDate(p.t)]} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile wide">
        <div className="tile-head"><span className="tile-label">Joined and ended</span></div>
        <div className="tile-value legend">
          <span><i className="key up" /><span className="big-num">{sum(joined)}</span> joined</span>
          <span><i className="key down" /><span className="big-num">{sum(ended)}</span> ended</span>
        </div>
        <div className="lbl">Pro subscriptions, {range.line}</div>
        <div className="moves">
          {cols.map(([t, c], i) => (
            <div
              key={t} className={`move ${bar === i ? 'on' : ''}`} tabIndex={0}
              aria-label={`${covers(t)}: ${c.up} joined, ${c.down} ended`}
              onPointerEnter={() => setBar(i)} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setBar(null); }} onFocus={() => setBar(i)} onBlur={() => setBar(null)}
            >
              {bar === i && (
                <div className={`tip ${tipSide(((i + 0.5) / cols.length) * 100)}`} role="status">
                  <b>{c.up} joined · {c.down} ended</b><span>{covers(t)}</span>
                </div>
              )}
              <div className="move-up"><div style={{ height: `${c.up * px}px` }} /></div>
              <div className="move-down"><div style={{ height: `${c.down * px}px` }} /></div>
              {range.id === 'week' && <div className="move-label">{new Date(t).toLocaleDateString('en-GB', { weekday: 'short' })}</div>}
            </div>
          ))}
        </div>
        {range.id !== 'week' && <div className="axis"><span>{cols[0] ? shortDate(cols[0][0]) : ''}</span><span>Today</span></div>}
      </div>
      <p className={`source tiles-note ${stale ? 'stale' : ''}`}>
        From RevenueCat, in {currency === 'USD' ? 'US dollars' : currency} · {stale ? `not updated since ${when(updated)}: check the hourly job in Convex` : `updated ${when(updated)}`}
      </p>
    </>
  );
}

/** Phones RevenueCat saw open the app: this week so far, the week before, and every one since launch. */
function Phones({ charts }: { charts: RevenueChart[] }) {
  const weeks = series(charts.find((c) => c.chart === 'customers_active'), /active/i);
  const total = sum(series(charts.find((c) => c.chart === 'customers_new'), /new/i));
  const week = weeks[weeks.length - 1], before = weeks[weeks.length - 2];
  return (
    <div className="card">
      <div className="h2">Phones</div>
      {!week ? <p className="muted">No data from RevenueCat yet.</p> : (
        <>
          <div className="tile-value"><span className="big-num">{count(week.v)}</span></div>
          <div className="lbl">opened the app since {inline(week.t)}{before && `, ${count(before.v)} the week before`}</div>
          <div className="lbl">{count(total)} since launch</div>
        </>
      )}
    </div>
  );
}

export function OverviewPage() {
  const data = useQuery(api.admin.overview) as Overview | undefined;
  const [range, setRange] = useState<Range>('life');
  const r = RANGES.find((x) => x.id === range)!;

  const todo = data ? [
    { count: data.reported.count, title: 'Numbers not working', sub: `${data.reported.since24h} in the last 24 hours`, go: 'Review', href: '#/numbers' },
    { count: data.ideas.noStatus, title: 'Open ideas', sub: 'Mark them Planned or Done', go: 'Review', href: '#/ideas' },
    { count: data.feedback.lastWeek, title: 'New feedback', sub: data.feedback.total ? 'In the last 7 days' : 'Nothing sent yet', go: 'Read', href: '#/feedback' },
    { count: data.ideas.hiddenByReports, title: 'Ideas hidden by flags', sub: 'Three flags hide one', go: 'Check', href: '#/ideas/hidden' },
  ] : [];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">{longToday()}{data && ` · ${count(data.numbers)} numbers in ${data.hospitals} hospitals`}</div>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((x) => (
            <button key={x.id} aria-pressed={range === x.id} onClick={() => setRange(x.id)}>{x.label}</button>
          ))}
        </div>
      </header>
      {!data ? <div className="loading" aria-busy="true" /> : (
        <>
          <section className="overview-top">
            <div className="tiles"><Revenue charts={data.revenue} range={r} /></div>
            <div className="overview-side">
              <div className="card">
                <div className="h2">Waiting on you</div>
                <div className="rows">
                  {todo.map((t) => (
                    <div key={t.title} className="row todo">
                      <div className={`badge ${t.count ? 'hot' : ''}`}>{t.count}</div>
                      <div className="grow">
                        <div className={t.count ? '' : 'muted'}>{t.title}</div>
                        <div className="lbl">{t.sub}</div>
                      </div>
                      {t.count > 0 && <a className="go" href={t.href}>{t.go}</a>}
                    </div>
                  ))}
                </div>
              </div>
              <Phones charts={data.revenue} />
            </div>
          </section>
          <section className="overview-bottom">
            <div className="card">
              <div className="h2">Latest in the app</div>
              <div className="rows">
                {data.activity.length === 0 && <p className="muted">Nothing yet.</p>}
                {data.activity.slice(0, 6).map((a, i) => (
                  <div key={i} className="row activity">
                    <i className={`dot ${a.kind}`} />
                    <div className="grow"><div className="clamp">{a.text}</div><div className="lbl">{a.day ? shortDate(a.at) : when(a.at)}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><div className="h2">Top ideas</div><a href="#/ideas">All {data.ideas.total}</a></div>
              {data.ideas.top.length === 0 ? <p className="muted">No ideas yet.</p>
                : data.ideas.top.every((i) => i.votes === 0) ? <p className="muted">Nobody has voted yet.</p>
                : (
                  <div className="rows">
                    {data.ideas.top.map((i) => (
                      <div key={i.id} className="row">
                        <div className="votes">{i.votes}</div>
                        <div className="grow ellipsis">{i.text}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
