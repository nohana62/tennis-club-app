import type { StoredDoublesMatch } from '../types';

export interface DoublesGameRankingEntry {
  id: string;
  name: string;
  matchesPlayed: number;
  totalGames: number;
  rank: number;
}

export function isValidDoublesGames(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 99;
}

export function hasDoublesScore(
  match: Pick<StoredDoublesMatch, 'teamAGames' | 'teamBGames'>,
): boolean {
  return isValidDoublesGames(match.teamAGames) && isValidDoublesGames(match.teamBGames);
}

export function buildDoublesGameRanking(
  matches: StoredDoublesMatch[],
): DoublesGameRankingEntry[] {
  const totals = new Map<string, Omit<DoublesGameRankingEntry, 'rank'>>();

  matches.filter(hasDoublesScore).forEach((match) => {
    const teams = [
      { participants: match.teamA, games: match.teamAGames! },
      { participants: match.teamB, games: match.teamBGames! },
    ];
    teams.forEach(({ participants, games }) => {
      participants.forEach((participant) => {
        const current = totals.get(participant.id) ?? {
          id: participant.id,
          name: participant.name,
          matchesPlayed: 0,
          totalGames: 0,
        };
        current.matchesPlayed += 1;
        current.totalGames += games;
        totals.set(participant.id, current);
      });
    });
  });

  const sorted = [...totals.values()]
    .sort((a, b) => b.totalGames - a.totalGames || a.name.localeCompare(b.name, 'ja'));
  let previousGames = -1;
  let currentRank = 0;

  return sorted.map((entry, index) => {
    if (entry.totalGames !== previousGames) {
      currentRank = index + 1;
      previousGames = entry.totalGames;
    }
    return { ...entry, rank: currentRank };
  });
}
