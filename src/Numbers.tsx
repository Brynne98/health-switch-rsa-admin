import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import { api, type NumberRow, type Numbers } from './api';
import { Icon } from './App';
import { Dialog, messageOf } from './Dialog';
import { when } from './format';

const TABS = {
  added: { label: 'Added', empty: ['None added from a phone', 'A number someone adds in the app goes live at once and shows here.'] },
  reported: { label: 'Reported', empty: ['Nothing reported', 'Numbers marked as not working show here.'] },
  removed: { label: 'Removed', empty: ['Nothing removed', 'Numbers you remove show here.'] },
} as const;
type Tab = keyof typeof TABS;

const NOTES: Record<Tab, string> = {
  added: 'Tap a full number to call it. In ⋯, Edit number changes it for everyone and keeps the old one in its history; Remove takes it off every phone, for good.',
  reported: 'Tap a full number to call it. In ⋯, It works clears the reports and shows it as working again; Edit number changes it for everyone and keeps the old one in its history.',
  removed: 'Removed numbers are gone from the app for everyone. A phone drops its copy the next time the app is opened.',
};

export function NumbersPage({ filter }: { filter: string }) {
  const data = useQuery(api.admin.numbers) as Numbers | undefined;
  const edit = useMutation(api.admin.editNumber);
  const clear = useMutation(api.admin.clearNumber);
  const remove = useMutation(api.admin.removeNumber);
  const [tab, setTab] = useState<Tab>(filter in TABS ? (filter as Tab) : 'added');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<NumberRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);

  useEffect(() => {
    if (menu === null) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('.menu-wrap')) setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menu]);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const rows = (data?.[tab] ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.hospital.toLowerCase().includes(q) || (digits && r.value.includes(digits)));
  const today = data ? data.added.filter((r) => r.addedAt! > Date.now() - 86_400_000).length : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Numbers</h1>
          <div className="sub">{data ? `${data.added.length} added from phones${today ? ` · ${today} in the last 24 hours` : ''} · ${data.reported.length} reported not working` : 'Numbers added and reported from phones'}</div>
        </div>
      </header>
      <div className="seg tabs" role="group" aria-label="Filter">
        {(Object.keys(TABS) as Tab[]).map((k) => {
          const n = data?.[k].length ?? 0;
          return <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setMenu(null); }}>{TABS[k].label}{n > 0 && <span className="muted"> {n}</span>}</button>;
        })}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!data ? <div className="loading" aria-busy="true" /> : (
        <div className="card table">
          <div className="search-wrap">
            <label className="search">
              <Icon size={18}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
              <input type="search" placeholder="Search name, hospital or number" aria-label="Search numbers" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          {rows.length > 0 && (
            <div className="num-row head" aria-hidden="true">
              <div className="th">Number</div><div className="th">Hospital</div><div className="th">Dials</div><div className="th">Reports</div>
              <div className="th">{tab === 'added' ? 'Added' : tab === 'removed' ? 'Removed' : 'Last report'}</div><div />
            </div>
          )}
          {rows.map((r) => (
            <div key={r.entryId} className="num-row">
              <b className="cell-name">{r.name}</b>
              <div className="cell-hospital muted">{r.hospital}</div>
              {/* Only a full number can be called; a 4-digit extension needs the switchboard first. */}
              {r.value.replace(/\D/g, '').length >= 9 && tab !== 'removed'
                ? <a className="cell-dial mono" href={`tel:${r.value}`} title="Call it">{r.value}</a>
                : <div className="cell-dial mono">{r.value}</div>}
              <div className="cell-count">{r.count > 0 && <span className="chip bad">{r.count} report{r.count === 1 ? '' : 's'}</span>}</div>
              <div className="cell-last muted">
                {tab === 'added' ? when(r.addedAt!)
                  : tab === 'removed' ? when(r.removedAt!)
                  : r.lastReportedAt !== null && when(r.lastReportedAt)}
              </div>
              <div className="actions">
                {tab !== 'removed' && (
                  <div className="menu-wrap">
                    <button className="more" aria-label="More actions" aria-expanded={menu === r.entryId} onClick={() => setMenu(menu === r.entryId ? null : r.entryId)}>
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                    </button>
                    {menu === r.entryId && (
                      <div className="menu" role="menu">
                        <button role="menuitem" onClick={() => { setMenu(null); setError(null); setEditing(r); }}>Edit number</button>
                        {r.count > 0 && (
                          <button role="menuitem" onClick={() => {
                            setMenu(null);
                            if (!confirm(`Mark ${r.name} as working? The reports go and it shows as working again in the app.`)) return;
                            setError(null);
                            clear({ entryId: r.entryId }).catch((e) => setError(messageOf(e)));
                          }}>It works</button>
                        )}
                        <hr />
                        <button role="menuitem" className="danger" onClick={() => {
                          setMenu(null);
                          if (!confirm(`Remove ${r.name} (${r.value}) at ${r.hospital} for good? It goes from every phone the next time the app is opened. This can’t be undone.`)) return;
                          setError(null);
                          remove({ entryId: r.entryId }).catch((e) => setError(messageOf(e)));
                        }}>Remove</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="empty">
              <div className="h2">{q ? `Nothing matches “${query.trim()}”` : TABS[tab].empty[0]}</div>
              {!q && <p className="muted">{TABS[tab].empty[1]}</p>}
            </div>
          )}
          {rows.length > 0 && <p className="lbl list-note">{NOTES[tab]}</p>}
        </div>
      )}
      {editing && (
        <Dialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <p className="muted">The old number is kept in its history, and the reports reset.</p>
          <form
            className="idea-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = String(new FormData(e.currentTarget).get('value')).replace(/\s+/g, '');
              const err = e.currentTarget.querySelector('.error') as HTMLElement;
              if (busy) return;
              setBusy(true);
              try { await edit({ entryId: editing.entryId, value }); setEditing(null); } catch (x) { err.textContent = messageOf(x); } finally { setBusy(false); }
            }}
          >
            <fieldset className="plain-set" disabled={busy}>
            <label className="field">
              <span>Number</span>
              <input name="value" defaultValue={editing.value} inputMode="numeric" autoComplete="off" required autoFocus />
            </label>
            <p className="error" role="alert" />
            <div className="actions">
              <button className="primary">Save</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </>
  );
}
