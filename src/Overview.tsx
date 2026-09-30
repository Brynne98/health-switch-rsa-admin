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

type Pt = { t: number; v: number };

/** One measure of a chart as dated points, oldest first. RevenueCat dates are in seconds. */
function series(chart: RevenueChart | undefined, match: RegExp, fallback = 0): Pt[] {
  if (!chart) return [];
  const found = chart.measures.findIndex((m) => match.test(m.name));
  const m = found < 0 ? fallback : found;
  return chart.points
    .filter((p) => p.m === m)
    .map((p) => ({ t: p.t < 1e12 ? p.t * 1000 : p.t, v: p.v }))
    .sort((a, b) => a.t - b.t);
}

const within = (pts: Pt[], from: number, to = Infinity) => pts.filter((p) => p.t >= from && p.t < to);
const sum = (pts: Pt[]) => pts.reduce((n, p) => n + p.v, 0);

function Spark({ pts, floor }: { pts: Pt[]; floor?: number }) {
  if (pts.length < 2) return <div className="spark-empty" />;
  const vals = pts.map((p) => p.v);
  const lo = floor ?? Math.min(...vals), hi = Math.max(...vals);
  const xy = vals.map((v, i) => `${((i / (vals.length - 1)) * 300).toFixed(1)},${(52 - ((v - lo) / (hi - lo || 1)) * 44).toFixed(1)}`);
  const line = 'M' + xy.join(' L');
  return (
    <svg className="spark" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L300,56 L0,56 Z`} className="spark-area" />
      <path d={line} className="spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Revenue({ charts, range }: { charts: RevenueChart[]; range: (typeof RANGES)[number] }) {
  const by = (id: RevenueChart['chart']) => charts.find((c) => c.chart === id);
  if (charts.length === 0) {
    return (
      <div className="card tile-wide">
        <div className="h2">Revenue</div>
        <p className="muted">Shows here within the hour once the RevenueCat key and project are set in the Convex environment.</p>
      </div>
    );
  }
  const currency = by('revenue')?.currency ?? by('mrr')?.currency ?? 'USD';
  const now = Date.now();
  const from = range.days === null ? 0 : now - range.days * DAY_MS;

  const revenue = series(by('revenue'), /revenue|proceeds/i);
  const got = within(revenue, from);
  const before = range.days === null ? [] : within(revenue, from - range.days * DAY_MS, from);
  const delta = before.length && sum(before) > 0 ? Math.round(((sum(got) - sum(before)) / sum(before)) * 100) : null;

  const mrr = within(series(by('mrr'), /mrr/i), from);
  const actives = within(series(by('actives'), /active/i), from);

  const moves = by('actives_movement');
  const joined = within(series(moves, /new/i, 0), from);
  const left = within(series(moves, /churn|cancel|expir/i, 1), from).map((p) => ({ t: p.t, v: Math.abs(p.v) }));
  // Days for a week; weeks for anything longer.
  const step = range.id === 'week' ? DAY_MS : 7 * DAY_MS;
  const start = joined[0]?.t ?? from;
  const buckets = new Map<number, { up: number; down: number }>();
  const add = (p: Pt, k: 'up' | 'down') => {
    const b = start + Math.floor((p.t - start) / step) * step;
    const cur = buckets.get(b) ?? { up: 0, down: 0 };
    cur[k] += p.v;
    buckets.set(b, cur);
  };
  joined.forEach((p) => add(p, 'up'));
  left.forEach((p) => add(p, 'down'));
  const cols = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-8);
  const top = Math.max(1, ...cols.map(([, c]) => Math.max(c.up, c.down)));
  const net = sum(joined) - sum(left);
  const last = (pts: Pt[]) => pts[pts.length - 1]?.v ?? 0;
  const fromLabel = got[0] ? shortDate(got[0].t) : '';

  return (
    <>
      <div className="card tile">
        <div className="tile-head"><span className="tile-label">You get</span><span className="source">RevenueCat</span></div>
        <div className="tile-value">
          <span className="big-num">{money(sum(got), currency)}</span>
          {delta !== null && <span className={`chip ${delta >= 0 ? 'good' : 'bad'}`}>{delta >= 0 ? '+' : '−'}{Math.abs(delta)}% on the {range.days} days before</span>}
        </div>
        <div className="lbl">{range.line}, after VAT and Apple’s cut</div>
        <Spark pts={got} floor={0} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile">
        <div className="tile-head"><span className="tile-label">Monthly recurring</span><span className="source">RevenueCat</span></div>
        <div className="tile-value"><span className="big-num">{money(last(mrr), currency)}</span></div>
        <div className="lbl">what Pro brings in a month if nobody cancels</div>
        <Spark pts={mrr} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile">
        <div className="tile-head"><span className="tile-label">People on Pro</span><span className="source">RevenueCat</span></div>
        <div className="tile-value"><span className="big-num">{count(last(actives))}</span></div>
        <div className="lbl">paying for Pro right now</div>
        <Spark pts={actives} />
        <div className="axis"><span>{fromLabel}</span><span>Today</span></div>
      </div>
      <div className="card tile">
        <div className="tile-head"><span className="tile-label">Joined and cancelled</span><span className="source">RevenueCat</span></div>
        <div className="tile-value"><span className="big-num">{net >= 0 ? '+' : '−'}{Math.abs(net)}</span><span className="lbl">on Pro, {range.line}</span></div>
        <div className="legend">
          <span><i className="key up" /><b>{sum(joined)}</b> joined</span>
          <span><i className="key down" /><b>{sum(left)}</b> cancelled</span>
        </div>
        <div className="moves" aria-hidden="true">
          {cols.map(([t, c]) => (
            <div key={t} className="move">
              <div className="move-up"><div style={{ height: `${(c.up / top) * 40}px` }} /></div>
              <div className="move-zero" />
              <div className="move-down"><div style={{ height: `${(c.down / top) * 22}px` }} /></div>
              <div className="move-label">{range.id === 'week' ? new Date(t).toLocaleDateString('en-GB', { weekday: 'short' }) : shortDate(t)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function OverviewPage() {
  const data = useQuery(api.admin.overview) as Overview | undefined;
  const [range, setRange] = useState<Range>('life');
  const r = RANGES.find((x) => x.id === range)!;

  const todo = data ? [
    { count: data.reported.count, title: 'Numbers reported not working', sub: `${data.reported.since24h} since yesterday`, go: 'Review', href: '#/numbers' },
    { count: data.ideas.noStatus, title: 'Ideas with no status', sub: 'Planned shows in the app', go: 'Sort', href: '#/ideas' },
    { count: data.feedback.lastWeek, title: 'New feedback', sub: data.feedback.total ? 'In the last 7 days' : 'Nothing sent yet', go: 'Read', href: '#/feedback' },
    { count: data.ideas.hiddenByReports, title: 'Ideas hidden by reports', sub: 'Three reports hide one', go: 'Check', href: '#/ideas/hidden' },
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
          </section>
          <section className="overview-bottom">
            <div className="card">
              <div className="h2">Latest in the app</div>
              <div className="rows">
                {data.activity.length === 0 && <p className="muted">Nothing yet.</p>}
                {data.activity.map((a, i) => (
                  <div key={i} className="row activity">
                    <i className={`dot ${a.kind}`} />
                    <div className="grow"><div className="clamp">{a.text}</div><div className="lbl">{when(a.at)}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><div className="h2">Top ideas</div><a href="#/ideas">All {data.ideas.total}</a></div>
              <div className="rows">
                {data.ideas.top.map((i) => (
                  <div key={i.id} className="row">
                    <div className="votes">{i.votes}</div>
                    <div className="grow ellipsis">{i.text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="h2">Server usage</div>
              <p className="muted">Function calls, database size and data sent are on the Convex dashboard, under Usage.</p>
              <a className="go inline" href="https://dashboard.convex.dev" target="_blank" rel="noreferrer">Open Convex ↗</a>
            </div>
          </section>
        </>
      )}
    </>
  );
}
