import apiFetch from '@wordpress/api-fetch';

/** What `GET /wconvert/v1/optins` returns: the list projection, no config blobs. */
export interface OptinSummary {
  id: string;
  name: string;
  goal: string;
  published_at: string | null;
  deleted_at: string | null;
}

export type OptinStatus = 'published' | 'draft' | 'deleted';

export function statusOf(optin: OptinSummary): OptinStatus {
  if (optin.deleted_at !== null) {
    return 'deleted';
  }

  return optin.published_at !== null ? 'published' : 'draft';
}

const path = (suffix = '') => `/wconvert/v1/optins${suffix}`;

export const listOptins = () => apiFetch<OptinSummary[]>({ path: path() });

export const createOptin = (name: string, goal: string, config: Record<string, unknown>) =>
  apiFetch<unknown>({ path: path(), method: 'POST', data: { name, goal, config } });

// Publishing is its own route rather than a field on a PATCH: it promotes one
// column onto another and rebuilds the published set, which a `status` field
// would hide.
export const publishOptin = (id: string) =>
  apiFetch<unknown>({ path: path(`/${id}/publish`), method: 'POST' });

export const unpublishOptin = (id: string) =>
  apiFetch<unknown>({ path: path(`/${id}/unpublish`), method: 'POST' });

// A soft delete. The Optin keeps its row, because analytics interprets its
// conversion counts by joining it at read.
export const deleteOptin = (id: string) => apiFetch<unknown>({ path: path(`/${id}`), method: 'DELETE' });
