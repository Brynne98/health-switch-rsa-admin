import { useAuthActions } from '@convex-dev/auth/react';
import { useEffect, useState } from 'react';

const DENIED = 'That Google account can’t open the dashboard.';
export const TRIED = 'hsr-admin-google-tried';

/**
 * Google, for the owner's account only. The server refuses every other
 * account, and Google then sends the page back with no code, the same as a
 * cancelled sign-in. A mark kept for this tab tells that return apart from a
 * first visit.
 */
export function SignIn({ denied, onDenied }: { denied: boolean; onDenied: () => void }) {
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (denied) { setError(DENIED); onDenied(); }
    // Once per refusal; onDenied is a fresh function every render.
  }, [denied]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(TRIED)) { sessionStorage.removeItem(TRIED); setError(DENIED); }
    } catch {}
  }, []);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      try { sessionStorage.setItem(TRIED, '1'); } catch {}
      // SITE_URL is the bare origin; the site lives under its base path.
      await signIn('google', { redirectTo: import.meta.env.BASE_URL });
    } catch {
      setError('Couldn’t reach Google. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin-card">
        <img className="mark big" src={`${import.meta.env.BASE_URL}icon.png`} alt="" />
        <h1>Health Switch admin</h1>
        <p className="muted">Only the owner can sign in.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy} onClick={() => void google()}>Continue with Google</button>
      </div>
    </div>
  );
}
