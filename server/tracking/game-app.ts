import { randomUUID } from 'node:crypto';
import type { GameApplication, TrackerRule } from '../../src/shared/api/trackingContracts.ts';
export function gameApplicationRules(rules: TrackerRule[], input: GameApplication): TrackerRule[] {
  const existing = rules.find(
    (rule) =>
      rule.field === 'app' &&
      rule.operator === 'equals' &&
      rule.value.toLowerCase() === input.app.toLowerCase(),
  );
  const game: TrackerRule = {
    id: existing?.id ?? randomUUID(),
    name: input.title,
    enabled: true,
    field: 'app',
    operator: 'equals',
    value: input.app,
    activity: 'games',
    priority: 100,
  };
  return [...rules.filter((rule) => rule.id !== game.id), game];
}
