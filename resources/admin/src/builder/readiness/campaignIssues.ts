import { __, sprintf } from '@wordpress/i18n';
import { capturedFields } from '../../destinations/requirements';
import { problemsIn } from '../structure/problems';
import { captureReadiness } from '../structure/captureReadiness';
import { journeyIssues } from '../structure/journeyIssues';
import { capturesTaken, nodeAt, nodesOf } from '../structure/tree';
import { convertingActOf } from '../structure/guards';
import { submissionScreen } from '../structure/journey';
import { summarise } from '../rules/summaries';
import { inlinePlacementLabel } from '../../inlinePlacement';
import { destinationsSaid } from '../destinations';
import { asksForPolicy } from '../policy';
import { outcomeDesignIssue, outcomeHandoffIssue, type OutcomeContract } from '../../goals/outcome';
import type { CaptureMode } from '../captureMode';
import type { JourneyRepair } from '../structure/journeyReadiness';
import type { Path } from '../panel';
import type { RuleVocabulary } from '../api';
import type { DisplayRulesValue } from '../rules/summaries';
import type { Destination } from '../../destinations/api';
import type { Template } from '@renderer/types';

/**
 * Everything to fix or check on this campaign, as ONE list.
 *
 * ============================================================================
 * TWO COUNTS THAT DISAGREED ARE WHY THIS FILE EXISTS (ADR 0133).
 * ============================================================================
 * The header said "3 to fix" while the screens' own "Issues (2)" button said
 * something else, because each assembled its own list from its own subset of
 * checks. Now the review dialog, the header count, each screen's warning and
 * each Flow-map badge read this one list, so they cannot disagree.
 *
 * **Data, not callbacks.** Each issue says where its fix is ({@link IssueGo});
 * the editor decides how to get there. That keeps this a pure function of the
 * campaign, testable without rendering anything.
 */

/** Which editor tab holds the fix, for that tab's attention dot. */
export type BlockedTab = 'edit' | 'rules' | 'destinations';

/** Where the fix is. The editor turns each into a jump. */
export type IssueGo =
  | { readonly to: 'rules'; readonly section: string }
  | { readonly to: 'placement' }
  | { readonly to: 'retry-goal' }
  /** The design, in place: the element panel or the look. */
  | { readonly to: 'edit-design' }
  /** The library of designs: only where a different design is the answer. */
  | { readonly to: 'library' }
  | { readonly to: 'destinations' }
  | { readonly to: 'journey'; readonly repair: JourneyRepair }
  | { readonly to: 'element'; readonly path: Path }
  | { readonly to: 'schedule' };

export interface CampaignIssue {
  /** Stable across renders, so a list can key on it. */
  readonly key: string;
  /** What to do, in the merchant's words. */
  readonly said: string;
  /** Whether publishing is refused until it is fixed. */
  readonly blocks: boolean;
  readonly tab: BlockedTab | null;
  readonly go: IssueGo;
  /** The screen it is about, where it is about one: per-screen warnings and map badges read this. */
  readonly screenId?: string;
  /**
   * Where the review draws it, when not in its generic list: privacy notes
   * sit under Privacy and destination notes under "Where leads go".
   */
  readonly section?: 'privacy' | 'where';
  /** The answer that sits beside it in the review: keep leads in WConvert only. */
  readonly offersKeepLocal?: boolean;
  /** The answer that sits beside it in the review: read the goal again. */
  readonly offersRetry?: boolean;
}

/** Keys the review draws in its own sections rather than its lists. */
export const ISSUE = {
  handoff: 'handoff',
  policyPage: 'privacy:page',
  policyNotice: 'privacy:notice',
  consent: 'privacy:consent',
} as const;

export interface CampaignIssueInputs {
  readonly template: Template | undefined;
  readonly rules: DisplayRulesValue;
  readonly vocabulary: RuleVocabulary;
  readonly displayType: string;
  readonly contentLock?: unknown;
  readonly inlinePlacement?: unknown;
  /**
   * Null when the goal could not be read, which is itself an issue; undefined
   * while it is still loading, which is not — or every setup opens on "1 to fix".
   */
  readonly outcome: OutcomeContract | null | undefined;
  readonly bound: readonly string[];
  readonly destinations: readonly Destination[] | null;
  readonly captureMode: CaptureMode;
  /** `config.submission_settings`: the optional signup's own routes. */
  readonly submissionSettings?: unknown;
  /** `config.unchecked_links`: link addresses a fresh setup guessed (ADR 0133). */
  readonly uncheckedLinks?: unknown;
  readonly privacyGuidance?: boolean;
  readonly policyUrl?: string;
}

