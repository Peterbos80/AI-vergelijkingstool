/**
 * Print the revenue scenarios from docs/strategy/09 §6 (same code as the
 * owner dashboard). Projections with explicit assumptions — not facts.
 */
import { affiliatePerVisitor, firstMonthReaching, project, SCENARIOS } from '../src/lib/revenue/scenarios';

const GOAL = 500;
const rows = [3, 6, 9, 12, 18];
for (const [name, params] of Object.entries(SCENARIOS)) {
  const proj = project(params);
  const epv = affiliatePerVisitor(params);
  console.log(`\n${name}: affiliate €/visitor ${epv.toFixed(4)} → visitors for €${GOAL} (affiliate only) ≈ ${Math.round(GOAL / epv)}`);
  for (const m of rows) {
    const x = proj[m - 1]!;
    console.log(
      `  month ${String(m).padStart(2)}: V=${Math.round(x.visitors).toString().padStart(6)}  total ≈ €${Math.round(x.total)}` +
        `  (aff ${x.affiliate.toFixed(0)}, news ${x.newsletter.toFixed(0)}, leads ${x.leads.toFixed(0)}, sponsor ${x.sponsoring.toFixed(0)}, subs ${Math.round(x.subscribers)})`,
    );
  }
  const first = firstMonthReaching(params, GOAL);
  console.log(`  first month ≥ €${GOAL}: ${first ?? 'not within 18 months'}`);
}
