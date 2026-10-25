<script setup lang="ts">
import { computed } from 'vue';
import type { LocalProfile } from '../api/profileContracts.ts';
const props = defineProps<{ profile: LocalProfile }>();
const initials = computed(() =>
  props.profile.name === 'Твоё пространство'
    ? 'ТЫ'
    : props.profile.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => Array.from(part)[0] ?? '')
        .join('')
        .toLocaleUpperCase('ru'),
);
</script>
<template>
  <span class="profile-avatar"
    ><img v-if="profile.avatar" :src="profile.avatar" :alt="profile.name" /><span v-else>{{
      initials
    }}</span></span
  >
</template>
<style scoped>
.profile-avatar {
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
