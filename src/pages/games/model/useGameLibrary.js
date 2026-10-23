import { computed, ref } from 'vue';
import { completedInPeriod, gameMinutes } from '../../../entities/game/index.js';
export function useGameLibrary(games) {
  const search = ref('');
  const statusFilter = ref('all');
  const completionPeriod = ref('all');
  const completedYears = computed(() =>
    [
      ...new Set(
        games.value
          .filter((g) => g.status === 'completed' && g.completed_at)
          .map((g) => g.completed_at.slice(0, 4)),
      ),
    ]
      .sort()
      .reverse(),
  );
  const filteredGames = computed(() =>
    games.value.filter(
      (g) =>
        (statusFilter.value === 'all' || g.status === statusFilter.value) &&
        completedInPeriod(g, completionPeriod.value) &&
        g.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
    ),
  );
  const libraryStats = computed(() => ({
    total: games.value.length,
    completed: games.value.filter((g) => g.status === 'completed').length,
    playing: games.value.filter((g) => g.status === 'playing').length,
    minutes: games.value.reduce((sum, g) => sum + gameMinutes(g), 0),
    shown: filteredGames.value.length,
    shownMinutes: filteredGames.value.reduce((sum, g) => sum + gameMinutes(g), 0),
    shownCompleted: filteredGames.value.filter((g) => g.status === 'completed').length,
  }));
  function setStatus(value) {
    statusFilter.value = value;
    if (!['all', 'completed'].includes(value)) completionPeriod.value = 'all';
  }
  function setPeriod(value) {
    completionPeriod.value = value;
    if (value !== 'all') statusFilter.value = 'completed';
  }
  return {
    search,
    statusFilter,
    completionPeriod,
    completedYears,
    filteredGames,
    libraryStats,
    setStatus,
    setPeriod,
  };
}
