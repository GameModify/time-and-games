import { onMounted, onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';
export function usePlotWidth(element: Ref<HTMLElement | null>) {
  const width = ref(0);
  let observer: ResizeObserver | undefined;
  onMounted(() => {
    width.value = element.value?.clientWidth ?? 0;
    observer = new ResizeObserver((entries) => {
      width.value = entries[0]?.contentRect.width ?? 0;
    });
    if (element.value) observer.observe(element.value);
  });
  onUnmounted(() => {
    observer?.disconnect();
  });
  return width;
}
