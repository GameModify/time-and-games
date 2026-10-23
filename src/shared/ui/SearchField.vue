<script setup lang="ts">
import { Search } from 'lucide-vue-next';
const value = defineModel<string>({ required: true });
defineProps<{ label: string; placeholder?: string }>();
const emit = defineEmits<{ search: [] }>();
</script>
<template>
  <label class="search-field">
    <Search :size="17" aria-hidden="true" />
    <input
      v-model="value"
      type="search"
      :aria-label="label"
      :placeholder="placeholder"
      @keydown.enter.prevent="emit('search')"
    />
  </label>
</template>
<style scoped>
.search-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--input);
  color: var(--muted);
  cursor: text;
}
.search-field > svg {
  flex: none;
}
.search-field > input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 9px 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  box-shadow: none;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
}
.search-field:focus-within {
  border-color: var(--purple);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--purple) 18%, transparent);
}
</style>
