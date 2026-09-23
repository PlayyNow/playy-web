import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TvView from '../TvView';
import { buildSandboxEvent, parseCourtCount, parseSandboxState } from './buildSandbox';

export default function SandboxTv() {
  const [params] = useSearchParams();
  const courts = parseCourtCount(params.get('courts'));
  const state = parseSandboxState(params.get('state'));
  const data = useMemo(() => buildSandboxEvent(courts, state), [courts, state]);
  const [lastSuccessAt] = useState(() => new Date());

  return <TvView data={data} lastSuccessAt={lastSuccessAt} eventId={data.event.id} />;
}
