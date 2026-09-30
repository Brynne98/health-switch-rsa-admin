import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import { api, type Overview } from './api';
import { FeedbackPage } from './Feedback';
import { IdeasPage } from './Ideas';
import { NumbersPage } from './Numbers';
import { OverviewPage } from './Overview';
import { SignIn } from './SignIn';

export type Page = 'overview' | 'feedback' | 'ideas' | 'numbers';

const PAGES: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></> },
  { id: 'feedback', label: 'Feedback', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
  { id: 'ideas', label: 'Ideas', icon: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /></> },
  { id: 'numbers', label: 'Not working', icon: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /><path d="m16 2 6 6" /><path d="m22 2-6 6" /></> },
];

/** Opens another site in a new tab. */
const OUT = <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>;

export function Icon({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** The page lives in the address after #, so reload and back both work. */
function usePage(): [Page, string] {
  const read = () => {
    const [id, filter = ''] = location.hash.replace(/^#\/?/, '').split('/');
    return [PAGES.some((p) => p.id === id) ? (id as Page) : 'overview', filter] as [Page, string];
  };
  const [page, setPage] = useState(read);
  useEffect(() => {
    const on = () => { setPage(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return page;
}

export function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.admin.me, isAuthenticated ? {} : 'skip') as { owner: boolean } | undefined;
  const { signOut } = useAuthActions();
  const [page, filter] = usePage();
  const overview = useQuery(api.admin.overview, me?.owner ? {} : 'skip') as Overview | undefined;
  // Only what is waiting on you, the same counts as the Overview list; nothing when it is 0.
  const counts: Partial<Record<Page, number>> = overview ? {
    feedback: overview.feedback.lastWeek,
    ideas: overview.ideas.noStatus,
    numbers: overview.reported.count,
  } : {};

  if (isLoading || (isAuthenticated && me === undefined)) return <div className="loading" aria-busy="true" />;
  if (!isAuthenticated || !me?.owner) return <SignIn denied={isAuthenticated && me?.owner === false} onDenied={() => void signOut()} />;

  return (
    <div className="shell">
      <nav className="side" aria-label="Pages">
        <div className="brand">
          <div className="mark"><div /></div>
          <div><div className="brand-name">Health Switch</div><div className="brand-sub">Admin</div></div>
        </div>
        {PAGES.map((p) => (
          <a key={p.id} className="nav" href={`#/${p.id}`} aria-current={page === p.id ? 'page' : undefined}>
            <Icon>{p.icon}</Icon><span>{p.label}</span>
            {!!counts[p.id] && <span className={`nav-count ${p.id === 'numbers' ? 'chip bad' : ''}`}>{counts[p.id]}</span>}
          </a>
        ))}
        <div className="side-foot">
          <a className="nav quiet" href="https://dashboard.convex.dev" target="_blank" rel="noreferrer"><Icon size={18}>{OUT}</Icon><span>Convex</span></a>
          <a className="nav quiet" href="https://app.revenuecat.com" target="_blank" rel="noreferrer"><Icon size={18}>{OUT}</Icon><span>RevenueCat</span></a>
          <button className="nav quiet" onClick={() => void signOut()}><Icon size={18}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Icon><span>Sign out</span></button>
        </div>
      </nav>
      <main className="main">
        {page === 'overview' && <OverviewPage />}
        {page === 'feedback' && <FeedbackPage />}
        {page === 'ideas' && <IdeasPage key={filter} filter={filter} />}
        {page === 'numbers' && <NumbersPage />}
        <footer className="phone-foot">
          <a href="https://dashboard.convex.dev" target="_blank" rel="noreferrer">Convex ↗</a>
          <a href="https://app.revenuecat.com" target="_blank" rel="noreferrer">RevenueCat ↗</a>
          <button className="link" onClick={() => void signOut()}>Sign out</button>
        </footer>
      </main>
    </div>
  );
}
