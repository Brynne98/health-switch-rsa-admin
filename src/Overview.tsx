import { useQuery } from 'convex/react';
import { useState, type ReactNode } from 'react';

import { api, type Overview, type RevenueChart } from './api';
import { count, DAY_MS, longToday, money, shortDate, time, when } from './format';

type Pt = { t: number; v: number; incomplete?: boolean };

/** One measure of a chart as dated points, oldest first; its total, or one segment's share of a split chart. RevenueCat dates are in seconds. */
function series(chart: RevenueChart | undefined, match: RegExp, fallback = 0, segment?: string): Pt[] {
  if (!chart) return [];
  const found = chart.measures.findIndex((m) => match.test(m.name));
  const m = found < 0 ? fallback : found;
  const s = segment === undefined ? undefined : chart.segments?.indexOf(segment) ?? -1;
  return chart.points
    .filter((p) => p.m === m && p.s === s)
    .map((p) => ({ t: p.t < 1e12 ? p.t * 1000 : p.t, v: p.v, incomplete: p.incomplete }))
    .sort((a, b) => a.t - b.t);
}

const sum = (pts: { v: number }[]) => pts.reduce((n, p) => n + p.v, 0);
const last = (pts: Pt[]) => pts[pts.length - 1]?.v ?? 0;
const DAYS = 30;

/** A day written as "2026-10-08", read at noon UTC so no time zone moves it to another date. */
const noon = (day: string) => Date.parse(`${day}T12:00:00Z`);
const longDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** The last 30 days to yesterday on Apple's clock, which runs behind South Africa's. */
function appleDays() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  return Array.from({ length: DAYS }, (_, k) => isoDay(noon(today) - (DAYS - k) * DAY_MS));
}

/** Whole dollars once there is room to lose the cents. */
const short = (n: number, currency: string) =>
  n >= 10 ? new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n) : money(n, currency);

type Day = { t: number; up: number; down: number; wait: boolean };

/**
 * One bar a day, the first measure up from the line and the second down.
 * The legend holds each side's total and hides that side when tapped. Pointing
 * at a day, or tapping it on a phone, opens its card beside the bar.
 */
