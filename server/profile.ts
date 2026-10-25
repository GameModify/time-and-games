import type { DatabaseSync } from 'node:sqlite';
import type { Express } from 'express';
import { defaultProfile, profileSchema } from '../src/shared/api/profileContracts.ts';
import type { LocalProfile } from '../src/shared/api/profileContracts.ts';
import { ensure } from './http.ts';
function initializeProfile(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS local_profile (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, avatar TEXT NOT NULL)',
  );
}
export function readProfile(db: DatabaseSync): LocalProfile {
  initializeProfile(db);
  const row = db.prepare('SELECT name,avatar FROM local_profile WHERE id=1').get();
  return row ? profileSchema.parse(row) : defaultProfile();
}
export function validateProfile(profile: LocalProfile): void {
  if (!profile.avatar) return;
  const bytes = Buffer.from(profile.avatar.slice('data:image/webp;base64,'.length), 'base64');
  ensure(
    bytes.length >= 20 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP' &&
      bytes.readUInt32LE(4) === bytes.length - 8,
    'Выбери корректную картинку для аватара',
  );
}
export function writeProfile(db: DatabaseSync, value: LocalProfile): LocalProfile {
  const profile = profileSchema.parse(value);
  validateProfile(profile);
  initializeProfile(db);
  db.prepare('INSERT OR REPLACE INTO local_profile (id,name,avatar) VALUES (1,?,?)').run(
    profile.name,
    profile.avatar,
  );
  return profile;
}
export function registerProfile(app: Express, db: DatabaseSync): void {
  initializeProfile(db);
  app.get('/api/profile', (_req, res) => {
    res.json(readProfile(db));
  });
  app.patch('/api/profile', (req, res) => {
    res.json(writeProfile(db, profileSchema.parse(req.body)));
  });
}
