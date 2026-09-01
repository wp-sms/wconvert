import apiFetch from '@wordpress/api-fetch';

/**
 * The three facts an Optin's state is read from, **wherever the row came
 * from.**
 *
 * The list projection carries them and so does the whole Optin the builder
 * reads, and both screens have to reach the same answer about one campaign:
 * the list's *Suspended* badge and the editor's readiness panel disagreeing
 * would be worse than either being absent. {@see statusOf} takes this rather
 * than the summary so there is one implementation and no second reading.
 */
export interface OptinState {
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

/** What `GET /wconvert/v1/optins` returns: the list projection, no config blobs. */
export interface OptinSummary extends OptinState {
  id: string;
  name: string;
  goal: string;
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

export function statusOf(optin: OptinState): OptinStatus {
  if (optin.deleted_at !== null) {
    return 'deleted';
  }

  if (optin.published_at === null) {
    return 'draft';
  }

  return optin.suspended !== null ? 'suspended' : 'published';
}

/**
 * May this row be unpublished?
 *
 * Named for the question the button asks rather than for "is it live", which a
 * [[Suspended]] Optin is NOT — it is on no page and emits nothing. What it is
 * is *published*: the site is holding it back and the merchant did not, so
 * offering them Publish would read as "this never went live" and ask them to
 * undo something they never did.
 */
export const canUnpublish = (status: OptinStatus): boolean => status === 'published' || status === 'suspended';

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