/** Everything to fix, then everything to check, in the order the review reads them. */
export function campaignIssues(inputs: CampaignIssueInputs): CampaignIssue[] {
  const { template, rules, vocabulary, displayType, contentLock, inlinePlacement, outcome, bound, destinations, captureMode } = inputs;
  const overlay = displayType !== 'inline';
  const hasDesign = template !== undefined && template.tree.steps.length > 0;
  const captures = hasDesign ? capturesTaken(template.tree) : [];
  const screenOf = (path: Path | null | undefined): string | undefined =>
    hasDesign && path && typeof path[0] === 'number' ? template.tree.steps[path[0]]?.id : undefined;
  const problems = hasDesign ? [...problemsIn(template, rules.schedule.ends_at), ...captureReadiness(template, outcome?.audience_channel)] : [];
  // A product block still waiting for its products is the one thing to say: the
  // Goal's "needs a link" would be the same missing choice, said twice.
  const choosingProducts = hasDesign && problems.some(problem => problem.blocksPublish && problem.path !== null
    && nodeAt(template.tree, problem.path)?.type === 'products');
  const goalIssue = outcome && hasDesign && !choosingProducts ? outcomeDesignIssue(outcome, template) : null;
  const handoffIssue = outcome ? outcomeHandoffIssue(outcome, bound, destinations, captureMode) : null;
  const inlineTriggerIssue = !overlay && (inlinePlacement != null || contentLock != null) && rules.display_rules?.opening.mode !== 'immediate';
  const issue = (key: string, said: string, tab: BlockedTab | null, go: IssueGo, blocks: boolean, more: Partial<CampaignIssue> = {}): CampaignIssue =>
    ({ key, said, tab, go, blocks, ...more });

  const blocking: CampaignIssue[] = [
    ...summarise(rules, vocabulary).filter(summary => summary.attention && ['who', 'when', 'where'].includes(summary.id))
      .map(summary => issue(`rules:${summary.id}`, summary.text, 'rules', { to: 'rules', section: summary.id }, true)),
    ...(contentLock != null && (overlay || inlinePlacement != null || !template || convertingActOf(template.tree)[0] !== 'submit')
      ? [issue('content-lock', __('Content lock requires an inline submission form and manual placement.', 'wconvert'), 'rules', { to: 'placement' }, true)] : []),
    ...(!overlay && inlinePlacement != null && inlinePlacementLabel(inlinePlacement) === null
      ? [issue('inline-placement', __('Choose a valid inline position and a whole paragraph number from 1 to 100.', 'wconvert'), 'rules', { to: 'placement' }, true)] : []),
    ...(inlineTriggerIssue ? [issue('inline-trigger', __('This placement needs “When does it open?” set to Right away. Change it, or use manual placement.', 'wconvert'), 'rules', { to: 'rules', section: 'when' }, true)] : []),
    // A failed read is retried in place: reloading the page would cost unsaved edits.
    ...(outcome === null ? [issue('goal-unread', __('The goal’s requirements could not be checked.', 'wconvert'), null, { to: 'retry-goal' }, true, { offersRetry: true })] : []),
    ...(goalIssue ? [issue('goal', goalIssue, 'edit', template && convertingActOf(template.tree)[0] === outcome?.action ? { to: 'edit-design' } : { to: 'library' }, true)] : []),
    // The commonest first-campaign blocker gets its answer beside it, not a tab away (ADR 0132).
    ...(handoffIssue ? [issue(ISSUE.handoff, handoffIssue, 'destinations', { to: 'destinations' }, true, { offersKeepLocal: true })] : []),
    ...signupRouteIssues(inputs),
    ...(!hasDesign ? [issue('no-design', __('Choose a design before publishing.', 'wconvert'), 'edit', { to: 'library' }, true)] : []),
    ...(template ? journeyIssues(template.tree, outcome?.action) : []).map(found =>
      issue(`journey:${found.key}`, found.said, 'edit', { to: 'journey', repair: found.repair }, true, { screenId: found.repair.screenId })),
    ...problems.filter(problem => problem.check === 'converts' || problem.blocksPublish).map((problem, index) =>
      issue(`problem:${index}:${problem.said}`, problem.said, 'edit', problem.path !== null ? { to: 'element', path: problem.path } : { to: 'edit-design' }, true,
        { screenId: screenOf(problem.path) })),
    ...(hasDesign && bound.length > 0 && captures.length === 0
      ? [issue('no-fields', __('This campaign needs a form field to collect leads. Choose a design with a form.', 'wconvert'), 'edit', { to: 'library' }, true)] : []),
  ];

  const where = destinationsSaid(bound, destinations, capturedFields(template));
  const reviewsPrivacy = inputs.privacyGuidance === true && captures.length > 0;
  const expectsConsent = reviewsPrivacy && outcome?.audience_channel != null;
  const checking: CampaignIssue[] = [
    ...problems.filter(problem => problem.check !== 'converts' && !problem.blocksPublish).map((problem, index) =>
      issue(`check:${index}:${problem.said}`, problem.said, null,
        problem.go === 'schedule' ? { to: 'schedule' } : problem.path !== null ? { to: 'element', path: problem.path } : { to: 'edit-design' }, false,
        { screenId: screenOf(problem.path) })),
    ...uncheckedLinkIssues(template, inputs.uncheckedLinks).map(found =>
      issue(`unchecked:${found.id}`, found.said, null, { to: 'element', path: found.path }, false, { screenId: screenOf(found.path) })),
    // A lead magnet kept in WConvert only still publishes (ADR 0133); saying so is the point.
    ...(outcome?.destination_type != null && captureMode === 'local' && captures.length > 0
      ? [issue('no-delivery', __('Visitors won’t get the file until you set up the delivery email.', 'wconvert'), 'destinations', { to: 'destinations' }, false)] : []),
    ...where.problems.map(said => issue(`where:${said}`, said, 'destinations', { to: 'destinations' }, false, { section: 'where' })),
    ...(reviewsPrivacy && !inputs.policyUrl
      ? [issue(ISSUE.policyPage, __('WordPress has no Privacy Policy page selected, so the form cannot link to it.', 'wconvert'), null, { to: 'edit-design' }, false, { section: 'privacy' })] : []),
    ...(reviewsPrivacy && template && visiblePolicyLinkIn(template, inputs.policyUrl) === null
      ? [issue(ISSUE.policyNotice, __('No Privacy Policy notice is shown on this form.', 'wconvert'), null, { to: 'edit-design' }, false, { section: 'privacy' })] : []),
    ...(expectsConsent && template && consentIn(template, true) === null
      ? [issue(ISSUE.consent, __('No consent checkbox is shown for this mailing list.', 'wconvert'), null, { to: 'edit-design' }, false, { section: 'privacy' })] : []),
  ];

  return [...blocking, ...checking];
}

