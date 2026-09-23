import type { PublicEventResponse, PublicRound, PublicStanding } from '../types';
import { computeAmericanoStandings, generateAmericanoSchedule } from './americanoSchedule';
import { buildSandboxEvent } from './buildSandbox';

const SCORE_PAIRS: Array<[number, number]> = [
  [16, 8],
  [14, 10],
  [15, 9],
  [13, 11],
  [18, 6],
  [17, 7],
  [12, 12],
  [19, 5],
  [20, 4],
  [11, 13],
];

function activeRound(data: PublicEventResponse): PublicRound | null {
  return data.americano?.rounds.find((round) => round.status === 'ACTIVE') ?? null;
}

function confirmedTotal(data: PublicEventResponse): number {
  return data.americano?.rounds.reduce(
    (count, round) => count + round.matches.filter((match) => match.scoreStatus === 'CONFIRMED').length,
    0,
  ) ?? 0;
}

function applyStandings(data: PublicEventResponse): void {
  const americano = data.americano;
  if (!americano || americano.status === 'SETUP') {
    if (americano) americano.standings = [];
    return;
  }
  const byId = new Map(data.event.participants.map((player) => [player.userId, player]));
  const computed = computeAmericanoStandings(americano.rounds);
  const standings: PublicStanding[] = computed.map((row) => {
    const player = byId.get(row.userId);
    return {
      userId: row.userId,
      rank: row.rank,
      netDifferential: row.netDifferential,
      totalPointsScored: row.totalPointsScored,
      totalPointsConceded: row.totalPointsConceded,
      wins: row.wins,
      losses: row.losses,
      matchesPlayed: row.matchesPlayed,
      sitOuts: row.sitOuts,
      user: {
        id: row.userId,
        name: player?.name ?? 'Player',
        username: player?.username ?? null,
        avatarId: player?.avatarId ?? null,
      },
    };
  });
  americano.standings = standings;
}

function scorePair(points: number, index: number): [number, number] {
  const pair = SCORE_PAIRS[index % SCORE_PAIRS.length] ?? [points - 8, 8];
  if (pair[0] + pair[1] === points) return pair;
  const high = Math.min(points - 1, Math.ceil(points / 2) + 2);
  return [high, points - high];
}

export function resetTournament(courtCount: number): PublicEventResponse {
  return buildSandboxEvent(courtCount, 'setup');
}

export function startTournament(data: PublicEventResponse): PublicEventResponse {
  const americano = data.americano;
  if (!americano || americano.status !== 'SETUP') return data;
  const next = structuredClone(data);
  const board = next.americano;
  if (!board) return data;
  const roster = next.event.participants.map((player) => player.userId);
  const schedule = generateAmericanoSchedule(roster, board.courtCount);
  const startedAt = new Date().toISOString();
  board.status = 'ACTIVE';
  board.totalRounds = schedule.totalRounds;
  board.currentRound = 1;
  board.rounds = schedule.rounds.map((round) => ({
    id: `round-${round.roundNumber}`,
    roundNumber: round.roundNumber,
    status: round.roundNumber === 1 ? 'ACTIVE' : 'PENDING',
    startedAt: round.roundNumber === 1 ? startedAt : null,
    completedAt: null,
    sitOuts: round.sitOutUserIds.map((userId) => ({ userId })),
    matches: round.matches.map((match) => ({
      id: `m-${round.roundNumber}-${match.courtNumber}`,
      courtNumber: match.courtNumber,
      team1Player1Id: match.team1Player1Id,
      team1Player2Id: match.team1Player2Id,
      team2Player1Id: match.team2Player1Id,
      team2Player2Id: match.team2Player2Id,
      team1Score: null,
      team2Score: null,
      scoreStatus: 'PENDING' as const,
    })),
  }));
  applyStandings(next);
  return next;
}

export function confirmNext(data: PublicEventResponse): PublicEventResponse {
  const active = activeRound(data);
  const match = active?.matches.find((item) => item.scoreStatus !== 'CONFIRMED');
  if (!data.americano || !active || !match) return data;
  const next = structuredClone(data);
  const round = next.americano?.rounds.find((item) => item.status === 'ACTIVE');
  const target = round?.matches.find((item) => item.id === match.id);
  if (!next.americano || !target) return data;
  const [team1Score, team2Score] = scorePair(next.americano.pointsPerRound, confirmedTotal(data));
  target.scoreStatus = 'CONFIRMED';
  target.team1Score = team1Score;
  target.team2Score = team2Score;
  applyStandings(next);
  return next;
}

