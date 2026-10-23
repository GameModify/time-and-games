import type { Game, Session } from '../../../shared/api/contracts.ts';
import type { SessionWriteDto, GameWriteDto } from '../../../shared/api/inputContracts.ts';
import type { EditorForm, EditorValues } from './types.ts';
import { localInput } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
import { playtimeFields, playtimeMinutes } from '../../../entities/game/index.ts';
export function sessionValues(date: string, session?: Session): EditorValues {
  if (session)
    return {
      ...session,
      game_id: session.game_id || '',
      start: localInput(session.start_at),
      end: session.end_at === null ? '' : localInput(session.end_at),
      category_ids: [session.category_id],
    };
  const start = new Date(`${date}T${clock(Date.now())}`);
  return {
    start: localInput(start),
    end: localInput(+start + 3600000),
    category_ids: [],
    title: '',
    note: '',
    game_id: '',
  };
}
export function gameValues(game?: Game): EditorValues {
  if (!game) return {};
  const time = playtimeFields(game.playtime_minutes);
  return { ...game, playtime_hours: time.hours, playtime_remainder: time.minutes };
}
export function sessionPayload(form: EditorForm): SessionWriteDto {
  const start_at = +new Date(form.start),
    end_at = form.end ? +new Date(form.end) : null;
  if (
    !Number.isFinite(start_at) ||
    (end_at !== null && (!Number.isFinite(end_at) || end_at <= start_at))
  )
    throw new Error('Окончание должно быть позже начала');
  if (!form.category_ids.length) throw new Error('Выбери хотя бы одну категорию');
  if (end_at === null && start_at > Date.now())
    throw new Error('Активный таймер не может начинаться в будущем');
  return { start_at, end_at, title: form.title, note: form.note, game_id: form.game_id || null };
}
export function gamePayload(form: EditorForm): GameWriteDto {
  return {
    name: form.name,
    steam_appid: form.steam_appid,
    poster: form.poster,
    status: form.status,
    rating: form.rating,
    review: form.review,
    started_at: form.started_at,
    completed_at: form.completed_at,
    playtime_minutes: playtimeMinutes(form.playtime_hours, form.playtime_remainder),
  };
}
