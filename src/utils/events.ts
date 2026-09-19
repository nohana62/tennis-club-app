import type { ClubEvent } from '../types';

export function isEventCancelled(event: Pick<ClubEvent, 'status'>): boolean {
  return event.status === 'cancelled';
}
