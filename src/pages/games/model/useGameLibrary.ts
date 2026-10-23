import type { Ref } from 'vue';
import type { Game } from '../../../shared/api/contracts.ts';
import { computed, ref } from 'vue';
import { gamePeriodDate, gameMinutes } from '../../../entities/game/index.ts';
import { dateInPeriod } from '../../../shared/lib/datePeriod.ts';
class GameLibraryControllerContext {
  games: Ref<Game[]>;
  constructor(games: Ref<Game[]>) {
    this.games = games;
  }
}
class GameLibraryController extends GameLibraryControllerContext {
  search = ref('');
  favoritesOnly = ref(false);
  statusFilter = ref('all');
  completionPeriod = ref('all');
  completedYears = computed(() =>
    [
      ...new Set(
        this.games.value
          .filter((g) => this.statusFilter.value === 'all' || g.status === this.statusFilter.value)
          .map((g) => gamePeriodDate(g, this.statusFilter.value)?.slice(0, 4))
          .filter((year) => !!year),
      ),
    ]
      .sort()
      .reverse(),
  );
  filteredGames = computed(() =>
    this.games.value.filter(
      (g) =>
        (this.statusFilter.value === 'all' || g.status === this.statusFilter.value) &&
        (!this.favoritesOnly.value || g.favorite) &&
        dateInPeriod(gamePeriodDate(g, this.statusFilter.value), this.completionPeriod.value) &&
        g.name.toLocaleLowerCase().includes(this.search.value.toLocaleLowerCase()),
    ),
  );
  libraryStats = computed(() => ({
    total: this.games.value.length,
    completed: this.games.value.filter((g) => g.status === 'completed').length,
    playing: this.games.value.filter((g) => g.status === 'playing').length,
    minutes: this.games.value.reduce((sum, g) => sum + gameMinutes(g), 0),
    shown: this.filteredGames.value.length,
    shownMinutes: this.filteredGames.value.reduce((sum, g) => sum + gameMinutes(g), 0),
    shownCompleted: this.filteredGames.value.filter((g) => g.status === 'completed').length,
  }));
  setStatus = (value: string) => {
    this.statusFilter.value = value;
  };
  setPeriod = (value: string) => {
    this.completionPeriod.value = value;
  };
  periodLabel = computed(() =>
    this.statusFilter.value === 'completed'
      ? 'Когда пройдены'
      : this.statusFilter.value === 'all'
        ? 'Дата начала или прохождения'
        : 'Когда начаты',
  );
}
type GameLibraryControllerView = Pick<
  GameLibraryController,
  | 'search'
  | 'favoritesOnly'
  | 'periodLabel'
  | 'statusFilter'
  | 'completionPeriod'
  | 'completedYears'
  | 'filteredGames'
  | 'libraryStats'
  | 'setStatus'
  | 'setPeriod'
>;
export function useGameLibrary(games: Ref<Game[]>): GameLibraryControllerView {
  return new GameLibraryController(games);
}
