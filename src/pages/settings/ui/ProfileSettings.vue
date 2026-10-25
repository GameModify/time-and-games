<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import type { LocalProfile } from '../../../shared/api/profileContracts.ts';
import ProfileAvatar from '../../../shared/ui/ProfileAvatar.vue';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { avatarImage } from '../model/avatarImage.ts';
const props = defineProps<{ profile: LocalProfile; save: (profile: LocalProfile) => Promise<void> }>();
const draft = reactive({ ...props.profile });
const busy = ref(false),
  error = ref('');
const changed = computed(
  () => draft.name !== props.profile.name || draft.avatar !== props.profile.avatar,
);
async function choose(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = '';
  if (!file || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    draft.avatar = await avatarImage(file);
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}
async function submit(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    draft.name = draft.name.trim();
    await props.save({ name: draft.name, avatar: draft.avatar });
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <details class="panel settings-panel settings-disclosure">
    <summary class="section-heading">
      <div>
        <h2>Локальный профиль</h2>
        <p class="muted">Твоё имя и картинка в этом пространстве. Аккаунт не нужен.</p>
      </div>
    </summary>
    <form class="profile-form" @submit.prevent="submit">
      <ProfileAvatar class="avatar profile-preview" :profile="draft" />
      <label
        >Имя<input v-model="draft.name" required maxlength="60" autocomplete="nickname" :disabled="busy"
      /></label>
      <div class="profile-actions">
        <label class="button secondary file-button"
          >Выбрать картинку<input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            :disabled="busy"
            @change="choose" /></label
        ><button
          type="button"
          class="button secondary"
          :disabled="busy || !draft.avatar"
          @click="draft.avatar = ''"
        >
          Убрать картинку
        </button>
      </div>
      <p class="subtle-note">
        JPG, PNG или WebP до 5 МБ. Картинка обрезается по центру и уменьшается до 256 × 256. Профиль
        хранится на этом сервере и входит в резервную копию.
      </p>
      <p v-if="error" class="alert error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy || !changed || !draft.name.trim()">
        {{ busy ? 'Обработка…' : 'Сохранить профиль' }}
      </button>
    </form>
  </details>
</template>
<style scoped>
.profile-form {
  display: grid;
  gap: 16px;
  justify-items: start;
  padding: 0 22px;
  grid-template-columns: minmax(0, 1fr);
}
.profile-preview {
  width: 80px;
  height: 80px;
  font-size: 24px;
}
label:not(.file-button) {
  display: grid;
  gap: 8px;
  color: var(--muted);
  width: 100%;
  max-width: 400px;
}
input:not([type='file']) {
  min-width: 0;
  width: 100%;
}
.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
