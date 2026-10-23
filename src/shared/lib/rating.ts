export function ratingTone(value: number | null) {
  if (value === null) return 'neutral';
  if (value >= 7.5) return 'gold';
  return value < 4 ? 'red' : 'neutral';
}
