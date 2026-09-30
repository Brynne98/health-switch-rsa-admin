import { useMutation, useQuery } from 'convex/react';
import { useState, useSyncExternalStore } from 'react';

import { api, type Feedback } from './api';
import { Dialog, IdeaForm } from './Dialog';
import { shortDate, time } from './format';

const PHONE = '(max-width: 959px)';
const onMedia = (cb: () => void) => { const m = matchMedia(PHONE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

export function FeedbackPage() {
  // On a phone the side panel sits above a long list, so the form opens as a popup instead.
  const phone = useSyncExternalStore(onMedia, () => matchMedia(PHONE).matches);
  const rows = useQuery(api.admin.feedback) as Feedback[] | undefined;
  const create = useMutation(api.admin.newIdea);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Feedback | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  // Which messages became ideas, for this visit only.
  const [made, setMade] = useState<Set<string>>(new Set());

  const q = search.trim().toLowerCase();
  const shown = (rows ?? []).filter((f) => !q || f.text.toLowerCase().includes(q));
  const groups: { day: string; items: Feedback[] }[] = [];
  for (const f of shown) {
    const day = shortDate(f.createdAt);
    if (groups[groups.length - 1]?.day !== day) groups.push({ day, items: [] });
    groups[groups.length - 1].items.push(f);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Feedback</h1>
          <div className="sub">{rows ? `${rows.length} messages · ` : ''}private, only you see these</div>
        </div>
      </header>
      <div className="split">
        <section className="card flush">
          {rows?.length !== 0 && <div className="search-wrap">
            <label className="search">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" placeholder="Search feedback" aria-label="Search feedback" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>}
          {!rows && <div className="loading" aria-busy="true" />}
          {rows && shown.length === 0 && (
            <div className="empty"><div className="h2">{rows.length ? 'Nothing matches' : 'No feedback yet'}</div><p className="muted">{rows.length ? 'Try other words.' : 'Messages sent from the app’s Feedback screen show here.'}</p></div>
          )}
          {groups.map((g) => (
            <div key={g.day}>
              <div className="day">{g.day}</div>
              {g.items.map((f) => (
                <div key={f.id} className={`fb-row ${picked?.id === f.id ? 'picked' : ''}`}>
                  <div className="muted fb-time">{time(f.createdAt)}</div>
                  <div className="grow">{f.text}</div>
                  {made.has(f.id)
                    ? <span className="chip good">Made an idea</span>
                    : <button className="ghost" onClick={() => { setPicked(f); setPosted(null); }}>Make an idea</button>}
                </div>
              ))}
            </div>
          ))}
        </section>
        <aside className={`card side-panel ${(phone && !posted) || rows?.length === 0 ? 'hide' : ''}`} aria-live="polite">
          {picked && !phone ? (
            <>
              <div className="h2 large">New idea</div>
              <p className="muted">Goes up on the Ideas list in the app for everyone to vote on. The feedback it came from stays private.</p>
              <div className="quote">From: “{picked.text}”</div>
              <IdeaForm
                key={picked.id}
                initial={picked.text}
                submitLabel="Post idea"
                onCancel={() => setPicked(null)}
                onSubmit={async (text) => {
                  await create({ text });
                  setMade(new Set(made).add(picked.id));
                  setPosted(text);
                  setPicked(null);
                }}
              />
            </>
          ) : posted ? (
            <>
              <div className="h2 large">Idea posted</div>
              <p>“{posted}”</p>
              <a href="#/ideas">See it in Ideas</a>
            </>
          ) : (
            <p className="muted">Pick <b>Make an idea</b> on a message to turn it into a public idea. You can reword it first.</p>
          )}
        </aside>
        {picked && phone && (
          <Dialog title="New idea" onClose={() => setPicked(null)}>
            <p className="muted">Goes up on the Ideas list for everyone to vote on. The feedback stays private.</p>
              <IdeaForm
                key={picked.id}
                initial={picked.text}
                submitLabel="Post idea"
                onCancel={() => setPicked(null)}
                onSubmit={async (text) => {
                  await create({ text });
                  setMade(new Set(made).add(picked.id));
                  setPosted(text);
                  setPicked(null);
                }}
              />
          </Dialog>
        )}
      </div>
    </>
  );
}
