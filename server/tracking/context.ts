import type { TrackerInterval } from '../../src/shared/api/trackingContracts.ts';
import type { SessionContext } from '../../src/shared/api/contracts.ts';
export function trackingContext(item: TrackerInterval): SessionContext {
  return {
    website: item.website,
    project: item.project,
    app: item.app,
    media_creator: item.media_creator,
    media_id: item.media_id,
  };
}
