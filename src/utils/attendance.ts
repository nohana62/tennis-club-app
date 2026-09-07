import type { Attendance, Member } from '../types';

export function findAttendanceForMember(
  attendances: Attendance[],
  eventId: string,
  member: Pick<Member, 'id' | 'name'>,
): Attendance | undefined {
  const eventAttendances = attendances.filter((attendance) => attendance.eventId === eventId);
  const idMatch = member.id
    ? eventAttendances.find((attendance) => attendance.memberId === member.id)
    : undefined;
  return idMatch ?? eventAttendances.find(
    (attendance) => !attendance.memberId && attendance.memberName.trim() === member.name.trim(),
  );
}
