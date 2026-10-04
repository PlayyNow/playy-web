import data from './americano.json';

export type SandboxRound = {
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

export type SandboxScenario = {
  courtCount: number;
  totalRounds: number;
  rounds: SandboxRound[];
};

type FixtureFile = {
  seed: number;
  players: string[];
  scenarios: {
    '16p4c': SandboxScenario;
    '16p3c': SandboxScenario;
  };
};

const fixture = data as FixtureFile;

export function sandboxScenario(courtCount: number): SandboxScenario {
  return courtCount >= 4 ? fixture.scenarios['16p4c'] : fixture.scenarios['16p3c'];
}