/** The issues about each screen, by screen id: what a screen's warning and a map badge count. */
export function issuesByScreen(issues: readonly CampaignIssue[]): ReadonlyMap<string, readonly CampaignIssue[]> {
  const byScreen = new Map<string, CampaignIssue[]>();
  for (const issue of issues) {
    if (issue.screenId !== undefined) byScreen.set(issue.screenId, [...(byScreen.get(issue.screenId) ?? []), issue]);
  }
  return byScreen;
}

/** The handlers an {@link IssueGo} is followed through. */
export interface IssueRoutes {
  readonly onGoTo: (path: Path) => void;
  readonly onGoToSchedule: () => void;
  readonly onGoToRules: (section: string) => void;
  readonly onGoToDestinations: () => void;
  /** The library of designs. */
  readonly onGoToDesign: () => void;
  readonly onGoToPlacement: () => void;
  /** The design in place. */
  readonly onEditDesign: () => void;
  readonly onEditJourney: (repair?: JourneyRepair) => void;
  readonly onRetryGoal?: () => void;
}

/** Go where an issue's fix is: one spelling for the review, the screens and the map. */
export function followIssue(go: IssueGo, routes: IssueRoutes): void {
  switch (go.to) {
    case 'rules': routes.onGoToRules(go.section); break;
    case 'placement': routes.onGoToPlacement(); break;
    case 'retry-goal': routes.onRetryGoal?.(); break;
    case 'edit-design': routes.onEditDesign(); break;
    case 'library': routes.onGoToDesign(); break;
    case 'destinations': routes.onGoToDestinations(); break;
    case 'journey': routes.onEditJourney(go.repair); break;
    case 'element': routes.onGoTo(go.path); break;
    case 'schedule': routes.onGoToSchedule(); break;
  }
}

