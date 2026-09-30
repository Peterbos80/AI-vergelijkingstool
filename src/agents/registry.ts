/**
 * The agent registry: every scheduled agent, in one list. The runner, CLI,
 * worker, cron endpoint and Admin → Operations all read from here.
 * Order matters only for ties in "due" time: safety agents first.
 */
import { auditAgent } from './defs/audit';
import { brokenLinkAgent } from './defs/broken-link';
import { changeDetectionAgent } from './defs/change-detection';
import { contentAgent } from './defs/content';
import { discoveryAgent } from './defs/discovery';
import { duplicateAgent } from './defs/duplicate';
import { escalationAgent } from './defs/escalation';
import { fxAgent } from './defs/fx';
import { healthAgent } from './defs/health';
import { monetizationAgent } from './defs/monetization';
import { newsAgent } from './defs/news';
import { notifierAgent } from './defs/notifier';
import { opportunityAgent } from './defs/opportunity';
import { pricingAgent } from './defs/pricing';
import { qualityAgent } from './defs/quality';
import { recommendationAgent } from './defs/recommendation';
import { reporterAgent } from './defs/reporter';
import { socialAgent } from './defs/social';
import { verificationAgent } from './defs/verification';
import { videoAgent } from './defs/video';
import type { AgentDefinition, AgentName } from './types';

export const AGENTS: AgentDefinition[] = [
  healthAgent,
  escalationAgent,
  qualityAgent,
  notifierAgent,
  fxAgent,
  pricingAgent,
  brokenLinkAgent,
  changeDetectionAgent,
  newsAgent,
  socialAgent,
  videoAgent,
  discoveryAgent,
  verificationAgent,
  duplicateAgent,
  monetizationAgent,
  recommendationAgent,
  opportunityAgent,
  contentAgent,
  reporterAgent,
  auditAgent,
];

export function getAgent(name: AgentName): AgentDefinition {
  const def = AGENTS.find((a) => a.name === name);
  if (!def) throw new Error(`Unknown agent: ${name}`);
  return def;
}

export function isAgentName(name: string): name is AgentName {
  return AGENTS.some((a) => a.name === name);
}
