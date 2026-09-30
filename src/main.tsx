import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles.css';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function LoadFailed() {
  const { signOut } = useAuthActions();
  return (
    <div className="signin">
      <div className="signin-card">
        <h1>Couldn’t load the dashboard</h1>
        <p className="muted">The server refused or didn’t answer. Reloading usually fixes it; if not, sign out and back in.</p>
        <button className="primary" onClick={() => location.reload()}>Reload</button>
        <button className="secondary" onClick={() => void signOut().then(() => location.reload())}>Sign out</button>
      </div>
    </div>
  );
}

/** A failed server call throws during render; without this the page goes blank. */
class Boundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <LoadFailed /> : this.props.children; }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <Boundary>
        <App />
      </Boundary>
    </ConvexAuthProvider>
  </StrictMode>,
);