function Mirror({ days, names, card, label, height = 230 }: {
  days: Day[]; names: [string, string]; card: (i: number) => ReactNode; label: string; height?: number;
}) {
  const [show, setShow] = useState([true, true]);
  const [at, setAt] = useState<number | null>(null);
  const W = 680, padB = 4, top = 10, n = days.length;
  const val = (d: Day, side: 0 | 1) => (show[side] ? (side ? d.down : d.up) : 0);
  const maxU = Math.max(1, ...days.map((d) => val(d, 0))), maxD = Math.max(1, ...days.map((d) => val(d, 1)));
  const plotH = height - top - padB, span = maxU + maxD, zero = top + plotH * (maxU / span), y = (v: number) => (v / span) * plotH;
  const bw = W / n, gap = Math.max(2, bw * 0.25), w = bw - gap;
  const step = maxU <= 4 ? 1 : maxU <= 25 ? 5 : 10 * Math.ceil(maxU / 40);
  const ticks = Array.from({ length: Math.floor(maxU / step) }, (_, k) => (k + 1) * step);
  const done = days.filter((d) => !d.wait);
  const totals = [sum(done.map((d) => ({ v: d.up }))), sum(done.map((d) => ({ v: d.down })))];
  // A bar with its far end rounded; up grows from the line, down hangs from it.
  const bar = (x: number, h: number, up: boolean) => {
    if (h <= 0) return '';
    const r = Math.min(3, w / 2, h), y0 = up ? zero - 1 : zero + 1, s = up ? -1 : 1;
    return `M${x},${y0} v${s * (h - r)} q0,${s * r} ${r},${s * r} h${w - 2 * r} q${r},0 ${r},${-s * r} v${-s * (h - r)} z`;
  };
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    setAt(i >= 0 && i < n ? i : null);
  };
  const key = (e: React.KeyboardEvent) => {
    const s = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (s) { e.preventDefault(); setAt((i) => Math.min(n - 1, Math.max(0, (i ?? n) + s))); }
  };
  const left = at === null ? 0 : ((at + 0.5) / n) * 100;
  return (
    <>
      <div className="legend-buttons">
        {names.map((name, side) => (
          <button key={name} aria-pressed={show[side]} onClick={() => setShow((s) => s.map((v, k) => (k === side ? !v : v)))}>
            <i className={`key ${side ? 'down' : 'up'}`} />{name} <b>{count(totals[side])}</b>
          </button>
        ))}
      </div>
      <div className="mirror">
        {[0, ...ticks].map((v) => <span key={v} className="y-label" style={{ top: zero - y(v) }}>{v}</span>)}
        <div
          className="plot" tabIndex={0} aria-label={`${label}: use the arrow keys to read each day`}
          onPointerDown={pick} onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAt(null); }}
          onFocus={() => setAt((i) => i ?? n - 1)} onBlur={() => setAt(null)} onKeyDown={key}
        >
          {/* Stretched to the card's width; the labels are plain text beside it so they keep their size on a phone. */}
          <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
            {ticks.map((v) => <line key={v} className="grid" x1={0} x2={W} y1={zero - y(v)} y2={zero - y(v)} />)}
            <line className="zero" x1={0} x2={W} y1={zero} y2={zero} />
            {days.map((d, i) => {
              const x = i * bw + gap / 2;
              return (
                <g key={d.t} className={at === null || at === i ? '' : 'dim'}>
                  {d.wait
                    ? <rect className="waiting" x={x} y={zero - y(maxU / 2)} width={w} height={y(maxU / 2)} rx={2} vectorEffect="non-scaling-stroke" />
                    : <><path className="up" d={bar(x, y(val(d, 0)), true)} /><path className="down" d={bar(x, y(val(d, 1)), false)} /></>}
                </g>
              );
            })}
          </svg>
          <div className="x-labels">
            {days.map((d, i) => (n - 1 - i) % 7 === 0 && (
              // The last label ends at the edge rather than running past it.
            <span key={d.t} style={i === n - 1 ? { right: 0 } : { left: `${((i + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' }}>{shortDate(d.t)}</span>
            ))}
          </div>
          {at !== null && (
            <div className={`tip ${left > 50 ? 'flip' : ''}`} style={{ left: `${left}%` }} role="status">
              <b>{longDate(days[at].t)}</b>
              {days[at].wait ? <span>Not in from the store yet. Usually arrives in 1 to 2 days.</span> : card(at)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Downloads and uninstalls from the stores' own reports (HSR-119). Android shows once it has data. */
function Downloads({ data }: { data: Overview }) {
  const rows = data.storeDays;
  const android = rows.some((r) => r.store === 'android' && r.downloads !== null);
  const got = (store: 'ios' | 'android', day: string) => rows.find((r) => r.store === store && r.day === day);
  const latest = rows.filter((r) => r.downloads !== null).map((r) => r.day).sort().pop();
  const days = appleDays().map((day) => {
    const ios = got('ios', day), and = got('android', day);
    const wait = ios?.downloads == null && (!android || and?.downloads == null);
    return {
      t: noon(day), wait, day, ios, and,
      up: (ios?.downloads ?? 0) + (android ? and?.downloads ?? 0 : 0),
      down: (ios?.uninstalls ?? 0) + (android ? and?.uninstalls ?? 0 : 0),
    };
  });
  const line = (name: string, r?: (typeof rows)[number]) => (
    <tr key={name}><td>{name}</td><td>{count(r?.downloads ?? 0)}</td><td>{count(r?.uninstalls ?? 0)}</td></tr>
  );
  return (
    <div className="card wide">
      <div className="h2">Downloads and uninstalls, each day</div>
      {!latest ? (
        <p className="muted">No numbers from the App Store yet. They update once a day; if this stays empty, check the App Store Connect key in Convex.</p>
      ) : (
        <>
          <Mirror
            days={days} names={['Downloads', 'Uninstalls']} label="Downloads and uninstalls"
            card={(i) => {
              const d = days[i];
              return (
                <table>
                  <thead><tr><th /><th>Downloads</th><th>Uninstalls</th></tr></thead>
                  <tbody>
                    {line('iPhone', d.ios)}
                    {android && line('Android', d.and)}
                    {android && <tr className="total"><td>Both</td><td>{count(d.up)}</td><td>{count(d.down)}</td></tr>}
                  </tbody>
                </table>
              );
            }}
          />
          <p className="source">
            {android ? 'App Store and Google Play' : 'App Store'}, up to {shortDate(noon(latest))}. Apple ends each day at midnight US Pacific time, and only counts uninstalls from people who share data with it, so uninstalls read low.
          </p>
        </>
      )}
    </div>
  );
}

/** Pro joins (new and back again) and endings each day, from RevenueCat's movement chart. */
function ProMoves({ charts }: { charts: RevenueChart[] }) {
  const moves = charts.find((c) => c.chart === 'actives_movement');
  const byDay = new Map<number, { up: number; down: number }>();
  const add = (pts: Pt[], k: 'up' | 'down') => pts.forEach((p) => {
    const d = byDay.get(p.t) ?? { up: 0, down: 0 };
    // Ends are net of recoveries, so a day with more restored than lost is negative: nobody left.
    d[k] += Math.max(0, p.v);
    byDay.set(p.t, d);
  });
  add(series(moves, /^new/i, 0), 'up');
  add(series(moves, /resub/i, 1), 'up');
  add(series(moves, /churn/i, 2), 'down');
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const days = Array.from({ length: DAYS }, (_, k) => today - (DAYS - 1 - k) * DAY_MS).map((t) => ({ t, wait: false, ...(byDay.get(t) ?? { up: 0, down: 0 }) }));
  return (
    <div className="card wide">
      <div className="h2">Pro started and ended, each day</div>
      {!moves ? <p className="muted">No data from RevenueCat yet.</p> : (
        <Mirror
          days={days} names={['Started', 'Ended']} label="Pro started and ended" height={150}
          card={(i) => <table><tbody><tr><td>Started</td><td>{days[i].up}</td></tr><tr><td>Ended</td><td>{days[i].down}</td></tr></tbody></table>}
        />
      )}
    </div>
  );
}

/** What Pro brings in each week, the amount on every bar. The week still running is an outline. */
function Weekly({ charts, currency }: { charts: RevenueChart[]; currency: string }) {
  const daily = series(charts.find((c) => c.chart === 'revenue'), /revenue|proceeds/i);
  // Weeks start on Monday.
  const monday = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS;
  const weeks = new Map<number, number>();
  daily.forEach((p) => weeks.set(monday(p.t), (weeks.get(monday(p.t)) ?? 0) + p.v));
  const cols = [...weeks].sort((a, b) => a[0] - b[0]).slice(-9);
  const now = monday(Date.parse(new Date().toISOString().slice(0, 10)));
  const fourWeeks = sum(daily.filter((p) => p.t >= now - 28 * DAY_MS && p.t < now));
  const W = 330, h = 150, padB = 18, top = 16, max = Math.max(1, ...cols.map((c) => c[1]));
  const bw = W / Math.max(cols.length, 1), gap = bw * 0.3, w = bw - gap;
  return (
    <div className="card">
      <div className="tile-label">You get, each week</div>
      <div className="big-num">{money(fourWeeks, currency)}</div>
      <div className="lbl">last 4 weeks, after VAT and Apple’s cut</div>
      <svg className="weekly" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={cols.map(([t, v]) => `week of ${shortDate(t)}: ${money(v, currency)}`).join(', ')}>
        <line className="zero" x1={0} x2={W} y1={h - padB} y2={h - padB} />
        {cols.map(([t, v], i) => {
          const x = i * bw + gap / 2, hh = (v / max) * (h - padB - top), running = t === now;
          return (
            <g key={t}>
              <rect className={running ? 'running' : 'up'} x={x} y={h - padB - hh - 1} width={w} height={Math.max(hh, running ? 1 : 0)} rx={2} />
              {v > 0 && <text className="val" x={x + w / 2} y={h - padB - hh - 5} textAnchor="middle">{short(v, currency)}</text>}
              {(i % 2 === 0 || running) && <text x={x + w / 2} y={h - 2} textAnchor="middle">{shortDate(t)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Pro({ charts, currency }: { charts: RevenueChart[]; currency: string }) {
  const by = (id: RevenueChart['chart']) => charts.find((c) => c.chart === id);
  const plan = (id: 'mrr' | 'actives', match: RegExp, p?: string) => last(series(by(id), match, 0, p));
  const monthly = plan('actives', /active/i, 'P1M'), yearly = plan('actives', /active/i, 'P1Y');
  return (
    <div className="card">
      <div className="tile-label">People on Pro</div>
      <div className="big-num">{count(plan('actives', /active/i))}</div>
      <div className="plan-split" aria-hidden="true">
        <div className="up" style={{ flex: monthly || 0.0001 }} /><div className="up soft" style={{ flex: yearly || 0.0001 }} />
      </div>
      <div className="legend">
        <span><i className="key up" />{count(monthly)} monthly</span>
        <span><i className="key up soft" />{count(yearly)} yearly</span>
      </div>
      <div className="lbl gap"><b className="ink">{money(plan('mrr', /mrr/i), currency)}</b> a month if nobody cancels</div>
    </div>
  );
}

/** Downloads in the last 30 days, how many of those phones opened the app, and how many started Pro. */
function Funnel({ data }: { data: Overview }) {
  const android = data.storeDays.some((r) => r.store === 'android' && r.downloads !== null);
  const days = new Set(appleDays());
  const from = noon([...days][0]);
  const downloads = data.storeDays.filter((r) => days.has(r.day) && (android || r.store === 'ios')).reduce((n, r) => n + (r.downloads ?? 0), 0);
  const fresh = data.revenue.find((c) => c.chart === 'customers_new');
  // RevenueCat sees a phone the first time the app opens; the same stores as the downloads.
  const opened = sum(series(fresh, /new/i, 0, 'iOS').filter((p) => p.t >= from)) + (android ? sum(series(fresh, /new/i, 0, 'Android').filter((p) => p.t >= from)) : 0);
  const pro = sum(series(data.revenue.find((c) => c.chart === 'actives_movement'), /^new/i, 0).filter((p) => p.t >= from));
  const steps: [string, number][] = [['Downloaded', downloads], ['Opened the app', opened], ['Started Pro', pro]];
  const top = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <div className="card">
      <div className="tile-label">From download to Pro, last 30 days</div>
      <div className="funnel">
        {steps.map(([name, v]) => (
          <div key={name} className="step"><span>{name}</span><div className="bar" style={{ width: `${Math.max(2, (v / top) * 100)}%` }} /><span className="big-num">{count(v)}</span></div>
        ))}
      </div>
      {downloads > 0 && pro > 0 && <div className="lbl">1 in {Math.round(downloads / pro)} downloads goes Pro</div>}
    </div>
  );
}

const KIND: Record<Overview['activity'][number]['kind'], [string, string]> = {
  notWorking: ['Not working', 'bad'], edit: ['Edit', ''], idea: ['Idea', ''], feedback: ['Feedback', ''], proJoin: ['Pro', 'good'], proEnd: ['Left Pro', ''],
};

function Latest({ activity }: { activity: Overview['activity'] }) {
  const groups: { day: string; items: Overview['activity'] }[] = [];
  for (const a of activity) {
    const day = shortDate(a.at);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(a);
  }
  return (
    <div className="card">
      <div className="tile-label">Latest in the app</div>
      {activity.length === 0 && <p className="muted">Nothing yet.</p>}
      {groups.map((g) => (
        <div key={g.day} className="feed">
          <div className="feed-day">{g.day}</div>
          {g.items.map((a, i) => (
            <div key={i} className="feed-row">
              <span className={`chip ${KIND[a.kind][1] || 'quiet'}`}>{KIND[a.kind][0]}</span>
              <span className="clamp">{a.text}{!a.day && <span className="lbl"> · {time(a.at)}</span>}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function OverviewPage() {
  const data = useQuery(api.admin.overview) as Overview | undefined;
  const todo = data ? [
    { count: data.reported.count, title: 'numbers not working', go: 'Review', href: '#/numbers' },
    { count: data.ideas.noStatus, title: 'ideas with no status', go: 'Review', href: '#/ideas' },
    { count: data.feedback.lastWeek, title: 'new feedback this week', go: 'Read', href: '#/feedback' },
    { count: data.ideas.hiddenByReports, title: 'ideas hidden by flags', go: 'Check', href: '#/ideas/hidden' },
  ] : [];
  const charts = data?.revenue ?? [];
  const currency = charts.find((c) => c.currency)?.currency ?? 'USD';
  const updated = charts.length ? Math.max(...charts.map((c) => c.fetchedAt)) : 0;
  // The job runs hourly, so two hours without an update means it has stopped.
  const stale = updated > 0 && Date.now() - updated > 2 * 60 * 60 * 1000;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">{longToday()}{data && ` · ${count(data.numbers)} numbers in ${data.hospitals} hospitals`}</div>
        </div>
      </header>
      {!data ? <div className="loading" aria-busy="true" /> : (
        <div className="overview">
          <div className="card wide">
            <div className="tile-label">Waiting on you</div>
            <div className="waiting-strip">
              {todo.map((t) => (
                <div key={t.title} className={`waiting-item ${t.count ? 'hot' : ''}`}>
                  <div className="big-num">{t.count}</div>
                  <div className="lbl">{t.title}</div>
                  {t.count > 0 && <a href={t.href}>{t.go}</a>}
                </div>
              ))}
            </div>
          </div>
          {charts.length === 0 ? (
            <div className="card wide">
              <div className="h2">Revenue</div>
              <p className="muted">No data from RevenueCat yet. It updates every hour; if it stays empty, check the key and project in the Convex environment.</p>
            </div>
          ) : (
            <>
              <Weekly charts={charts} currency={currency} />
              <Pro charts={charts} currency={currency} />
            </>
          )}
          <Downloads data={data} />
          <ProMoves charts={charts} />
          <Funnel data={data} />
          <Latest activity={data.activity} />
          {updated > 0 && (
            <p className={`source wide ${stale ? 'stale' : ''}`}>
              Money and Pro from RevenueCat, in {currency === 'USD' ? 'US dollars' : currency} · {stale ? `not updated since ${when(updated)}: check the hourly job in Convex` : `updated ${when(updated)}`}
            </p>
          )}
        </div>
      )}
    </>
  );
}
