// Pure port of backend/src/services/americano.service.ts (preview, schedule, standings).
// Kept local so the dev preview can run the real rotation without importing Prisma.

export type ScheduledRound = {
  roundNumber: number;
  sitOutUserIds: string[];
  matches: Array<{
    courtNumber: number;
    team1Player1Id: string;
    team1Player2Id: string;
    team2Player1Id: string;
    team2Player2Id: string;
  }>;
};

type ScoreStatus = 'PENDING' | 'CONFLICT' | 'CONFIRMED';

type PlayerStanding = {
  userId: string;
  totalPointsScored: number;
  totalPointsConceded: number;
  netDifferential: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  sitOuts: number;
  rank: number;
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function getPairCount(map: Map<string, number>, a: string, b: string): number {
  return map.get(pairKey(a, b)) || 0;
}

function incPairCount(map: Map<string, number>, a: string, b: string): void {
  const key = pairKey(a, b);
  map.set(key, (map.get(key) || 0) + 1);
}

function getDuelValue(duelMap: Map<string, Map<string, number>>, a: string, b: string): number {
  const row = duelMap.get(a);
  if (!row) return 0;
  return row.get(b) || 0;
}

export function buildAmericanoPreview(playerCount: number, courtCount: number): { sitOutPerRound: number; estimatedRounds: number } {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount % 4 !== 0) {
    throw new Error('Player count must be a multiple of 4 and at least 4');
  }
  if (!Number.isInteger(courtCount) || courtCount < 1) {
    throw new Error('Court count must be at least 1');
  }
  const activeSlotsPerRound = courtCount * 4;
  if (activeSlotsPerRound > playerCount) {
    throw new Error('Court count is too high for current players');
  }
  const estimatedRounds = Math.max(1, Math.ceil(((playerCount - 1) * playerCount) / activeSlotsPerRound));
  return {
    sitOutPerRound: playerCount - activeSlotsPerRound,
    estimatedRounds,
  };
}

function pickSitOutsForRound(
  allPlayers: string[],
  sitOutCountMap: Map<string, number>,
  lastSitOutRoundMap: Map<string, number>,
  roundNumber: number,
  sitOutPerRound: number,
): string[] {
  if (sitOutPerRound <= 0) return [];

  const notBackToBack = allPlayers.filter((playerId) => (lastSitOutRoundMap.get(playerId) || -9999) !== roundNumber - 1);
  const candidatePool = notBackToBack.length >= sitOutPerRound ? notBackToBack : allPlayers;

  const ordered = [...candidatePool].sort((a, b) => {
    const aSitOuts = sitOutCountMap.get(a) || 0;
    const bSitOuts = sitOutCountMap.get(b) || 0;
    if (aSitOuts !== bSitOuts) return aSitOuts - bSitOuts;
    const aLast = lastSitOutRoundMap.get(a) || -9999;
    const bLast = lastSitOutRoundMap.get(b) || -9999;
    if (aLast !== bLast) return aLast - bLast;
    return a.localeCompare(b);
  });

  const selected = ordered.slice(0, sitOutPerRound);
  selected.forEach((playerId) => {
    sitOutCountMap.set(playerId, (sitOutCountMap.get(playerId) || 0) + 1);
    lastSitOutRoundMap.set(playerId, roundNumber);
  });
  return selected;
}

function buildTeamsForRound(
  activePlayers: string[],
  teammateCountMap: Map<string, number>,
): Array<[string, string]> {
  const pool = [...activePlayers].sort((a, b) => a.localeCompare(b));
  const teams: Array<[string, string]> = [];

  while (pool.length > 0) {
    let bestI = 0;
    let bestJ = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestKey = '';
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const a = pool[i];
        const b = pool[j];
        const repeatScore = getPairCount(teammateCountMap, a, b);
        const key = `${a}|${b}`;
        if (repeatScore < bestScore || (repeatScore === bestScore && key < bestKey)) {
          bestScore = repeatScore;
          bestI = i;
          bestJ = j;
          bestKey = key;
        }
      }
    }
    const b = pool.splice(bestJ, 1)[0];
    const a = pool.splice(bestI, 1)[0];
    teams.push([a, b]);
  }
  return teams;
}

function buildMatchesForRound(
  teams: Array<[string, string]>,
  opponentCountMap: Map<string, number>,
): ScheduledRound['matches'] {
  const remaining = [...teams];
  const matches: ScheduledRound['matches'] = [];
  let courtNumber = 1;

  while (remaining.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestKey = '';

    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const [a1, a2] = remaining[i];
        const [b1, b2] = remaining[j];
        const score = getPairCount(opponentCountMap, a1, b1)
          + getPairCount(opponentCountMap, a1, b2)
          + getPairCount(opponentCountMap, a2, b1)
          + getPairCount(opponentCountMap, a2, b2);
        const key = `${[a1, a2].join('|')}~${[b1, b2].join('|')}`;
        if (score < bestScore || (score === bestScore && key < bestKey)) {
          bestScore = score;
          bestI = i;
          bestJ = j;
          bestKey = key;
        }
      }
    }

    const team2 = remaining.splice(bestJ, 1)[0];
    const team1 = remaining.splice(bestI, 1)[0];
    matches.push({
      courtNumber,
      team1Player1Id: team1[0],
      team1Player2Id: team1[1],
      team2Player1Id: team2[0],
      team2Player2Id: team2[1],
    });
    courtNumber += 1;
  }

  return matches;
}

