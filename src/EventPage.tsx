import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicEvent, PublicEventError, APP_STORE_URL } from './api';
import type { PublicAmericano, PublicEvent, PublicEventResponse, PublicMatch, PublicRound } from './types';
import { avatarSrc, courtLabel, formatDubai, formatNet, initials, playerName } from './names';

const POLL_MS = 10_000;

function Avatar({ avatarId, name }: { avatarId?: string | null; name: string }) {
  const src = avatarSrc(avatarId);
  if (src) return <img className="avatar" src={src} alt="" />;
  return <span className="avatar fallback">{initials(name)}</span>;
}

function scoreLabel(match: PublicMatch, roundStatus: PublicRound['status'], hidden: boolean): string {
  if (roundStatus === 'PENDING') return 'Upcoming';
  if (hidden) return 'Hidden';
  if (match.team1Score == null || match.team2Score == null) return 'In play';
  return `${match.team1Score} – ${match.team2Score}`;
}

function MatchCard({
  match,
  event,
  americano,
  roundStatus,
}: {
  match: PublicMatch;
  event: PublicEvent;
  americano: PublicAmericano;
  roundStatus: PublicRound['status'];
}) {
  const standings = americano.standings;
  const t1 = `${playerName(match.team1Player1Id, event, standings)} & ${playerName(match.team1Player2Id, event, standings)}`;
  const t2 = `${playerName(match.team2Player1Id, event, standings)} & ${playerName(match.team2Player2Id, event, standings)}`;
  return (
    <article className="card match">
      <div className="match-top">
        <strong>{courtLabel(match.courtNumber, americano.courtNames)}</strong>
        <span className={`pill ${match.scoreStatus.toLowerCase()}`}>{match.scoreStatus === 'CONFIRMED' ? 'Confirmed' : match.scoreStatus === 'CONFLICT' ? 'Conflict' : 'Pending'}</span>
      </div>
      <p className="team">{t1}</p>
      <p className="vs">vs</p>
      <p className="team">{t2}</p>
      <p className="score">{scoreLabel(match, roundStatus, americano.scoresHidden)}</p>
    </article>
  );
}

function RoundBlock({ round, event, americano }: { round: PublicRound; event: PublicEvent; americano: PublicAmericano }) {
  const sitNames = round.sitOuts.map((s) => playerName(s.userId, event, americano.standings));
  return (
    <section className="round-block">
      <header className="round-head">
        <h3>Round {round.roundNumber}</h3>
        <span className={`pill ${round.status.toLowerCase()}`}>
          {round.status === 'ACTIVE' ? 'Live' : round.status === 'COMPLETED' ? 'Done' : 'Upcoming'}
        </span>
      </header>
      <div className="match-grid">
        {round.matches.map((match) => (
          <MatchCard key={match.id} match={match} event={event} americano={americano} roundStatus={round.status} />
        ))}
      </div>
      {sitNames.length > 0 && (
        <p className="sitout">Sitting out: {sitNames.join(', ')}</p>
      )}
    </section>
  );
}

