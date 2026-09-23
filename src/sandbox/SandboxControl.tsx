import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  advanceRound,
  autoStep,
  confirmNext,
  finishTournament,
  markNextConflict,
  readout,
  resetTournament,
  startTournament,
} from './engine';
import { commitData, commitFailure, ensureEnvelope, subscribe } from './store';
import { parseCourtCount } from './buildSandbox';
import './control.css';

export default function SandboxControl() {
  const [params] = useSearchParams();
  const courts = parseCourtCount(params.get('courts'));
  const [env, setEnv] = useState(() => ensureEnvelope(courts));
  const [auto, setAuto] = useState(false);

  useEffect(() => subscribe(setEnv), []);

  useEffect(() => {
    if (!auto) return undefined;
    const id = window.setInterval(() => {
      const current = ensureEnvelope(courts);
      const next = autoStep(current.data);
      if (!next) {
        setAuto(false);
        return;
      }
      setEnv(commitData(next, courts));
    }, 2000);
    return () => window.clearInterval(id);
  }, [auto, courts]);

  const info = readout(env.data);
  const run = (next: typeof env.data) => {
    if (next === env.data) return;
    setEnv(commitData(next, courts));
  };

  return (
    <main className="sim">
      <h1>Americano simulator</h1>
      <p>
        Open the phone and the TV without <code>?state=</code>. This panel pushes each step immediately.
        Add <code>?courts=2</code> or <code>?courts=4</code> before Reset to change the court count.
      </p>
      <div className="sim-readout">
        <div><span>Status</span><strong>{info.status}</strong></div>
        <div><span>Active round</span><strong>{info.activeRound ?? '—'}</strong></div>
        <div><span>Confirmed</span><strong>{info.matchCount ? `${info.confirmed}/${info.matchCount}` : '—'}</strong></div>
        <div><span>Board</span><strong>{info.players} players · {info.courts} courts</strong></div>
      </div>
      <div className="sim-actions">
        <button type="button" onClick={() => { setAuto(false); setEnv(commitData(resetTournament(courts), courts)); }}>Reset to setup</button>
        <button type="button" disabled={!info.canStart} onClick={() => run(startTournament(env.data))}>Start</button>
        <button type="button" disabled={!info.canConfirm} onClick={() => run(confirmNext(env.data))}>Confirm next match</button>
        <button type="button" disabled={!info.canConflict} onClick={() => run(markNextConflict(env.data))}>Mark next match conflict</button>
        <button type="button" disabled={!info.canAdvance} onClick={() => run(advanceRound(env.data))}>Advance round</button>
        <button type="button" disabled={!info.canFinish} onClick={() => run(finishTournament(env.data))}>Finish</button>
        <button type="button" className={auto ? 'on' : ''} onClick={() => setAuto((value) => !value)}>{auto ? 'Stop auto-play' : 'Auto-play'}</button>
        <button type="button" className={env.fail ? 'on' : ''} onClick={() => setEnv(commitFailure(!env.fail, courts))}>
          {env.fail ? 'API failure on' : 'Simulate API failure'}
        </button>
      </div>
      <p>Phone: /sandbox/americano · TV: /sandbox/americano/tv</p>
    </main>
  );
}
