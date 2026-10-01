import { isImportedSessionAgent } from "@getpaseo/protocol/agent-labels";
import type { Agent } from "@/stores/session-store";

export type CloseAgentTabPolicy = { kind: "archive-on-close" } | { kind: "layout-only" };

export function resolveCloseAgentTabPolicy(
  agent: Pick<Agent, "parentAgentId" | "labels"> | null | undefined,
): CloseAgentTabPolicy {
  if (!agent) {
    return { kind: "archive-on-close" };
  }

  if (agent.parentAgentId) {
    return { kind: "layout-only" };
  }

  // An imported provider session stays reachable from the Sessions list, so
  // closing its tab only closes the tab. Archiving it would force a re-import.
  if (isImportedSessionAgent(agent)) {
    return { kind: "layout-only" };
  }

  return { kind: "archive-on-close" };
}
