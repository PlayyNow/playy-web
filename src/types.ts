export type PublicParticipant = {
  userId: string;
  name: string | null;
  username: string | null;
  avatarId: string | null;
  role: string;
  status: string;
};

export type PublicOrganizer = {
  name: string | null;
  username: string | null;
  avatarId: string | null;
  isVerified: boolean;
};

export type PublicEvent = {
  id: string;
  title: string;
  sport: string;
  format: string;
  eventType: string;
  type: string;
  startsAt: string;
  endsAt: string;
  address: string | null;
  maxPlayers: number;
  joinedCount: number;
  organizer: PublicOrganizer;
  participants: PublicParticipant[];
};

export type PublicMatch = {
  id: string;
  courtNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Score: number | null;
  team2Score: number | null;
  scoreStatus: 'PENDING' | 'CONFLICT' | 'CONFIRMED';
};

export type PublicRound = {
  id: string;
  roundNumber: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  startedAt: string | null;
  completedAt: string | null;
  matches: PublicMatch[];
  sitOuts: Array<{ userId: string }>;
};

export type PublicStanding = {
  userId: string;
  rank: number;
  netDifferential: number;
  totalPointsScored: number;
  totalPointsConceded: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  sitOuts: number;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatarId: string | null;
  };
};

export type PublicAmericano = {
  status: 'SETUP' | 'ACTIVE' | 'COMPLETED';
  courtCount: number;
  totalRounds: number;
  pointsPerRound: number;
  courtNames: string[] | null;
  hideScoresUntilEnd: boolean;
  scoresHidden: boolean;
  currentRound: number | null;
  standings: PublicStanding[];
  rounds: PublicRound[];
};

export type PublicEventResponse = {
  event: PublicEvent;
  americano: PublicAmericano | null;
};
