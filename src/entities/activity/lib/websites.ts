import type { Category, Session } from '../../../shared/api/contracts.ts';
import { unionDuration } from '../../../shared/lib/date.ts';
export interface WebsitePeriod {
  from: number;
  to: number;
}
export interface WebsiteUsage {
  host: string;
  elapsed: number;
  sessions: Session[];
}
export interface WebsiteSummary {
  elapsed: number;
  sites: WebsiteUsage[];
}
export function websiteUsage(
  sessions: Session[],
  categories: Category[],
  now: number,
  period?: WebsitePeriod,
): WebsiteSummary {
  const neutral = sessions.filter((session) => neutralWebsite(session, categories));
  const hosts = new Set(neutral.map((session) => session.tracking_context?.website ?? ''));
  const sites = [...hosts]
    .map((host) => siteUsage(host, neutral, now, period))
    .sort((a, b) => b.elapsed - a.elapsed);
  return {
    elapsed: websiteDuration(neutral, now, period),
    sites,
  };
}

function neutralWebsite(session: Session, categories: Category[]): boolean {
  const context = session.tracking_context;
  return Boolean(
    context?.website &&
    !context.project &&
    !categories.find((category) => category.id === session.category_id)?.is_work,
  );
}

function websiteDuration(sessions: Session[], now: number, period?: WebsitePeriod): number {
  return unionDuration(
    sessions.map((session) => [
      Math.max(session.start_at, period?.from ?? session.start_at),
      Math.min(session.end_at ?? now, period?.to ?? session.end_at ?? now),
    ]),
  );
}

function siteUsage(
  host: string,
  sessions: Session[],
  now: number,
  period?: WebsitePeriod,
): WebsiteUsage {
  const rows = sessions.filter((session) => session.tracking_context?.website === host);
  return { host, elapsed: websiteDuration(rows, now, period), sessions: rows };
}
