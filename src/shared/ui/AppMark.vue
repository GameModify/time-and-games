<script setup lang="ts">
defineProps({ size: { type: Number, default: 30 } });
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path
      d="M10 18c1-5 4-7 8-5l4 2h4l4-2c4-2 7 0 8 5l4 15c1 5-4 8-7 4l-5-6H18l-5 6c-3 4-8 1-7-4z"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linejoin="round"
    />
    <path d="M13 23h8m-4-4v8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    <circle
      cx="31"
      cy="22"
      r="7"
      fill="var(--accent-surface,#292238)"
      stroke="currentColor"
      stroke-width="2"
    />
    <path d="M31 18v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <path d="m6 8 1-3 1 3 3 1-3 1-1 3-1-3-3-1z" fill="currentColor" />
  </svg>
</template>
