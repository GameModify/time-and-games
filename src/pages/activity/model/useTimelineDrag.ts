import { ref } from 'vue';
import { selectedTrackRange } from '../../../entities/activity/index.ts';
import type { TrackRange } from '../../../entities/activity/index.ts';
interface DragSelection {
  pointer: number;
  lane: string;
  left: number;
  width: number;
  start: number;
  end: number;
  range: TrackRange;
}
function relativePosition(event: PointerEvent, drag: DragSelection): number {
  return Math.max(0, Math.min(1, (event.clientX - drag.left) / drag.width));
}
function dragTarget(event: PointerEvent): HTMLElement | undefined {
  if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') return;
  return event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
}
function begin(event: PointerEvent, lane: string, range: TrackRange): DragSelection | undefined {
  const target = dragTarget(event);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width) return;
  const start = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  target.setPointerCapture(event.pointerId);
  return {
    pointer: event.pointerId,
    lane,
    left: rect.left,
    width: rect.width,
    start,
    end: start,
    range,
  };
}

class TimelineSelection {
  drag = ref<DragSelection>();
  skippedClick = ref(false);
  range: () => TrackRange;
  zoom: (value: TrackRange) => void;
  constructor(range: () => TrackRange, zoom: (value: TrackRange) => void) {
    this.range = range;
    this.zoom = zoom;
  }
  down = (event: PointerEvent, lane: string): void => {
    this.skippedClick.value = false;
    this.drag.value = begin(event, lane, this.range());
  };
  move = (event: PointerEvent): void => {
    if (this.drag.value?.pointer === event.pointerId)
      this.drag.value.end = relativePosition(event, this.drag.value);
  };
  up = (event: PointerEvent): void => {
    if (this.drag.value?.pointer !== event.pointerId) return;
    const selection = this.drag.value;
    const last = relativePosition(event, selection);
    this.skippedClick.value = Math.abs(last - selection.start) * selection.width >= 8;
    if (this.skippedClick.value) this.zoom(selectedTrackRange(selection.range, selection.start, last));
    this.drag.value = undefined;
  };
  cancel = (): void => {
    this.drag.value = undefined;
  };
}
export function useTimelineDrag(range: () => TrackRange, zoom: (value: TrackRange) => void) {
  return new TimelineSelection(range, zoom);
}
export function dragStyle(drag: DragSelection | undefined) {
  return drag
    ? {
        left: `${Math.min(drag.start, drag.end) * 100}%`,
        width: `${Math.abs(drag.end - drag.start) * 100}%`,
      }
    : {};
}
