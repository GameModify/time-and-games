<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { Star, X } from 'lucide-vue-next';
import { ratingTone } from '../lib/rating.ts';
const value = defineModel<number | null>({ required: true });
const props = withDefaults(defineProps<{ label?: string }>(), { label: 'Твоя оценка' });
const id = useId();
const preview = ref<number | null>(null);
const shown = computed(() => preview.value ?? value.value ?? 0);
function ratingLabel(rating: number) {
  return `${rating.toLocaleString('ru-RU')} из 10`;
}
</script>
<template>
  <div class="rating-control" :data-tone="ratingTone(shown || null)">
    <span class="field-label">{{ props.label }}</span>
    <div class="rating-line">
      <div class="rating-stars" role="radiogroup" :aria-label="props.label" @mouseleave="preview = null">
        <span v-for="star in 10" :key="star" class="rating-star">
          <Star class="rating-outline" :size="25" />
          <span
            class="rating-fill"
            :style="{ width: `${Math.max(0, Math.min(1, shown - star + 1)) * 100}%` }"
            ><Star :size="25" fill="currentColor"
          /></span>
          <label
            v-for="half in 2"
            :key="half"
            :class="['rating-choice', half === 1 ? 'rating-left' : 'rating-right']"
            @mouseenter="preview = star - 1 + half / 2"
          >
            <input
              v-model="value"
              type="radio"
              :name="id"
              :value="star - 1 + half / 2"
              :aria-label="ratingLabel(star - 1 + half / 2)"
            />
          </label>
        </span>
      </div>
      <output class="rating-value" :data-tone="ratingTone(value)">{{
        value === null ? 'Без оценки' : ratingLabel(value)
      }}</output>
      <button
        v-if="value !== null"
        type="button"
        class="icon-button"
        aria-label="Убрать оценку"
        @click="
          value = null;
          preview = null;
        "
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>
<style scoped>
.rating-control {
  --rating-color: var(--rating-neutral);
  display: grid;
  gap: 10px;
}
.rating-control[data-tone='gold'] {
  --rating-color: var(--rating);
}
.rating-control[data-tone='red'] {
  --rating-color: var(--rating-low);
}
.field-label {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
}
.rating-line {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rating-stars {
  display: flex;
  gap: 3px;
}
.rating-star {
  position: relative;
  display: block;
  width: 25px;
  height: 25px;
  flex: none;
}
.rating-outline {
  color: var(--subtle);
}
.rating-fill {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: var(--rating-color);
  pointer-events: none;
}
.rating-fill svg {
  max-width: none;
  width: 25px;
  height: 25px;
}
.rating-choice {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  cursor: pointer;
  border-radius: 3px;
}
.rating-left {
  left: 0;
}
.rating-right {
  right: 0;
}
.rating-choice input {
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  min-height: 0;
  min-width: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}
.rating-choice:has(input:focus-visible) {
  outline: 2px solid var(--purple);
  outline-offset: 3px;
}
.rating-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--rating-neutral);
}
.rating-value[data-tone='gold'] {
  color: var(--rating);
}
.rating-value[data-tone='red'] {
  color: var(--rating-low);
}
</style>
