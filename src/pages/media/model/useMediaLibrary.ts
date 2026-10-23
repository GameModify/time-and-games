import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue';
import type { UnwrapNestedRefs, Ref } from 'vue';
import type { Media, CatalogResult, CatalogDetails } from '../../../shared/api/mediaContracts.ts';
import {
  catalogResultSchema,
  catalogDetailsSchema,
  mediaInputSchema,
  mediaSchema,
} from '../../../shared/api/mediaContracts.ts';
import { emptyMedia, updateMediaProgress, orderedEpisodes } from '../../../entities/media/index.ts';
import { api, readApi } from '../../../shared/api/client.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { playtimeFields, playtimeMinutes } from '../../../entities/game/index.ts';
import type { NumericInput } from '../../../shared/api/contracts.ts';
class MediaLibraryControllerContext {
  items: Ref<Media[]>;
  load: () => Promise<void>;
  flash: (text: string) => void;
  constructor(items: Ref<Media[]>, load: () => Promise<void>, flash: (text: string) => void) {
    this.items = items;
    this.load = load;
    this.flash = flash;
  }
}
class MediaLibraryController extends MediaLibraryControllerContext {
  search = ref('');
  favoritesOnly = ref(false);
  status = ref('all');
  kind = ref('all');
  dialog = ref(false);
  confirmingDelete = ref(false);
  busy = ref(false);
  error = ref('');
  form = ref<Media>({ ...emptyMedia(), id: '', created_at: 0 });
  hours = ref<NumericInput>('');
  minutes = ref<NumericInput>('');
  catalogQuery = ref('');
  catalogResults = ref<CatalogResult[]>([]);
  catalogBusy = ref(false);
  catalogSearched = ref(false);
  catalogVersion = 0;
  previousFocus: HTMLElement | null = null;
  dialogElement = ref<HTMLElement | null>(null);
  filtered = computed(() =>
    this.items.value.filter(
      (m) =>
        (this.status.value === 'all' || m.status === this.status.value) &&
        (this.kind.value === 'all' || m.kind === this.kind.value) &&
        (!this.favoritesOnly.value || m.favorite) &&
        m.name.toLocaleLowerCase().includes(this.search.value.toLocaleLowerCase()),
    ),
  );
  stats = computed(() => ({
    total: this.items.value.length,
    completed: this.items.value.filter((m) => m.status === 'completed').length,
    watching: this.items.value.filter((m) => m.status === 'watching').length,
    minutes: this.items.value.reduce((n, m) => n + m.watched_minutes, 0),
  }));
  seasons = computed(() =>
    [...new Set(this.form.value.episodes.map((e) => e.season))].sort((a, b) => a - b),
  );
  seasonEpisodes = computed(() =>
    orderedEpisodes(this.form.value.episodes).filter((e) => e.season === this.form.value.current_season),
  );
  setDialogElement = (element: unknown) => {
    this.dialogElement.value = element instanceof HTMLElement ? element : null;
  };
  open = (item?: Media) => {
    this.catalogVersion++;
    this.catalogBusy.value = false;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.form.value = item ? mediaSchema.parse(item) : { ...emptyMedia(), id: '', created_at: 0 };
    const time = playtimeFields(this.form.value.watched_minutes);
    this.hours.value = time.hours;
    this.minutes.value = time.minutes;
    this.error.value = '';
    this.catalogQuery.value = '';
    this.catalogResults.value = [];
    this.catalogSearched.value = false;
    this.confirmingDelete.value = false;
    this.dialog.value = true;
    void nextTick(() =>
      this.dialogElement.value?.querySelector<HTMLElement>('input,button,select')?.focus(),
    );
  };
  close = () => {
    if (this.busy.value) return;
    this.catalogVersion++;
    this.catalogBusy.value = false;
    this.dialog.value = false;
    void nextTick(() => this.previousFocus?.focus());
  };
  syncProgress = () => {
    try {
      this.form.value = updateMediaProgress(this.form.value, {
        current_season: this.form.value.current_season,
        current_episode: this.form.value.current_episode,
      });
      if (this.form.value.time_mode === 'estimated') {
        const time = playtimeFields(this.form.value.watched_minutes);
        this.hours.value = time.hours;
        this.minutes.value = time.minutes;
      }
      this.error.value = '';
    } catch (e) {
      this.error.value = errorMessage(e);
    }
  };
  beginCatalogSearch = () => {
    this.catalogBusy.value = true;
    this.catalogSearched.value = false;
    this.error.value = '';
  };
  searchCatalog = async () => {
    if (this.catalogBusy.value || this.catalogQuery.value.trim().length < 2) return;
    const version = ++this.catalogVersion;
    this.beginCatalogSearch();
    try {
      const rows = await readApi(
        `/media/search?q=${encodeURIComponent(this.catalogQuery.value.trim())}&kind=${this.form.value.kind}`,
        catalogResultSchema.array(),
      );
      if (version === this.catalogVersion) {
        this.catalogResults.value = rows;
        this.catalogSearched.value = true;
      }
    } catch (e) {
      if (version === this.catalogVersion) this.error.value = errorMessage(e);
    } finally {
      if (version === this.catalogVersion) this.catalogBusy.value = false;
    }
  };
  applyCatalogDetails = (details: CatalogDetails, result: CatalogResult, preserveName: boolean) => {
    this.form.value = {
      ...this.form.value,
      ...details,
      poster: result.poster || details.poster,
      name: preserveName ? this.form.value.name : details.name,
    };
    this.catalogResults.value = [];
    this.catalogSearched.value = false;
  };
  selectExisting = (result: CatalogResult) => {
    const existing = this.items.value.find((item) => item.imdb_id === result.imdb_id);
    if (!existing || this.form.value.id) return false;
    this.open(existing);
    this.flash('Эта карточка уже есть в библиотеке');
    return true;
  };
  selectCatalog = async (result: CatalogResult, preserveName = false) => {
    if (this.selectExisting(result)) return;
    const version = ++this.catalogVersion;
    this.catalogBusy.value = true;
    this.error.value = '';
    try {
      const details = await readApi(
        `/media/catalog/${result.imdb_id}?kind=${result.kind}`,
        catalogDetailsSchema,
      );
      if (version !== this.catalogVersion) return;
      this.applyCatalogDetails(details, result, preserveName);
    } catch (e) {
      if (version === this.catalogVersion) this.error.value = errorMessage(e);
    } finally {
      if (version === this.catalogVersion) this.catalogBusy.value = false;
    }
  };
  save = async () => {
    if (this.busy.value || this.catalogBusy.value) return;
    this.busy.value = true;
    this.error.value = '';
    try {
      const f = this.form.value;
      if (f.time_mode === 'manual')
        f.watched_minutes = playtimeMinutes(this.hours.value, this.minutes.value);
      const input = mediaInputSchema.parse(f);
      await api(f.id ? `/media/${f.id}` : '/media', f.id ? 'PATCH' : 'POST', input);
      await this.load();
      this.busy.value = false;
      this.close();
      this.flash('Карточка сохранена');
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      this.busy.value = false;
    }
  };
  advance = async (item: Media) => {
    if (this.busy.value) return;
    this.busy.value = true;
    this.error.value = '';
    try {
      await api(`/media/${item.id}/next-episode`, 'POST', {});
      await this.load();
      this.flash('Серия отмечена как просмотренная');
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      this.busy.value = false;
    }
  };
  toggleFavorite = async (item: Media) => {
    if (this.busy.value) return;
    this.busy.value = true;
    try {
      await api(`/media/${item.id}`, 'PATCH', { favorite: !item.favorite });
      await this.load();
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      this.busy.value = false;
    }
  };
  remove = async () => {
    this.busy.value = true;
    this.error.value = '';
    try {
      await api(`/media/${this.form.value.id}`, 'DELETE');
      await this.load();
      this.busy.value = false;
      this.close();
      this.flash('Карточка удалена');
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      this.busy.value = false;
    }
  };
  keydown = (event: KeyboardEvent) => {
    if (!this.dialog.value) return;
    if (event.key === 'Escape') this.close();
    if (event.key === 'Tab') {
      const targets = [
        ...(this.dialogElement.value?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select,textarea,a[href]',
        ) ?? []),
      ].filter((e) => e.getClientRects().length);
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  registerMounted = () => {
    onMounted(() => {
      document.addEventListener('keydown', this.keydown);
    });
  };
  registerUnmounted = () => {
    onUnmounted(() => {
      this.catalogVersion++;
      document.removeEventListener('keydown', this.keydown);
    });
  };
  constructor(items: Ref<Media[]>, load: () => Promise<void>, flash: (text: string) => void) {
    super(items, load, flash);
    this.registerMounted();
    this.registerUnmounted();
  }
}
type MediaLibraryControllerView = Pick<
  MediaLibraryController,
  | 'search'
  | 'favoritesOnly'
  | 'toggleFavorite'
  | 'status'
  | 'kind'
  | 'dialog'
  | 'confirmingDelete'
  | 'busy'
  | 'error'
  | 'form'
  | 'hours'
  | 'minutes'
  | 'catalogQuery'
  | 'catalogResults'
  | 'catalogBusy'
  | 'catalogSearched'
  | 'filtered'
  | 'stats'
  | 'seasons'
  | 'seasonEpisodes'
  | 'setDialogElement'
  | 'open'
  | 'close'
  | 'syncProgress'
  | 'searchCatalog'
  | 'selectCatalog'
  | 'save'
  | 'advance'
  | 'remove'
>;
export function useMediaLibrary(
  items: Ref<Media[]>,
  load: () => Promise<void>,
  flash: (text: string) => void,
): MediaLibraryControllerView {
  return new MediaLibraryController(items, load, flash);
}
export type MediaLibraryView = UnwrapNestedRefs<ReturnType<typeof useMediaLibrary>>;
