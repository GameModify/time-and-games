<script setup lang="ts">
const value = defineModel<boolean>({ required: true });
defineProps<{ label: string }>();
</script>
<template>
  <label class="checkbox-field">
    <input v-model="value" type="checkbox" />
    <span>{{ label }}</span>
  </label>
</template>
<style scoped>
.checkbox-field {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  cursor: pointer;
}
.checkbox-field > input {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  min-height: 0;
  margin: 2px 0 0;
  padding: 0;
  accent-color: var(--purple);
}
.checkbox-field > span {
  min-width: 0;
}
</style>
