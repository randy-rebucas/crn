import type { AttendanceRecord, InstructorClass, Schedule } from './instructor-hooks';

// Pure date/schedule helpers shared by the instructor views. Schedules are
// weekly ("every Tuesday 13:00-16:00"), so dates are always projected from
// dayOfWeek + "HH:MM" strings in the viewer's local time.

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// An attendance record's session day. The API stores the marked calendar
// day ("YYYY-MM-DD", sent by attendance-view) as midnight UTC, so the UTC
// date part *is* the day — converting through local time would shift it a
// day for anyone west of Greenwich.
export function recordDayKey(r: Pick<AttendanceRecord, 'date'>) {
  return r.date.slice(0, 10);
}

export interface AgendaItem {
  key: string;
  date: Date;
  schedule: Schedule;
  cls: InstructorClass | undefined;
  state: 'done' | 'live' | 'next' | 'later';
}

// Weekly schedules projected onto the next 7 calendar days, starting today.
export function buildAgenda(schedules: Schedule[], classById: Map<string, InstructorClass>, now: Date): AgendaItem[] {
  const items: AgendaItem[] = [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const todays = schedules
      .filter((s) => s.dayOfWeek === date.getDay())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const s of todays) {
      let state: AgendaItem['state'] = 'later';
      if (offset === 0) {
        if (minutesOf(s.endTime) <= nowMinutes) state = 'done';
        else if (minutesOf(s.startTime) <= nowMinutes) state = 'live';
      }
      items.push({ key: `${s.id}-${offset}`, date, schedule: s, cls: classById.get(s.classId), state });
    }
  }
  const firstUpcoming = items.find((i) => i.state === 'later');
  if (firstUpcoming && !items.some((i) => i.state === 'live')) firstUpcoming.state = 'next';
  return items;
}

export function relativeDay(date: Date, now: Date) {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// PRESENT and LATE both count as attended. EXCUSED stays in the denominator
// as not-attended: dropping it would inflate the rate for a class where many
// students were excused.
export function attendanceRate(records: AttendanceRecord[]) {
  if (records.length === 0) return null;
  const attended = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return Math.round((attended / records.length) * 100);
}

// The next start of any of these weekly schedules at or after `now` (a
// session already in progress counts as "next" until it ends).
export function nextOccurrence(schedules: Schedule[], now: Date) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const match = schedules
      .filter((s) => s.dayOfWeek === date.getDay() && (offset > 0 || minutesOf(s.endTime) > nowMinutes))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    if (match) {
      const live = offset === 0 && minutesOf(match.startTime) <= nowMinutes;
      return { date, schedule: match, live };
    }
  }
  return null;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
