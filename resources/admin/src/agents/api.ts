import apiFetch from '@wordpress/api-fetch';

/** "Let AI agents publish" (ADR 0154 §7). Off until a site administrator turns it on. */
export interface AgentPublishing {
  enabled: boolean;
}

export const readAgentPublishing = () => apiFetch<AgentPublishing>({
  path: '/wconvert/v1/agents/publishing',
});

export const saveAgentPublishing = (enabled: boolean) => apiFetch<AgentPublishing>({
  path: '/wconvert/v1/agents/publishing',
  method: 'POST',
  data: { enabled },
});
