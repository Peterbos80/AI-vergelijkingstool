/**
 * Tool scout configuration (docs/strategy/12 §4.4, docs/DATA_SOURCES.md):
 * the makers' feeds and blocked domains from data/discovery/sources.json, and
 * the hard thresholds of the quarantine gates. The thresholds are code, not
 * settings: they are never lowered to reach a number of new tools.
 */
import { z } from 'zod';
import json from '../../../../data/discovery/sources.json';

const feedSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  maker: z.string().min(1).max(60),
  url: z.string().url().startsWith('https://'),
  homepage: z.string().url().startsWith('https://'),
});

const configSchema = z.object({
  officialFeeds: z.array(feedSchema).max(40),
  blockedDomains: z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/)).max(2000),
});

export type OfficialFeed = z.infer<typeof feedSchema>;

export const SCOUT_CONFIG = configSchema.parse(json);

/** Popularity: a signal counts at or above these values (≥ 2 independent signals needed). */
export const POPULARITY = {
  /** Hacker News points of a Show HN, Launch HN or launch story. */
  hnPoints: 50,
  /** Stars of an organisation's GitHub repository created in the last 30 days. */
  githubStars: 300,
  /** Product Hunt votes (only read with PRODUCTHUNT_TOKEN). */
  phVotes: 200,
} as const;

/** Discovery keeps tracking candidates from these lower values, so growing signals are seen. */
export const COLLECT = {
  showHnPoints: 20,
  storyPoints: 50,
  githubStars: 100,
  githubMaxAgeDays: 30,
  phVotes: 50,
} as const;

export const SCOUT_LIMITS = {
  /** New tools published per day (the best ones; fewer when fewer pass the gates). */
  perDay: 5,
  /** More publications than this in 24 hours is impossible by design: freeze and escalate. */
  anomalyPerDay: 10,
  /** More candidates passing every gate on one day than this looks like a parser fault: freeze. */
  anomalyPassing: 30,
  quarantineDays: 7,
  /** Launch posts from makers' feeds whose product link is looked up per run. */
  launchPostsPerRun: 6,
  /** Product Hunt posts whose website link is resolved per run. */
  productHuntPerRun: 10,
} as const;
