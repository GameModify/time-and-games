<script setup lang="ts">
import { computed, ref } from 'vue';
import ClassificationDialog from './ClassificationDialog.vue';
import type { Session } from '../../../shared/api/contracts.ts';
import type { WorkspaceView } from '../../../features/workspace/index.ts';
import { activityGroups } from '../../../entities/activity/index.ts';
import { duration } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
const props = defineProps<{ sessions: Session[]; model: WorkspaceView }>();
defineEmits<{ edit: [session: Session] }>();
const selected = ref<Session | null>(null);
async function classified(): Promise<void> {
  selected.value = null;
  await props.model.load();
  props.model.flash('Категория сохранена');
}
const groups = computed(() => activityGroups(props.sessions, props.model.now));
function label(segments: Session[]): string {
  const first = segments[0];
  return first
    ? first.title || props.model.gameName(first.game_id) || props.model.category(first.category_id).name
    : 'Занятие';
}
</script>
<template>
  <div class="grouped-records">
    <details v-for="group in groups" :key="group.id" class="activity-record">
      <summary>
        <strong
          ><small v-if="group.segments[0]?.tracking_context?.project"
            >{{ group.segments[0].tracking_context.project }} · </small
          >{{ label(group.segments) }}</strong
        ><span>{{ clock(group.start) }} - {{ clock(group.end) }}</span
        ><b>{{ duration(group.elapsed, true) }}</b
        ><small v-if="group.paused">Перерывы: {{ duration(group.paused, true) }}</small
        ><small v-else>Без перерывов</small>
      </summary>
      <div class="record-segments">
        <div v-for="segment in group.segments" :key="segment.id" class="segment-actions">
          <button class="button secondary segment" @click="$emit('edit', segment)">
            <span
              >{{ clock(segment.start_at) }} -
              {{ segment.end_at === null ? 'сейчас' : clock(segment.end_at) }} ·
              {{ duration((segment.end_at ?? model.now) - segment.start_at, true) }}</span
            ><span v-if="segment.note">{{ segment.note }}</span
            ><small>{{ segment.tracking_live ? 'Текущий отрезок' : 'Изменить отрезок' }}</small>
          </button>
          <button
            v-if="!segment.tracking_live && segment.end_at !== null"
            class="button secondary classify"
            @click="selected = segment"
          >
            Категория
          </button>
          <small v-else class="muted">Категорию записи можно изменить после завершения отрезка</small>
        </div>
      </div>
    </details>
  </div>
  <ClassificationDialog
    v-if="selected"
    :key="selected.id"
    :session="selected"
    :categories="model.categories"
    @close="selected = null"
    @saved="classified"
  />
</template>
<style scoped>
.grouped-records {
  display: grid;
  gap: 10px;
  padding: 12px 20px;
}
.activity-record {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
summary {
  cursor: pointer;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
}
summary::before {
  content: '▸';
  color: var(--muted);
}
details[open] > summary::before {
  content: '▾';
}
strong {
  font-weight: 500;
  flex: 1;
  min-width: 140px;
  overflow-wrap: anywhere;
}
span,
small {
  color: var(--muted);
}
b {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.record-segments {
  display: grid;
  gap: 8px;
  padding: 0 16px 16px;
}
.segment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.segment-actions > .segment {
  flex: 1;
}
.classify {
  align-self: start;
}
.segment {
  justify-content: space-between;
  flex-wrap: wrap;
  text-align: left;
}
.segment span {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
