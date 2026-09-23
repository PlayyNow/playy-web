import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicEvent, PublicEventError, APP_STORE_URL } from './api';
import type { PublicAmericano, PublicEvent, PublicEventResponse, PublicMatch, PublicRound, PublicStanding } from './types';
import { avatarSrc, courtLabel, formatNet, initials, playerName } from './names';
import { avatarCircleColor } from './avatarTone';
import './event.css';

const POLL_MS = 10_000;
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Unbounded:wght@800&display=swap';

function useEventFonts(): void {
  useLayoutEffect(() => {
    const id = 'ev-fonts';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    return () => {
      link?.remove();
    };
  }, []);
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Avatar({ avatarId, name, size }: { avatarId?: string | null; name: string; size: number }) {
  const src = avatarSrc(avatarId);
  const background = avatarCircleColor(avatarId);
  if (src) {
    return <img className="ev-avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size, background }} />;
  }
  return (
    <span className="ev-avatar fallback" style={{ width: size, height: size, background, fontSize: Math.max(10, Math.round(size * 0.32)) }}>
      {initials(name)}
    </span>
  );
}

function avatarIdFor(userId: string, event: PublicEvent, standings: PublicStanding[]): string | null {
  return event.participants.find((player) => player.userId === userId)?.avatarId
    ?? standings.find((row) => row.userId === userId)?.user.avatarId
    ?? null;
}

function formatKicker(sport: string, format: string): string {
  const sportLabel = sport.trim().toUpperCase();
  const raw = format.trim().toUpperCase().replace(/_/g, ' ');
  const rest = raw.startsWith(`${sportLabel} `) ? raw.slice(sportLabel.length + 1) : raw;
  return `${sportLabel} · ${rest}`;
}

function formatWhen(startsAt: string, endsAt: string, address: string | null): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const clock = (value: Date) => value.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${date} · ${clock(start)}–${clock(end)} · ${address?.trim() || 'Venue TBA'}`;
}

function roundClock(startedAt: string | null, now: number): string {
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function netTone(value: number): { text: string; tone: 'pos' | 'neg' | 'zero' } {
  if (value === 0) return { text: '0', tone: 'zero' };
  if (value > 0) return { text: formatNet(value), tone: 'pos' };
  return { text: formatNet(value), tone: 'neg' };
}

type MatchLook = {
  pill: string;
  label: string;
  pulse: boolean;
  border: boolean;
  scores: boolean;
};

function matchLook(match: PublicMatch, roundStatus: PublicRound['status'], hidden: boolean): MatchLook {
  if (roundStatus === 'PENDING') {
    return { pill: 'upcoming', label: 'UPCOMING', pulse: false, border: false, scores: false };
  }
  if (hidden) {
    return { pill: '', label: '', pulse: false, border: false, scores: false };
  }
  if (match.scoreStatus === 'CONFIRMED' && match.team1Score != null && match.team2Score != null) {
    return { pill: 'final', label: 'FINAL', pulse: false, border: false, scores: true };
  }
  if (match.scoreStatus === 'CONFLICT') {
    return { pill: 'confirming', label: 'CONFIRMING SCORE', pulse: false, border: false, scores: false };
  }
  return { pill: 'inplay', label: 'IN PLAY', pulse: true, border: true, scores: false };
}

function CourtCard({
  match,
  round,
  event,
  americano,
}: {
  match: PublicMatch;
  round: PublicRound;
  event: PublicEvent;
  americano: PublicAmericano;
}) {
  const look = matchLook(match, round.status, americano.scoresHidden);
  const standings = americano.standings;
  const leftWin = look.scores && (match.team1Score ?? 0) > (match.team2Score ?? 0);
  const rightWin = look.scores && (match.team2Score ?? 0) > (match.team1Score ?? 0);
  const side = (firstId: string, secondId: string, score: number | null, win: boolean) => (
    <div className="ev-teamline">
      <div className="ev-side">
        {[firstId, secondId].map((userId) => {
          const name = playerName(userId, event, standings);
          return (
            <div key={userId} className="ev-person">
              <Avatar avatarId={avatarIdFor(userId, event, standings)} name={name} size={32} />
              <span className="ev-name">{name}</span>
            </div>
          );
        })}
      </div>
      {look.scores && <span className={win ? 'ev-score win' : 'ev-score'}>{score}</span>}
    </div>
  );
  return (
    <article className={look.border ? 'ev-court inplay' : 'ev-court'}>
      <div className="ev-court-top">
        <h3 className="ev-court-name">{courtLabel(match.courtNumber, americano.courtNames)}</h3>
        {look.label && (
          <span className={`ev-pill ${look.pill}`}>
            {look.pulse && <span className="ev-pulse" />}
            {look.label}
          </span>
        )}
      </div>
      {side(match.team1Player1Id, match.team1Player2Id, match.team1Score, leftWin)}
      <div className="ev-hair" />
      {side(match.team2Player1Id, match.team2Player2Id, match.team2Score, rightWin)}
    </article>
  );
}

function SitCard({
  round,
  event,
  standings,
}: {
  round: PublicRound;
  event: PublicEvent;
  standings: PublicStanding[];
}) {
  if (round.sitOuts.length === 0) return null;
  return (
    <section className="ev-sit">
      <h3 className="ev-label sit">Sitting out</h3>
      <div className="ev-sit-grid">
        {round.sitOuts.map((sit) => {
          const name = playerName(sit.userId, event, standings);
          return (
            <div key={sit.userId} className="ev-sit-person">
              <Avatar avatarId={avatarIdFor(sit.userId, event, standings)} name={name} size={28} />
              <span className="ev-sit-name">{name}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UpNext({
  round,
  event,
  americano,
}: {
  round: PublicRound;
  event: PublicEvent;
  americano: PublicAmericano;
}) {
  const names = round.sitOuts.map((sit) => playerName(sit.userId, event, americano.standings));
  return (
    <section className="ev-up">
      <h3 className="ev-label up">Up next · Round {round.roundNumber}</h3>
      <div className="ev-up-list">
        {round.matches.map((match) => (
          <div key={match.id} className="ev-next">
            <span className="ev-next-court">{courtLabel(match.courtNumber, americano.courtNames)}</span>
            <span className="ev-next-names">
              <span>{playerName(match.team1Player1Id, event, americano.standings)} & {playerName(match.team1Player2Id, event, americano.standings)}</span>
              <span className="dim">vs {playerName(match.team2Player1Id, event, americano.standings)} & {playerName(match.team2Player2Id, event, americano.standings)}</span>
            </span>
          </div>
        ))}
      </div>
      {names.length > 0 && <p className="ev-sit-next">Sitting out next: {names.join(', ')}</p>}
    </section>
  );
}

function Podium({
  standings,
  event,
}: {
  standings: PublicStanding[];
  event: PublicEvent;
}) {
  const places = [2, 1, 3].map((rank) => standings.find((row) => row.rank === rank) ?? null);
  if (places.every((row) => row == null)) return null;
  return (
    <div className="ev-podium">
      {places.map((row, index) => {
        if (!row) return <div key={index} />;
        const name = row.user.name || row.user.username || playerName(row.userId, event, standings);
        const net = netTone(row.netDifferential);
        const place = row.rank === 1 ? '1st' : row.rank === 2 ? '2nd' : '3rd';
        return (
          <div key={row.userId} className="ev-place">
            <div className={`ev-ring p${row.rank}`}>
              <Avatar avatarId={row.user.avatarId} name={name} size={row.rank === 1 ? 72 : 56} />
            </div>
            <strong>{place}</strong>
            <span className="ev-who"><span>{name}</span></span>
            <span className={`ev-net ${net.tone}`}>{net.text}</span>
            <span className="ev-pts">{row.totalPointsScored} PTS</span>
            <span className="ev-wl">{row.wins}–{row.losses}</span>
          </div>
        );
      })}
    </div>
  );
}

function StandingsTable({ rows, event }: { rows: PublicStanding[]; event: PublicEvent }) {
  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  return (
    <div>
      <div className="ev-stand-cols">
        <span>#</span>
        <span>Player</span>
        <span>+/−</span>
        <span>PTS</span>
        <span>W–L</span>
      </div>
      {ordered.map((row) => {
        const name = row.user.name || row.user.username || playerName(row.userId, event, rows);
        const net = netTone(row.netDifferential);
        const highlight = row.rank <= 3 ? ` r${row.rank}` : '';
        return (
          <div key={row.userId} className={`ev-stand-row${highlight}`}>
            <span className={`ev-rank${highlight}`}>{row.rank}</span>
            <span className="ev-who">
              <Avatar avatarId={row.user.avatarId} name={name} size={32} />
              <span>{name}</span>
            </span>
            <span className={`ev-net ${net.tone}`}>{net.text}</span>
            <span className="ev-pts">{row.totalPointsScored}</span>
            <span className="ev-wl">{row.wins}–{row.losses}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function EventPage() {
  const { eventId } = useParams();
  const [data, setData] = useState<PublicEventResponse | null>(null);
  const [error, setError] = useState<'notfound' | 'error' | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'live' | 'standings' | 'players'>('live');
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [viewedRound, setViewedRound] = useState<number | null>(null);
  const [followingLive, setFollowingLive] = useState(true);
  const viewedRoundRef = useRef<number | null>(null);
  const prevStatusRef = useRef<PublicAmericano['status'] | null>(null);
  const prevActiveRef = useRef<number | null>(null);
  const now = useNow();
  useEventFonts();

  useEffect(() => {
    viewedRoundRef.current = null;
    prevStatusRef.current = null;
    prevActiveRef.current = null;
    setViewedRound(null);
    setFollowingLive(true);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    const load = async (isFirst: boolean) => {
      try {
        const next = await fetchPublicEvent(eventId);
        if (cancelled) return;
        setData(next);
        setError(null);
        setSyncedAt(Date.now());
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
    const onPreview = () => { void load(false); };
    if (import.meta.env.DEV) window.addEventListener('playy-preview-push', onPreview);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (import.meta.env.DEV) window.removeEventListener('playy-preview-push', onPreview);
    };
  }, [eventId]);

  const event = data?.event;
  const americano = data?.americano;

  useEffect(() => {
    if (!americano) return;
    const activeNum = americano.rounds.find((round) => round.status === 'ACTIVE')?.roundNumber ?? null;
    const lastNum = americano.rounds.reduce((max, round) => Math.max(max, round.roundNumber), 0);
    const prevStatus = prevStatusRef.current;
    const prevActive = prevActiveRef.current;

    if (americano.status === 'SETUP' || lastNum === 0) {
      viewedRoundRef.current = null;
      setViewedRound(null);
    } else if (prevStatus === 'ACTIVE' && americano.status === 'COMPLETED') {
      viewedRoundRef.current = lastNum;
      setViewedRound(lastNum);
      setFollowingLive(false);
    } else if (activeNum != null && prevActive != null && activeNum !== prevActive) {
      viewedRoundRef.current = activeNum;
      setViewedRound(activeNum);
      setFollowingLive(true);
    } else if (viewedRoundRef.current == null) {
      const initial = americano.status === 'COMPLETED' ? lastNum : (activeNum ?? lastNum);
      viewedRoundRef.current = initial;
      setViewedRound(initial);
      setFollowingLive(americano.status === 'ACTIVE' && activeNum != null && initial === activeNum);
    }

    prevStatusRef.current = americano.status;
    prevActiveRef.current = activeNum;
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
  const ordered = americano ? [...americano.rounds].sort((a, b) => a.roundNumber - b.roundNumber) : [];
  const activeRound = ordered.find((round) => round.status === 'ACTIVE') ?? null;
  const lastRound = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  const fallbackRound = americano?.status === 'COMPLETED'
    ? lastRound?.roundNumber ?? null
    : activeRound?.roundNumber ?? lastRound?.roundNumber ?? null;
  const shownNumber = followingLive && activeRound
    ? activeRound.roundNumber
    : (viewedRound ?? fallbackRound);
  const shown = ordered.find((round) => round.roundNumber === shownNumber) ?? null;
  const nextRound = ordered.find((round) => round.status === 'PENDING') ?? null;
  const viewingLive = activeRound != null && shown?.roundNumber === activeRound.roundNumber;
  const showBack = Boolean(americano?.status === 'ACTIVE' && activeRound && shown && !viewingLive);
  const syncedSeconds = syncedAt == null ? 0 : Math.max(0, Math.floor((now - syncedAt) / 1000));
  const statusKind = americano?.status === 'ACTIVE' ? 'live' : americano?.status === 'COMPLETED' ? 'final' : 'soon';
  const statusLabel = statusKind === 'live' ? 'LIVE' : statusKind === 'final' ? 'FINAL RESULTS' : 'STARTING SOON';
  const standings = americano ? [...americano.standings].sort((a, b) => a.rank - b.rank) : [];

  const goTo = (roundNumber: number) => {
    viewedRoundRef.current = roundNumber;
    setViewedRound(roundNumber);
    setFollowingLive(false);
  };

  return (
    <main className="ev">
      <header className="ev-head">
        <p className="ev-word">PLAYY</p>
        <span className={`ev-status ${statusKind}`}>
          {statusKind === 'live' && <span className="ev-dot" />}
          {statusLabel}
        </span>
      </header>

      <section>
        <p className="ev-kicker">{americano ? formatKicker(event.sport, event.format) : formatKicker(event.sport, event.eventType === 'FRIENDLY' ? 'SOCIAL' : 'COMPETITIVE')}</p>
        <h1 className="ev-title">{event.title}</h1>
        <p className="ev-meta">{formatWhen(event.startsAt, event.endsAt, event.address)}</p>
        <p className="ev-meta">
          {joined} players
          {americano ? ` · ${americano.courtCount} courts · ${americano.pointsPerRound} pts a game` : ''}
          {' · Host '}{event.organizer.name || 'Playy'}
        </p>
      </section>

      {americano?.status === 'ACTIVE' && activeRound && (
        <section className="ev-progress">
          <div className="ev-progress-top">
            <span className="ev-roundnum">ROUND {activeRound.roundNumber} / {americano.totalRounds}</span>
            <span className="ev-roundtime">Round time {roundClock(activeRound.startedAt, now)}</span>
          </div>
          <div className="ev-segments">
            {ordered.map((round) => (
              <span
                key={round.id}
                className={`ev-segment${round.status === 'COMPLETED' ? ' done' : round.status === 'ACTIVE' ? ' now' : ''}`}
              />
            ))}
          </div>
        </section>
      )}

      <nav className="ev-tabs">
        <button type="button" className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Courts</button>
        <button type="button" className={tab === 'standings' ? 'on' : ''} onClick={() => setTab('standings')}>Standings</button>
        <button type="button" className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Players</button>
      </nav>

      {tab === 'live' && (
        <section>
          {!americano && <p className="ev-note">This session isn’t an Americano.</p>}
          {americano?.status === 'SETUP' && (
            <p className="ev-note">Court assignments appear when the host starts the tournament.</p>
          )}
          {americano && americano.status !== 'SETUP' && shown && (
            <>
              <div className="ev-stepper">
                <button
                  type="button"
                  className="ev-step"
                  aria-label="Previous round"
                  disabled={shown.roundNumber <= 1}
                  onClick={() => goTo(shown.roundNumber - 1)}
                >
                  ‹
                </button>
                <div className="ev-step-mid">
                  <span className="ev-step-label">Round {shown.roundNumber} of {americano.totalRounds}</span>
                  <span className={`ev-mini ${shown.status === 'ACTIVE' ? 'live' : shown.status === 'COMPLETED' ? 'done' : 'upcoming'}`}>
                    {shown.status === 'ACTIVE' ? 'Live' : shown.status === 'COMPLETED' ? 'Done' : 'Upcoming'}
                  </span>
                </div>
                <button
                  type="button"
                  className="ev-step"
                  aria-label="Next round"
                  disabled={shown.roundNumber >= ordered[ordered.length - 1].roundNumber}
                  onClick={() => goTo(shown.roundNumber + 1)}
                >
                  ›
                </button>
              </div>
              {showBack && (
                <button
                  type="button"
                  className="ev-back"
                  onClick={() => {
                    if (!activeRound) return;
                    viewedRoundRef.current = activeRound.roundNumber;
                    setViewedRound(activeRound.roundNumber);
                    setFollowingLive(true);
                  }}
                >
                  Back to live
                </button>
              )}
              <div className="ev-stack">
                {shown.matches.map((match) => (
                  <CourtCard key={match.id} match={match} round={shown} event={event} americano={americano} />
                ))}
                <SitCard round={shown} event={event} standings={americano.standings} />
                {viewingLive && nextRound && (
                  <UpNext round={nextRound} event={event} americano={americano} />
                )}
              </div>
              <p className="ev-sync">Synced {syncedSeconds}s ago · scores appear once both teams confirm</p>
            </>
          )}
        </section>
      )}

      {tab === 'standings' && (
        <section>
          {!americano && <p className="ev-note">No standings for this format.</p>}
          {americano?.scoresHidden && (
            <p className="ev-note">Scores are hidden until the tournament ends.</p>
          )}
          {americano && !americano.scoresHidden && standings.length === 0 && (
            <p className="ev-note">Standings appear once rounds are scored.</p>
          )}
          {americano && !americano.scoresHidden && standings.length > 0 && (
            <>
              {americano.status === 'COMPLETED' && <Podium standings={standings} event={event} />}
              <section className="ev-panel">
                <div className="ev-panel-head">
                  <h2 className="ev-label stand">Standings</h2>
                  <p className="ev-sub">Ranked by point difference</p>
                </div>
                <StandingsTable rows={standings} event={event} />
              </section>
            </>
          )}
        </section>
      )}

      {tab === 'players' && (
        <ul className="ev-players">
          {event.participants.map((player) => {
            const name = player.name || player.username || 'Player';
            return (
              <li key={player.userId} className="ev-player">
                <Avatar avatarId={player.avatarId} name={name} size={36} />
                <div>
                  <strong>{name}</strong>
                  <p>{player.role === 'HOST' ? 'Host' : 'Player'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ev-bar">
        <div className="ev-bar-inner">
          <div className="ev-bar-copy">
            <strong>Play the next one</strong>
            <span>Find games at your level on Playy</span>
          </div>
          <a className="ev-get" href="https://joinplayy.com">Get Playy</a>
        </div>
      </div>
    </main>
  );
}
