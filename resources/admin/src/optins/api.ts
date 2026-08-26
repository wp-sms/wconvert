import apiFetch from '@wordpress/api-fetch';

/** What `GET /wconvert/v1/optins` returns: the list projection, no config blobs. */
export interface OptinSummary {
  id: string;
  name: string;
  goal: string;
  published_at: string | null;
  deleted_at: string | null;
  /**
   * Why this Optin is [[Suspended]], already written as a sentence — or null
   * where it is running.
   *
   * The words come from PHP rather than being keyed off a code here, because
   * `wp i18n make-pot` can only see them there and there is no registry for
   * this bundle to fetch and map against. Present on every row, including as
   * null: a key that appeared only on the bad rows is a key this file would
   * test for existence, and "absent" and "not suspended" would be one thing
   * until the day a request half-failed.
   */
  suspended: string | null;
}

/**
 * The four states a row can be in, in the order they OVERRIDE one another.
 *
 * `suspended` sits between deleted and published because it is not a state the
 * merchant chose — which is exactly what separates it from a draft or a
 * deleted Optin, and the reason it is always shown with its cause (CONTEXT.md,
 * Suspended). A suspended Optin is still PUBLISHED underneath, so the row
 * keeps its Unpublish button: the merchant did not unpublish it and must not
 * have to publish it again to undo something they never did.
 */
export type OptinStatus = 'published' | 'suspended' | 'draft' | 'deleted';

export function statusOf(optin: OptinSummary): OptinStatus {
  if (optin.deleted_at !== null) {
    return 'deleted';
  }

  if (optin.published_at === null) {
    return 'draft';
  }

  return optin.suspended !== null ? 'suspended' : 'published';
}

/** Is this Optin live on the site — including one the site is holding back? */
export const isPublished = (status: OptinStatus): boolean => status === 'published' || status === 'suspended';

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
