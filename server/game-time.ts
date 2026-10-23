import type { Game, Session } from '../src/shared/api/contracts.ts';
import { unionDuration } from '../src/shared/lib/date.ts';
export function withGameTimes<G extends Pick<Game, 'id' | 'playtime_minutes'>>(
  games: G[],
  sessions: Pick<Session, 'game_id' | 'start_at' | 'end_at'>[],
  now = Date.now(),
) {
  const byGame = new Map<string | null, [number, number][]>();
  for (const session of sessions) {
    const intervals = byGame.get(session.game_id) ?? [];
    byGame.set(session.game_id, intervals);
    const end = session.end_at ?? now;
    if (end > session.start_at) intervals.push([session.start_at, end]);
  }
  return games.map((game) => {
    const total = unionDuration(byGame.get(game.id) ?? []);
    const tracked_minutes = Math.floor(total / 60000);
    return { ...game, tracked_minutes, total_minutes: Math.max(game.playtime_minutes, tracked_minutes) };
  });
}
