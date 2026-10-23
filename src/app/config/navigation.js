import { LayoutDashboard, Gamepad2, BarChart3, Settings2 } from 'lucide-vue-next';
export const nav = [
  { id: 'dashboard', title: 'Мой день', icon: LayoutDashboard },
  { id: 'games', title: 'Библиотека игр', icon: Gamepad2 },
  { id: 'analytics', title: 'Статистика', icon: BarChart3 },
  { id: 'settings', title: 'Настройки', icon: Settings2 },
];
export const titles = {
  dashboard: ['Твой день, в деталях', 'Каждый момент - часть большой истории.'],
  games: ['Следующее приключение', 'Твои миры, впечатления и пройденные истории.'],
  analytics: ['Время в перспективе', 'Посмотри, из чего складываются твои дни.'],
  settings: ['Всё под тебя', 'Категории, локальные данные и резервные копии.'],
};
