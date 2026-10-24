import { trackerRuleSchema } from '../../../shared/api/trackingContracts.ts';
import type { TrackerRule } from '../../../shared/api/trackingContracts.ts';
export interface WorkRuleDraft {
  source: 'app' | 'host' | 'media_creator' | 'media_id' | 'title';
  value: string;
  name: string;
  activity: string;
  project: string;
}
function target(draft: WorkRuleDraft): string {
  const value = draft.value.trim(),
    url = URL.parse(value);
  if (draft.source === 'host') return (url ?? URL.parse('https://' + value))?.hostname ?? value;
  if (draft.source === 'media_id') return url?.searchParams.get('v') ?? value;
  if (draft.source === 'media_creator')
    return url?.pathname ?? (value.startsWith('@') ? '/' + value : value);
  return value;
}
export function workRule(draft: WorkRuleDraft, rules: TrackerRule[]): TrackerRule {
  const value = target(draft),
    scope = draft.source === 'app' || draft.source === 'host' ? 'focus' : 'media';
  const existing = rules.find(
    (rule) => rule.field === draft.source && rule.value === value && rule.scope === scope,
  );
  return trackerRuleSchema.parse({
    id: existing?.id ?? crypto.randomUUID(),
    name: draft.name.trim() || value,
    enabled: true,
    field: draft.source,
    operator: draft.source === 'title' ? 'contains' : 'equals',
    value,
    activity: draft.activity,
    project: draft.project.trim() || undefined,
    scope,
    priority: 200,
  });
}
