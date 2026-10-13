import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import { api, type Hospital } from './api';
import { Icon } from './App';
import { Dialog, messageOf } from './Dialog';
import { count, shortDate, when } from './format';

const TABS = {
  all: { label: 'All', test: (h: Hospital) => h.removedAt === null, empty: ['No hospitals', 'Every hospital in the app shows here.'] },
  reported: { label: 'Reported', test: (h: Hospital) => h.removedAt === null && h.reports > 0, empty: ['Nothing reported', 'A hospital someone reports from the app shows here.'] },
  phones: { label: 'From phones', test: (h: Hospital) => h.removedAt === null && h.fromPhone, empty: ['None added from a phone', 'A hospital someone adds in the app goes live at once and shows here.'] },
  removed: { label: 'Removed', test: (h: Hospital) => h.removedAt !== null, empty: ['Nothing removed', 'Hospitals you remove show here.'] },
} as const;
type Tab = keyof typeof TABS;

const numbers = (n: number) => `${count(n)} number${n === 1 ? '' : 's'}`;

/** Reported first, then the ones phones added, newest first, then by name. Removed: latest first. */
function order(a: Hospital, b: Hospital) {
  if (a.removedAt !== null && b.removedAt !== null) return b.removedAt - a.removedAt;
  return b.reports - a.reports
    || Number(b.fromPhone) - Number(a.fromPhone)
    || (a.fromPhone && b.fromPhone ? b.addedAt - a.addedAt : 0)
    || a.name.localeCompare(b.name);
}

export function HospitalsPage() {
  const all = useQuery(api.admin.hospitals) as Hospital[] | undefined;
  const remove = useMutation(api.admin.removeHospital);
  const clear = useMutation(api.admin.clearHospitalReports);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<Hospital | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const live = (all ?? []).filter(TABS.all.test);
  const q = query.trim().toLowerCase();
  const rows = (all ?? []).filter(TABS[tab].test).filter((h) => !q || h.name.toLowerCase().includes(q)).sort(order);
  const reported = live.filter((h) => h.reports > 0).length;
  const matches = removing !== null && typed.trim().toLowerCase() === removing.name.trim().toLowerCase();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Hospitals</h1>
          <div className="sub">{all ? `${live.length} hospitals · ${numbers(live.reduce((n, h) => n + h.numbers, 0))}${reported ? ` · ${reported} reported` : ''}` : 'Every hospital in the app'}</div>
        </div>
      </header>
      <div className="seg tabs" role="group" aria-label="Filter">
        {(Object.keys(TABS) as Tab[]).map((k) => {
          const n = (all ?? []).filter(TABS[k].test).length;
          return <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{TABS[k].label}{n > 0 && <span className="muted"> {n}</span>}</button>;
        })}
      </div>
      {done && <p className="done" role="status">{done}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!all ? <div className="loading" aria-busy="true" /> : (
        <div className="card table">
          <div className="search-wrap">
            <label className="search">
              <Icon size={18}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
              <input type="search" placeholder="Search hospitals" aria-label="Search hospitals" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {rows.length > 0 && (
            <div className="h-row head" aria-hidden="true">
              <div className="th">Hospital</div><div className="th h-num">Numbers</div><div className="th">Reports</div><div className="th">{tab === 'removed' ? 'Removed' : 'Added'}</div><div />
            </div>
          )}
          {rows.map((h) => (
            <div key={h.id} className="h-row">
              <div className="h-name"><b>{h.name}</b>{h.hiddenInApp && h.removedAt === null && <span className="chip quiet">Not shown in the app</span>}</div>
              <div className="h-meta">
                <div className="h-num mono">{count(h.numbers)}<span className="h-unit"> number{h.numbers === 1 ? '' : 's'}</span></div>
                <div>{h.reports > 0 && <span className="chip bad" title={h.lastReportedAt ? `Last report ${when(h.lastReportedAt)}` : undefined}>{h.reports} report{h.reports === 1 ? '' : 's'}</span>}</div>
                <div className="h-added muted">
                  {h.removedAt !== null ? <><span className="chip bad">Removed</span>{when(h.removedAt)}</>
                    : h.fromPhone ? <><span className="chip new">From a phone</span>{when(h.addedAt)}</>
                    : 'Original list'}
                </div>
              </div>
              <div className="actions">
                {h.removedAt === null && h.reports > 0 && (
                  <button className="ghost" onClick={() => {
                    if (!confirm(`Keep ${h.name}? Its ${h.reports === 1 ? 'report goes' : 'reports go'} and it stays in the app.`)) return;
                    setError(null);
                    clear({ hospitalId: h.id }).catch((e) => setError(messageOf(e)));
                  }}>It’s fine</button>
                )}
                {h.removedAt === null && <button className="ghost danger" onClick={() => { setError(null); setDone(null); setTyped(''); setRemoving(h); }}>Remove</button>}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="empty">
              <div className="h2">{q ? `Nothing matches “${query.trim()}”` : TABS[tab].empty[0]}</div>
              {!q && <p className="muted">{TABS[tab].empty[1]}</p>}
            </div>
          )}
          {rows.length > 0 && (
            <p className="lbl list-note">{tab === 'removed'
              ? 'Removed hospitals are gone from the app for everyone. A phone drops its copy the next time the app is opened. The name can’t be used again.'
              : 'Remove takes a hospital and its numbers off every phone, for good. It’s fine: the reports go and the hospital stays.'}</p>
          )}
        </div>
      )}
      {removing && (
        <Dialog title={`Remove ${removing.name} for good?`} onClose={() => setRemoving(null)}>
          <ul className="plain">
            <li><span className="muted">Hospital</span><b>{removing.name}</b></li>
            <li><span className="muted">Numbers that go with it</span><b>{count(removing.numbers)}</b></li>
            <li><span className="muted">Added</span><span>{removing.fromPhone ? `From a phone, ${when(removing.addedAt)}` : `Original list, ${shortDate(removing.addedAt)}`}</span></li>
          </ul>
          <p>It disappears from <b>every phone</b> the next time the app is opened{removing.numbers > 0 ? `, along with its ${numbers(removing.numbers)}` : ''}. Nobody can find it, edit it or add it again under this name.</p>
          <p className="danger"><b>This can’t be undone.</b></p>
          <form
            className="idea-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const err = e.currentTarget.querySelector('.error') as HTMLElement;
              if (busy || !matches) return;
              setBusy(true);
              err.textContent = '';
              try {
                const gone = await remove({ hospitalId: removing.id, name: removing.name }) as { name: string; numbers: number };
                setDone(`${gone.name}${gone.numbers > 0 ? ` and its ${numbers(gone.numbers)} are` : ' is'} removed. Phones drop ${gone.numbers > 0 ? 'them' : 'it'} the next time the app is opened.`);
                setRemoving(null);
                setTab('removed');
                setQuery('');
              } catch (x) { err.textContent = messageOf(x); } finally { setBusy(false); }
            }}
          >
            <fieldset className="plain-set" disabled={busy}>
              <label className="field">
                <span>Type {removing.name} to confirm</span>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus />
              </label>
              <p className="error" role="alert" />
              <div className="actions stack">
                <button className="primary danger" disabled={!matches}>{removing.numbers > 0 ? `Remove hospital and ${numbers(removing.numbers)}` : 'Remove hospital'}</button>
                <button type="button" className="secondary" onClick={() => setRemoving(null)}>Cancel</button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </>
  );
}
