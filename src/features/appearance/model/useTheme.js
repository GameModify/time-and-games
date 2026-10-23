import { ref } from 'vue';
export function useTheme() {
  const theme = ref(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  function setTheme(value) {
    theme.value = value;
    document.documentElement.dataset.theme = value;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', value === 'light' ? '#f3f4f8' : '#0c0d14');
    try {
      localStorage.setItem('time-and-games-theme', value);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
  }
  return { theme, setTheme };
}
