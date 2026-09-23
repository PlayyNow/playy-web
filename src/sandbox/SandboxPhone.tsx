import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import EventPage from '../EventPage';
import { parseCourtCount } from './buildSandbox';
import { ensureEnvelope, subscribe, type SandboxEnvelope } from './store';

export default function SandboxPhone() {
  const [params] = useSearchParams();
  const courts = parseCourtCount(params.get('courts'));
  const envRef = useRef<SandboxEnvelope>(ensureEnvelope(courts));
  const openedRef = useRef(false);

  useLayoutEffect(() => {
    envRef.current = ensureEnvelope(courts);
    const stop = subscribe((env) => {
      envRef.current = env.fail ? { ...envRef.current, fail: true } : env;
      window.dispatchEvent(new Event('playy-preview-push'));
    });
    const original = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/events/') && url.endsWith('/public')) {
        if (envRef.current.fail && openedRef.current) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        openedRef.current = true;
        return Promise.resolve(new Response(JSON.stringify(envRef.current.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return original(input, init);
    }) as typeof window.fetch;
    return () => {
      stop();
      window.fetch = original;
    };
  }, [courts]);

  return <EventPage />;
}
