import { APP_STORE_URL } from './api';

export default function HomePage() {
  return (
    <main className="shell">
      <header className="brand">
        <span className="logo">PLAYY</span>
      </header>
      <h1>Live event viewer</h1>
      <p className="muted">
        Open a public Playy event from the link you were sent. Private sessions are not shown here.
      </p>
      <a className="store" href={APP_STORE_URL}>Get the Playy app</a>
    </main>
  );
}
