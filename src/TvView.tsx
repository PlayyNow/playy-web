import { useEffect, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { PublicAmericano, PublicEvent, PublicEventResponse, PublicMatch, PublicRound, PublicStanding } from './types';
import { avatarSrc, courtLabel, formatNet, initials, playerName } from './names';
import './tv.css';

const FINAL_QR_URL = 'https://joinplayy.com';

function liveViewerUrl(eventId: string): string {
  return `https://playy-web.vercel.app/event/${eventId}`;
}

export function useTvBodyLock() {
  useEffect(() => {
    const { overflow, background } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#141416';
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.background = background;
    };
  }, []);
}

function useStageScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Logo() {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="tv-wordmark">PLAYY</span>;
  return <img className="tv-logo" src="/logo.png" alt="Playy" onError={() => setFailed(true)} />;
}

function TvAvatar({ avatarId, name, size }: { avatarId?: string | null; name: string; size: number }) {
  const src = avatarSrc(avatarId);
  if (src) {
    return <img className="tv-avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  return (
    <span className="tv-avatar fallback" style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.32)) }}>
      {initials(name)}
    </span>
  );
}

function QrTile({ value, tile }: { value: string; tile: number }) {
  const pad = tile >= 300 ? 28 : 16;
  return (
    <div className="tv-qr-tile" style={{ width: tile, height: tile, padding: pad }}>
      <QRCodeSVG value={value} size={tile - pad * 2} marginSize={0} bgColor="#ffffff" fgColor="#141416" title="Playy QR code" />
    </div>
  );
}

function Sync({ lastSuccessAt, now }: { lastSuccessAt: Date | null; now: Date }) {
  const seconds = lastSuccessAt == null
    ? null
    : Math.max(0, Math.floor((now.getTime() - lastSuccessAt.getTime()) / 1000));
  const stale = seconds == null || seconds > 30;
  return (
    <p className="tv-sync">
      <span className={stale ? 'tv-dot amber' : 'tv-dot'} />
      {stale ? 'Reconnecting…' : `Synced ${seconds}s ago`}
    </p>
  );
}

