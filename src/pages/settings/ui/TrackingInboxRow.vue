<script setup lang="ts">
import CheckboxField from '../../../shared/ui/CheckboxField.vue';
import { ref } from 'vue';
import type { Category } from '../../../shared/api/contracts.ts';
import type {
  TrackingConnection,
  TrackingInboxItem,
  TrackingImport,
  TrackingIgnore,
} from '../../../shared/api/trackingContracts.ts';
import { duration } from '../../../shared/lib/date.ts';
const props = defineProps<{
  item: TrackingInboxItem;
  categories: Category[];
  mappings: TrackingConnection['mappings'];
  busy: boolean;
}>();
const emit = defineEmits<{ import: [value: TrackingImport]; ignore: [value: TrackingIgnore] }>();
const remember = ref(false);
const category = ref(
  props.mappings.find((mapping) => mapping.activity === props.item.activity)?.category_id ?? '',
);
function importItem(): void {
  emit('import', {
    id: props.item.id,
    device_id: props.item.device_id,
    category_id: category.value,
    remember: remember.value,
  });
}
</script>
<template>
  <div class="tracking-inbox-row">
    <div class="tracking-interval-info">
      <strong>{{ item.title || 'Занятие без названия' }}</strong>
      <span class="muted"
        >{{
          new Date(item.start_at).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        }}
        · {{ duration(item.end_at - item.start_at, true) }} · {{ item.activity || 'Без правила' }}</span
      >
    </div>
    <span v-if="item.resource_kind === 'document'" class="muted document-path">{{
      item.resource_id?.startsWith('word-title:')
        ? 'Полный путь документа не определён'
        : item.resource_id
    }}</span>
    <CheckboxField
      v-if="
        item.resource_kind === 'document' &&
        item.resource_id &&
        !item.resource_id.startsWith('word-title:')
      "
      v-model="remember"
      label="Запомнить категорию для этого документа"
    />
    <label class="tracking-category"
      ><span class="sr-only">Категория интервала</span
      ><select v-model="category">
        <option value="">Выбери категорию</option>
        <option v-for="entry in categories" :key="entry.id" :value="entry.id">{{ entry.name }}</option>
      </select></label
    >
    <div class="tracking-row-actions">
      <button class="button secondary" :disabled="!category || busy" @click="importItem">Добавить</button
      ><button
        class="text-button"
        :disabled="busy"
        @click="emit('ignore', { id: item.id, device_id: item.device_id })"
      >
        Пропустить
      </button>
    </div>
  </div>
</template>

<style scoped>
.document-path {
  overflow-wrap: anywhere;
  grid-column: 1 / -1;
  font-size: 13px;
}
</style>
