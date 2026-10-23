<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { reactive, toRefs, computed } from 'vue';
import { Check, LoaderCircle, Moon, Plus, ShieldCheck, Sun, X } from 'lucide-vue-next';
import { useRecordEditor, RecordDialog } from '../features/record-editor/index.ts';
import { useTheme } from '../features/appearance/index.ts';
import { useWorkspace } from '../features/workspace/index.ts';
import { nav, titles, pageEyebrows } from './config/navigation.ts';
import AppMark from '../shared/ui/AppMark.vue';
const workspace = useWorkspace();
const workspaceView = reactive(workspace);
const editorModel = useRecordEditor(workspace);
const editor = reactive(editorModel);
const appearance = reactive(useTheme());
const { page, games, now, error, notice, loading, navigate, load } = workspace;
const { editSession, editGame } = editorModel;
const { theme, setTheme } = toRefs(appearance);
const pageProps = computed(() => {
  if (page.value === 'media')
    return { items: workspaceView.media, load: workspace.load, flash: workspace.flash };
  if (page.value === 'games')
    return {
      games: games.value,
      editor,
      toggleFavorite: workspace.toggleGameFavorite,
      busy: workspaceView.busy,
    };
  if (page.value === 'settings')
    return {
      categories: workspaceView.categories,
      groupNames: workspaceView.groupNames,
      editor,
      appearance,
    };
  return { model: workspaceView, editor };
});
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="/" @click.prevent="navigate('dashboard')"
        ><span class="brand-icon"><AppMark :size="30" /></span
        ><span>Время<span class="brand-plus"> и </span>игры<small>ЛИЧНОЕ ПРОСТРАНСТВО</small></span></a
      >
      <div class="sidebar-label">ТВОЁ ПРОСТРАНСТВО</div>
      <nav aria-label="Основная навигация">
        <RouterLink
          v-for="item in nav"
          :key="item.id"
          :class="['nav-item', { active: page === item.id }]"
          :to="item.path"
          :aria-current="page === item.id ? 'page' : undefined"
        >
          <component :is="item.icon" :size="19" />{{ item.title
          }}<span v-if="item.id === 'games'" class="nav-count">{{ games.length }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="local-note">
          <ShieldCheck :size="19" />
          <div>Только на твоём ПК<small>Твои данные остаются с тобой</small></div>
          <span class="status-dot" />
        </div>
        <div class="profile">
          <span class="avatar">ТЫ</span>
          <div>Твоё пространство<small>В своём ритме</small></div>
        </div>
      </div>
    </aside>

    <main>
      <header class="topbar">
        <div class="breadcrumb">
          Личное пространство <span>/</span> <b>{{ nav.find((n) => n.id === page)?.title }}</b>
        </div>
        <div class="topbar-right">
          <button
            class="theme-toggle"
            :aria-label="theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
            :title="theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
            @click="setTheme(theme === 'dark' ? 'light' : 'dark')"
          >
            <Sun v-if="theme === 'dark'" :size="18" /><Moon v-else :size="18" /><span>{{
              theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'
            }}</span>
          </button>
          <span class="local-badge"><span class="status-dot" /> Локальный режим</span
          ><span class="topbar-date">{{
            new Date(now).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          }}</span
          ><span class="small-avatar">ТЫ</span>
        </div>
      </header>
      <div class="page-content">
        <div v-if="error" role="alert" class="alert error">
          <span>{{ error }}</span
          ><button class="text-button" @click="load">Повторить</button
          ><button class="icon-button" aria-label="Закрыть ошибку" @click="error = ''">
            <X :size="16" />
          </button>
        </div>
        <div class="page-heading">
          <div>
            <div class="eyebrow">
              {{ pageEyebrows[page] }}
            </div>
            <h1>
              {{ titles[page]?.[0] }}<span v-if="page === 'dashboard'" class="heading-dot">.</span>
            </h1>
            <p>{{ titles[page]?.[1] }}</p>
          </div>
          <button v-if="page === 'dashboard'" class="button secondary" @click="editSession()">
            <Plus :size="17" />Добавить запись</button
          ><button v-if="page === 'games'" class="button primary" @click="editGame()">
            <Plus :size="17" />Добавить игру
          </button>
        </div>

        <div v-if="loading" class="loading">
          <LoaderCircle class="spin" />Загружаю твоё пространство…
        </div>
        <RouterView v-else v-slot="{ Component }">
          <component :is="Component" v-bind="pageProps" />
        </RouterView>
        <footer class="page-footer">
          <span>ВРЕМЯ И ИГРЫ <span class="footer-dot">·</span> Твоё время имеет значение.</span
          ><span><ShieldCheck :size="13" /> Хранится локально</span>
        </footer>
      </div>
    </main>

    <Transition name="toast"
      ><div v-if="notice" class="toast" role="status"><Check :size="18" />{{ notice }}</div></Transition
    >
    <RecordDialog :editor="editor" />
  </div>
</template>
