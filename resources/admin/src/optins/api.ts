import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';

export interface CampaignPreview {
  id: string;
  template: Template | null;
  display_type: string;
}

export interface ProductHealth {
  id: string;
  basis: 'published' | 'draft';
  checks: { label: string; state: 'ok' | 'warning' | 'unknown' | 'context'; message: string }[];
}

export const readProductHealth = (ids: string[], signal?: AbortSignal) => {
  const query = new URLSearchParams();
  for (const id of ids) query.append('ids[]', id);
  return apiFetch<ProductHealth[]>({ path: `/wconvert/v1/optins/product-health?${query}`, signal });
};

/** Only visible designs are fetched; the list response remains small. */
export const readCampaignPreviews = (ids: string[]) => {
  const query = new URLSearchParams();
  for (const id of ids) query.append('ids[]', id);
  return apiFetch<CampaignPreview[]>({ path: `/wconvert/v1/optins/previews?${query}` });
};

/** Copy the saved draft through the same validated creation route as the editor. */
export async function duplicateCampaign(id: string, name: string) {
  const saved = await apiFetch<{ goal: string; config: Record<string, unknown> }>({ path: `/wconvert/v1/optins/${id}` });
  const config = { ...saved.config };
  if (config.analytics && typeof config.analytics === 'object') config.analytics = { ...config.analytics, label: '' };
  return createOptin(name, saved.goal, config);
}

/**
 * The state facts shared by the list and editor, wherever the row came from.
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
  /** Saved configuration differs from the live snapshot; false for drafts and deleted Optins. */
  has_unpublished_changes: boolean;
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
  /**
   * The [[Optin]] this one is an arm of, or null where it is a campaign in its
   * own right.
   *
   * The list itself is parentless Optins ONLY (ADR 0045), so every row at the
   * top level answers null and this is only ever set on a row inside
   * {@link OptinSummary.arms}. It travels anyway, because a row that could not
   * say what it is would have to be told by whatever rendered it.
   */
  parent_id: string | null;
  /**
   * The other arms of this row's A/B test — **empty on every Optin that is not
   * running one**, which is almost all of them.
   *
   * A [[Variant]] is a whole Optin with its own id, its own row and therefore
   * its own counters (ADR 0045), so these are ordinary summaries and the row
   * component draws them the way it draws any other. What the nesting says is
   * that they are one campaign: a merchant running three tests meets three
   * campaigns rather than six.
   *
   * The parent is arm A and is the row these hang beneath, so a test with two
   * arms has exactly one entry here.
   */
  arms: OptinSummary[];
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

/**
 * A campaign's name for a person to read: "Unnamed campaign" where it has
 * none, never its ID (ADR 0131). A function rather than a constant because
 * `__()` must not run at module scope.
 */
export const campaignName = (row: { readonly name: string }): string =>
  row.name.trim() || __('Unnamed campaign', 'wconvert');

const path = (suffix = '') => `/wconvert/v1/optins${suffix}`;

// `includeDeleted` because a Lead outlives the Optin that captured it: the
// lead log labels rows with the Optin's name, and a soft-deleted Optin still
// has one — which is what the soft delete is for.
export const listOptins = (includeDeleted = false) =>
  apiFetch<OptinSummary[]>({ path: path(includeDeleted ? '?include_deleted=1' : '') });

/**
 * Every Optin in the list, campaigns and arms alike, flat.
 *
 * ============================================================================
 * THE LIST IS PARENTLESS-ONLY, AND ONE SCREEN NEEDS THE OTHER ROWS TOO.
 * ============================================================================
 * The route answers parentless Optins with their arms nested beneath them,
 * which is the shape the Optins screen is about: a merchant running three
 * tests meets three campaigns rather than six (ADR 0045).
 *
 * The [[Lead]] log is asking a different question. It labels each Lead with the
 * Optin that captured it, and an arm captures Leads — so the nested shape would
 * leave a raw ULID in the Optin column and no filter entry, for exactly the
 * Leads whose provenance is hardest to recover. **The name is the only
 * provenance a Lead has** (ADR 0002, ADR 0020).
 *
 * A flatten rather than a second route: the arms are already on the wire, so
 * this costs no read, and one route answering both questions is one place for
 * `include_deleted` to mean what it says.
 */
