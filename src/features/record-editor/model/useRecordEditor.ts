import type { UnwrapNestedRefs } from 'vue';
import type { Category, Game, Session, SteamResult } from '../../../shared/api/contracts.ts';
import type {
  EditorDependencies,
  EditorForm,
  EditorValues,
  ModalKind,
  RecordResource,
} from './types.ts';
import { emptyEditorForm } from './types.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue';
import { steamResultSchema, importResultSchema, backupSchema } from '../../../shared/api/contracts.ts';
import { api, readApi } from '../../../shared/api/client.ts';
import { localInput } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
import { playtimeFields, playtimeMinutes } from '../../../entities/game/index.ts';
export function useRecordEditor(workspace: EditorDependencies) {
  const {
    categories,
    groupNames,
    games,
    sessions,
    now,
    date,
    selected,
    error,
    flash,
    load,
    category,
    gameName,
  } = workspace;
  let previousFocus: HTMLElement | null,
    searchVersion = 0;
  const modal = ref<ModalKind | null>(null);

  const modalElement = ref<HTMLElement | null>(null);

  const form = ref<EditorForm>(emptyEditorForm());
  const isGameSession = computed(() =>
    form.value.category_ids.some((id) =>
      categories.value.some((c) => c.id === id && (c.icon === 'gamepad' || c.name === 'Игры')),
    ),
  );

  const modalError = ref('');

  const saving = ref(false);

  const steamQuery = ref('');

  const steamResults = ref<SteamResult[]>([]);

  const steamSearched = ref(false);

  const steamBusy = ref(false);

  const steamId = ref('');

  const steamKey = ref('');

  const importReport = ref('');

  const steamPath = ref('');

  const modalTitles = {
    session: 'Запись времени',
    game: 'Карточка игры',
    category: 'Категория',
    steam: 'Импорт из Steam',
    backup: 'Восстановление данных',
    delete: 'Удаление записи',
    reset: 'Сброс данных',
  };

  function setModalElement(element: unknown) {
    modalElement.value = element instanceof HTMLElement ? element : null;
  }

  function open(type: ModalKind, values: EditorValues = {}) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalError.value = '';
    form.value = {
      ...emptyEditorForm(),
      ...values,
      started_at: values.started_at || '',
      completed_at: values.completed_at || '',
    };
    modal.value = type;
    void nextTick(() => modalElement.value?.querySelector<HTMLElement>('input,select,button')?.focus());
  }

  function close() {
    if (saving.value) return;
    modal.value = null;
    steamKey.value = '';
    void nextTick(() => previousFocus?.focus());
  }

  function onKey(e: KeyboardEvent) {
    if (!modal.value) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const targets = [
        ...(modalElement.value?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select,textarea,a[href]',
        ) ?? []),
      ].filter((el) => el.getClientRects().length);
      const first = targets[0],
        last = targets.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  function editSession(s?: Session) {
    const start = new Date(`${date.value}T${clock(Date.now())}`);
    open(
      'session',
      s
        ? {
            ...s,
            game_id: s.game_id || '',
            start: localInput(s.start_at),
            end: s.end_at === null ? '' : localInput(s.end_at),
            category_ids: [s.category_id],
          }
        : {
            start: localInput(start),
            end: localInput(+start + 3600000),
            category_ids: [],
            title: '',
            note: '',
            game_id: '',
          },
    );
    syncSessionDuration();
  }

  function editGame(g?: Game) {
    open(
      'game',
      g
        ? {
            ...g,
            playtime_hours: playtimeFields(g.playtime_minutes).hours,
            playtime_remainder: playtimeFields(g.playtime_minutes).minutes,
          }
        : {
            name: '',
            poster: '',
            status: 'backlog',
            rating: null,
            review: '',
            started_at: '',
            completed_at: '',
            playtime_hours: '',
            playtime_remainder: '',
          },
    );
  }

  function syncSessionDuration() {
    const minutes = form.value.end
      ? Math.max(0, Math.round((+new Date(form.value.end) - +new Date(form.value.start)) / 60000))
      : 0;
    const fields = playtimeFields(minutes);
    form.value.duration_hours = fields.hours;
    form.value.duration_minutes = fields.minutes;
  }

  function setSessionDuration() {
    try {
      const minutes = playtimeMinutes(form.value.duration_hours, form.value.duration_minutes);
      const start = +new Date(form.value.start);
      if (!Number.isFinite(start)) return;
      form.value.end = minutes ? localInput(start + minutes * 60000) : '';
      modalError.value = '';
    } catch (e) {
      modalError.value = errorMessage(e);
    }
  }

  function editCategory(c?: Category) {
    open(
      'category',
      c ? { ...c } : { name: '', group_name: 'Работа', color: '#8e77ff', is_work: false },
    );
  }

  async function save() {
    saving.value = true;
    modalError.value = '';
    try {
      const f = form.value;
      if (modal.value === 'session') {
        const start_at = +new Date(f.start),
          end_at = f.end ? +new Date(f.end) : null;
        if (
          !Number.isFinite(start_at) ||
          (end_at !== null && (!Number.isFinite(end_at) || end_at <= start_at))
        )
          throw new Error('Окончание должно быть позже начала');
        if (!f.category_ids.length) throw new Error('Выбери хотя бы одну категорию');
        if (end_at === null && start_at > Date.now())
          throw new Error('Активный таймер не может начинаться в будущем');
        const payload = { start_at, end_at, title: f.title, note: f.note, game_id: f.game_id || null };
        if (f.id)
          await api(`/sessions/${f.id}`, 'PATCH', { ...payload, category_id: f.category_ids[0] });
        else await api('/sessions', 'POST', { ...payload, category_ids: f.category_ids });
      } else if (modal.value === 'game') {
        const payload = {
          ...f,
          rating: f.rating,
          playtime_minutes: playtimeMinutes(f.playtime_hours, f.playtime_remainder),
        };
        await api(f.id ? `/games/${f.id}` : '/games', f.id ? 'PATCH' : 'POST', payload);
      } else if (modal.value === 'category') {
        await api(f.id ? `/categories/${f.id}` : '/categories', f.id ? 'PATCH' : 'POST', f);
      } else if (modal.value === 'backup') {
        await api('/import-backup', 'POST', f.data);
        selected.value = [];
      } else if (modal.value === 'reset') {
        await api('/reset', 'POST', { confirmation: f.confirmation });
        selected.value = [];
      } else if (modal.value === 'delete') {
        if (!f.id) throw new Error('Запись не выбрана');
        await api(`/${f.resource}/${f.id}`, 'DELETE');
      }
      saving.value = false;
      close();
      await load();
      flash('Готово, изменения сохранены');
    } catch (e) {
      modalError.value = errorMessage(e);
    } finally {
      saving.value = false;
    }
  }

  function remove(
    resource: RecordResource,
    item: { id?: string; name?: string; title?: string; category_id?: string },
  ) {
    open('delete', {
      resource,
      id: item.id,
      name: item.name || item.title || category(item.category_id || '').name,
    });
  }

  async function steamSearch() {
    const version = ++searchVersion;
    const query = steamQuery.value.trim();
    steamBusy.value = true;
    modalError.value = '';
    steamSearched.value = false;
    try {
      const rows = await readApi(
        `/steam/search?q=${encodeURIComponent(query)}`,
        steamResultSchema.array(),
      );
      if (version === searchVersion) {
        steamResults.value = rows;
        steamSearched.value = true;
      }
    } catch (e) {
      if (version === searchVersion) modalError.value = errorMessage(e);
    } finally {
      if (version === searchVersion) steamBusy.value = false;
    }
  }

  async function importSteam(owned: boolean) {
    saving.value = true;
    modalError.value = '';
    importReport.value = '';
    try {
      const result = importResultSchema.parse(
        await api(
          `/steam/import-${owned ? 'owned' : 'installed'}`,
          'POST',
          owned ? { steam_id: steamId.value, api_key: steamKey.value } : { steam_path: steamPath.value },
        ),
      );
      importReport.value = `Найдено: ${result.found}. Добавлено: ${result.added}. Уже в библиотеке: ${result.skipped}.`;
      await load();
    } catch (e) {
      modalError.value = errorMessage(e);
    } finally {
      saving.value = false;
      steamKey.value = '';
    }
  }

  async function readBackup(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ');
      const data = backupSchema.parse(JSON.parse(await file.text()) as unknown);
      open('backup', { data });
    } catch (e) {
      error.value = errorMessage(e);
    }
  }
  onMounted(() => {
    window.addEventListener('keydown', onKey);
  });
  onUnmounted(() => {
    window.removeEventListener('keydown', onKey);
  });
  return {
    modal,
    modalElement,
    setModalElement,
    form,
    isGameSession,
    modalError,
    saving,
    steamQuery,
    steamResults,
    steamSearched,
    steamBusy,
    steamId,
    steamKey,
    importReport,
    steamPath,
    modalTitles,
    open,
    close,
    editSession,
    editGame,
    editCategory,
    save,
    remove,
    steamSearch,
    importSteam,
    readBackup,
    categories,
    groupNames,
    games,
    sessions,
    now,
    category,
    gameName,
    syncSessionDuration,
    setSessionDuration,
  };
}

export type EditorModel = ReturnType<typeof useRecordEditor>;
export type EditorView = UnwrapNestedRefs<EditorModel>;
