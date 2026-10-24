import type { Session } from '../../../shared/api/contracts.ts';
import { unionDuration } from '../../../shared/lib/date.ts';
export interface ActivityGroup {
  id: string;
  segments: Session[];
  start: number;
  end: number;
  elapsed: number;
  paused: number;
}
export function activityGroups(sessions: Session[], now: number): ActivityGroup[] {
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    const id = session.group_id ?? session.id;
    const rows = groups.get(id) ?? [];
    rows.push(session);
    groups.set(id, rows);
  }
  return [...groups].map(([id, segments]) => summarizeGroup(id, segments, now));
}

function summarizeGroup(id: string, segments: Session[], now: number): ActivityGroup {
  const start = Math.min(...segments.map((row) => row.start_at));
  const end = Math.max(...segments.map((row) => row.end_at ?? now));
  const elapsed = unionDuration(segments.map((row) => [row.start_at, row.end_at ?? now]));
  return {
    id,
    segments: segments.toSorted((a, b) => a.start_at - b.start_at),
    start,
    end,
    elapsed,
    paused: Math.max(0, end - start - elapsed),
  };
}
