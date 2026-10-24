import { exportTimerGroups, initializeTimers, restoreTimerGroups } from './timers/storage.ts';
import type { DatabaseSync } from 'node:sqlite';
import { backupCategorySchema, gameSchema, sessionSchema } from '../src/shared/api/contracts.ts';
import type { Backup, Game, Session } from '../src/shared/api/contracts.ts';
import type { Media } from '../src/shared/api/mediaContracts.ts';
import { readRows, transaction } from './storage.ts';
import { insertGameRecord, validateGame } from './games.ts';
import { insertCategory, validColor } from './categories.ts';
import { insertSession, timestamp } from './sessions.ts';
import { ensure } from './http.ts';
interface BackupMediaStore {
  list: () => Media[];
  restore: (item: Media) => Media;
}
interface BackupIndexes {
  categories: Set<string>;
  games: Set<string>;
  sessions: Set<string>;
  active: Set<string>;
}
type BackupCategory = Backup['categories'][number];
export function exportBackup(db: DatabaseSync, store: BackupMediaStore): Backup {
  initializeTimers(db);
  return {
    format: 'time-and-games-backup',
    version: 3,
    exported_at: new Date().toISOString(),
    categories: readRows(db, 'SELECT * FROM categories ORDER BY sort_order', backupCategorySchema),
    games: readRows(db, 'SELECT * FROM games', gameSchema),
    sessions: readRows(db, 'SELECT * FROM sessions', sessionSchema),
    timer_groups: exportTimerGroups(db),
    media: store.list(),
  };
}
function addUnique(ids: Set<string>, id: string, message: string): void {
  ensure(id && !ids.has(id), message);
  ids.add(id);
}
function validateCategory(item: BackupCategory, ids: Set<string>): void {
  addUnique(ids, item.id, 'Некорректная категория');
  ensure(
    item.name.trim() &&
      item.name.length <= 55 &&
      item.group_name.trim() &&
      item.group_name.length <= 40 &&
      validColor(item.color) &&
      Number.isSafeInteger(item.sort_order),
    'Некорректная категория',
  );
}
function validateBackupGame(item: Game, ids: Set<string>): void {
  addUnique(ids, item.id, 'Некорректная игра');
  validateGame(item, true);
}
function validateSession(item: Session, index: BackupIndexes): void {
  addUnique(index.sessions, item.id, 'Некорректная сессия');
  ensure(
    index.categories.has(item.category_id) && (!item.game_id || index.games.has(item.game_id)),
    'Некорректная сессия',
  );
  ensure(
    timestamp(item.start_at) &&
      (item.end_at === null || (timestamp(item.end_at) && item.end_at > item.start_at)),
    'Некорректная сессия',
  );
  if (item.end_at === null)
    addUnique(index.active, item.category_id, 'Два активных таймера одной категории');
}
function validateMedia(items: Media[]): void {
  const ids = new Set<string>(),
    imdbIds = new Set<string>();
  for (const item of items) {
    addUnique(ids, item.id, 'Повторяющийся фильм или сериал');
    if (item.imdb_id) addUnique(imdbIds, item.imdb_id, 'Повторяющийся фильм или сериал');
  }
}
export function validateBackup(data: Backup): void {
  const index: BackupIndexes = {
    categories: new Set(),
    games: new Set(),
    sessions: new Set(),
    active: new Set(),
  };
  data.categories.forEach((item) => {
    validateCategory(item, index.categories);
  });
  data.games.forEach((item) => {
    validateBackupGame(item, index.games);
  });
  data.sessions.forEach((item) => {
    validateSession(item, index);
  });
  validateMedia(data.media);
  validateTimerGroups(data);
}
export function restoreBackup(db: DatabaseSync, store: BackupMediaStore, data: Backup): void {
  initializeTimers(db);
  transaction(db, () => {
    db.exec(
      'DELETE FROM timer_segments;DELETE FROM timer_groups;DELETE FROM media;DELETE FROM sessions;DELETE FROM games;DELETE FROM categories;',
    );
    data.categories.forEach((item) => {
      insertCategory(db, { ...item, is_work: Boolean(item.is_work) });
    });
    data.games.forEach((item) => {
      insertGameRecord(db, item);
    });
    data.sessions.forEach((item) => {
      insertSession(db, item);
    });
    restoreTimerGroups(db, data.timer_groups ?? []);
    data.media.forEach((item) => store.restore(item));
  });
}

function validateTimerGroups(data: Backup): void {
  const ids = new Set(data.sessions.map((session) => session.id)),
    linked = new Set<string>(),
    groups = new Set<string>();
  for (const group of data.timer_groups ?? []) {
    addUnique(groups, group.id, 'Повторяющееся занятие');
    for (const id of group.session_ids) {
      ensure(ids.has(id), 'Не найден отрезок занятия');
      addUnique(linked, id, 'Отрезок связан с несколькими занятиями');
    }
    validateGroupState(
      data.sessions.filter((session) => group.session_ids.includes(session.id)),
      group.paused,
    );
  }
}

function validateGroupState(sessions: Session[], paused: boolean): void {
  ensure(
    sessions.filter((session) => session.end_at === null).length <= 1,
    'У занятия несколько активных отрезков',
  );
  ensure(
    !paused || sessions.every((session) => session.end_at !== null),
    'Занятие на паузе содержит активный отрезок',
  );
}
