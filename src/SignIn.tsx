import { useAuthActions } from '@convex-dev/auth/react';
import { useEffect, useState } from 'react';

const DENIED = 'That email and password can’t open the dashboard.';

/**
 * Email and password, for the owner only. The server refuses every other
 * email with the same message as a wrong password. "Set up" is for the first
 * visit: it needs the one-time code from the Convex environment.
 */
export function SignIn({ denied, onDenied }: { denied: boolean; onDenied: () => void }) {
  const { signIn } = useAuthActions();
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (denied) { setError(DENIED); onDenied(); }
    // Once per refusal; onDenied is a fresh function every render.
  }, [denied]);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await signIn('password', {
        email: String(form.get('email')),
        password: String(form.get('password')),
        flow: setup ? 'signUp' : 'signIn',
        ...(setup ? { setupCode: String(form.get('setupCode')) } : {}),
      });
    } catch {
      setError(setup ? 'Couldn’t set the password. Check the setup code, and use at least 12 characters.' : DENIED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={submit}>
        <div className="mark big"><div /></div>
        <h1>Health Switch admin</h1>
        <p className="muted">{setup ? 'Set the password for the owner’s email.' : 'Only the owner can sign in.'}</p>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 12 : undefined} required />
        </label>
        {setup && (
          <label className="field">
            <span>Setup code</span>
            <input name="setupCode" autoComplete="off" required />
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{setup ? 'Set password' : 'Sign in'}</button>
        <button type="button" className="link" onClick={() => { setSetup(!setup); setError(null); }}>
          {setup ? 'I already have a password' : 'First time here? Set up the password'}
        </button>
      </form>
    </div>
  );
}