export function markNextConflict(data: PublicEventResponse): PublicEventResponse {
  const active = activeRound(data);
  const match = active?.matches.find((item) => item.scoreStatus === 'PENDING');
  if (!active || !match) return data;
  const next = structuredClone(data);
  const target = next.americano?.rounds
    .find((round) => round.status === 'ACTIVE')
    ?.matches.find((item) => item.id === match.id);
  if (!target) return data;
  target.scoreStatus = 'CONFLICT';
  target.team1Score = null;
  target.team2Score = null;
  return next;
}

export function advanceRound(data: PublicEventResponse): PublicEventResponse {
  const americano = data.americano;
  const active = activeRound(data);
  if (!americano || !active) return data;
  if (active.matches.some((match) => match.scoreStatus !== 'CONFIRMED')) return data;
  const upcoming = americano.rounds.find((round) => round.status === 'PENDING');
  if (!upcoming) return data;
  const next = structuredClone(data);
  const board = next.americano;
  if (!board) return data;
  const current = board.rounds.find((round) => round.id === active.id);
  const following = board.rounds.find((round) => round.id === upcoming.id);
  if (!current || !following) return data;
  const now = new Date().toISOString();
  current.status = 'COMPLETED';
  current.completedAt = now;
  following.status = 'ACTIVE';
  following.startedAt = now;
  board.status = 'ACTIVE';
  board.currentRound = following.roundNumber;
  return next;
}

export function finishTournament(data: PublicEventResponse): PublicEventResponse {
  const americano = data.americano;
  if (!americano || americano.status !== 'ACTIVE') return data;
  const pending = americano.rounds.some((round) => round.status === 'PENDING');
  const active = activeRound(data);
  if (pending || !active || active.matches.some((match) => match.scoreStatus !== 'CONFIRMED')) return data;
  const next = structuredClone(data);
  const board = next.americano;
  const round = board?.rounds.find((item) => item.id === active.id);
  if (!board || !round) return data;
  round.status = 'COMPLETED';
  round.completedAt = new Date().toISOString();
  board.status = 'COMPLETED';
  board.currentRound = null;
  return next;
}

export function autoStep(data: PublicEventResponse): PublicEventResponse | null {
  const americano = data.americano;
  if (!americano || americano.status === 'COMPLETED') return null;
  if (americano.status === 'SETUP') return startTournament(data);
  const active = activeRound(data);
  if (active && active.matches.some((match) => match.scoreStatus !== 'CONFIRMED')) {
    return confirmNext(data);
  }
  if (americano.rounds.some((round) => round.status === 'PENDING')) {
    return advanceRound(data);
  }
  const finished = finishTournament(data);
  return finished === data ? null : finished;
}

export type SimReadout = {
  status: string;
  activeRound: number | null;
  confirmed: number;
  matchCount: number;
  players: number;
  courts: number;
  canStart: boolean;
  canConfirm: boolean;
  canConflict: boolean;
  canAdvance: boolean;
  canFinish: boolean;
};

export function readout(data: PublicEventResponse): SimReadout {
  const americano = data.americano;
  const active = activeRound(data);
  const confirmed = active?.matches.filter((match) => match.scoreStatus === 'CONFIRMED').length ?? 0;
  const matchCount = active?.matches.length ?? 0;
  const allConfirmed = matchCount > 0 && confirmed === matchCount;
  const hasPendingRound = americano?.rounds.some((round) => round.status === 'PENDING') ?? false;
  return {
    status: americano?.status ?? 'NONE',
    activeRound: active?.roundNumber ?? null,
    confirmed,
    matchCount,
    players: data.event.participants.length,
    courts: americano?.courtCount ?? 0,
    canStart: americano?.status === 'SETUP',
    canConfirm: Boolean(active?.matches.some((match) => match.scoreStatus !== 'CONFIRMED')),
    canConflict: Boolean(active?.matches.some((match) => match.scoreStatus === 'PENDING')),
    canAdvance: Boolean(americano?.status === 'ACTIVE' && allConfirmed && hasPendingRound),
    canFinish: Boolean(americano?.status === 'ACTIVE' && allConfirmed && !hasPendingRound),
  };
}
