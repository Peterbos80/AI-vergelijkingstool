/**
 * Revenue scenario model (docs/strategy/09 §6). These are projections with
 * explicit assumptions, not facts; the owner dashboard shows them next to
 * measured values and replaces each assumption once real data exists.
 *
 *   affiliate  = V × o × a × c × r
 *   newsletter = (S / 1000) × CPM × 4 × fill      (only when S ≥ 1000; S churns 2%/month)
 *   leads      = V × leadRate × qualification × valuePerLead
 *   sponsoring = slots × slotPrice                  (only when V ≥ 10 000)
 */
export interface ScenarioParams {
  o: number;
  a: number;
  c: number;
  r: number;
  signupRate: number;
  cpm: number;
  fill: number;
  leadRate: number;
  leadQualification: number;
  leadValue: number;
  sponsorSlots: number;
  sponsorPrice: number;
  /** Visitors per month at anchor months; linearly interpolated from month 0 = 0. */
  traffic: Record<number, number>;
}

export const NEWSLETTER_MIN_SUBSCRIBERS = 1000;
export const SPONSOR_MIN_VISITORS = 10_000;
export const MONTHLY_CHURN = 0.02;
export const SENDS_PER_MONTH = 4;

export const SCENARIOS: Record<'conservative' | 'base' | 'optimistic', ScenarioParams> = {
  conservative: {
    o: 0.2, a: 0.25, c: 0.01, r: 15,
    signupRate: 0.003, cpm: 25, fill: 0.25,
    leadRate: 0.0002, leadQualification: 0.3, leadValue: 50,
    sponsorSlots: 0, sponsorPrice: 0,
    traffic: { 3: 800, 6: 2000, 9: 3500, 12: 5000, 18: 9000 },
  },
  base: {
    o: 0.3, a: 0.35, c: 0.015, r: 22,
    signupRate: 0.01, cpm: 35, fill: 0.5,
    leadRate: 0.0005, leadQualification: 0.4, leadValue: 75,
    sponsorSlots: 1, sponsorPrice: 150,
    traffic: { 3: 1500, 6: 4000, 9: 8000, 12: 12000, 18: 20000 },
  },
  optimistic: {
    o: 0.4, a: 0.45, c: 0.025, r: 35,
    signupRate: 0.015, cpm: 50, fill: 0.75,
    leadRate: 0.0008, leadQualification: 0.5, leadValue: 100,
    sponsorSlots: 2, sponsorPrice: 250,
    traffic: { 3: 3000, 6: 9000, 9: 18000, 12: 30000, 18: 45000 },
  },
};

export function trafficAt(month: number, anchors: Record<number, number>): number {
  const points = [[0, 0], ...Object.entries(anchors).map(([m, v]) => [Number(m), v])].sort((x, y) => x[0]! - y[0]!) as [
    number,
    number,
  ][];
  for (let i = 1; i < points.length; i++) {
    const [m0, v0] = points[i - 1]!;
    const [m1, v1] = points[i]!;
    if (month <= m1) return v0 + ((v1 - v0) * (month - m0)) / (m1 - m0);
  }
  return points[points.length - 1]![1];
}

export interface MonthProjection {
  month: number;
  visitors: number;
  subscribers: number;
  affiliate: number;
  newsletter: number;
  leads: number;
  sponsoring: number;
  total: number;
}

export function project(p: ScenarioParams, months = 18): MonthProjection[] {
  const out: MonthProjection[] = [];
  let subscribers = 0;
  for (let m = 1; m <= months; m++) {
    const v = trafficAt(m, p.traffic);
    subscribers = subscribers * (1 - MONTHLY_CHURN) + v * p.signupRate;
    const affiliate = v * p.o * p.a * p.c * p.r;
    const newsletter =
      subscribers >= NEWSLETTER_MIN_SUBSCRIBERS ? (subscribers / 1000) * p.cpm * SENDS_PER_MONTH * p.fill : 0;
    const leads = v * p.leadRate * p.leadQualification * p.leadValue;
    const sponsoring = v >= SPONSOR_MIN_VISITORS ? p.sponsorSlots * p.sponsorPrice : 0;
    out.push({
      month: m,
      visitors: v,
      subscribers,
      affiliate,
      newsletter,
      leads,
      sponsoring,
      total: affiliate + newsletter + leads + sponsoring,
    });
  }
  return out;
}

export function firstMonthReaching(p: ScenarioParams, goal: number, months = 18): number | null {
  return project(p, months).find((x) => x.total >= goal)?.month ?? null;
}

/** Affiliate revenue per visitor and visitors needed for a goal (affiliate only). */
export function affiliatePerVisitor(p: ScenarioParams): number {
  return p.o * p.a * p.c * p.r;
}
