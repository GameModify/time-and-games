<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue';
import type { CSSProperties } from 'vue';
import { recentHoursLabel as periodLabel } from '../model/timelineSummary.ts';
import { Check, ChevronDown, Clock3 } from 'lucide-vue-next';
import { recentHourOptions } from '../../../entities/activity/index.ts';
import type { RecentTrackHours } from '../../../entities/activity/index.ts';
const props = defineProps<{ hours: RecentTrackHours | null; active: boolean }>();
const emit = defineEmits<{ period: [hours: RecentTrackHours | null] }>();
const root = ref<HTMLElement | null>(null),
  trigger = ref<HTMLButtonElement | null>(null),
  menu = ref<HTMLElement | null>(null),
  open = ref(false);
const menuId = useId();
const placement = ref<CSSProperties>({});
const label = computed(() => (props.hours === null ? 'Последние часы' : periodLabel(props.hours)));
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
  positionMenu();
  await nextTick();
  const chosen = menu.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
  (chosen ?? menu.value?.querySelector<HTMLButtonElement>('button'))?.focus();
}
function pixels(value: number): string {
  return String(value) + 'px';
}
function positionMenu(): void {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const width = Math.min(268, window.innerWidth - 24);
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const limit = Math.max(above, below, 100);
  const height = Math.min(menu.value?.scrollHeight ?? 300, limit);
  placement.value = {
    width: pixels(width),
    left: pixels(Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))),
    top: pixels(below >= height ? rect.bottom + 8 : Math.max(12, rect.top - height - 8)),
    maxHeight: pixels(limit),
  };
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
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button') ?? []);
  const index = items.findIndex((item) => item === document.activeElement);
  const step = event.key === 'ArrowUp' ? -1 : 1;
  const edge = event.key === 'Home' ? 0 : items.length - 1;
  const next =
    event.key === 'Home' || event.key === 'End' ? edge : (index + step + items.length) % items.length;
  items[next]?.focus();
}
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside);
  window.removeEventListener('resize', positionMenu);
  window.removeEventListener('scroll', positionMenu, true);
});
</script>
<template>
  <div ref="root" class="period-picker" @focusout="focusOut" @keydown.esc.stop.prevent="close(true)">
    <div class="segmented" aria-label="Период на графике">
      <button type="button" :class="{ active: hours === null && active }" @click="choose(null)">
        Весь день
      </button>
      <button
        ref="trigger"
        type="button"
        class="period-trigger"
        :class="{ active: hours !== null && active }"
        aria-haspopup="menu"
        :aria-expanded="open"
        :aria-controls="menuId"
        @click="toggle"
        @keydown.down.prevent="toggle"
      >
        <Clock3 :size="15" aria-hidden="true" />
        <span>{{ label }}</span>
        <ChevronDown :size="15" :class="{ rotated: open }" aria-hidden="true" />
      </button>
    </div>
    <div
      v-if="open"
      :id="menuId"
      ref="menu"
      class="period-menu"
      :style="placement"
      role="menu"
      aria-label="Последние часы"
      @keydown="navigate"
    >
      <span class="period-menu-title">Показать до текущего момента</span>
      <button
        v-for="value in recentHourOptions"
        :key="value"
        type="button"
        role="menuitemradio"
        :aria-checked="hours === value"
        @click="choose(value)"
      >
        <span>{{ periodLabel(value) }}</span>
        <Check v-if="hours === value" :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
<style scoped>
.period-picker {
  position: relative;
  max-width: 100%;
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
  transition: transform 150ms ease;
}
.period-trigger .rotated {
  transform: rotate(180deg);
}
.period-menu {
  position: fixed;
  z-index: 20;
  display: grid;
  gap: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--raised);
  color: var(--text);
  box-shadow: 0 12px 32px #0003;
}
.period-menu-title {
  padding: 8px 10px;
  color: var(--muted);
  font-size: 12px;
}
.period-menu > button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 42px;
  padding: 10px;
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  text-align: left;
  font: inherit;
  font-size: 14px;
}
.period-menu > button:hover,
.period-menu > button:focus-visible {
  background: var(--surface);
}
.period-menu > button[aria-checked='true'] {
  background: var(--accent-surface);
  color: var(--accent-text);
}
@media (prefers-reduced-motion: reduce) {
  .period-trigger svg:last-child {
    transition: none;
  }
}
</style>