export const flattened = (optins: readonly OptinSummary[]): OptinSummary[] =>
  optins.flatMap((optin) => [optin, ...optin.arms]);

// The created Optin comes back rather than being discarded: creation lands
// the merchant in the builder, and the builder is addressed by id.
export const createOptin = (name: string, goal: string, config: Record<string, unknown>) =>
  apiFetch<{ id: string }>({ path: path(), method: 'POST', data: { name, goal, config } });

// Publishing is its own route rather than a field on a PATCH: it promotes one
// column onto another and rebuilds the published set, which a `status` field
// would hide.
export const publishOptin = (id: string) =>
  apiFetch<OptinState>({ path: path(`/${id}/publish`), method: 'POST' });

export const unpublishOptin = (id: string) =>
  apiFetch<unknown>({ path: path(`/${id}/unpublish`), method: 'POST' });

// A soft delete. The Optin keeps its row, because analytics interprets its
// conversion counts by joining it at read.
export const deleteOptin = (id: string) => apiFetch<unknown>({ path: path(`/${id}`), method: 'DELETE' });

/**
 * Start an A/B test: a second Optin that is a copy of this one.
 *
 * ============================================================================
 * NO NAME GOES OUT, AND THAT IS THE FEATURE RATHER THAN AN OMISSION.
 * ============================================================================
 * A [[Variant]] is never asked for a name — it takes its parent's with a letter
 * after it, because nobody should be asked to name a thing they think of as
 * *the other one* (ADR 0045). There is no dialog in front of this call for the
 * same reason: there is nothing to ask.
 *
 * **The route only exists on an install that bought it.** It is registered by
 * the `ab-testing` module's own PHP, so a build without the module answers 404
 * rather than refusing — enforcement by non-registration (ADR 0015). This
 * screen marks the action before the click so the merchant never meets that
 * 404; it does not test for it.
 *
 * The variant comes back whole, because creating one lands the merchant in the
 * builder looking at it.
 */
export const createVariant = (id: string) =>
  apiFetch<{ id: string }>({ path: path(`/${id}/variants`), method: 'POST' });

/**
 * End it: this arm becomes the campaign and every other arm is tidied away.
 *
 * **Nothing is deleted.** The losing arm is a month of the merchant's own
 * history and a removed row makes every count naming it uninterpretable
 * (ADR 0020) — so it is soft-deleted, which drops it out of this list and
 * keeps its counts in its [[Goal]]'s total, with no special case anywhere.
 *
 * @param id The test — the parentless Optin the arms hang beneath.
 * @param winner The arm that won. The parent itself is a legitimate answer.
 */
export const declareWinner = (id: string, winner: string) =>
  apiFetch<unknown>({ path: path(`/${id}/winner`), method: 'POST', data: { winner } });

/**
 * The allowance the whole site shares — how often this device may be shown
 * **anything at all** (ADR 0047).
 *
 * ============================================================================
 * ALL FOUR FIELDS, SPELLED OUT, WHICH IS NOT THE PAYLOAD'S SHAPE.
 * ============================================================================
 * The engine reads an absent switch as ON, so the copy the browser gets omits
 * a `true`. This scope's defaults are the opposite — all four off until a
 * merchant asks — and a checkbox cannot be drawn from a key that is not there.
 * So the route answers with every field, and this screen never has to work out
 * which scope's silence it is reading.
 */
export interface SiteAllowance {
  maxImpressions: number | null;
  cooldownDays: number | null;
  stopAfterDismiss: boolean;
  stopAfterConversion: boolean;
}

export const readSiteAllowance = () => apiFetch<SiteAllowance>({ path: path('/frequency') });

export const saveSiteAllowance = (allowance: SiteAllowance) =>
  apiFetch<SiteAllowance>({ path: path('/frequency'), method: 'POST', data: allowance });
