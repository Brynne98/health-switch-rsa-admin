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

/** `up2`: the part of `up` drawn on top in the second colour (Android downloads). */
/** `down2`: the part of `down` drawn lighter, beyond the rest (iPhone uninstalls, a sample only; HSR-179). */
type Day = { t: number; up: number; up2?: number; down: number; down2?: number; wait: boolean };

/**
 * One bar a day, the first measure up from the line and the second down.
 * The legend holds each side's total and hides that side when tapped. Pointing
 * at a day, or tapping it on a phone, opens its card beside the bar.
 */
function Mirror({ days, names, parts, card, label, height = 230, average = false }: {
  days: Day[]; names: [string] | [string, string]; parts?: { label: string; key: string }[]; card: (i: number) => ReactNode; label: string; height?: number;
  /** The legend gives a day's average rather than the total, for counts that cannot be added up across days (HSR-179). */
  average?: boolean;
}) {
  const [show, setShow] = useState([true, true]);
  const [at, setAt] = useState<number | null>(null);
  const W = 680, padB = 4, top = 10, n = days.length;
  // One name: only bars above the line, using the whole height (HSR-174).
  const two = names.length > 1;
  const val = (d: Day, side: 0 | 1) => (show[side] ? (side ? (two ? d.down : 0) : d.up) : 0);
  const maxU = Math.max(1, ...days.map((d) => val(d, 0))), maxD = two ? Math.max(1, ...days.map((d) => val(d, 1))) : 0;
  const plotH = height - top - padB, span = maxU + maxD, zero = top + plotH * (maxU / span), y = (v: number) => (v / span) * plotH;
  const bw = W / n, gap = Math.max(2, bw * 0.25), w = bw - gap;
  const step = maxU <= 4 ? 1 : maxU <= 25 ? 5 : 10 * Math.ceil(maxU / 40);
  const ticks = Array.from({ length: Math.floor(maxU / step) }, (_, k) => (k + 1) * step);
  const done = days.filter((d) => !d.wait);
  const totals = [sum(done.map((d) => ({ v: d.up }))), sum(done.map((d) => ({ v: d.down })))];
  // A bar with its far end rounded; up grows from the line, down hangs from it.
  // `from` lifts a bar to sit on another; `round: false` leaves its far end square for one to sit on it.
  const bar = (x: number, h: number, up: boolean, from = 0, round = true) => {
    if (h <= 0) return '';
    const r = round ? Math.min(3, w / 2, h) : 0, y0 = up ? zero - 1 - from : zero + 1 + from, s = up ? -1 : 1;
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
            <i className={`key ${side ? 'down' : 'up'}`} />{name}{' '}
            {average ? <><b>{count(Math.round(totals[side] / Math.max(1, done.filter((d) => d.up > 0).length)))}</b> a day</> : <b>{count(totals[side])}</b>}
          </button>
        ))}
        {parts && (
          <span className="legend parts">
            {parts.map((p) => <span key={p.label}><i className={`key ${p.key}`} />{p.label}</span>)}
          </span>
        )}
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
                    : <>
                      {(() => {
                        const top = show[0] ? d.up2 ?? 0 : 0, low = val(d, 0) - top;
                        return <><path className="up" d={bar(x, y(low), true, 0, top <= 0)} /><path className="up2" d={bar(x, y(top), true, y(low))} /></>;
                      })()}
                      {(() => {
                        const light = show[1] ? d.down2 ?? 0 : 0, solid = val(d, 1) - light;
                        return <><path className="down" d={bar(x, y(solid), false, 0, light <= 0)} /><path className="down2" d={bar(x, y(light), false, y(solid))} /></>;
                      })()}
                    </>}
                </g>
              );
            })}
          </svg>
          <div className="x-labels">
            {days.map((d, i) => (n - 1 - i) % 7 === 0 && (
              // The last label ends at the edge rather than running past it.
            <span key={d.t} className={i === n - 8 ? 'near-end' : undefined} style={i === n - 1 ? { right: 0 } : { left: `${((i + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' }}>{shortDate(d.t)}</span>
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
  const counted = rows.filter((r) => r.downloads !== null);
  const latest = counted.map((r) => r.day).sort().pop();
  // Apple's reports land 1 to 2 days late, so the daily job gets 3 days before it reads as stopped.
  const stale = staleDays(counted, 3);
  const days = appleDays().map((day) => {
    const ios = got('ios', day), and = got('android', day);
    // Downloads and uninstalls come from separate reports; a day waits only while neither is in.
    const none = (r?: (typeof rows)[number]) => r?.downloads == null && r?.uninstalls == null;
    const wait = none(ios) && (!android || none(and));
    return {
      t: noon(day), wait, day, ios, and,
      up: (ios?.downloads ?? 0) + (android ? and?.downloads ?? 0 : 0),
      up2: android ? and?.downloads ?? 0 : 0,
      down: (ios?.uninstalls ?? 0) + (android ? and?.uninstalls ?? 0 : 0),
      // Apple only counts people who share data with it, so its part is drawn lighter (HSR-179).
      down2: ios?.uninstalls ?? 0,
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
            parts={[
              { label: 'iPhone', key: 'up' }, ...(android ? [{ label: 'Android', key: 'up2' }] : []),
              { label: 'iPhone uninstalls, partial count', key: 'down2' },
            ]}
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
          <p className={`source ${stale ? 'stale' : ''}`}>
            {android ? 'App Store and Google Play' : 'App Store'}, up to {shortDate(noon(latest))}. Apple ends each day at midnight US Pacific time, and counts iPhone uninstalls only from people who share data with it, so the lighter part reads low. Google counts every Android uninstall.{stale}
          </p>
        </>
      )}
    </div>
  );
}

/** The last 30 whole UTC days, to yesterday: the daily job runs just after midnight UTC. */
const utcDays = () => Array.from({ length: DAYS }, (_, k) => isoDay(noon(isoDay(Date.now())) - (DAYS - k) * DAY_MS));

/** The stores' reports land days late, so their chart goes by the newest day with numbers, after `grace` days. */
function staleDays(rows: { day: string }[], grace: number) {
  const latest = rows.map((r) => r.day).sort().pop() ?? '';
  return latest < isoDay(Date.now() - (1 + grace) * DAY_MS) ? ` Nothing newer than ${shortDate(noon(latest))}: check the daily job in Convex.` : '';
}

/**
 * A day with no row draws as 0, so a job that has stopped would read as a quiet app. The job runs every day,
 * so a source that has not written for 26 hours has stopped (HSR-172). Each source stamps its own time.
 */
function staleNote(stamps: (number | null)[]) {
  const last = Math.max(0, ...stamps.map((s) => s ?? 0));
  return last && last < Date.now() - 26 * 3_600_000 ? ` Not updated since ${when(last)}: check the daily job in Convex.` : '';
}

/** People using the live app each day, and searches that found nothing, from PostHog (HSR-144). */
function Usage({ data }: { data: Overview }) {
  const rows = data.usageDays.filter((r) => r.users !== null);
  const got = (day: string) => rows.find((r) => r.day === day);
  const stale = staleNote(rows.map((r) => r.posthogAt));
  const days = utcDays().map((day) => {
    const r = got(day);
    return { t: noon(day), wait: false, r, up: r?.users ?? 0, down: 0 };
  });
  return (
    <div className="card wide">
      <div className="h2">People using the app, each day</div>
      {!rows.length ? (
        <p className="muted">No numbers from PostHog yet. They update once a day; if this stays empty, check POSTHOG_API_KEY in Convex.</p>
      ) : (
        <>
          <Mirror
            days={days} names={['People']} label="People using the app" average
            card={(i) => {
              const r = days[i].r;
              return (
                <table><tbody>
                  <tr><td>People</td><td>{count(r?.users ?? 0)}</td></tr>
                  <tr><td>Numbers dialled</td><td>{count(r?.dialled ?? 0)}</td></tr>
                  <tr><td>Numbers copied</td><td>{count(r?.copied ?? 0)}</td></tr>
                  <tr><td>Numbers shared</td><td>{count(r?.shared ?? 0)}</td></tr>
                  <tr><td>Searches that found nothing</td><td>{count(r?.noResults ?? 0)}</td></tr>
                </tbody></table>
              );
            }}
          />
          <p className={`source ${stale ? 'stale' : ''}`}>PostHog, live app only. People is the average a day over these 30 days. Days end at midnight UTC.{stale}</p>
        </>
      )}
    </div>
  );
}

/** Errors the app caught and errors it did not catch, each day, and the issues that happen most, from Sentry (HSR-144). */
function Errors({ data }: { data: Overview }) {
  const rows = data.usageDays.filter((r) => r.errors !== null);
  const got = (day: string) => rows.find((r) => r.day === day);
  const stale = staleNote(rows.map((r) => r.sentryAt));
  // Sentry's errors include the uncaught ones; the up side is only the rest, so a day's bar adds to its total.
  const days = utcDays().map((day) => {
    const r = got(day), crashes = r?.crashes ?? 0;
    return { t: noon(day), wait: false, up: (r?.errors ?? 0) - crashes, down: crashes };
  });
  return (
    <div className="card wide">
      <div className="h2">Errors, each day</div>
      {!rows.length ? (
        <p className="muted">No numbers from Sentry yet. They update once a day; if this stays empty, check SENTRY_AUTH_TOKEN in Convex.</p>
      ) : (
        <>
          <Mirror
            days={days} names={['Caught', 'Not caught']} label="Errors" height={150}
            card={(i) => <table><tbody><tr><td>Caught</td><td>{count(days[i].up)}</td></tr><tr><td>Not caught</td><td>{count(days[i].down)}</td></tr></tbody></table>}
          />
          {data.errorIssues.length > 0 && (
            <>
              <div className="tile-label" style={{ marginTop: 14 }}>Happens most, last 30 days</div>
              <div className="feed">
                {data.errorIssues.map((i) => (
                  <div key={i.url} className="feed-row">
                    <span className="chip quiet">{count(i.events)}×</span>
                    <span className="clamp">
                      <a href={i.url} target="_blank" rel="noreferrer">{i.title}</a>
                      <span className="lbl"> · {i.people === 1 ? '1 person' : `${count(i.people)} people`} · last seen {shortDate(i.lastSeen).replace(/^(Today|Yesterday)$/, (w) => w.toLowerCase())}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className={`source ${stale ? 'stale' : ''}`}>Sentry, production only. Caught: the app handled the error, and iPhone freezes. Not caught: nothing in the app handled it; most close the app, some do not. Days end at midnight UTC.{stale}</p>
        </>
      )}
    </div>
  );
}

const STORE = { ios: 'App Store', android: 'Google Play' } as const;

/** Five stars, the first `n` filled, read out as a number. */
function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((k) => <i key={k} className={k <= Math.round(n) ? 'on' : ''} />)}
    </span>
  );
}

/** Each store's average stars, then the newest written reviews from both (HSR-179). */
function Ratings({ data }: { data: Overview }) {
  const of = (store: 'ios' | 'android') => data.ratings.find((r) => r.store === store);
  return (
    <div className="card wide">
      <div className="rating-stores">
        {(['ios', 'android'] as const).map((store) => {
          const r = of(store);
          return (
            <div key={store}>
              <div className="tile-label">{STORE[store]}</div>
              {r?.average ? (
                <div className="rating-avg">
                  <span className="big-num">{r.average.toFixed(1)}</span><Stars n={r.average} />
                  {r.count !== null && <span className="lbl">{count(r.count)} {r.count === 1 ? 'rating' : 'ratings'}</span>}
                </div>
              ) : <p className="muted">No ratings yet.</p>}
            </div>
          );
        })}
      </div>
      <div className="tile-label" style={{ marginTop: 18 }}>Latest comments</div>
      {data.reviews.length === 0 ? <p className="muted">No written reviews yet.</p> : (
        <div className="feed">
          {data.reviews.map((r, i) => (
            <div key={i} className="review">
              <div className="review-head"><Stars n={r.rating} /><span className="lbl">{STORE[r.store]} · {shortDate(r.at)}</span></div>
              {r.title && <b>{r.title}</b>}
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="source">Apple’s average is the South African store page’s. Google’s comes from its daily report files, 3 to 7 days late, with no count. Ratings without words are not listed as comments.</p>
    </div>
  );
}

/** Clicks on each healthswitch.co.za/get?from= link, then downloads by store, then Pro (HSR-171). */
function Campaigns({ data }: { data: Overview }) {
  const rows = data.campaigns ?? [];
  return (
    <div className="card wide">
      <div className="h2">Links and ads</div>
      {!rows.length ? (
        <p className="muted">No clicks on a healthswitch.co.za/get link yet.</p>
      ) : (
        <>
          <div className="scroll-x">
            <table className="campaigns">
              <thead>
                <tr className="group"><th /><th colSpan={4}>Clicks</th><th colSpan={2}>Downloads</th><th>Pro</th></tr>
                <tr><th>Link</th><th>All</th><th>iPhone</th><th>Android</th><th>Computer</th><th>App Store</th><th>Google Play</th><th>Android</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source}>
                    <td>{r.source}<span className="lbl"> · since {shortDate(noon(r.firstDay))}</span></td>
                    <td>{count(r.clicksIos + r.clicksAndroid + r.clicksOther)}</td>
                    <td>{count(r.clicksIos)}</td>
                    <td>{count(r.clicksAndroid)}</td>
                    <td>{count(r.clicksOther)}</td>
                    <td>{count(r.appleDownloads)}</td>
                    <td>{count(r.androidInstalls)}</td>
                    <td>{count(r.androidPro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="source">
            Clicks from the link itself, test links left out. App Store downloads are Apple’s own count for the link, but only from people who share data with Apple, and Apple leaves out very small counts, so they read low. Play installs and Pro are exact, for Android phones that opened the app on the update that reads the install link.
          </p>
        </>
      )}
    </div>
  );
}

type Week = { t: number; v: number; running: boolean };

/** Monday of a moment's week, at UTC midnight. */
const monday = (t: number) => {
  const d = Date.parse(isoDay(t));
  return d - ((new Date(d).getUTCDay() + 6) % 7) * DAY_MS;
};

/** Points added up by week (Monday start), every week from the first to this one; a week with nothing is 0. */
function byWeek(pts: { t: number; v: number }[]): Week[] {
  const sums = new Map<number, number>();
  pts.forEach((p) => sums.set(monday(p.t), (sums.get(monday(p.t)) ?? 0) + p.v));
  const now = monday(Date.now());
  const out: Week[] = [];
  for (let t = Math.min(now, ...sums.keys()); t <= now; t += 7 * DAY_MS) out.push({ t, v: sums.get(t) ?? 0, running: t === now });
  return out;
}

/**
 * A small bar a week at a tile's foot (HSR-179). The week still running is an outline.
 * Pointing at a bar, or tapping it, shows its week and count; the arrow keys step through.
 */
function WeekBars({ weeks, unit, label }: { weeks: Week[]; unit: (n: number) => string; label: string }) {
  const [at, setAt] = useState<number | null>(null);
  const n = weeks.length, W = 300, H = 56, max = Math.max(1, ...weeks.map((w) => w.v));
  const bw = W / n, gap = Math.min(6, bw * 0.3), w = bw - gap;
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
    <div className="week-bars">
      <div
        className="plot" tabIndex={0} aria-label={`${label}: use the arrow keys to read each week`}
        onPointerDown={pick} onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAt(null); }}
        onFocus={() => setAt((i) => i ?? n - 1)} onBlur={() => setAt(null)} onKeyDown={key}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {weeks.map((wk, i) => {
            const h = wk.v > 0 ? Math.max(2, (wk.v / max) * (H - 1)) : wk.running ? 1 : 0;
            return (
              <rect
                key={wk.t} className={`${wk.running ? 'running' : 'up'} ${at === null || at === i ? '' : 'dim'}`}
                x={i * bw + gap / 2} y={H - h} width={w} height={h} rx={1.5}
              />
            );
          })}
        </svg>
        {at !== null && (
          <div className={`tip ${left > 50 ? 'flip' : ''}`} style={{ left: `${left}%` }} role="status">
            <b>{weeks[at].running ? 'This week' : `Week of ${shortDate(weeks[at].t)}`}</b>
            <span>{unit(weeks[at].v)}{weeks[at].running ? ' so far' : ''}</span>
          </div>
        )}
      </div>
      <div className="week-axis"><span>{shortDate(weeks[0].t)}</span><span>This week</span></div>
    </div>
  );
}

function DownloadsTile({ data }: { data: Overview }) {
  const weeks = byWeek(data.downloadDays.map((d) => ({ t: noon(d.day), v: d.downloads })));
  return (
    <div className="card">
      <div className="tile-label">Downloads since launch</div>
      <div className="big-num">{count(data.downloadsSinceLaunch)}</div>
      <div className="lbl"><b className="ink">{count(lastDays(data).downloads)}</b> in the last 30 days</div>
      <WeekBars weeks={weeks} label="Downloads each week" unit={(v) => (v === 1 ? '1 download' : `${count(v)} downloads`)} />
    </div>
  );
}

/** Everything Pro has brought in since launch, and the 4 whole weeks before this one. */
function Earnings({ charts, currency }: { charts: RevenueChart[]; currency: string }) {
  const daily = series(charts.find((c) => c.chart === 'revenue'), /revenue|proceeds/i);
  const now = monday(Date.now());
  return (
    <div className="card">
      <div className="tile-label">Lifetime earnings</div>
      <div className="big-num">{money(sum(daily), currency)}</div>
      {charts.length === 0 ? <div className="lbl">No data from RevenueCat yet.</div> : (
        <>
          <div className="lbl">since launch, after VAT and the stores’ cut</div>
          <div className="lbl gap"><b className="ink">{money(sum(daily.filter((p) => p.t >= now - 28 * DAY_MS && p.t < now)), currency)}</b> in the last 4 weeks</div>
        </>
      )}
    </div>
  );
}

function Pro({ charts, currency }: { charts: RevenueChart[]; currency: string }) {
  const by = (id: RevenueChart['chart']) => charts.find((c) => c.chart === id);
  const plan = (id: 'mrr' | 'actives', match: RegExp, p?: string) => last(series(by(id), match, 0, p));
  const moves = by('actives_movement');
  // New and back again; both count as joining.
  const joins = byWeek([...series(moves, /^new/i, 0), ...series(moves, /resub/i, 1)].map((p) => ({ t: p.t, v: Math.max(0, p.v) })));
  return (
    <div className="card">
      <div className="tile-label">People on Pro</div>
      <div className="big-num">{count(plan('actives', /active/i))}</div>
      <div className="lbl">{count(plan('actives', /active/i, 'P1M'))} monthly · {count(plan('actives', /active/i, 'P1Y'))} yearly</div>
      <div className="lbl"><b className="ink">{money(plan('mrr', /mrr/i), currency)}</b> a month if nobody cancels</div>
      <WeekBars weeks={joins} label="People joining Pro each week" unit={(v) => `${count(v)} joined`} />
    </div>
  );
}

/** Downloads in the last 30 days, how many of those phones opened the app, and how many started Pro. */
/** Downloads over the chart's 30 days; Android counts once it has data. */
function lastDays(data: Overview) {
  const android = data.storeDays.some((r) => r.store === 'android' && r.downloads !== null);
  const days = new Set(appleDays());
  const downloads = data.storeDays.filter((r) => days.has(r.day) && (android || r.store === 'ios')).reduce((n, r) => n + (r.downloads ?? 0), 0);
  return { android, days, downloads };
}

/** One number with its label and a line under it, for the numbers row (HSR-162, HSR-179). */
function Tile({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="card">
      <div className="tile-label">{label}</div>
      <div className="big-num">{value}</div>
      {children && <div className="lbl">{children}</div>}
    </div>
  );
}

/** Numbers dialled, copied and shared from the app over the last 30 days, from PostHog (HSR-179). */
function Calls({ data }: { data: Overview }) {
  const days = new Set(utcDays());
  const rows = data.usageDays.filter((r) => days.has(r.day));
  const add = (k: 'dialled' | 'copied' | 'shared') => rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  return (
    <Tile label="Numbers used, last 30 days" value={count(add('dialled') + add('copied') + add('shared'))}>
      {count(add('dialled'))} dialled · {count(add('copied'))} copied · {count(add('shared'))} shared
    </Tile>
  );
}

/** Phones that opened the app this week, each once, from RevenueCat's weekly count (HSR-179). */
function ThisWeek({ charts }: { charts: RevenueChart[] }) {
  const weeks = series(charts.find((c) => c.chart === 'customers_active'), /active/i);
  return (
    <Tile label="People this week" value={count(last(weeks))}>
      {weeks.length > 1 ? <><b className="ink">{count(weeks[weeks.length - 2].v)}</b> the week before</> : 'each phone counted once'}
    </Tile>
  );
}

/** People who ever started Pro, out of every download since launch (HSR-179). */
function BecamePro({ data, charts }: { data: Overview; charts: RevenueChart[] }) {
  const joined = sum(series(charts.find((c) => c.chart === 'actives_movement'), /^new/i, 0).map((p) => ({ v: Math.max(0, p.v) })));
  const all = data.downloadsSinceLaunch;
  return (
    <Tile label="Downloads that became Pro" value={`${all ? ((joined / all) * 100).toFixed(1) : 0}%`}>
      {count(joined)} of {count(all)} since launch
    </Tile>
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
              <span className="clamp">{a.kind === 'idea' ? a.text.replace(/^Idea: /, '') : a.text}{!a.day && <span className="lbl"> · {time(a.at)}</span>}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function OverviewPage() {
  const data = useQuery(api.admin.overview) as Overview | undefined;
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
        // Latest runs down the right as its own rail, so no tile stretches to its height (HSR-184).
        <div className="overview-layout">
        <div className="overview">
          <div className="totals wide">
            <DownloadsTile data={data} />
            <Pro charts={charts} currency={currency} />
          </div>
          <div className="numbers wide">
            <Earnings charts={charts} currency={currency} />
            <Calls data={data} />
            <ThisWeek charts={charts} />
            <BecamePro data={data} charts={charts} />
          </div>
          <div className="latest-inline wide"><Latest activity={data.activity} /></div>
          {updated > 0 && (
            <p className={`source wide ${stale ? 'stale' : ''}`}>
              Money and Pro from RevenueCat, in {currency === 'ZAR' ? 'rand' : currency === 'USD' ? 'US dollars' : currency} · {stale ? `not updated since ${when(updated)}: check the hourly job in Convex` : `updated ${when(updated)}`}
            </p>
          )}
          <h2 className="section">Downloads</h2>
          <Downloads data={data} />
          <Campaigns data={data} />
          <h2 className="section">Ratings</h2>
          <Ratings data={data} />
          <h2 className="section">App use and errors</h2>
          <Usage data={data} />
          <Errors data={data} />
        </div>
        <aside className="rail"><Latest activity={data.activity} /></aside>
        </div>
      )}
    </>
  );
}
