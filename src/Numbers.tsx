import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';

import { api, type Reported } from './api';
import { Dialog, messageOf } from './Dialog';
import { when } from './format';

export function NumbersPage() {
  const rows = useQuery(api.admin.notWorking) as Reported[] | undefined;
  const edit = useMutation(api.admin.editNumber);
  const clear = useMutation(api.admin.clearNumber);
  const [editing, setEditing] = useState<Reported | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Not working</h1>
          <div className="sub">{rows ? `${rows.length} number${rows.length === 1 ? '' : 's'} people pressed “Not working” on · ${rows.filter((r) => r.lastReportedAt > Date.now() - 86_400_000).length} in the last day` : 'Numbers people pressed “Not working” on'}</div>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!rows ? <div className="loading" aria-busy="true" /> : (
        <div className="card table">
          {rows.length === 0 && <div className="empty"><div className="h2">Nothing reported</div><p className="muted">Numbers marked as not working show here.</p></div>}
          {rows.map((r) => (
            <div key={r.entryId} className="num-row">
              <span className="chip bad">{r.count} report{r.count === 1 ? '' : 's'}</span>
              <div className="grow">
                <div>{r.name} <span className="muted">at {r.hospital}</span></div>
                <div className="lbl"><span className="mono">{r.value}</span> · last reported {when(r.lastReportedAt)}</div>
              </div>
              <div className="actions">
                <button className="ghost" onClick={() => { setError(null); setEditing(r); }}>Edit number</button>
                <button className="ghost" onClick={() => {
                  if (!confirm(`Clear the reports on ${r.name}? It shows as working again in the app.`)) return;
                  setError(null);
                  clear({ entryId: r.entryId }).catch((e) => setError(messageOf(e)));
                }}>Clear</button>
              </div>
            </div>
          ))}
          {rows.length > 0 && <p className="lbl list-note">Clear if the number works: the reports go and it shows as working again. Edit number if it has changed: the old one stays in its history.</p>}
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
