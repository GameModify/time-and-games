import type { Express, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { mediaSchema, mediaInputSchema, mediaKindSchema } from '../src/shared/api/mediaContracts.ts';
import type { Media, MediaInput } from '../src/shared/api/mediaContracts.ts';
import { emptyMedia, nextEpisode, updateMediaProgress } from '../src/entities/media/index.ts';
import { errorMessage } from '../src/shared/lib/errors.ts';
import { createCatalogClient } from './media-catalog.ts';
class MediaStoreContext {
  db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }
}
class MediaStore extends MediaStoreContext {
  initializeSchema = () => {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY,imdb_id TEXT UNIQUE,data TEXT NOT NULL)',
    );
  };
  list = () => {
    return this.db
      .prepare('SELECT data FROM media')
      .all()
      .map((row) => mediaSchema.parse(JSON.parse(String(row.data)) as unknown))
      .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id));
  };
  get = (id: string) => {
    const row = this.db.prepare('SELECT data FROM media WHERE id=?').get(id);
    return row ? mediaSchema.parse(JSON.parse(String(row.data)) as unknown) : undefined;
  };
  validate = (item: Media) => {
    const parsed = mediaSchema.parse(item);
    if (parsed.started_at && parsed.completed_at && parsed.completed_at < parsed.started_at)
      throw new Error('Дата окончания просмотра должна быть не раньше начала');
    if (parsed.poster) {
      const url = new URL(parsed.poster);
      if (url.protocol !== 'https:') throw new Error('Обложка должна быть HTTPS-ссылкой');
    }
    const found = parsed.imdb_id
      ? this.db.prepare('SELECT id FROM media WHERE imdb_id=? AND id<>?').get(parsed.imdb_id, parsed.id)
      : undefined;
    if (found) throw new Error('Этот фильм или сериал уже есть в библиотеке');
    return parsed;
  };
  restore = (item: Media) => {
    const parsed = this.validate(item);
    this.db
      .prepare('INSERT INTO media (id,imdb_id,data) VALUES (?,?,?)')
      .run(parsed.id, parsed.imdb_id, JSON.stringify(parsed));
    return parsed;
  };
  add = (input: MediaInput) => {
    if (input.imdb_id) {
      const row = this.db.prepare('SELECT id FROM media WHERE imdb_id=?').get(input.imdb_id);
      if (row) {
        const existing = this.get(String(row.id));
        if (existing) return { item: existing, created: false };
      }
    }
    const item = updateMediaProgress(
      { ...emptyMedia(), id: randomUUID(), created_at: Date.now() },
      input,
    );
    return { item: this.restore(item), created: true };
  };
  update = (id: string, input: MediaInput) => {
    const old = this.get(id);
    if (!old) return undefined;
    const item = this.validate(updateMediaProgress(old, input));
    this.db
      .prepare('UPDATE media SET imdb_id=?,data=? WHERE id=?')
      .run(item.imdb_id, JSON.stringify(item), id);
    return item;
  };
  remove = (id: string) => Boolean(this.db.prepare('DELETE FROM media WHERE id=?').run(id).changes);
  constructor(db: DatabaseSync) {
    super(db);
    this.initializeSchema();
  }
}
type MediaStoreView = Pick<MediaStore, 'list' | 'get' | 'add' | 'update' | 'restore' | 'remove'>;
export function createMediaStore(db: DatabaseSync): MediaStoreView {
  return new MediaStore(db);
}
class MediaRoutesContext {
  api: Express;
  db: DatabaseSync;
  constructor(api: Express, db: DatabaseSync) {
    this.api = api;
    this.db = db;
  }
}
class MediaRoutes extends MediaRoutesContext {
  store = createMediaStore(this.db);
  catalog = createCatalogClient();
  invalid = (res: Response, err: unknown) => {
    res
      .status(400)
      .json({ error: err instanceof z.ZodError ? 'Проверь поля карточки' : errorMessage(err) });
  };
  registerListRoute = () => {
    this.api.get('/api/media', (_req, res) => res.json(this.store.list()));
  };
  registerSearchRoute = () => {
    this.api.get('/api/media/search', async (req, res) => {
      const query = z.string().trim().min(2).max(100).parse(req.query.q);
      const kind = mediaKindSchema.parse(req.query.kind ?? 'movie');
      try {
        res.json(await this.catalog.search(query, kind));
      } catch {
        res
          .status(502)
          .json({ error: 'Не удалось загрузить каталог. Попробуй позже или добавь вручную.' });
      }
    });
  };
  registerDetailsRoute = () => {
    this.api.get('/api/media/catalog/:id', async (req, res) => {
      const id = z
        .string()
        .regex(/^tt\d{5,12}$/)
        .parse(req.params.id);
      const kind = mediaKindSchema.parse(req.query.kind ?? 'movie');
      try {
        res.json(await this.catalog.details(id, kind));
      } catch {
        res
          .status(502)
          .json({ error: 'Не удалось загрузить карточку из каталога. Можно заполнить её вручную.' });
      }
    });
  };
  registerCreateRoute = () => {
    this.api.post('/api/media', (req, res) => {
      try {
        const result = this.store.add(mediaInputSchema.parse(req.body));
        res.status(result.created ? 201 : 200).json(result);
      } catch (err) {
        this.invalid(res, err);
      }
    });
  };
  registerUpdateRoute = () => {
    this.api.patch('/api/media/:id', (req, res) => {
      try {
        const item = this.store.update(
          z.string().parse(req.params.id),
          mediaInputSchema.parse(req.body),
        );
        if (!item) {
          res.status(404).json({ error: 'Запись не найдена' });
          return;
        }
        res.json(item);
      } catch (err) {
        this.invalid(res, err);
      }
    });
  };
  registerProgressRoute = () => {
    this.api.post('/api/media/:id/next-episode', (req, res) => {
      try {
        const id = z.string().parse(req.params.id);
        const old = this.store.get(id);
        if (!old) {
          res.status(404).json({ error: 'Сериал не найден' });
          return;
        }
        res.json(this.store.update(id, nextEpisode(old)));
      } catch (err) {
        this.invalid(res, err);
      }
    });
  };
  registerDeleteRoute = () => {
    this.api.delete('/api/media/:id', (req, res) => {
      if (!this.store.remove(z.string().parse(req.params.id))) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
      }
      res.json({ ok: true });
    });
  };
  constructor(api: Express, db: DatabaseSync) {
    super(api, db);
    this.registerListRoute();
    this.registerSearchRoute();
    this.registerDetailsRoute();
    this.registerCreateRoute();
    this.registerUpdateRoute();
    this.registerProgressRoute();
    this.registerDeleteRoute();
  }
}
export function registerMediaRoutes(api: Express, db: DatabaseSync) {
  return new MediaRoutes(api, db).store;
}
