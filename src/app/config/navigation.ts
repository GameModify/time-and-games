import { pagePaths } from '../../shared/lib/navigationState.ts';
import type { Page } from '../../shared/lib/navigationState.ts';
import { LayoutDashboard, Gamepad2, BarChart3, Settings2, Film } from 'lucide-vue-next';
export const nav = [
  { id: 'dashboard', path: pagePaths.dashboard, title: 'Мой день', icon: LayoutDashboard },
  { id: 'media', path: pagePaths.media, title: 'Фильмы и сериалы', icon: Film },
  { id: 'games', path: pagePaths.games, title: 'Библиотека игр', icon: Gamepad2 },
  { id: 'analytics', path: pagePaths.analytics, title: 'Статистика', icon: BarChart3 },
  { id: 'settings', path: pagePaths.settings, title: 'Настройки', icon: Settings2 },
];
export const titles: Record<string, [string, string]> = {
  dashboard: ['Твой день, в деталях', 'Каждый момент - часть большой истории.'],
  games: ['Следующее приключение', 'Твои миры, впечатления и пройденные истории.'],
  analytics: ['Время в перспективе', 'Посмотри, из чего складываются твои дни.'],
  media: ['Твои фильмы и сериалы', 'Смотри в своём ритме и сохраняй впечатления.'],
  settings: ['Всё под тебя', 'Категории, локальные данные и резервные копии.'],
};
export const pageEyebrows: Record<Page, string> = {
  dashboard: 'КАЖДЫЙ МОМЕНТ ИМЕЕТ ЗНАЧЕНИЕ',
  games: 'ИГРЫ И ВПЕЧАТЛЕНИЯ',
  media: 'КИНО И СЕРИАЛЫ',
  analytics: 'ТВОЁ ВРЕМЯ В ЦИФРАХ',
  settings: 'НАСТРОЙКИ ПРОСТРАНСТВА',
};
