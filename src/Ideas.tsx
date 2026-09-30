import { useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import { api, type Idea, type Status } from './api';
import { Dialog, IdeaForm, messageOf } from './Dialog';
import { shortDate, when } from './format';

const TABS = {
  all: { label: 'All', test: () => true, empty: ['No ideas yet', 'Ideas people send from the app show here.'] },
  planned: { label: 'Planned', test: (i: Idea) => i.status === 'planned', empty: ['Nothing planned', 'Set an idea’s status to Planned and it shows here, and as Planned in the app.'] },
  done: { label: 'Done', test: (i: Idea) => i.status === 'done', empty: ['Nothing done yet', 'Ideas marked Done show here.'] },
  flagged: { label: 'Flagged', test: (i: Idea) => i.reports > 0, empty: ['Nothing flagged', 'When someone flags an idea in the app it shows here. Three flags hide it.'] },
  hidden: { label: 'Hidden', test: (i: Idea) => i.hidden, empty: ['Nothing hidden', 'Ideas hidden by flags or by you show here.'] },
} as const;
type Tab = keyof typeof TABS;

type Open = { kind: 'new' } | { kind: 'edit'; idea: Idea } | { kind: 'voters'; idea: Idea } | null;

function Voters({ idea }: { idea: Idea }) {
  const rows = useQuery(api.admin.voters, { id: idea.id }) as { name: string | null; at: number }[] | undefined;
  if (!rows) return <div className="loading small" aria-busy="true" />;
  if (rows.length === 0) return <p className="muted">No votes yet.</p>;
  return (
    <ul className="plain">
      {rows.map((r, i) => <li key={i}><span>{r.name ?? 'A phone with no name'}</span><span className="muted">{when(r.at)}</span></li>)}
    </ul>
  );
}

export function IdeasPage({ filter }: { filter: string }) {
  const ideas = useQuery(api.admin.ideas) as Idea[] | undefined;
  const [tab, setTab] = useState<Tab>(Object.hasOwn(TABS, filter) ? (filter as Tab) : 'all');
  const [menu, setMenu] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const setStatus = useMutation(api.admin.setIdeaStatus);
  const setHidden = useMutation(api.admin.setIdeaHidden);
  const remove = useMutation(api.admin.deleteIdea);
  const create = useMutation(api.admin.newIdea);
  const edit = useMutation(api.admin.editIdea);

  useEffect(() => {
    if (menu === null) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest('.menu-wrap')) setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menu]);
  const run = (p: Promise<unknown>) => { setError(null); p.catch((e) => setError(messageOf(e))); };
  const all = ideas ?? [];
  const rows = all.filter(TABS[tab].test);
  const votes = all.reduce((n, i) => n + i.votes, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Ideas</h1>
          <div className="sub">{ideas ? `${all.length} ideas · ${votes} votes · public in the app` : 'Public in the app'}</div>
        </div>
        <button className="primary" onClick={() => setOpen({ kind: 'new' })}>New idea</button>
      </header>
      <div className="seg tabs" role="group" aria-label="Filter">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setMenu(null); }}>
            {TABS[k].label}{all.some(TABS[k].test) && <span className="muted"> {all.filter(TABS[k].test).length}</span>}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!ideas ? <div className="loading" aria-busy="true" /> : (
        <div className="card table">
          <div className="idea-row head" aria-hidden="true">
            <div className="th num-col">Votes</div><div className="th">Idea</div><div className="th">Posted</div><div className="th">Flags</div><div className="th">Status</div><div />
          </div>
          {rows.map((i) => (
            <div key={i.id} className={`idea-row ${i.hidden ? 'is-hidden' : ''}`}>
              <div className="votes num-col">{i.votes}</div>
              <div className="idea-text">{i.text}{i.hidden && <span className="chip bad">Hidden</span>}</div>
              <div className="muted cell-sent">{shortDate(i.createdAt)}</div>
              <div className="muted cell-reports">{i.reports ? `${i.reports} flag${i.reports === 1 ? '' : 's'}` : '—'}</div>
              <select
                className={`status ${i.status}`}
                aria-label={`Status of “${i.text}”`}
                value={i.status}
                onChange={(e) => run(setStatus({ id: i.id, status: e.target.value as Status }))}
              >
                <option value="open">Open</option>
                <option value="planned">Planned</option>
                <option value="done">Done</option>
              </select>
              <div className="menu-wrap">
                <button className="more" aria-label="More actions" aria-expanded={menu === i.id} onClick={() => setMenu(menu === i.id ? null : i.id)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
                {menu === i.id && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenu(null); setOpen({ kind: 'edit', idea: i }); }}>Edit text</button>
                    <button role="menuitem" onClick={() => { setMenu(null); setOpen({ kind: 'voters', idea: i }); }}>See who voted</button>
                    <button role="menuitem" onClick={() => { setMenu(null); run(setHidden({ id: i.id, hidden: !i.hidden })); }}>
                      {i.hidden ? 'Show in the app again' : 'Hide from the app'}
                    </button>
                    <hr />
                    <button role="menuitem" className="danger" onClick={() => {
                      setMenu(null);
                      if (confirm(`Delete “${i.text}”? Its votes go too. This can’t be undone.`)) run(remove({ id: i.id }));
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="empty"><div className="h2">{TABS[tab].empty[0]}</div><p className="muted">{TABS[tab].empty[1]}</p></div>
          )}
        </div>
      )}
      {open?.kind === 'new' && (
        <Dialog title="New idea" onClose={() => setOpen(null)}>
          <p className="muted">Goes up on the Ideas list in the app for everyone to vote on.</p>
          <IdeaForm initial="" submitLabel="Post idea" onCancel={() => setOpen(null)} onSubmit={async (text) => { await create({ text }); setOpen(null); }} />
        </Dialog>
      )}
      {open?.kind === 'edit' && (
        <Dialog title="Edit idea" onClose={() => setOpen(null)}>
          <IdeaForm initial={open.idea.text} submitLabel="Save" onCancel={() => setOpen(null)} onSubmit={async (text) => { await edit({ id: open.idea.id, text }); setOpen(null); }} />
        </Dialog>
      )}
      {open?.kind === 'voters' && (
        <Dialog title="Who voted" onClose={() => setOpen(null)}>
          <p className="muted">Phones have no accounts, so a name shows only if someone typed one.</p>
          <Voters idea={open.idea} />
          <div className="actions"><button className="secondary" onClick={() => setOpen(null)}>Done</button></div>
        </Dialog>
      )}
    </>
  );
}
