<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from 'lucide-vue-next';
import type { CategoryLane, ActivityTrack } from '../../../entities/activity/index.ts';
import { timelineItems } from '../../../entities/activity/index.ts';
import type { Session } from '../../../shared/api/contracts.ts';
import { duration } from '../../../shared/lib/date.ts';
import { useDialogFocus } from '../../../shared/lib/dialogFocus.ts';
import { createBackdropDismiss } from '../../../shared/lib/backdrop.ts';
import TimelineActivityItem from './TimelineActivityItem.vue';
const props = defineProps<{ lane: CategoryLane; period: string; selectedItem?: string }>();
const emit = defineEmits<{ close: []; focus: [item: ActivityTrack]; edit: [session: Session] }>();
const panel = ref<HTMLElement | null>(null),
  limit = ref(30);
const items = computed(() => timelineItems(props.lane.tracks));
const shown = computed(() => {
  const selected = items.value.find((item) => item.id === props.selectedItem);
  return selected
    ? [selected, ...items.value.filter((item) => item !== selected)].slice(0, limit.value)
    : items.value.slice(0, limit.value);
});
const close = () => {
  emit('close');
};
useDialogFocus(panel, close);
const backdrop = createBackdropDismiss(close);
</script>
<template>
  <Teleport to="body">
    <div
      class="timeline-backdrop"
      @pointerdown="backdrop.down"
      @pointerup="backdrop.up"
      @pointercancel="backdrop.cancel"
    >
      <section
        ref="panel"
        class="timeline-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-detail-title"
      >
        <header>
          <div>
            <h2 id="timeline-detail-title"><i :style="{ background: lane.color }" />{{ lane.name }}</h2>
            <p>{{ period }} · {{ duration(lane.elapsed) }} · занятий: {{ items.length }}</p>
          </div>
          <button class="icon-button" aria-label="Закрыть детали графика" @click="close">
            <X :size="20" />
          </button>
        </header>
        <div class="details-body">
          <TimelineActivityItem
            v-for="item in shown"
            :key="item.id"
            :item="item"
            :selected="selectedItem === item.id"
            :fallback="lane.name"
            @focus="emit('focus', $event)"
            @edit="emit('edit', $event)"
          />
          <button v-if="shown.length < items.length" class="button secondary more" @click="limit += 30">
            Показать ещё · осталось {{ items.length - shown.length }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.timeline-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: #0006;
  display: flex;
  justify-content: flex-end;
}
.timeline-details {
  width: min(530px, 100%);
  height: 100%;
  background: var(--panel);
  color: var(--text);
  box-shadow: -8px 0 32px #0003;
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  padding: 24px;
  border-bottom: 1px solid var(--line);
}
header > div {
  min-width: 0;
}
h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 500;
  margin: 0;
  overflow-wrap: anywhere;
}
h2 i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 9px;
}
p {
  font-size: 13px;
  color: var(--muted);
  margin: 9px 0 0;
}
.details-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 24px 24px;
  scrollbar-gutter: stable;
}
.more {
  margin-top: 20px;
}
</style>
