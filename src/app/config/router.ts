import { createRouter, createWebHistory } from 'vue-router';
import type { RouterHistory, RouteRecordRaw } from 'vue-router';
import { ActivityPage } from '../../pages/activity/index.ts';
import { MediaPage } from '../../pages/media/index.ts';
import { GamesPage } from '../../pages/games/index.ts';
import { SettingsPage } from '../../pages/settings/index.ts';
import { navigationUrl, pagePaths, readNavigation } from '../../shared/lib/navigationState.ts';

const routes: RouteRecordRaw[] = [
  { path: pagePaths.dashboard, name: 'dashboard', component: ActivityPage },
  { path: pagePaths.games, name: 'games', component: GamesPage },
  { path: pagePaths.media, name: 'media', component: MediaPage },
  { path: pagePaths.analytics, name: 'analytics', component: ActivityPage },
  { path: pagePaths.settings, name: 'settings', component: SettingsPage },
  { path: '/:pathMatch(.*)*', redirect: (to) => navigationUrl(readNavigation(to.fullPath)) },
];
export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({ history, routes });
  router.beforeEach((to) => {
    const canonical = navigationUrl(readNavigation(to.fullPath));
    if (canonical !== to.fullPath) {
      const target = router.resolve(canonical);
      return { path: target.path, query: target.query, hash: target.hash, replace: true };
    }
    return true;
  });
  return router;
}
