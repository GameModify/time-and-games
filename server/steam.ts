import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { GameInput } from '../src/shared/api/inputContracts.ts';
import type { SteamResult } from '../src/shared/api/contracts.ts';
import { steamSearchSchema, steamOwnedSchema } from './validation.ts';
import { steamPoster } from './games.ts';
interface SteamAccountRequest {
  key: string;
  steamId: string;
}
export async function searchSteam(query: string): Promise<SteamResult[]> {
  const url = new URL('https://store.steampowered.com/api/storesearch/');
  url.search = new URLSearchParams({ term: query, l: 'russian', cc: 'US' }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': 'TimeAndGames/0.1' },
  });
  if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
  const data = steamSearchSchema.parse(await response.json());
  return data.items.slice(0, 24).map((item) => ({
    appid: item.id,
    name: item.name,
    poster: steamPoster(item.id),
    thumbnail: item.tiny_image ?? '',
  }));
}
function steamRoots(customPath?: string): string[] {
  return [
    customPath,
    process.env.TNG_STEAM_PATH,
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ].filter((root): root is string => Boolean(root));
}
function addSteamDirectory(dirs: Set<string>, root: string): void {
  const directory = path.join(root, 'steamapps');
  if (existsSync(directory)) dirs.add(directory);
}
function scanSteamRoot(dirs: Set<string>, root: string): void {
  addSteamDirectory(dirs, root);
  const file = path.join(root, 'steamapps', 'libraryfolders.vdf');
  if (!existsSync(file)) return;
  for (const match of readFileSync(file, 'utf8').matchAll(/"path"\s+"([^"]+)"/gi))
    if (match[1]) addSteamDirectory(dirs, match[1].replace(/\\\\/g, '\\'));
}
export function steamDirectories(customPath?: string): Set<string> {
  const dirs = new Set<string>();
  steamRoots(customPath).forEach((root) => {
    scanSteamRoot(dirs, root);
  });
  return dirs;
}
export function readSteamManifest(dir: string, file: string): GameInput | undefined {
  const id = /^appmanifest_(\d+)\.acf$/i.exec(file)?.[1];
  if (!id) return undefined;
  try {
    const name = /"name"\s+"([^"]+)"/i.exec(readFileSync(path.join(dir, file), 'utf8'))?.[1];
    const appid = Number(id);
    if (name && Number.isSafeInteger(appid) && appid > 0)
      return { steam_appid: appid, name, poster: steamPoster(appid) };
  } catch {
    /* Steam can remove a manifest during a scan. */
  }
  return undefined;
}
export async function ownedSteamGames({ key, steamId }: SteamAccountRequest): Promise<GameInput[]> {
  const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/');
  url.search = new URLSearchParams({
    key,
    steamid: steamId,
    include_appinfo: 'true',
    include_played_free_games: 'true',
    format: 'json',
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(14000) });
  if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
  const data = steamOwnedSchema.parse(await response.json());
  return data.response.games.map((game) => ({
    steam_appid: game.appid,
    name: game.name,
    poster: steamPoster(game.appid),
    playtime_minutes: game.playtime_forever ?? 0,
  }));
}
