import type { Attendance, ClubEvent, Member } from '../types';
import { isEventCancelled } from './events';

export interface RainRankingEntry {
  id: string;
  name: string;
  count: number;
  rank: number;
  eventDates: string[];
}

export interface RainRankingResult {
  cancelledEventCount: number;
  entries: RainRankingEntry[];
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ja');
}

export function buildRainRanking(
  events: ClubEvent[],
  attendances: Attendance[],
  members: Member[],
  fromMonth: string,
  toMonth: string,
): RainRankingResult {
  const cancelledEvents = events.filter((event) => {
    const month = event.date.slice(0, 7);
    return Boolean(event.id) && isEventCancelled(event) && month >= fromMonth && month <= toMonth;
  });
  const memberById = new Map(
    members.filter((member) => member.id).map((member) => [member.id!, member]),
  );
  const memberByName = new Map(
    members.map((member) => [normalizeName(member.name), member]),
  );
  const totals = new Map<string, { name: string; events: Map<string, string> }>();

  cancelledEvents.forEach((event) => {
    const participants = new Map<string, string>();

    attendances
      .filter((attendance) => (
        attendance.eventId === event.id
        && attendance.status === 'attending'
        && attendance.memberName.trim()
      ))
      .forEach((attendance) => {
        const member = (attendance.memberId ? memberById.get(attendance.memberId) : undefined)
          ?? memberByName.get(normalizeName(attendance.memberName));
        const id = member?.id
          ? `member:${member.id}`
          : `name:${normalizeName(attendance.memberName)}`;
        participants.set(id, member?.name ?? attendance.memberName.trim());
      });

    participants.forEach((name, id) => {
      const total = totals.get(id) ?? { name, events: new Map<string, string>() };
      total.events.set(event.id!, event.date);
      totals.set(id, total);
    });
  });

  const sorted = [...totals.entries()]
    .map(([id, total]) => ({
      id,
      name: total.name,
      count: total.events.size,
      eventDates: [...total.events.values()].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));

  let previousCount = -1;
  let currentRank = 0;
  const entries = sorted.map((entry, index) => {
    if (entry.count !== previousCount) {
      currentRank = index + 1;
      previousCount = entry.count;
    }
    return { ...entry, rank: currentRank };
  });

  return {
    cancelledEventCount: cancelledEvents.length,
    entries,
  };
}
