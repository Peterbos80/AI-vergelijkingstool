import { describe, expect, it } from 'vitest';
import { firstMonthReaching, project, SCENARIOS, trafficAt } from '@/lib/revenue/scenarios';

// Values published in docs/strategy/09 §6 — the doc and the code must agree.
const TABLE = {
  conservative: { 3: 8, 6: 21, 9: 37, 12: 53, 18: 95 },
  base: { 3: 74, 6: 199, 9: 397, 12: 746, 18: 1248 },
  optimistic: { 3: 593, 6: 1778, 9: 4210, 12: 6743, 18: 10169 },
} as const;

describe('revenue scenarios', () => {
  it('interpolates traffic between anchors', () => {
    expect(trafficAt(3, SCENARIOS.base.traffic)).toBe(1500);
    expect(trafficAt(4.5, SCENARIOS.base.traffic)).toBe(2750);
    expect(trafficAt(1, SCENARIOS.base.traffic)).toBe(500);
  });
  for (const [name, rows] of Object.entries(TABLE)) {
    it(`matches the documented ${name} table`, () => {
      const proj = project(SCENARIOS[name as keyof typeof SCENARIOS]);
      for (const [month, value] of Object.entries(rows)) {
        expect(Math.round(proj[Number(month) - 1]!.total)).toBe(value);
      }
    });
  }
  it('reaches €500 in the documented month', () => {
    expect(firstMonthReaching(SCENARIOS.conservative, 500)).toBeNull();
    expect(firstMonthReaching(SCENARIOS.base, 500)).toBe(11);
    expect(firstMonthReaching(SCENARIOS.optimistic, 500)).toBe(3);
  });
});
