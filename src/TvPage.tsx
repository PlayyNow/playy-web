import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicEvent, PublicEventError } from './api';
import type { PublicEventResponse } from './types';
import TvView, { useTvBodyLock } from './TvView';

const POLL_MS = 10_000;

export default function TvPage() {
  const { eventId } = useParams();
  const [data, setData] = useState<PublicEventResponse | null>(null);
  const [error, setError] = useState<'notfound' | 'error' | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  useTvBodyLock();

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    const load = async (isFirst: boolean) => {
      try {
        const next = await fetchPublicEvent(eventId);
        if (cancelled) return;
        setData(next);
        setLastSuccessAt(new Date());
        setError(null);
      } catch (err) {
        if (cancelled || !isFirst) return;
        if (err instanceof PublicEventError && err.status === 404) setError('notfound');
        else setError('error');
      } finally {
        if (!cancelled && isFirst) setLoading(false);
      }
    };

    void load(true);
    const id = window.setInterval(() => void load(false), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eventId]);

  if (loading || !data) {
    const missing = error === 'notfound' || (!loading && !eventId);
    const failed = !loading && !data;
    return (
      <div className="tv-root">
        <div className="tv-boot">
          {failed ? (
            <>
              <h1>{missing ? 'Event not found' : 'Couldn’t load this event'}</h1>
              <p>{missing ? 'This link is only valid for public Playy sessions.' : 'Check your connection and try again.'}</p>
            </>
          ) : (
            <p>Loading event…</p>
          )}
        </div>
      </div>
    );
  }

  return <TvView data={data} lastSuccessAt={lastSuccessAt} eventId={eventId ?? data.event.id} />;
}
