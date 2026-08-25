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

// `includeDeleted` because a Lead outlives the Optin that captured it: the
// lead log labels rows with the Optin's name, and a soft-deleted Optin still
// has one — which is what the soft delete is for.
export const listOptins = (includeDeleted = false) =>
  apiFetch<OptinSummary[]>({ path: path(includeDeleted ? '?include_deleted=1' : '') });

// The created Optin comes back rather than being discarded: creation lands
// the merchant in the builder, and the builder is addressed by id.
export const createOptin = (name: string, goal: string, config: Record<string, unknown>) =>
  apiFetch<{ id: string }>({ path: path(), method: 'POST', data: { name, goal, config } });

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