export default function EventPage() {
  const { eventId } = useParams();
  const [data, setData] = useState<PublicEventResponse | null>(null);
  const [error, setError] = useState<'notfound' | 'error' | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'live' | 'standings' | 'players'>('live');

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    const load = async (isFirst: boolean) => {
      try {
        const next = await fetchPublicEvent(eventId);
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PublicEventError && err.status === 404) setError('notfound');
        else if (isFirst) setError('error');
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

  const event = data?.event;
  const americano = data?.americano;
  const liveRound = useMemo(() => {
    if (!americano) return null;
    return americano.rounds.find((r) => r.status === 'ACTIVE')
      || (americano.currentRound != null
        ? americano.rounds.find((r) => r.roundNumber === americano.currentRound)
        : null)
      || null;
  }, [americano]);

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Loading event…</p>
      </main>
    );
  }

  if (error === 'notfound') {
    return (
      <main className="shell">
        <h1>Event not found</h1>
        <p className="muted">This link is only valid for public Playy sessions.</p>
        <a className="store" href={APP_STORE_URL}>Get Playy on the App Store</a>
      </main>
    );
  }

  if (error === 'error') {
    return (
      <main className="shell">
        <h1>Couldn’t load this event</h1>
        <p className="muted">Check your connection and try again.</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="shell">
        <h1>Event not found</h1>
        <p className="muted">This link is only valid for public Playy sessions.</p>
        <a className="store" href={APP_STORE_URL}>Get Playy on the App Store</a>
      </main>
    );
  }

  const joined = Math.max(0, Number(event.joinedCount || 0));
  const orderedRest = americano ? americano.rounds.filter((round) => round.id !== liveRound?.id) : [];
  const nextPending = orderedRest.find((round) => round.status === 'PENDING') ?? null;
  const laterPending = orderedRest.filter((round) => round.status === 'PENDING' && round.id !== nextPending?.id);
  const laterStart = laterPending[0]?.roundNumber;
  const laterEnd = laterPending[laterPending.length - 1]?.roundNumber;
  const laterDrawnLabel = laterStart == null || laterEnd == null
    ? null
    : laterStart === laterEnd
      ? `Round ${laterStart} drawn`
      : `Rounds ${laterStart}–${laterEnd} drawn`;

  return (
    <main className="shell">
      <header className="brand">
        <span className="logo">PLAYY</span>
        <span className="live-dot" aria-hidden />
        <span className="muted small">Live viewer</span>
      </header>

      <section className="hero card">
        <p className="eyebrow">{event.sport} · {event.eventType === 'FRIENDLY' ? 'Social' : 'Competitive'}</p>
        <h1>{event.title}</h1>
        <p className="meta">{formatDubai(event.startsAt)} – {formatDubai(event.endsAt).split(',').pop()?.trim()} GST</p>
        {event.address && <p className="meta">{event.address}</p>}
        <p className="meta">{joined} / {event.maxPlayers} players · Host {event.organizer.name || 'Playy'}</p>
      </section>

      {americano && (
        <p className="status-line">
          {americano.status === 'SETUP' && 'Waiting for the host to start the Americano.'}
          {americano.status === 'ACTIVE' && `Round ${americano.currentRound ?? '—'} of ${americano.totalRounds} · ${americano.pointsPerRound} pts a game`}
          {americano.status === 'COMPLETED' && 'Tournament complete'}
          {americano.scoresHidden && ' · Scores hidden until the end'}
        </p>
      )}

      <nav className="tabs">
        <button type="button" className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Courts</button>
        <button type="button" className={tab === 'standings' ? 'on' : ''} onClick={() => setTab('standings')}>Standings</button>
        <button type="button" className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Players</button>
      </nav>

      {tab === 'live' && (
        <section>
          {!americano && <p className="muted">This session isn’t an Americano.</p>}
          {americano?.status === 'SETUP' && (
            <p className="muted">Court assignments appear when the host starts the tournament.</p>
          )}
          {americano && liveRound && (
            <RoundBlock round={liveRound} event={event} americano={americano} />
          )}
          {americano && americano.status !== 'SETUP' && (
            <div className="rounds">
              {orderedRest.map((round) => {
                if (round.status === 'PENDING' && round.id !== nextPending?.id) return null;
                return <RoundBlock key={round.id} round={round} event={event} americano={americano} />;
              })}
              {laterDrawnLabel && <p className="muted">{laterDrawnLabel}</p>}
            </div>
          )}
        </section>
      )}

      {tab === 'standings' && (
        <section>
          {!americano && <p className="muted">No standings for this format.</p>}
          {americano?.scoresHidden && (
            <p className="muted">Scores are hidden until the tournament ends.</p>
          )}
          {americano && !americano.scoresHidden && americano.standings.length === 0 && (
            <p className="muted">Standings appear once rounds are scored.</p>
          )}
          {americano && !americano.scoresHidden && americano.standings.length > 0 && (
            <ol className="standings">
              {americano.standings.map((row) => {
                const name = row.user.name || row.user.username || playerName(row.userId, event, americano.standings);
                return (
                  <li key={row.userId} className="stand-row">
                    <span className="rank">#{row.rank}</span>
                    <Avatar avatarId={row.user.avatarId} name={name} />
                    <span className="stand-name">{name}</span>
                    <span className={row.netDifferential >= 0 ? 'pos' : 'neg'}>{formatNet(row.netDifferential)}</span>
                    <span className="wl">{row.wins}–{row.losses}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {tab === 'players' && (
        <ul className="players">
          {event.participants.map((p) => {
            const name = p.name || p.username || 'Player';
            return (
              <li key={p.userId} className="player-row">
                <Avatar avatarId={p.avatarId} name={name} />
                <div>
                  <strong>{name}</strong>
                  <p className="muted small">{p.role === 'HOST' ? 'Host' : 'Player'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer>
        <a className="store" href={APP_STORE_URL}>Download Playy</a>
        <p className="muted small">Updates every 10 seconds. Scores are entered in the Playy app.</p>
      </footer>
    </main>
  );
}
