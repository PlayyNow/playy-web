import type { PublicEventResponse, PublicMatch, PublicParticipant, PublicRound, PublicStanding } from '../types';
import { buildAmericanoPreview, computeAmericanoStandings, generateAmericanoSchedule } from './americanoSchedule';

export type SandboxState = 'setup' | 'live' | 'final';

const HOST_ID = 'p01';
const BASE_PLAYERS = 16;
const POINTS = 24;
const BASE_NAMES = [
  'Hana Kapoor',
  'Luca Moretti',
  'Sara Haddad',
  'Omar Faris',
  'Maya Chen',
  'Jon Santos',
  'Leila Nour',
  'Adam Berg',
  'Noor Saleh',
  'Chris Adeyemi',
  'Priya Shah',
  'Evan Brooks',
  'Lina Mansour',
  'Tom Berger',
  'Aisha Rahman',
  'Leo Martins',
];
const LONG_NAMES = ['Pakipretender2801', 'Yogi From Queens'];
const DECISIVE: Array<[number, number]> = [
  [16, 8],
  [14, 10],
  [18, 6],
  [15, 9],
  [20, 4],
  [13, 11],
  [17, 7],
  [19, 5],
  [21, 3],
  [10, 14],
  [8, 16],
  [11, 13],
];

function playerId(index: number): string {
  return `p${String(index + 1).padStart(2, '0')}`;
}

export function parseCourtCount(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 3;
  return Math.min(4, n);
}

export function parseSandboxState(raw: string | null): SandboxState {
  if (raw === 'setup' || raw === 'final' || raw === 'live') return raw;
  return 'live';
}

export function buildSandboxEvent(courtCount: number, state: SandboxState): PublicEventResponse {
  const courts = parseCourtCount(String(courtCount));
  buildAmericanoPreview(BASE_PLAYERS, courts);
  const rosterIds = Array.from({ length: BASE_PLAYERS }, (_, index) => playerId(index));
  const schedule = generateAmericanoSchedule(rosterIds, courts);
  const activeRoundNumber = schedule.rounds.length >= 2 ? 2 : 1;
  const featuredRound = schedule.rounds.find((round) => round.roundNumber === activeRoundNumber) ?? schedule.rounds[0];
  const featuredIds = featuredRound
    ? featuredRound.matches.flatMap((match) => [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ])
    : [];
  const longTargets = featuredIds.filter((id) => id !== HOST_ID).slice(0, 2);
  const names = new Map(rosterIds.map((id, index) => [id, BASE_NAMES[index] ?? 'Player']));
  longTargets.forEach((id, index) => {
    const longName = LONG_NAMES[index];
    if (longName) names.set(id, longName);
  });

  const participants: PublicParticipant[] = [...names.entries()].map(([userId, name], index) => ({
    userId,
    name,
    username: name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    avatarId: `avatar_${(index % 6) + 1}`,
    role: userId === HOST_ID ? 'HOST' : 'PARTICIPANT',
    status: 'JOINED',
  }));

  const activeStartedAt = new Date(Date.now() - (6 * 60 + 12) * 1000).toISOString();
  let decisiveCursor = 0;
  const nextDecisive = (): [number, number] => {
    const pair = DECISIVE[decisiveCursor % DECISIVE.length];
    decisiveCursor += 1;
    return pair;
  };

  const rounds: PublicRound[] = state === 'setup'
    ? []
    : schedule.rounds.map((round) => {
      const isActiveSlot = round.roundNumber === activeRoundNumber;
      const roundStatus: PublicRound['status'] = state === 'final'
        ? 'COMPLETED'
        : round.roundNumber < activeRoundNumber
          ? 'COMPLETED'
          : isActiveSlot
            ? 'ACTIVE'
            : 'PENDING';
      const sitOuts = round.sitOutUserIds.map((userId) => ({ userId }));

      let confirmedOnActive = 0;
      const matches: PublicMatch[] = round.matches.map((match) => {
        let scoreStatus: PublicMatch['scoreStatus'] = 'PENDING';
        let scores: [number, number] | null = null;
        if (roundStatus === 'COMPLETED') {
          scoreStatus = 'CONFIRMED';
          scores = round.roundNumber === 1 && match.courtNumber === 1 ? [12, 12] : nextDecisive();
        } else if (roundStatus === 'ACTIVE') {
          const pattern: PublicMatch['scoreStatus'][] = ['CONFIRMED', 'PENDING', 'CONFLICT', 'CONFIRMED'];
          scoreStatus = pattern[Math.min(match.courtNumber - 1, pattern.length - 1)] ?? 'PENDING';
          if (scoreStatus === 'CONFIRMED') {
            scores = confirmedOnActive === 0 ? [12, 12] : [16, 8];
            confirmedOnActive += 1;
          }
        }
        return {
          id: `m-${round.roundNumber}-${match.courtNumber}`,
          courtNumber: match.courtNumber,
          team1Player1Id: match.team1Player1Id,
          team1Player2Id: match.team1Player2Id,
          team2Player1Id: match.team2Player1Id,
          team2Player2Id: match.team2Player2Id,
          team1Score: scores ? scores[0] : null,
          team2Score: scores ? scores[1] : null,
          scoreStatus,
        };
      });

      return {
        id: `round-${round.roundNumber}`,
        roundNumber: round.roundNumber,
        status: roundStatus,
        startedAt: roundStatus === 'PENDING'
          ? null
          : roundStatus === 'ACTIVE'
            ? activeStartedAt
            : '2026-09-24T14:05:00.000Z',
        completedAt: roundStatus === 'COMPLETED' ? '2026-09-24T14:25:00.000Z' : null,
        matches,
        sitOuts,
      };
    });

  const computed = computeAmericanoStandings(rounds);
  const byId = new Map(participants.map((player) => [player.userId, player]));
  const standings: PublicStanding[] = state === 'setup'
    ? []
    : computed.map((row) => {
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

  const active = rounds.find((round) => round.status === 'ACTIVE');
  const courtNames = ['Centre', 'Palm', 'Marina', 'JBR'].slice(0, courts);

  return {
    event: {
      id: 'preview-americano',
      title: 'Thursday Night Americano',
      sport: 'Padel',
      format: 'PADEL_AMERICANO',
      eventType: 'FRIENDLY',
      type: 'SESSION',
      startsAt: '2026-09-24T14:00:00.000Z',
      endsAt: '2026-09-24T17:00:00.000Z',
      address: 'NAS Sports Complex, Al Quoz',
      maxPlayers: participants.length,
      joinedCount: participants.length,
      organizer: {
        name: names.get(HOST_ID) ?? 'Host',
        username: 'hanakapoor',
        avatarId: 'avatar_1',
        isVerified: true,
      },
      participants,
    },
    americano: {
      status: state === 'setup' ? 'SETUP' : state === 'final' ? 'COMPLETED' : 'ACTIVE',
      courtCount: courts,
      totalRounds: schedule.totalRounds,
      pointsPerRound: POINTS,
      courtNames,
      hideScoresUntilEnd: false,
      scoresHidden: false,
      currentRound: active ? active.roundNumber : null,
      standings,
      rounds,
    },
  };
}
