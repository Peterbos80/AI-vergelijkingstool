/**
 * The agent registry: every scheduled agent, in one list. The runner, CLI,
 * worker, cron endpoint and Admin → Operations all read from here.
 */
import { brokenLinkAgent } from './defs/broken-link';
import { changeDetectionAgent } from './defs/change-detection';
import { escalationAgent } from './defs/escalation';
import { fxAgent } from './defs/fx';
import { healthAgent } from './defs/health';
import { pricingAgent } from './defs/pricing';
import { qualityAgent } from './defs/quality';
import type { AgentDefinition, AgentName } from './types';

export const AGENTS: AgentDefinition[] = [
  healthAgent,
  escalationAgent,
  qualityAgent,
  fxAgent,
  pricingAgent,
  brokenLinkAgent,
  changeDetectionAgent,
];

export function getAgent(name: AgentName): AgentDefinition {
  const def = AGENTS.find((a) => a.name === name);
  if (!def) throw new Error(`Unknown agent: ${name}`);
  return def;
}

export function isAgentName(name: string): name is AgentName {
  return AGENTS.some((a) => a.name === name);
}
