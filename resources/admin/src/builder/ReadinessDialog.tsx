import { lazy, Suspense, useId, useRef, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Check, Eye, Target, TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { StatusBadge } from '../optins/StatusBadge';
import { statusOf, type OptinState } from '../optins/api';
import { FactList } from '../shell/FactList';
import { campaignFacts, linksIn } from '../optins/campaignFacts';
import { formatCount, humanize, labelOf } from '../lib/format';
import { messageOf, type Loadable } from '../shell/loadable';
import { destinationsSaid } from './destinations';
import { capturedFields } from '../destinations/requirements';
import { type JourneyRepair } from './structure/journeyReadiness';
import { capturesTaken } from './structure/tree';
import { convertingActOf } from './structure/guards';
import { summarise, summaryOf } from './rules/summaries';
import { ISSUE, consentIn, followIssue, type CampaignIssue, type IssueRoutes } from './readiness/campaignIssues';

const CampaignDesign = lazy(() => import('../optins/CampaignDesign'));
const handoffIssueOf = (issues: readonly CampaignIssue[]) => issues.some(issue => issue.key === ISSUE.handoff);

/** A blocker's fix, named for where it takes the merchant. */
function fixLabel(issue: CampaignIssue): string {
  switch (issue.go.to) {
    case 'destinations': return __('Choose a service', 'wconvert');
    case 'rules': case 'schedule': return __('Fix in Display rules', 'wconvert');
    case 'library': return __('Choose a design', 'wconvert');
    case 'placement': return __('Fix placement', 'wconvert');
    default: return __('Fix in the editor', 'wconvert');
  }
}
import type { CaptureMode } from './captureMode';
import { PlacementGuidance } from './PlacementGuidance';
import { inlinePlacementLabel } from '../inlinePlacement';
import { physicalPlacementLabel, resolvedPlacement } from './PlacementControl';
import { useDirection } from '../hooks/useDirection';
import type { Path } from './panel';
import type { RuleVocabulary } from './api';
import type { DisplayRulesValue } from './rules/summaries';
import type { Destination } from '../destinations/api';
import { goalSaid } from '../goals/said';
import type { GoalEntry } from '../goals/api';
import type { Template } from '@renderer/types';

export interface ReadinessDialogProps {
  /** The campaign's name: the dialog is about it, so it is the title. */
  readonly name?: string;
  readonly captureMode?: CaptureMode;
  /** The campaign's one issue list (ADR 0133): the same one every other count reads. */
  readonly issues: readonly CampaignIssue[];
  readonly optinId: string;
  readonly optin: OptinState;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly goal: Loadable<GoalEntry | null>;
  readonly goalId: string;
  readonly playbook: Loadable<string | null>;
  readonly playbookId: string;
  readonly rules: DisplayRulesValue;
  readonly vocabulary: RuleVocabulary;
  readonly displayType: string;
  readonly placement?: unknown;
  readonly contentLock?: unknown;
  readonly teaser?: unknown;
  readonly inlinePlacement?: unknown;
  readonly bound: readonly string[];
  readonly template: Template | undefined;
  readonly destinations: readonly Destination[] | null;
  readonly fieldLabels: Readonly<Record<string, string>>;
  readonly privacyGuidance?: boolean;
  readonly onGoTo: (path: Path) => void;
  readonly onGoToSchedule: () => void;
  readonly onGoToRules: (section: string) => void;
  readonly onGoToDestinations: () => void;
  readonly onGoToDesign: () => void;
  readonly onGoToPlacement?: () => void;
  readonly onEditDesign: () => void;
  /** Opens the Look panel: colors, fonts, position and the reopen button. */
  readonly onGoToLook?: () => void;
  readonly onEditJourney?: (repair?: JourneyRepair) => void;
  readonly onPreview: () => void;
  /** Saves any unsaved draft before promoting it; rejects without hiding the dialog. */
  readonly onPublish: () => Promise<void>;
  /** Switches a list campaign to Keep in WConvert only, in place (ADR 0132). */
  readonly onKeepLocal?: () => void;
  /** Reads the campaign's goal again after a failed read. */
  readonly onRetryGoal?: () => void;
}

export function ReadinessDialog({
  name = '',
  captureMode = 'local',
  issues,
  optinId,
  optin,
  dirty,
  busy,
  goal,
  goalId,
  playbook,
  playbookId,
  rules,
  vocabulary,
  displayType,
  placement,
  contentLock,
  teaser,
  inlinePlacement,
  bound,
  template,
  destinations,
  fieldLabels,
  privacyGuidance = false,
  onGoTo,
  onGoToSchedule,
  onGoToRules,
  onGoToDestinations,
  onGoToDesign,
  onGoToPlacement = onGoToDesign,
  onEditDesign,
  onGoToLook = onEditDesign,
  onEditJourney = onEditDesign,
  onPreview,
  onPublish,
  onKeepLocal,
  onRetryGoal,
}: ReadinessDialogProps) {
  const [open, setOpen] = useState(false);
  const direction = useDirection();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRepair, setErrorRepair] = useState<JourneyRepair | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const afterClose = useRef<(() => void) | null>(null);
  const where = destinationsSaid(bound, destinations, capturedFields(template));
  const overlay = displayType !== 'inline';
  const position = physicalPlacementLabel(displayType, placement, direction);
  const summaries = summarise(rules, vocabulary);
  const hasDesign = template !== undefined && template.tree.steps.length > 0;
  const captures = hasDesign ? capturesTaken(template.tree) : [];
  const outcome = goal.status === 'ready' ? goal.data?.outcome : undefined;
  const visibleConsentPath = template ? consentIn(template, true) : null;
  const reviewsPrivacy = privacyGuidance && captures.length > 0;
  const expectsConsent = reviewsPrivacy && outcome?.audience_channel != null;
  const blocking = issues.filter(issue => issue.blocks);
  // Privacy's own problems are review items now; its one fact line is Consent (ADR 0138).
  const warnings = issues.filter(issue => !issue.blocks && (issue.section === undefined || issue.section === 'privacy'));
  const unchecked = bound.length > 0 && destinations === null ? [__('Destination details could not be checked. Open Destinations to refresh them.', 'wconvert')] : [];
  const forwarding = captureMode === 'local' || bound.length === 0
    ? {
        said: captureMode === 'local' ? __('Kept in WConvert only', 'wconvert') : __('Saved in Leads', 'wconvert'),
        problems: [...(handoffIssueOf(issues) ? [__('No service chosen yet', 'wconvert')] : []), ...unchecked],
      }
    : { said: where.said, problems: [...where.problems, ...unchecked] };
  const go = (label: string, action: () => void) => <button type="button" className="wconvert-readiness__go" onClick={() => jump(action)}>{label}</button>;
  const placementSaid = overlay
    ? position === null && teaser == null ? undefined : { text: <>
        {position !== null && go(position, onGoToLook)}
        {teaser != null && ['popup', 'slide_in'].includes(displayType) && <span className="block text-note text-muted-foreground">{__('A reopen button follows visitors to eligible pages after they close it.', 'wconvert')}</span>}
        {displayType === 'floating_bar' && resolvedPlacement(displayType, placement) === 'block_start' && <span className="block text-note text-muted-foreground">{__('A top bar moves the page down; check it with your site header.', 'wconvert')}</span>}
      </> }
    : { text: <>
        {go(contentLock != null ? __('Content lock', 'wconvert') : inlinePlacementLabel(inlinePlacement) ?? __('Where you place its block or shortcode', 'wconvert'), onGoToPlacement)}
        {contentLock != null && <span className="block text-note text-muted-foreground">{__('Locks the selected region and remembers an unlock for 30 days in that browser. The content stays readable if the form cannot load.', 'wconvert')}</span>}
      </> };
  const facts = campaignFacts({
    rules: summaries,
    onRule: (section) => jump(() => onGoToRules(section)),
    act: hasDesign ? convertingActOf(template.tree)[0] : undefined,
    forwarding,
    links: linksIn(template),
    counts: goal.status === 'ready' ? goal.data?.headline_label ?? null : null,
    placement: placementSaid,
    collects: captures.length > 0 ? captures.map((field) => labelOf(field, fieldLabels, humanize(field))).join(', ') : undefined,
    consent: reviewsPrivacy
      ? expectsConsent
        ? visibleConsentPath === null ? { text: __('Not shown', 'wconvert'), attention: true } : { text: __('Shown', 'wconvert') }
        : { text: __('Not asked on this form', 'wconvert') }
      : undefined,
  });
  const routes: IssueRoutes = { onGoTo, onGoToSchedule, onGoToRules, onGoToDestinations, onGoToDesign, onGoToPlacement, onEditDesign, onEditJourney, onRetryGoal };
  // After jumping to fix a blocker, the way back to the list stays on screen until the list is empty.
  const [resume, setResume] = useState(false);
  const reviewCount = issues.length;
  const startedFrom = playbookId !== '' && playbook.status === 'ready' ? playbook.data : null;
  const isPublished = optin.published_at !== null;
  const current = isPublished && !dirty && !optin.has_unpublished_changes;

  const jump = (action: () => void, fromBlocker = false) => {
    if (publishing) return;
    afterClose.current = action;
    setResume(fromBlocker);
    setOpen(false);
  };
  const fix = (issue: CampaignIssue, fromBlocker = false) => jump(() => followIssue(issue.go, routes), fromBlocker);
  const reopen = () => {
    setPublished(false);
    setError(null);
    setErrorRepair(null);
    setResume(false);
    setOpen(true);
  };
  const publish = async () => {
    setPublishing(true);
    setError(null);
    setErrorRepair(null);
    try {
      await onPublish();
      setPublished(true);
    } catch (cause) {
      setError(messageOf(cause));
      const refusal = cause as { code?: unknown; data?: { issue?: unknown } } | null;
      if (refusal?.code === 'wconvert_optin_form_incomplete' && refusal.data?.issue === 'products') {
        const result = template?.tree.steps.find(screen => screen.kind === 'result' && (screen.products_required || screen.results?.some(result => result.product_filter)));
        if (result) {
          const filtered = result.results?.find(variant => variant.product_filter);
          setErrorRepair({ screenId: result.id, section: 'content', ...(filtered ? { resultId: filtered.id } : { focus: 'products-required' as const }) });
        }
      }
    } finally {
      setPublishing(false);
    }
  };

  // A refused Publish keeps focus and says why (§9): busy is `disabled`,
  // refused is `aria-disabled` with this sentence as its description.
  const refusal = optin.deleted_at !== null
    ? __('This campaign is in the trash. Restore it before publishing.', 'wconvert')
    : current
      ? __('Your saved draft matches the published version.', 'wconvert')
      : blocking.length > 0
        ? _n('Fix the item above first.', 'Fix the items above first.', blocking.length, 'wconvert')
        : null;

  return (
    <>
      {resume && blocking.length > 0 && !open && (
        <Button type="button" variant="outline" className="wconvert-readiness__resume" disabled={busy} onClick={reopen}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          {sprintf(
            /* translators: %d: how many items still block publishing. */
            _n('Back to review · %s left', 'Back to review · %s left', blocking.length, 'wconvert'),
            formatCount(blocking.length),
          )}
        </Button>
      )}
      <Button
        ref={trigger}
        variant="brand"
        disabled={busy}
        aria-describedby={blocking.length > 0 ? `${reasonId}-count` : undefined}
        onClick={reopen}
      >
        {reviewCount > 0 && <TriangleAlert aria-hidden="true" />}
        {__('Review & publish', 'wconvert')}
        {blocking.length > 0 && <span id={`${reasonId}-count`} hidden>{sprintf(
          /* translators: %d: how many items block publishing. */
          _n('%s item blocks publishing', '%s items block publishing', blocking.length, 'wconvert'),
          formatCount(blocking.length),
        )}</span>}
        {blocking.length > 0 && (
          <span className="wconvert-readiness__count" aria-hidden="true">
            {sprintf(/* translators: %d: how many items block publishing. */ _n('%s to fix', '%s to fix', blocking.length, 'wconvert'), formatCount(blocking.length))}
          </span>
        )}
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={(next) => {
          if (!publishing) setOpen(next);
        }}
      >
        <AdminDialogContent
          size="md"
          className="wconvert-launch-review"
          showCloseButton={!publishing}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const action = afterClose.current;
            afterClose.current = null;
            if (action) action();
            else trigger.current?.focus();
          }}
        >
          <AdminDialogHeader
            title={name || __('Untitled campaign', 'wconvert')}
            badge={<StatusBadge status={statusOf(optin)} />}
            meta={!published && (dirty || optin.has_unpublished_changes)
              ? sprintf(
                  /* translators: %s: the campaign's goal, e.g. "Goal: Collect subscribers". */
                  __('%s · Unpublished changes', 'wconvert'),
                  goalSaid(goal, goalId),
                )
              : goalSaid(goal, goalId)}
          />
          <AdminDialogBody inert={publishing}>
            {optin.suspended !== null && (
              <p className="wconvert-launch-review__notice">{optin.suspended}</p>
            )}
            {published ? (
              <div className="wconvert-launch-review__success" role="status">
                <Check aria-hidden="true" />
                <div>
                  {/* Published but held back by the site: say so rather than "live". */}
                  <strong>{optin.suspended !== null ? __('Published, but suspended.', 'wconvert') : __('It’s live.', 'wconvert')}</strong>
                  <p>{optin.suspended !== null ? __('Visitors don’t see it until the issue above is resolved.', 'wconvert') : sprintf(
                    /* translators: %s: where, to whom and when it shows, e.g. "Entire site · Everyone · Right away". */
                    __('Visitors see it: %s', 'wconvert'),
                    (['where', 'who', 'when'] as const).map((id) => summaryOf(summaries, id).text).join(' · '),
                  )}</p>
                </div>
              </div>
            ) : (
              <>
                {/* One callout for what blocks publishing, each with its fix (ADR 0138). */}
                {blocking.length > 0 && (
                  <section role="alert" className="wconvert-launch-review__blockers" aria-labelledby={`${reasonId}-blockers`}>
                    <h3 id={`${reasonId}-blockers`}>
                      <TriangleAlert aria-hidden="true" />
                      {sprintf(
                        /* translators: %d: how many items block publishing. */
                        _n('%d thing to fix before publishing', '%d things to fix before publishing', blocking.length, 'wconvert'),
                        blocking.length,
                      )}
                    </h3>
                    <ul>
                      {blocking.map((problem) => (
                        <li key={problem.key}>
                          <p>{problem.said}</p>
                          <div className="wconvert-launch-review__fixes">
                            {problem.offersRetry && onRetryGoal
                              ? <Button type="button" variant="outline" onClick={onRetryGoal}>{__('Try again', 'wconvert')}</Button>
                              : <Button type="button" variant="outline" onClick={() => fix(problem, true)}>{fixLabel(problem)}</Button>}
                            {problem.offersKeepLocal && onKeepLocal && <Button type="button" variant="outline" onClick={onKeepLocal}>{__('Keep in WConvert only', 'wconvert')}</Button>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section className="wconvert-launch-review__section wconvert-launch-review__what">
                  {hasDesign
                    ? <div className="wconvert-campaign-thumbnail"><Suspense fallback={<div className="wconvert-preview-placeholder" />}><CampaignDesign template={template} /></Suspense></div>
                    : <p>{__('No design selected yet.', 'wconvert')} <Button type="button" variant="link" onClick={() => jump(onGoToDesign)}>{__('Choose design', 'wconvert')}</Button></p>}
                  {/* What counts as success, said where publishing is decided, never folded away. */}
                  {outcome && goal.status === 'ready' && goal.data && (
                    <div className="wconvert-launch-review__success-measure">
                      <Target aria-hidden="true" size={18} />
                      <div>
                        <span>{__('Counts as success', 'wconvert')}</span>
                        <strong>{goal.data.headline_label}</strong>
                        <p>{outcome.measurement}</p>
                      </div>
                    </div>
                  )}
                  {startedFrom !== null && (
                    <p className="text-note text-muted-foreground">
                      {sprintf(
                        /* translators: %s: the name of the starting point this campaign was created from. */
                        __('Started from: %s', 'wconvert'),
                        startedFrom,
                      )}
                    </p>
                  )}
                </section>
                <ReviewSection
                  title={__('How it runs', 'wconvert')}
                  action={__('Display rules', 'wconvert')}
                  onAction={() => jump(() => onGoToRules('where'))}
                >
                  <FactList facts={facts} />
                  {displayType === 'fullscreen' && (
                    <p className="text-note text-muted-foreground">{__('Fullscreen covers the page until it is closed. Prefer a visitor action or real engagement over opening right away, and check it on mobile.', 'wconvert')}</p>
                  )}
                  {bound.length > 0 && (
                    <p className="text-note text-muted-foreground">
                      {__('Publishing does not test delivery.', 'wconvert')}{' '}
                      <button type="button" className="wconvert-readiness__go" onClick={() => jump(onGoToDestinations)}>
                        {__('Send a test first', 'wconvert')}
                      </button>
                    </p>
                  )}
                </ReviewSection>
                {warnings.length > 0 && (
                  <ReviewSection
                    title={sprintf(
                      _n('%d thing to review', '%d things to review', warnings.length, 'wconvert'),
                      warnings.length,
                    )}
                  >
                    <ul className="wconvert-launch-review__warnings">
                      {warnings.map((problem) => (
                        <li key={problem.key}>
                          {problem.key === ISSUE.policyPage
                            ? <>{problem.said}{' '}<a href="options-privacy.php" target="_blank" rel="noreferrer">{__('Set the Privacy Policy page', 'wconvert')}</a></>
                            : <button type="button" className="wconvert-readiness__go" onClick={() => fix(problem)}>{problem.said}</button>}
                        </li>
                      ))}
                    </ul>
                  </ReviewSection>
                )}
              </>
            )}
            {(published || current) && (
              <PlacementGuidance
                optinId={optinId}
                displayType={displayType}
                placement={placement}
                inlinePlacement={inlinePlacement}
                contentLock={contentLock}
                published={published || isPublished}
                // Any page rule, including one that leaves pages out, may leave the homepage out too.
                everywhere={(rules.targeting.include ?? []).length === 0 && (rules.targeting.exclude ?? []).length === 0}
              />
            )}
          </AdminDialogBody>
          <AdminDialogFooter
            back={published
              ? <Button variant="outline" onClick={() => setOpen(false)}>{__('Done', 'wconvert')}</Button>
              : hasDesign && <Button variant="outline" disabled={publishing} onClick={() => jump(onPreview)}><Eye aria-hidden="true" />{__('Preview', 'wconvert')}</Button>}
            note={published ? null : (
              <span id={reasonId}>
                {refusal ?? (dirty
                  ? __('Publishing saves your latest edits first.', 'wconvert')
                  : isPublished
                    ? __('This replaces the published version with your saved draft.', 'wconvert')
                    : __('Visitors see it wherever its display rules allow.', 'wconvert'))}
              </span>
            )}
            error={error !== null && (
              <>
                {error}
                {errorRepair && (
                  <>
                    {' '}
                    <button type="button" className="wconvert-readiness__go" onClick={() => jump(() => onEditJourney(errorRepair))}>
                      {__('Review product requirements', 'wconvert')}
                    </button>
                  </>
                )}
              </>
            )}
          >
            {!published && (
              <Button
                type="button"
                disabled={publishing}
                aria-disabled={refusal !== null || undefined}
                aria-describedby={refusal !== null ? reasonId : undefined}
                onClick={() => { if (refusal === null) void publish(); }}
              >
                {publishing
                  ? __('Publishing…', 'wconvert')
                  : dirty
                    ? __('Save & publish', 'wconvert')
                    : isPublished
                      ? __('Publish changes', 'wconvert')
                      : __('Publish campaign', 'wconvert')}
              </Button>
            )}
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialog>
    </>
  );
}

function ReviewSection({
  title,
  action,
  onAction,
  children,
}: {
  readonly title: string;
  readonly action?: string;
  readonly onAction?: () => void;
  readonly children: ReactNode;
}) {
  return (
    <section className="wconvert-launch-review__section">
      <div className="wconvert-launch-review__section-head">
        <h3>{title}</h3>
        {action && (
          <Button type="button" variant="link" onClick={onAction}>{action}</Button>
        )}
      </div>
      {children}
    </section>
  );
}
