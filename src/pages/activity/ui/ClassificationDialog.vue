<script setup lang="ts">
import { computed, ref } from 'vue';
import { X } from 'lucide-vue-next';
import type { Category, Session } from '../../../shared/api/contracts.ts';
import type { Classification } from '../../../shared/api/trackingContracts.ts';
import { classificationScopes } from '../model/classification.ts';
import { api } from '../../../shared/api/client.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { useDialogFocus } from '../../../shared/lib/dialogFocus.ts';
import { createBackdropDismiss } from '../../../shared/lib/backdrop.ts';
const props = defineProps<{ session: Session; categories: Category[] }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const category = ref(props.session.category_id),
  scope = ref<Classification['scope']>('record');
const project = ref(props.session.tracking_context?.project ?? ''),
  busy = ref(false),
  error = ref('');
const scopes = computed(() => classificationScopes(props.session.tracking_context));
const detail = computed(() => scopes.value.find((item) => item.value === scope.value)?.detail);
const modal = ref<HTMLElement | null>(null);
useDialogFocus(modal, close);
const backdrop = createBackdropDismiss(close);
function close(): void {
  if (!busy.value) emit('close');
}
async function save(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api('/tracking/classify', 'POST', {
      session_id: props.session.id,
      category_id: category.value,
      scope: scope.value,
      project: project.value,
    });
    emit('saved');
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
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="classification-title"
      tabindex="-1"
    >
      <header class="modal-header">
        <h2 id="classification-title">Категория занятия</h2>
        <button class="icon-button" aria-label="Закрыть" :disabled="busy" @click="close">
          <X :size="20" />
        </button>
      </header>
      <form class="modal-form" @submit.prevent="save">
        <p class="source">{{ session.title || 'Запись времени' }}</p>
        <label
          >Категория<select v-model="category" :disabled="busy">
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select></label
        >
        <label
          >Применить к<select v-model="scope" :disabled="busy">
            <option v-for="item in scopes" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select></label
        >
        <p class="field-hint" role="status">{{ detail }}</p>
        <label
          >Проект, если есть<input
            v-model="project"
            maxlength="100"
            placeholder="Например, Time &amp; Games"
            :disabled="busy"
        /></label>
        <p v-if="scope !== 'record'" class="field-hint">
          Изменится эта запись и правило для будущих занятий. Другие записи истории останутся прежними.
        </p>
        <p v-if="error" class="alert error" role="alert">{{ error }}</p>
        <div class="modal-actions">
          <button type="button" class="button secondary" :disabled="busy" @click="close">Отмена</button
          ><button class="button primary" :disabled="busy">
            {{ busy ? 'Сохраняем…' : 'Применить' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
<style scoped>
.source {
  overflow-wrap: anywhere;
  color: var(--muted);
}
</style>
