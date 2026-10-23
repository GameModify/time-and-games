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
import { steamResultSchema, importResultSchema } from '../../../shared/api/contracts.ts';
import { readBackupFile } from '../../../shared/api/backup.ts';
import { api, readApi } from '../../../shared/api/client.ts';
import { localInput } from '../../../shared/lib/date.ts';
import { sessionValues, gameValues, sessionPayload, gamePayload } from './values.ts';
import { playtimeFields, playtimeMinutes } from '../../../entities/game/index.ts';
class RecordEditorControllerContext {
  categories: EditorDependencies['categories'];
  groupNames: EditorDependencies['groupNames'];
  games: EditorDependencies['games'];
  sessions: EditorDependencies['sessions'];
  now: EditorDependencies['now'];
  date: EditorDependencies['date'];
  selected: EditorDependencies['selected'];
  error: EditorDependencies['error'];
  flash: EditorDependencies['flash'];
  load: EditorDependencies['load'];
  category: EditorDependencies['category'];
  gameName: EditorDependencies['gameName'];
  constructor(workspace: EditorDependencies) {
    this.categories = workspace.categories;
    this.groupNames = workspace.groupNames;
    this.games = workspace.games;
    this.sessions = workspace.sessions;
    this.now = workspace.now;
    this.date = workspace.date;
    this.selected = workspace.selected;
    this.error = workspace.error;
    this.flash = workspace.flash;
    this.load = workspace.load;
    this.category = workspace.category;
    this.gameName = workspace.gameName;
  }
}
class RecordEditorController extends RecordEditorControllerContext {
  previousFocus!: HTMLElement | null;
  searchVersion = 0;
  modal = ref<ModalKind | null>(null);
  modalElement = ref<HTMLElement | null>(null);
  form = ref<EditorForm>(emptyEditorForm());
  isGameSession = computed(() =>
    this.form.value.category_ids.some((id) =>
      this.categories.value.some((c) => c.id === id && (c.icon === 'gamepad' || c.name === 'Игры')),
    ),
  );
  modalError = ref('');
  saving = ref(false);
  steamQuery = ref('');
  steamResults = ref<SteamResult[]>([]);
  steamSearched = ref(false);
  steamBusy = ref(false);
  steamId = ref('');
  steamKey = ref('');
  importReport = ref('');
  steamPath = ref('');
  modalTitles = {
    session: 'Запись времени',
    game: 'Карточка игры',
    category: 'Категория',
    steam: 'Импорт из Steam',
    backup: 'Восстановление данных',
    delete: 'Удаление записи',
    reset: 'Сброс данных',
  };
  setModalElement = (element: unknown) => {
    this.modalElement.value = element instanceof HTMLElement ? element : null;
  };
  open = (type: ModalKind, values: EditorValues = {}) => {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.modalError.value = '';
    this.form.value = {
      ...emptyEditorForm(),
      ...values,
      started_at: values.started_at || '',
      completed_at: values.completed_at || '',
    };
    this.modal.value = type;
    void nextTick(() =>
      this.modalElement.value?.querySelector<HTMLElement>('input,select,button')?.focus(),
    );
  };
  close = () => {
    if (this.saving.value) return;
    this.modal.value = null;
    this.steamKey.value = '';
    void nextTick(() => this.previousFocus?.focus());
  };
  onKey = (e: KeyboardEvent) => {
    if (!this.modal.value) return;
    if (e.key === 'Escape') this.close();
    if (e.key === 'Tab') {
      const targets = [
        ...(this.modalElement.value?.querySelectorAll<HTMLElement>(
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
  };
  editSession = (session?: Session) => {
    this.open('session', sessionValues(this.date.value, session));
    this.syncSessionDuration();
  };
  editGame = (game?: Game) => {
    this.open('game', gameValues(game));
  };
  syncSessionDuration = () => {
    const minutes = this.form.value.end
      ? Math.max(
          0,
          Math.round((+new Date(this.form.value.end) - +new Date(this.form.value.start)) / 60000),
        )
      : 0;
    const fields = playtimeFields(minutes);
    this.form.value.duration_hours = fields.hours;
    this.form.value.duration_minutes = fields.minutes;
  };
  setSessionDuration = () => {
    try {
      const minutes = playtimeMinutes(this.form.value.duration_hours, this.form.value.duration_minutes);
      const start = +new Date(this.form.value.start);
      if (!Number.isFinite(start)) return;
      this.form.value.end = minutes ? localInput(start + minutes * 60000) : '';
      this.modalError.value = '';
    } catch (e) {
      this.modalError.value = errorMessage(e);
    }
  };
  editCategory = (c?: Category) => {
    this.open(
      'category',
      c ? { ...c } : { name: '', group_name: 'Работа', color: '#8e77ff', is_work: false },
    );
  };
  saveSession = async () => {
    const form = this.form.value,
      payload = sessionPayload(form);
    if (form.id)
      await api('/sessions/' + form.id, 'PATCH', { ...payload, category_id: form.category_ids[0] });
    else await api('/sessions', 'POST', { ...payload, category_ids: form.category_ids });
  };
  saveGame = async () => {
    const form = this.form.value;
    await api(form.id ? '/games/' + form.id : '/games', form.id ? 'PATCH' : 'POST', gamePayload(form));
  };
  saveCategory = async () => {
    const form = this.form.value;
    await api(form.id ? '/categories/' + form.id : '/categories', form.id ? 'PATCH' : 'POST', {
      name: form.name,
      group_name: form.group_name,
      color: form.color,
      is_work: form.is_work,
    });
  };
  restoreBackup = async () => {
    await api('/import-backup', 'POST', this.form.value.data);
    this.selected.value = [];
  };
  resetData = async () => {
    await api('/reset', 'POST', { confirmation: this.form.value.confirmation });
    this.selected.value = [];
  };
  deleteRecord = async () => {
    const form = this.form.value;
    if (!form.id) throw new Error('Запись не выбрана');
    await api('/' + form.resource + '/' + form.id, 'DELETE');
  };
  saveHandlers = {
    session: this.saveSession,
    game: this.saveGame,
    category: this.saveCategory,
    backup: this.restoreBackup,
    reset: this.resetData,
    delete: this.deleteRecord,
  };
  persist = async () => {
    const kind = this.modal.value;
    if (kind && kind !== 'steam') await this.saveHandlers[kind]();
  };
  save = async () => {
    this.saving.value = true;
    this.modalError.value = '';
    try {
      await this.persist();
      this.saving.value = false;
      this.close();
      await this.load();
      this.flash('Готово, изменения сохранены');
    } catch (error) {
      this.modalError.value = errorMessage(error);
    } finally {
      this.saving.value = false;
    }
  };
  remove = (
    resource: RecordResource,
    item: {
      id?: string;
      name?: string;
      title?: string;
      category_id?: string;
    },
  ) => {
    this.open('delete', {
      resource,
      id: item.id,
      name: item.name || item.title || this.category(item.category_id || '').name,
    });
  };
  steamSearch = async () => {
    const version = ++this.searchVersion;
    this.steamBusy.value = true;
    this.modalError.value = '';
    this.steamSearched.value = false;
    try {
      const rows = await readApi(
        `/steam/search?q=${encodeURIComponent(this.steamQuery.value.trim())}`,
        steamResultSchema.array(),
      );
      if (version === this.searchVersion) {
        this.steamResults.value = rows;
        this.steamSearched.value = true;
      }
    } catch (e) {
      if (version === this.searchVersion) this.modalError.value = errorMessage(e);
    } finally {
      if (version === this.searchVersion) this.steamBusy.value = false;
    }
  };
  importSteamLibrary = (owned: boolean) => {
    const payload = owned
      ? { steam_id: this.steamId.value, api_key: this.steamKey.value }
      : { steam_path: this.steamPath.value };
    return readApi(
      '/steam/import-' + (owned ? 'owned' : 'installed'),
      importResultSchema,
      'POST',
      payload,
    );
  };
  importSteam = async (owned: boolean) => {
    this.saving.value = true;
    this.modalError.value = '';
    this.importReport.value = '';
    try {
      const result = await this.importSteamLibrary(owned);
      this.importReport.value = `Найдено: ${result.found}. Добавлено: ${result.added}. Уже в библиотеке: ${result.skipped}.`;
      await this.load();
    } catch (e) {
      this.modalError.value = errorMessage(e);
    } finally {
      this.saving.value = false;
      this.steamKey.value = '';
    }
  };
  readBackup = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = await readBackupFile(file);
      this.open('backup', { data });
    } catch (e) {
      this.error.value = errorMessage(e);
    }
  };
  registerMounted = () => {
    onMounted(() => {
      window.addEventListener('keydown', this.onKey);
    });
  };
  registerUnmounted = () => {
    onUnmounted(() => {
      window.removeEventListener('keydown', this.onKey);
    });
  };
  constructor(workspace: EditorDependencies) {
    super(workspace);
    this.registerMounted();
    this.registerUnmounted();
  }
}
type RecordEditorControllerView = Pick<
  RecordEditorController,
  | 'modal'
  | 'modalElement'
  | 'setModalElement'
  | 'form'
  | 'isGameSession'
  | 'modalError'
  | 'saving'
  | 'steamQuery'
  | 'steamResults'
  | 'steamSearched'
  | 'steamBusy'
  | 'steamId'
  | 'steamKey'
  | 'importReport'
  | 'steamPath'
  | 'modalTitles'
  | 'open'
  | 'close'
  | 'editSession'
  | 'editGame'
  | 'editCategory'
  | 'save'
  | 'remove'
  | 'steamSearch'
  | 'importSteam'
  | 'readBackup'
  | 'categories'
  | 'groupNames'
  | 'games'
  | 'sessions'
  | 'now'
  | 'category'
  | 'gameName'
  | 'syncSessionDuration'
  | 'setSessionDuration'
>;
export function useRecordEditor(workspace: EditorDependencies): RecordEditorControllerView {
  return new RecordEditorController(workspace);
}
export type EditorModel = ReturnType<typeof useRecordEditor>;
export type EditorView = UnwrapNestedRefs<EditorModel>;