/**
 * An optional signup forwarded nowhere while the main one is forwarded.
 *
 * The server refuses it (`OptinController::publish()`, "Choose a service for
 * each form"), so the review must not call the campaign ready. Kept in WConvert
 * only, every form's leads stay here and there is nothing to choose.
 */
function signupRouteIssues({ template, captureMode, submissionSettings }: CampaignIssueInputs): CampaignIssue[] {
  if (!template || captureMode === 'local') return [];
  const settings = (submissionSettings ?? {}) as Record<string, { destination_ids?: unknown } | undefined>;
  return template.tree.submissions.slice(1).flatMap((signup): CampaignIssue[] => {
    const at = submissionScreen(template.tree, signup.id);
    const routes = settings[signup.id]?.destination_ids;
    if (at < 0 || (Array.isArray(routes) && routes.length > 0)) return [];
    return [{
      key: `signup-route:${signup.id}`,
      said: sprintf(__('Choose a service for the form on “%s”, or keep all leads in WConvert only.', 'wconvert'), template.tree.steps[at].name),
      blocks: true, tab: 'destinations', go: { to: 'destinations' }, screenId: template.tree.steps[at].id, offersKeepLocal: true,
    }];
  });
}

/** A prefilled link address still unchanged since the setup guessed it (ADR 0133). */
function uncheckedLinkIssues(template: Template | undefined, recorded: unknown): { id: string; said: string; path: Path }[] {
  if (!template || recorded === null || typeof recorded !== 'object') return [];
  const entries = recorded as Record<string, { href?: unknown; place?: unknown } | undefined>;
  return nodesOf(template.tree).flatMap(block => {
    const node = nodeAt(template.tree, block.path) as { id?: unknown; type?: string; label?: unknown; href?: unknown; action?: unknown } | null;
    const id = typeof node?.id === 'string' ? node.id : null;
    const entry = id === null ? undefined : entries[id];
    if (block.hidden || !node || node.type !== 'button' || node.action !== 'link' || !entry || typeof node.href !== 'string' || node.href !== entry.href) return [];
    const place = entry.place === 'shop' ? __('Shop page', 'wconvert') : entry.place === 'home' ? __('Home page', 'wconvert') : node.href;
    const label = typeof node.label === 'string' && node.label.trim() ? node.label.trim() : __('the button', 'wconvert');
    return [{ id: id as string, path: block.path,
      /* translators: 1: a button's words, e.g. “Shop the sale”. 2: where it links now, e.g. “Shop page”. */
      said: sprintf(__('Check where “%1$s” goes (now: %2$s).', 'wconvert'), label, place) }];
  });
}

/** A visible consent or fine-print sentence whose address is the site's policy. */
export function visiblePolicyLinkIn(template: Template, policyUrl?: string): Path | null {
  for (const block of nodesOf(template.tree)) {
    if (block.hidden) continue;
    const node = nodeAt(template.tree, block.path);
    if (!node || !asksForPolicy(node)) continue;
    const link = (node as { link?: { label?: unknown; href?: unknown } }).link;
    if (!link || typeof link.label !== 'string' || link.label.trim() === '') continue;
    if (link.href === undefined || link.href === '' || link.href === policyUrl) return block.path;
  }

  return null;
}

export function consentIn(template: Template, visibleOnly = false): Path | null {
  return nodesOf(template.tree).find((block) => block.type === 'consent' && (!visibleOnly || !block.hidden))?.path ?? null;
}
