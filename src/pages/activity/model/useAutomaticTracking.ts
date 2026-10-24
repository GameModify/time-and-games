import { ref, onMounted, onUnmounted } from 'vue';
import type { TrackingState } from '../../../shared/api/trackingContracts.ts';
import { trackingStateSchema } from '../../../shared/api/trackingContracts.ts';
import { readApi } from '../../../shared/api/client.ts';
class AutomaticTracking {
  state = ref<TrackingState | null>(null);
  timer: ReturnType<typeof setInterval> | undefined;
  disposed = false;
  load = async () => {
    try {
      const next = await readApi('/tracking', trackingStateSchema);
      if (!this.disposed) this.state.value = next;
    } catch {
      if (!this.disposed) this.state.value = null;
    }
  };
  start = () => {
    void this.load();
    this.timer = setInterval(() => {
      void this.load();
    }, 5000);
  };
  stop = () => {
    this.disposed = true;
    clearInterval(this.timer);
  };
}
export function useAutomaticTracking() {
  const tracking = new AutomaticTracking();
  onMounted(tracking.start);
  onUnmounted(tracking.stop);
  return tracking.state;
}