function dubaiClock(now: Date): string {
  return now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function dubaiWhen(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${day} · ${time} GST`;
}

function elapsedLabel(startedAt: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function subline(event: PublicEvent, americano: PublicAmericano | null): string {
  if (!americano) {
    const bits = [event.address, `${event.joinedCount} / ${event.maxPlayers} players`].filter(Boolean);
    return bits.join(' · ');
  }
  const bits = [
    event.address,
    `${event.joinedCount} players`,
    `${americano.courtCount} courts`,
    `${americano.pointsPerRound} points per match`,
  ].filter(Boolean);
  return bits.join(' · ');
}

function progressRound(rounds: PublicRound[]): number | null {
  const active = rounds.find((round) => round.status === 'ACTIVE');
  if (active) return active.roundNumber;
  let lastCompleted: number | null = null;
  rounds.forEach((round) => {
    if (round.status === 'COMPLETED') lastCompleted = round.roundNumber;
  });
  return lastCompleted;
}

function displayName(userId: string, event: PublicEvent, standings: PublicStanding[]): string {
  return playerName(userId, event, standings);
}

function netClass(value: number): string {
  if (value > 0) return 'pos';
  if (value < 0) return 'neg';
  return 'zero';
}

function rankClass(rank: number): string {
  if (rank === 1) return 'r1';
  if (rank === 2) return 'r2';
  if (rank === 3) return 'r3';
  return '';
}

function Header({
  event,
  americano,
  now,
}: {
  event: PublicEvent;
  americano: PublicAmericano | null;
  now: Date;
}) {
  const rounds = americano?.rounds ?? [];
  const showProgress = americano != null && americano.status !== 'SETUP' && rounds.length > 0;
  const roundNo = showProgress ? progressRound(rounds) : null;
  const active = rounds.find((round) => round.status === 'ACTIVE') ?? null;
  return (
    <header className="tv-header">
      <Logo />
      <div className="tv-header-titles">
        <h1 className="tv-title">{event.title}</h1>
        <p className="tv-sub">{subline(event, americano)}</p>
      </div>
      <div className="tv-header-right">
        {americano?.status === 'ACTIVE' && <span className="tv-pill live-tag tv-pulse">LIVE</span>}
        {showProgress && roundNo != null && (
          <span className="tv-round-label">ROUND {roundNo} / {americano.totalRounds}</span>
        )}
        {showProgress && (
          <div className="tv-segments">
            {rounds.map((round) => (
              <span
                key={round.id}
                className={`tv-segment ${round.status === 'COMPLETED' ? 'done' : ''} ${round.status === 'ACTIVE' ? 'now' : ''}`}
              />
            ))}
          </div>
        )}
        {active?.startedAt && <span className="tv-round-time">Round time {elapsedLabel(active.startedAt, now)}</span>}
        <div className="tv-clock">{dubaiClock(now)}</div>
      </div>
    </header>
  );
}

function PlayerGrid({ event }: { event: PublicEvent }) {
  return (
    <div className="tv-players">
      {event.participants.map((player) => {
        const name = player.name || player.username || 'Player';
        return (
          <div key={player.userId} className="tv-player-card">
            <TvAvatar avatarId={player.avatarId} name={name} size={52} />
            <span className="tv-ellipsis tv-name-md">{name}</span>
          </div>
        );
      })}
    </div>
  );
}

function CourtCard({
  match,
  event,
  americano,
}: {
  match: PublicMatch;
  event: PublicEvent;
  americano: PublicAmericano;
}) {
  const hidden = americano.scoresHidden;
  const pending = match.scoreStatus === 'PENDING';
  const confirmed = !hidden && match.scoreStatus === 'CONFIRMED' && match.team1Score != null && match.team2Score != null;
  const leftWin = confirmed && (match.team1Score ?? 0) > (match.team2Score ?? 0);
  const rightWin = confirmed && (match.team2Score ?? 0) > (match.team1Score ?? 0);
  const pill = hidden || pending
    ? 'inplay'
    : match.scoreStatus === 'CONFIRMED'
      ? 'final'
      : 'wait';
  const pillLabel = hidden || pending
    ? 'IN PLAY'
    : match.scoreStatus === 'CONFIRMED'
      ? 'FINAL'
      : 'CONFIRMING SCORE';
  const standings = americano.standings;
  const side = (a: string, b: string, win: boolean, away: boolean) => (
    <div className="tv-side">
      {[a, b].map((id) => {
        const name = displayName(id, event, standings);
        return (
          <div key={id} className={away ? 'tv-person away' : 'tv-person'}>
            <TvAvatar avatarId={event.participants.find((p) => p.userId === id)?.avatarId ?? standings.find((row) => row.userId === id)?.user.avatarId} name={name} size={44} />
            <span className={`tv-ellipsis tv-name-lg ${win ? 'tv-win' : ''}`}>{name}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <article className={pending ? 'tv-court live-border' : 'tv-court'}>
      <div className="tv-court-top">
        <h3 className="tv-court-name">{courtLabel(match.courtNumber, americano.courtNames)}</h3>
        <span className={`tv-pill ${pill}`}>
          {pill === 'inplay' && <span className="tv-dot small tv-pulse" />}
          {pillLabel}
        </span>
      </div>
      <div className="tv-matchup">
        {side(match.team1Player1Id, match.team1Player2Id, leftWin, false)}
        {confirmed ? (
          <div className="tv-score-center">
            <span className={leftWin ? 'tv-win' : ''}>{match.team1Score}</span>
            <span> – </span>
            <span className={rightWin ? 'tv-win' : ''}>{match.team2Score}</span>
          </div>
        ) : (
          <div className="tv-score-center vs">VS</div>
        )}
        {side(match.team2Player1Id, match.team2Player2Id, rightWin, true)}
      </div>
    </article>
  );
}

function StandingsTable({
  rows,
  event,
  rowMode,
}: {
  rows: PublicStanding[];
  event: PublicEvent;
  rowMode: 'full' | 'rest';
}) {
  const compact = rowMode === 'full' && rows.length > 16;
  return (
    <div className={`tv-stand-rows ${compact ? 'compact' : ''} ${rowMode === 'rest' ? 'short' : ''}`}>
      {rows.map((row) => {
        const name = row.user.name || row.user.username || displayName(row.userId, event, rows);
        return (
          <div key={row.userId} className={row.rank <= 3 ? 'tv-stand-row top' : 'tv-stand-row'}>
            <span className={`tv-rank ${rankClass(row.rank)}`}>{row.rank}</span>
            <div className="tv-person">
              <TvAvatar avatarId={row.user.avatarId} name={name} size={rowMode === 'rest' ? 32 : 34} />
              <span className="tv-ellipsis tv-name-sm">{name}</span>
            </div>
            <span className={`tv-net ${netClass(row.netDifferential)}`}>{formatNet(row.netDifferential)}</span>
            <span className="tv-pts">{row.totalPointsScored}</span>
            <span className="tv-wl">{row.wins}–{row.losses}</span>
          </div>
        );
      })}
    </div>
  );
}

function SetupState({
  event,
  americano,
  eventId,
  now,
  lastSuccessAt,
}: {
  event: PublicEvent;
  americano: PublicAmericano;
  eventId: string;
  now: Date;
  lastSuccessAt: Date | null;
}) {
  return (
    <>
      <div className="tv-body">
        <section className="tv-setup-main">
          <span className="tv-pill soon tv-pulse">STARTING SOON</span>
          <p className="tv-kicker">PADEL · AMERICANO</p>
          <h2 className="tv-hero-title">{event.title}</h2>
          <p className="tv-when">{dubaiWhen(event.startsAt)}{event.address ? ` · ${event.address}` : ''}</p>
          <div className="tv-chips">
            <div className="tv-chip">
              <strong>Partners rotate</strong>
              <span>New teammate every round</span>
            </div>
            <div className="tv-chip">
              <strong>{americano.pointsPerRound} points</strong>
              <span>Per match, every point counts</span>
            </div>
            {americano.totalRounds > 0 && (
              <div className="tv-chip">
                <strong>{americano.totalRounds} rounds</strong>
                <span>Best point difference wins</span>
              </div>
            )}
          </div>
          <p className="tv-section-label">TONIGHT&apos;S PLAYERS {event.joinedCount}/{event.maxPlayers}</p>
          <PlayerGrid event={event} />
        </section>
        <aside className="tv-qr-panel">
          <QrTile value={liveViewerUrl(eventId)} tile={340} />
          <h2>Follow live on your phone</h2>
          <p>Courts, scores and standings update every round. No download needed.</p>
        </aside>
      </div>
      <footer className="tv-footer">
        <span>Court assignments appear here the moment the host starts round 1</span>
        <Sync lastSuccessAt={lastSuccessAt} now={now} />
      </footer>
    </>
  );
}

function SitOutCard({
  userIds,
  event,
  standings,
}: {
  userIds: string[];
  event: PublicEvent;
  standings: PublicStanding[];
}) {
  const people = userIds.slice(0, 4);
  return (
    <article className="tv-court tv-sit-card">
      <h3 className="tv-court-name tv-sit-label">Sitting out</h3>
      <div className="tv-sit-list">
        {people.map((userId) => {
          const name = displayName(userId, event, standings);
          const avatarId = event.participants.find((player) => player.userId === userId)?.avatarId
            ?? standings.find((row) => row.userId === userId)?.user.avatarId;
          return (
            <div key={userId} className="tv-person">
              <TvAvatar avatarId={avatarId} name={name} size={44} />
              <span className="tv-ellipsis tv-name-lg">{name}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ActiveState({
  event,
  americano,
  eventId,
  now,
  lastSuccessAt,
}: {
  event: PublicEvent;
  americano: PublicAmericano;
  eventId: string;
  now: Date;
  lastSuccessAt: Date | null;
}) {
  const active = americano.rounds.find((round) => round.status === 'ACTIVE') ?? null;
  const upcoming = americano.rounds.find((round) => round.status === 'PENDING') ?? null;
  const sitIds = active?.sitOuts.map((sit) => sit.userId) ?? [];
  const sitNames = sitIds.map((userId) => displayName(userId, event, americano.standings));
  const threeCourts = active?.matches.length === 3;
  const nextSitNames = upcoming?.sitOuts.map((sit) => displayName(sit.userId, event, americano.standings)) ?? [];
  return (
    <div className="tv-body">
      <section className="tv-left">
        {active ? (
          <div className={active.matches.length > 4 ? 'tv-courts many' : threeCourts ? 'tv-courts quad' : 'tv-courts'}>
            {active.matches.map((match) => (
              <CourtCard key={match.id} match={match} event={event} americano={americano} />
            ))}
            {threeCourts && (
              <SitOutCard userIds={sitIds} event={event} standings={americano.standings} />
            )}
          </div>
        ) : (
          <p className="tv-muted">The next round has not started yet.</p>
        )}
        {!threeCourts && sitNames.length > 0 && <p className="tv-sit">Sitting out: {sitNames.join(', ')}</p>}
        {upcoming && (
          <div className="tv-upnext">
            <div className="tv-upnext-main">
              <p className="tv-upnext-kicker">UP NEXT · ROUND {upcoming.roundNumber}</p>
              <div className="tv-next-grid">
                {upcoming.matches.map((match) => (
                  <div key={match.id} className="tv-next-item">
                    <span className="tv-next-court">C{match.courtNumber}</span>
                    <span className="tv-next-names">
                      <span className="tv-next-line tv-ellipsis">
                        {displayName(match.team1Player1Id, event, americano.standings)} & {displayName(match.team1Player2Id, event, americano.standings)}
                      </span>
                      <span className="tv-next-line dim tv-ellipsis">
                        vs {displayName(match.team2Player1Id, event, americano.standings)} & {displayName(match.team2Player2Id, event, americano.standings)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              {nextSitNames.length > 0 && (
                <p className="tv-sit">Sitting out next: {nextSitNames.join(', ')}</p>
              )}
            </div>
            <div className="tv-qr-copy">
              <QrTile value={liveViewerUrl(eventId)} tile={172} />
              <strong>Live scores on your phone</strong>
              <span>Scan · no download needed</span>
            </div>
          </div>
        )}
      </section>
      <aside className="tv-stand">
        <div className="tv-stand-head">
          <h2>STANDINGS</h2>
          <p>Ranked by point difference</p>
        </div>
        {americano.scoresHidden ? (
          <div className="tv-hidden-note">Standings revealed at the end</div>
        ) : (
          <>
            <div className="tv-stand-cols">
              <span>#</span>
              <span>PLAYER</span>
              <span>+/−</span>
              <span>PTS</span>
              <span>W–L</span>
            </div>
            <StandingsTable rows={americano.standings} event={event} rowMode="full" />
          </>
        )}
        <div className="tv-stand-foot">
          <span>Scores appear once both teams confirm</span>
          <Sync lastSuccessAt={lastSuccessAt} now={now} />
        </div>
      </aside>
    </div>
  );
}

function CompletedState({
  event,
  americano,
  now,
  lastSuccessAt,
}: {
  event: PublicEvent;
  americano: PublicAmericano;
  now: Date;
  lastSuccessAt: Date | null;
}) {
  const places = [2, 1, 3]
    .map((rank) => americano.standings.find((row) => row.rank === rank))
    .filter((row): row is PublicStanding => row != null);
  const rest = americano.standings.filter((row) => row.rank >= 4);
  return (
    <div className="tv-final">
      <span className="tv-pill results">FINAL RESULTS</span>
      <div className="tv-body">
        <div className="tv-podium">
          {places.map((row) => {
            const name = row.user.name || row.user.username || displayName(row.userId, event, americano.standings);
            const tone = rankClass(row.rank);
            return (
              <div key={row.userId} className="tv-podium-col">
                <div className={`tv-ring ${tone}`}>
                  <TvAvatar avatarId={row.user.avatarId} name={name} size={84} />
                </div>
                <span className="tv-podium-name tv-ellipsis">{name}</span>
                <div className={`tv-block ${tone}`}>
                  <span className="tv-place-num">{row.rank}</span>
                  <span className={`tv-net ${netClass(row.netDifferential)}`}>{formatNet(row.netDifferential)}</span>
                  <span className="tv-pts">PTS {row.totalPointsScored}</span>
                  <span className="tv-wl">{row.wins}–{row.losses}</span>
                </div>
              </div>
            );
          })}
        </div>
        <aside className="tv-stand tv-final-table">
          <div className="tv-stand-head">
            <h2>FULL TABLE</h2>
          </div>
          <div className="tv-stand-cols">
            <span>#</span>
            <span>PLAYER</span>
            <span>+/−</span>
            <span>PTS</span>
            <span>W–L</span>
          </div>
          <StandingsTable rows={rest} event={event} rowMode="rest" />
        </aside>
      </div>
      <footer className="tv-footer">
        <div className="tv-final-foot">
          <QrTile value={FINAL_QR_URL} tile={120} />
          <p>
            Rate your partners and keep your points on Playy
            <span>Scan to download</span>
          </p>
        </div>
        <Sync lastSuccessAt={lastSuccessAt} now={now} />
      </footer>
    </div>
  );
}

type TvViewProps = {
  data: PublicEventResponse;
  lastSuccessAt: Date | null;
  eventId: string;
};

export default function TvView({ data, lastSuccessAt, eventId }: TvViewProps) {
  useTvBodyLock();
  const scale = useStageScale();
  const now = useNow();
  const { event, americano } = data;

  let body: ReactNode;
  if (!americano) {
    body = (
      <>
        <div className="tv-body">
          <section className="tv-fallback-main">
            <PlayerGrid event={event} />
          </section>
        </div>
        <footer className="tv-footer">
          <span />
          <Sync lastSuccessAt={lastSuccessAt} now={now} />
        </footer>
      </>
    );
  } else if (americano.status === 'SETUP') {
    body = <SetupState event={event} americano={americano} eventId={eventId} now={now} lastSuccessAt={lastSuccessAt} />;
  } else if (americano.status === 'COMPLETED') {
    body = <CompletedState event={event} americano={americano} now={now} lastSuccessAt={lastSuccessAt} />;
  } else {
    body = <ActiveState event={event} americano={americano} eventId={eventId} now={now} lastSuccessAt={lastSuccessAt} />;
  }

  return (
    <div className="tv-root">
      <div className="tv-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <Header event={event} americano={americano} now={now} />
        {body}
      </div>
    </div>
  );
}
