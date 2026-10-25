<script setup lang="ts">
import { idleTimeout } from '../../../shared/lib/trackingIdle.ts';

import { computed } from 'vue';
import { Globe2 } from 'lucide-vue-next';
import type { TrackerStatus } from '../../../shared/api/trackingContracts.ts';
const props = defineProps<{ status: TrackerStatus | null; now: number }>();
const browser = computed(() => {
  const item = props.status?.browser;
  return item?.active &&
    props.now >= item.timestamp &&
    props.now - item.timestamp < 15000 &&
    item.idle_ms < idleTimeout(props.status)
    ? item
    : null;
});
</script>
<template>
  <div v-if="browser" class="browser-tracking" role="status">
    <Globe2 :size="17" />
    <div>
      <strong>Просмотр сайтов</strong><small>{{ browser.website || browser.title }} · учитывается</small>
    </div>
  </div>
</template>
<style scoped>
.browser-tracking {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
strong {
  font-weight: 500;
}
small {
  display: block;
  color: var(--muted);
  margin-top: 5px;
  overflow-wrap: anywhere;
}
</style>
