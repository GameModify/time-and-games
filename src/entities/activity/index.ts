export { summarize, timelineLayout, activityBuckets, timelineRect } from './lib/statistics.ts';
export { activityIcons } from './ui/icons.ts';

export { activityGroups } from './lib/groups.ts';

export {
  activityTracks,
  activityTracksInRange,
  trackRange,
  trackTicks,
  trackPercent,
  trackGeometry,
} from './lib/tracks.ts';
export type { ActivityTrack, TrackSegment, TrackRange } from './lib/tracks.ts';

export { websiteUsage } from './lib/websites.ts';

export {
  categoryLanes,
  activityBands,
  timelineItems,
  currentActivities,
  tracksInRange,
} from './lib/overview.ts';
export type { CategoryLane } from './lib/overview.ts';
export {
  recentTrackRange,
  recentHourOptions,
  selectedTrackRange,
  focusedTrackRange,
  zoomTrackRange,
  shiftedTrackRange,
  overviewTicks,
} from './lib/track-window.ts';

export type { RecentTrackHours } from './lib/track-window.ts';
