import type { Category } from '../../../shared/api/contracts.ts';
import type { TrackerStatus, TrackingSettings } from '../../../shared/api/trackingContracts.ts';
export function workingApplication(
  status: TrackerStatus | null | undefined,
  settings: TrackingSettings | undefined,
  categories: Category[],
  now: number,
) {
  const app = status?.foreground,
    rule = status?.foreground_rule;
  if (!app || !rule || !eligibleApp(app, now)) return null;
  const mapping = settings?.mappings.find((item) => item.activity === rule.activity);
  return categories.find((category) => category.id === mapping?.category_id)?.is_work
    ? { app, rule }
    : null;
}

function eligibleApp(app: NonNullable<TrackerStatus['foreground']>, now: number): boolean {
  return (
    app.resource_kind === 'app' &&
    app.resource_id !== 'codex:desktop' &&
    now >= app.timestamp &&
    now - app.timestamp < 15000
  );
}
