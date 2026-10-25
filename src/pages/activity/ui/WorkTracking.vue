<script setup lang="ts">
import { idleTimeout, inactivityMessage } from '../../../shared/lib/trackingIdle.ts';

import { workingApplication } from '../model/workContext.ts';
import { computed } from 'vue';
import { BriefcaseBusiness, Pause, Play } from 'lucide-vue-next';
import type { Category } from '../../../shared/api/contracts.ts';
import type { TrackerStatus, TrackingSettings } from '../../../shared/api/trackingContracts.ts';
const props = defineProps<{
  status: TrackerStatus | null;
  categories: Category[];
  settings: TrackingSettings;
  now: number;
}>();
const context = computed(() =>
  workingApplication(props.status, props.settings, props.categories, props.now),
);
const active = computed(
  () => context.value?.app.active && context.value.app.idle_ms < idleTimeout(props.status),
);
</script>
<template>
  <div v-if="context" class="work-tracking">
    <BriefcaseBusiness :size="18" />
    <div>
      <strong>{{ context.rule.project || context.rule.name }}</strong
      ><small>{{ context.app.app }} · {{ context.app.title }}</small
      ><small
        ><Play v-if="active" :size="12" /><Pause v-else :size="12" />{{
          active ? 'Рабочее время учитывается' : inactivityMessage(status)
        }}</small
      >
    </div>
  </div>
</template>
<style scoped>
.work-tracking {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.work-tracking div {
  min-width: 0;
}
strong {
  font-weight: 500;
  overflow-wrap: anywhere;
}
small {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  margin-top: 5px;
  overflow-wrap: anywhere;
}
</style>
