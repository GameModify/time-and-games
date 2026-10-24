import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
function trap(event: KeyboardEvent, element: HTMLElement | null): void {
  if (event.key !== 'Tab' || !element) return;
  const items = [
    ...element.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
    ),
  ].filter((item) => item.getClientRects().length);
  const first = items[0],
    last = items.at(-1);
  if (
    (event.shiftKey && document.activeElement === first) ||
    (!event.shiftKey && document.activeElement === last)
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}
export function useDialogFocus(element: Ref<HTMLElement | null>, close: () => void): void {
  const previous = document.activeElement;
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
    trap(event, element.value);
  };
  onMounted(() => {
    element.value?.querySelector<HTMLElement>('select,input,button')?.focus();
    document.addEventListener('keydown', key);
  });
  onUnmounted(() => {
    document.removeEventListener('keydown', key);
    if (previous instanceof HTMLElement) previous.focus();
  });
}
