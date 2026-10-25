<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue';
import { Clock3, ChevronRight } from 'lucide-vue-next';
import { recentHoursLabel } from '../model/timelineSummary.ts';
import { recentHourOptions } from '../../../entities/activity/index.ts';
import type { RecentTrackHours } from '../../../entities/activity/index.ts';
const props = defineProps<{ hours: RecentTrackHours | null; active: boolean }>();
const emit = defineEmits<{ period: [hours: RecentTrackHours | null] }>();
const root = ref<HTMLElement | null>(null),
  trigger = ref<HTMLButtonElement | null>(null),
  options = ref<HTMLElement | null>(null),
  open = ref(false);
const optionsId = useId();
const label = computed(() =>
  open.value || props.hours === null ? 'Последние часы' : recentHoursLabel(props.hours),
);
function close(restore = false): void {
  open.value = false;
  if (restore) trigger.value?.focus();
}
async function toggle(): Promise<void> {
  if (open.value) {
    close();
    return;
  }
  open.value = true;
  await nextTick();
  const chosen = options.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
  (chosen ?? options.value?.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
}
function choose(hours: RecentTrackHours | null): void {
  emit('period', hours);
  close(hours !== null);
}
function outside(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close();
}
function focusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) close();
}
function navigate(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(options.value?.querySelectorAll<HTMLButtonElement>('button') ?? []);
  const index = items.findIndex((item) => item === document.activeElement);
  const step = event.key === 'ArrowLeft' ? -1 : 1;
  const edge = event.key === 'Home' ? 0 : items.length - 1;
  const next =
    event.key === 'Home' || event.key === 'End' ? edge : (index + step + items.length) % items.length;
  items[next]?.focus({ preventScroll: true });
}
onMounted(() => {
  document.addEventListener('pointerdown', outside);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside);
});
</script>
<template>
  <div ref="root" class="period-picker" @focusout="focusOut" @keydown.esc.stop.prevent="close(true)">
    <div class="segmented" aria-label="Период на графике">
      <button type="button" :class="{ active: hours === null && active && !open }" @click="choose(null)">
        Весь день
      </button>
      <button
        ref="trigger"
        type="button"
        class="period-trigger"
        :class="{ active: open || (hours !== null && active) }"
        :aria-expanded="open"
        :aria-controls="optionsId"
        @click="toggle"
        @keydown.right.prevent="toggle"
      >
        <Clock3 :size="15" aria-hidden="true" />
        <span>{{ label }}</span>
        <ChevronRight :size="15" :class="{ rotated: open }" aria-hidden="true" />
      </button>
    </div>
    <Transition name="hours-slide">
      <div
        v-if="open"
        :id="optionsId"
        ref="options"
        class="hour-options"
        role="group"
        aria-label="Выбор последних часов"
        @keydown="navigate"
      >
        <button
          v-for="value in recentHourOptions"
          :key="value"
          type="button"
          :aria-label="recentHoursLabel(value)"
          :aria-pressed="hours === value"
          :disabled="!open"
          @click="choose(value)"
        >
          {{ value }} ч
        </button>
      </div>
    </Transition>
  </div>
</template>
<style scoped>
.period-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}
.segmented {
  flex-shrink: 0;
}
.segmented > button {
  min-height: 36px;
  white-space: nowrap;
}
.period-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.period-trigger svg:last-child {
  transition: transform 240ms ease;
}
.period-trigger .rotated {
  transform: rotate(180deg);
}
.hour-options {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 224px;
  max-width: 100%;
  padding: 3px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--input);
  transform-origin: left center;
}
.hour-options > button {
  flex: 1 0 30px;
  min-height: 36px;
  padding: 5px 4px;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
}
.hour-options > button:hover {
  background: var(--surface);
  color: var(--text);
}
.hour-options > button[aria-pressed='true'] {
  background: var(--accent-surface);
  color: var(--accent-text);
}
.hour-options > button:focus-visible {
  outline: 2px solid var(--accent-text);
  outline-offset: -2px;
}
.hours-slide-enter-active,
.hours-slide-leave-active {
  transition:
    width 240ms ease,
    padding 240ms ease,
    opacity 160ms ease,
    transform 240ms ease;
}
.hours-slide-enter-from,
.hours-slide-leave-to {
  width: 0;
  padding-inline: 0;
  opacity: 0;
  transform: translateX(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .period-trigger svg:last-child,
  .hours-slide-enter-active,
  .hours-slide-leave-active {
    transition: none;
  }
}
</style>
