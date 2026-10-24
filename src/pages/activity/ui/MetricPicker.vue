<script setup lang="ts">
import { ref } from 'vue';
import { X } from 'lucide-vue-next';
import type { Category, DashboardCards } from '../../../shared/api/contracts.ts';
import CheckboxField from '../../../shared/ui/CheckboxField.vue';
import { createBackdropDismiss } from '../../../shared/lib/backdrop.ts';
import { useDialogFocus } from '../../../shared/lib/dialogFocus.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
const props = defineProps<{
  categories: Category[];
  selection: DashboardCards;
  save: (cards: DashboardCards) => Promise<void>;
}>();
const emit = defineEmits<{ close: [] }>();
const selected = ref([...props.selection.category_ids]),
  busy = ref(false),
  error = ref('');
const modal = ref<HTMLElement | null>(null);
const backdrop = createBackdropDismiss(close);
useDialogFocus(modal, close);
function close(): void {
  if (!busy.value) emit('close');
}
function toggle(id: string, checked: boolean): void {
  selected.value = checked ? [...selected.value, id] : selected.value.filter((item) => item !== id);
}
async function submit(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await props.save({ category_ids: selected.value });
    emit('close');
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div
    class="modal-backdrop"
    @pointerdown="backdrop.down"
    @pointerup="backdrop.up"
    @pointercancel="backdrop.cancel"
  >
    <section
      ref="modal"
      class="modal metric-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="metric-picker-title"
      tabindex="-1"
    >
      <header class="modal-header">
        <h2 id="metric-picker-title">Карточки сводки</h2>
        <button class="icon-button" aria-label="Закрыть выбор карточек" :disabled="busy" @click="close">
          <X :size="20" />
        </button>
      </header>
      <form class="modal-form" @submit.prevent="submit">
        <p class="field-hint">
          Добавь интересующие категории. Сними галочку, чтобы убрать карточку. Выбор сохранится на всех
          устройствах, подключённых к этому сайту.
        </p>
        <fieldset class="metric-options" :disabled="busy">
          <legend>Дополнительные карточки</legend>
          <CheckboxField
            v-for="category in categories"
            :key="category.id"
            :modelValue="selected.includes(category.id)"
            :label="category.name"
            @update:model-value="toggle(category.id, $event)"
          />
        </fieldset>
        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <div class="modal-actions">
          <button type="button" class="button secondary" :disabled="busy" @click="close">Отмена</button>
          <button class="button primary" :disabled="busy">
            {{ busy ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
<style scoped>
.metric-options {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.metric-options legend {
  padding-inline: 6px;
  color: var(--muted);
}
.metric-picker .field-hint {
  margin: 0;
}
</style>
