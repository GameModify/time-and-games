import { createAppRouter } from './app/config/router.ts';
import { createApp } from 'vue';
import App from './app/App.vue';
import './app/styles/base.css';
import './app/styles/themes.css';
const router = createAppRouter();
const app = createApp(App).use(router);
router
  .isReady()
  .then(() => {
    app.mount('#app');
  })
  .catch((error: unknown) => {
    console.error('Не удалось открыть приложение', error);
  });
