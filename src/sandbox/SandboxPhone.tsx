import { useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import EventPage from '../EventPage';
import { buildSandboxEvent, parseCourtCount } from './buildSandbox';

export default function SandboxPhone() {
  const [params] = useSearchParams();
  const courts = parseCourtCount(params.get('courts'));
  const data = useMemo(() => buildSandboxEvent(courts, 'live'), [courts]);
  const dataRef = useRef(data);
  dataRef.current = data;

  useLayoutEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/events/') && url.endsWith('/public')) {
        return Promise.resolve(new Response(JSON.stringify(dataRef.current), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return original(input, init);
    }) as typeof window.fetch;
    return () => {
      window.fetch = original;
    };
  }, [courts]);

  return <EventPage key={courts} />;
}