export function generateAmericanoSchedule(playerIds: string[], courtCount: number): { totalRounds: number; rounds: ScheduledRound[] } {
  const sortedPlayers = [...new Set(playerIds)].sort((a, b) => a.localeCompare(b));
  const preview = buildAmericanoPreview(sortedPlayers.length, courtCount);

  const sitOutCountMap = new Map<string, number>();
  const lastSitOutRoundMap = new Map<string, number>();
  const teammateCountMap = new Map<string, number>();
  const opponentCountMap = new Map<string, number>();
  sortedPlayers.forEach((playerId) => {
    sitOutCountMap.set(playerId, 0);
    lastSitOutRoundMap.set(playerId, -9999);
  });

  const rounds: ScheduledRound[] = [];
  for (let roundNumber = 1; roundNumber <= preview.estimatedRounds; roundNumber += 1) {
    const sitOutUserIds = pickSitOutsForRound(
      sortedPlayers,
      sitOutCountMap,
      lastSitOutRoundMap,
      roundNumber,
      preview.sitOutPerRound,
    );

    const activeSet = new Set(sortedPlayers);
    sitOutUserIds.forEach((id) => activeSet.delete(id));
    const activePlayers = [...activeSet].sort((a, b) => a.localeCompare(b));
    const teams = buildTeamsForRound(activePlayers, teammateCountMap);
    teams.forEach(([a, b]) => incPairCount(teammateCountMap, a, b));

    const matches = buildMatchesForRound(teams, opponentCountMap);
    matches.forEach((match) => {
      const team1 = [match.team1Player1Id, match.team1Player2Id];
      const team2 = [match.team2Player1Id, match.team2Player2Id];
      team1.forEach((a) => team2.forEach((b) => incPairCount(opponentCountMap, a, b)));
    });

    rounds.push({ roundNumber, sitOutUserIds, matches });
  }

  return { totalRounds: preview.estimatedRounds, rounds };
}

export function computeAmericanoStandings(rounds: Array<{
  sitOuts: Array<{ userId: string }>;
  matches: Array<{
    scoreStatus: ScoreStatus;
    team1Score: number | null;
    team2Score: number | null;
    team1Player1Id: string;
    team1Player2Id: string;
    team2Player1Id: string;
    team2Player2Id: string;
  }>;
}>): PlayerStanding[] {
  const stats = new Map<string, Omit<PlayerStanding, 'rank'>>();
  const duelMap = new Map<string, Map<string, number>>();

  const getRow = (id: string): Omit<PlayerStanding, 'rank'> => {
    const existing = stats.get(id);
    if (existing) return existing;
    const created: Omit<PlayerStanding, 'rank'> = {
      userId: id,
      totalPointsScored: 0,
      totalPointsConceded: 0,
      netDifferential: 0,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      sitOuts: 0,
    };
    stats.set(id, created);
    return created;
  };

  const addDuel = (a: string, b: string, delta: number) => {
    if (!duelMap.has(a)) duelMap.set(a, new Map<string, number>());
    const row = duelMap.get(a)!;
    row.set(b, (row.get(b) || 0) + delta);
  };

  rounds.forEach((round) => {
    round.sitOuts.forEach(({ userId }) => {
      const stat = getRow(userId);
      stat.sitOuts += 1;
    });

    round.matches.forEach((match) => {
      const team1 = [match.team1Player1Id, match.team1Player2Id];
      const team2 = [match.team2Player1Id, match.team2Player2Id];
      team1.concat(team2).forEach((id) => getRow(id));
      if (match.scoreStatus !== 'CONFIRMED' || match.team1Score === null || match.team2Score === null) {
        return;
      }

      const team1Win = match.team1Score > match.team2Score;
      const team2Win = match.team2Score > match.team1Score;
      team1.forEach((id) => {
        const stat = getRow(id);
        stat.totalPointsScored += match.team1Score!;
        stat.totalPointsConceded += match.team2Score!;
        stat.netDifferential += match.team1Score! - match.team2Score!;
        stat.matchesPlayed += 1;
        if (team1Win) stat.wins += 1;
        if (team2Win) stat.losses += 1;
      });
      team2.forEach((id) => {
        const stat = getRow(id);
        stat.totalPointsScored += match.team2Score!;
        stat.totalPointsConceded += match.team1Score!;
        stat.netDifferential += match.team2Score! - match.team1Score!;
        stat.matchesPlayed += 1;
        if (team2Win) stat.wins += 1;
        if (team1Win) stat.losses += 1;
      });

      team1.forEach((a) => {
        team2.forEach((b) => {
          addDuel(a, b, match.team1Score! - match.team2Score!);
          addDuel(b, a, match.team2Score! - match.team1Score!);
        });
      });
    });
  });

  const sorted = [...stats.values()].sort((a, b) => {
    if (b.netDifferential !== a.netDifferential) return b.netDifferential - a.netDifferential;
    const h2hA = getDuelValue(duelMap, a.userId, b.userId);
    const h2hB = getDuelValue(duelMap, b.userId, a.userId);
    if (h2hA !== h2hB) return h2hB - h2hA;
    if (b.totalPointsScored !== a.totalPointsScored) return b.totalPointsScored - a.totalPointsScored;
    return a.userId.localeCompare(b.userId);
  });

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
