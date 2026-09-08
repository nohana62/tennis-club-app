export interface DoublesParticipant {
  id: string;
  name: string;
}

export interface DoublesMatch {
  number: number;
  teamA: [DoublesParticipant, DoublesParticipant];
  teamB: [DoublesParticipant, DoublesParticipant];
}

const SIMULATION_COUNT = 120;

function pairKey(a: DoublesParticipant, b: DoublesParticipant): string {
  return [a.id, b.id].sort().join('|');
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pairingOptions(
  players: [DoublesParticipant, DoublesParticipant, DoublesParticipant, DoublesParticipant],
): Array<Pick<DoublesMatch, 'teamA' | 'teamB'>> {
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

function pairingCost(
  option: Pick<DoublesMatch, 'teamA' | 'teamB'>,
  partnerCounts: Map<string, number>,
  opponentCounts: Map<string, number>,
): number {
  const partnerCost =
    (partnerCounts.get(pairKey(...option.teamA)) ?? 0)
    + (partnerCounts.get(pairKey(...option.teamB)) ?? 0);
  const opponentCost = option.teamA.reduce(
    (sum, a) => sum + option.teamB.reduce(
      (inner, b) => inner + (opponentCounts.get(pairKey(a, b)) ?? 0),
      0,
    ),
    0,
  );
  return partnerCost * 8 + opponentCost * 2;
}

function generateCandidate(
  participants: DoublesParticipant[],
  matchCount: number,
): { matches: DoublesMatch[]; score: number } {
  const appearances = new Map(participants.map((participant) => [participant.id, 0]));
  const lastPlayed = new Map(participants.map((participant) => [participant.id, -1]));
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const matches: DoublesMatch[] = [];

  for (let index = 0; index < matchCount; index += 1) {
    const selected = shuffled(participants)
      .sort((a, b) => {
        const appearanceDiff = (appearances.get(a.id) ?? 0) - (appearances.get(b.id) ?? 0);
        if (appearanceDiff !== 0) return appearanceDiff;
        return (lastPlayed.get(a.id) ?? -1) - (lastPlayed.get(b.id) ?? -1);
      })
      .slice(0, 4) as [DoublesParticipant, DoublesParticipant, DoublesParticipant, DoublesParticipant];

    const options = shuffled(pairingOptions(selected));
    const bestCost = Math.min(...options.map((option) => pairingCost(option, partnerCounts, opponentCounts)));
    const option = options.find(
      (candidate) => pairingCost(candidate, partnerCounts, opponentCounts) === bestCost,
    )!;

    matches.push({ number: index + 1, ...option });
    selected.forEach((participant) => {
      appearances.set(participant.id, (appearances.get(participant.id) ?? 0) + 1);
      lastPlayed.set(participant.id, index);
    });
    increment(partnerCounts, pairKey(...option.teamA));
    increment(partnerCounts, pairKey(...option.teamB));
    option.teamA.forEach((a) => option.teamB.forEach((b) => increment(opponentCounts, pairKey(a, b))));
  }

  const appearanceValues = [...appearances.values()];
  const appearanceSpread = Math.max(...appearanceValues) - Math.min(...appearanceValues);
  const repeatedPartners = [...partnerCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1) ** 2, 0);
  const repeatedOpponents = [...opponentCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1) ** 2, 0);

  return {
    matches,
    score: appearanceSpread * 10_000 + repeatedPartners * 20 + repeatedOpponents * 3,
  };
}

export function generateDoublesMatches(
  participants: DoublesParticipant[],
  matchCount: number,
): DoublesMatch[] {
  if (participants.length < 4 || !Number.isInteger(matchCount) || matchCount < 1) return [];

  let best = generateCandidate(participants, matchCount);
  for (let i = 1; i < SIMULATION_COUNT; i += 1) {
    const candidate = generateCandidate(participants, matchCount);
    if (candidate.score < best.score) best = candidate;
  }
  return best.matches;
}
