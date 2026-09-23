import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TvView from '../TvView';
import { buildSandboxEvent, parseCourtCount, parseSandboxState, type SandboxState } from './buildSandbox';
import { ensureEnvelope, subscribe } from './store';

function StaticTv({ courts, state }: { courts: number; state: SandboxState }) {
  const data = useMemo(() => buildSandboxEvent(courts, state), [courts, state]);
  const [lastSuccessAt] = useState(() => new Date());
  return <TvView data={data} lastSuccessAt={lastSuccessAt} eventId={data.event.id} />;
}

function LiveTv({ courts }: { courts: number }) {
  const [data, setData] = useState(() => ensureEnvelope(courts).data);
  const [lastSuccessAt, setLastSuccessAt] = useState(() => new Date());

  useEffect(() => subscribe((env) => {
    if (env.fail) return;
    setData(env.data);
    setLastSuccessAt(new Date());
  }), []);

  return <TvView data={data} lastSuccessAt={lastSuccessAt} eventId={data.event.id} />;
}

export default function SandboxTv() {
  const [params] = useSearchParams();
  const courts = parseCourtCount(params.get('courts'));
  const stateRaw = params.get('state');
  if (stateRaw === 'setup' || stateRaw === 'live' || stateRaw === 'final') {
    return <StaticTv courts={courts} state={parseSandboxState(stateRaw)} />;
  }
  return <LiveTv courts={courts} />;
}
