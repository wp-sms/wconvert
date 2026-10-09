import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, Check, TriangleAlert } from 'lucide-react';
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
import { Disclosure } from '../shell/Disclosure';
import { formatCount, humanize, labelOf } from '../lib/format';
import { messageOf, type Loadable } from '../shell/loadable';
import { destinationsSaid } from './destinations';
import { capturedFields } from '../destinations/requirements';
import { type JourneyRepair } from './structure/journeyReadiness';
import { capturesTaken } from './structure/tree';
import { convertingActOf } from './structure/guards';
import { summarise, summaryOf } from './rules/summaries';
import { campaignIssues, consentIn, visiblePolicyLinkIn, type BlockedTab, type CampaignIssue, type IssueGo } from './readiness/campaignIssues';
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
  /** `config.submission_settings`: the optional signup's own routes. */
  readonly submissionSettings?: unknown;
  /** `config.unchecked_links`: link addresses a fresh setup guessed (ADR 0133). */
  readonly uncheckedLinks?: unknown;
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
  readonly policyUrl?: string;
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
  /** Which editor tabs hold something that blocks publishing, for their attention dots. */
  readonly onBlockedTabsChange?: (tabs: readonly BlockedTab[]) => void;
  /**
   * The campaign's one issue list, for every other place that counts issues
   * — each screen's warning and the map's badges (ADR 0133).
   */
  readonly onIssuesChange?: (issues: readonly CampaignIssue[]) => void;
}

export type { BlockedTab };

/** The handlers an {@link IssueGo} is followed through. */
export interface IssueRoutes {
  readonly onGoTo: (path: Path) => void;
  readonly onGoToSchedule: () => void;
  readonly onGoToRules: (section: string) => void;
  readonly onGoToDestinations: () => void;
  readonly onGoToDesign: () => void;
  readonly onGoToPlacement?: () => void;
  readonly onEditDesign: () => void;
  readonly onEditJourney?: (repair?: JourneyRepair) => void;
  readonly onRetryGoal?: () => void;
}

/** Go where an issue's fix is. One spelling for the review and the screens. */
export function followIssue(go: IssueGo, routes: IssueRoutes): void {
  switch (go.to) {
    case 'rules': routes.onGoToRules(go.section); break;
    case 'placement': (routes.onGoToPlacement ?? routes.onGoToDesign)(); break;
    case 'retry-goal': routes.onRetryGoal?.(); break;
    case 'edit-design': routes.onEditDesign(); break;
    case 'library': routes.onGoToDesign(); break;
    case 'destinations': routes.onGoToDestinations(); break;
    case 'journey': (routes.onEditJourney ?? routes.onEditDesign)(go.repair); break;
    case 'element': routes.onGoTo(go.path); break;
    case 'schedule': routes.onGoToSchedule(); break;
  }
}

export function ReadinessDialog({
  name = '',
  captureMode = 'local',
  submissionSettings,
  uncheckedLinks,
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
  policyUrl,
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
  onBlockedTabsChange,
  onIssuesChange,
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
  const privacyPath = template ? visiblePolicyLinkIn(template, policyUrl) : null;
  const consentPath = template ? consentIn(template) : null;
  const visibleConsentPath = template ? consentIn(template, true) : null;
  const reviewsPrivacy = privacyGuidance && captures.length > 0;
  const expectsConsent = reviewsPrivacy && outcome?.audience_channel != null;
  // The one list (ADR 0133): every count in the editor reads it.
  const issues = campaignIssues({ template, rules, vocabulary, displayType, contentLock, inlinePlacement, outcome, bound, destinations,
    captureMode, submissionSettings, uncheckedLinks, privacyGuidance, policyUrl });
  const blocking = issues.filter(issue => issue.blocks);
  const warnings = issues.filter(issue => !issue.blocks && issue.section === undefined);
  const missingPolicyPage = issues.some(issue => issue.key === 'privacy:page');
  const missingNotice = issues.some(issue => issue.key === 'privacy:notice');
  const missingConsent = issues.some(issue => issue.key === 'privacy:consent');
  const routes: IssueRoutes = { onGoTo, onGoToSchedule, onGoToRules, onGoToDestinations, onGoToDesign, onGoToPlacement, onEditDesign, onEditJourney, onRetryGoal };
  const handoffIssue = issues.find(issue => issue.key === 'handoff') ?? null;
  // A blocker answered inside the dialog (a failed goal read) belongs to no tab.
  const blockedTabs = [...new Set(blocking.flatMap((problem) => problem.tab === null ? [] : [problem.tab]))].sort().join(',');
  useEffect(() => {
    onBlockedTabsChange?.(blockedTabs === '' ? [] : blockedTabs.split(',') as BlockedTab[]);
  }, [blockedTabs, onBlockedTabsChange]);
  const signature = JSON.stringify(issues.map(issue => [issue.key, issue.said, issue.screenId ?? null, issue.blocks]));
  const latest = useRef(issues);
  latest.current = issues;
  useEffect(() => {
    onIssuesChange?.(latest.current);
  }, [signature, onIssuesChange]);
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
        ? __('Fix the items under “Before you can publish” first.', 'wconvert')
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
                {blocking.length > 0 && (
                  <ReviewSection title={__('Before you can publish', 'wconvert')}>
                    <ul className="wconvert-launch-review__notice">
                      {blocking.map((problem) => (
                        <li key={problem.key}>
                          <button type="button" className="wconvert-readiness__go" onClick={() => fix(problem, true)}>
                            {problem.said}
                          </button>
                          {problem.key === 'goal-unread' && onRetryGoal && <Button type="button" variant="outline" onClick={onRetryGoal}>{__('Try again', 'wconvert')}</Button>}
                          {problem.offersKeepLocal && onKeepLocal && <Button type="button" variant="outline" onClick={onKeepLocal}>{__('Keep in WConvert only', 'wconvert')}</Button>}
                        </li>
                      ))}
                    </ul>
                  </ReviewSection>
                )}
                <ReviewSection
                  title={__('Design', 'wconvert')}
                  action={hasDesign ? __('Preview design', 'wconvert') : __('Choose design', 'wconvert')}
                  onAction={() => jump(hasDesign ? onPreview : onGoToDesign)}
                >
                  <p>
                    {hasDesign
                      ? captures.length > 0
                        ? sprintf(
                            __('Collects: %s', 'wconvert'),
                            captures.map((field) => labelOf(field, fieldLabels, humanize(field))).join(', '),
                          )
                        : convertingActOf(template.tree).includes('click')
                          ? __('No lead fields. This design tracks button clicks.', 'wconvert')
                          : __('This design has no fields to collect leads.', 'wconvert')
                      : __('No design selected yet.', 'wconvert')}
                  </p>
                </ReviewSection>
                <ReviewSection title={__('Placement & timing', 'wconvert')}>
                  {displayType === 'fullscreen' && (
                    <p>{__('Fullscreen covers the page until it is closed. Prefer a visitor action or real engagement over opening right away, and check it on mobile.', 'wconvert')}</p>
                  )}
                  {position !== null && (
                    <p>
                      <button type="button" className="wconvert-readiness__go" onClick={() => jump(onGoToLook)}>
                        {sprintf(__('Position: %s', 'wconvert'), position)}
                      </button>
                      {displayType === 'floating_bar' && resolvedPlacement(displayType, placement) === 'block_start' && (
                        <> {__('A top bar moves the page down; check it with your site header.', 'wconvert')}</>
                      )}
                    </p>
                  )}
                  {teaser != null && ['popup', 'slide_in'].includes(displayType) && (
                    <p>
                      <button type="button" className="wconvert-readiness__go" onClick={() => jump(onGoToLook)}>
                        {__('Reopen button', 'wconvert')}
                      </button>{' '}
                      {__('Follows visitors to eligible pages in this tab after they close it. Check it beside checkout, chat and cookie controls on mobile.', 'wconvert')}
                    </p>
                  )}
                  {!overlay && (
                    <p>
                      <button type="button" className="wconvert-readiness__go" onClick={() => jump(onGoToPlacement)}>
                        {contentLock != null
                          ? __('Content lock', 'wconvert')
                          : inlinePlacementLabel(inlinePlacement) ?? __('Manual placement', 'wconvert')}
                      </button>{' '}
                      {contentLock != null
                        ? __('Locks the selected region and remembers an unlock for 30 days in that browser. The content stays readable if the form cannot load.', 'wconvert')
                        : inlinePlacement == null
                          ? __('Appears where you place its block or shortcode, when these rules allow it.', 'wconvert')
                          : null}
                    </p>
                  )}
                  <dl className="wconvert-launch-review__rules">
                    {summaries.map((summary) => (
                      <div key={summary.id}>
                        <dt>
                          <button
                            type="button"
                            className="wconvert-readiness__go"
                            onClick={() => jump(() => onGoToRules(summary.id))}
                          >
                            {!overlay && summary.id === 'where'
                              ? __('Eligible pages', 'wconvert')
                              : summary.eyebrow}
                          </button>
                        </dt>
                        <dd data-attention={summary.attention || undefined}>{summary.text}</dd>
                      </div>
                    ))}
                  </dl>
                </ReviewSection>
                <ReviewSection
                  title={__('Where leads go', 'wconvert')}
                  action={__('Edit destinations', 'wconvert')}
                  onAction={() => jump(onGoToDestinations)}
                >
                  <p>
                    {captures.length > 0
                      ? __('New leads are saved in WConvert.', 'wconvert')
                      : __('This design does not collect leads to save or send.', 'wconvert')}
                  </p>
                  {(captures.length > 0 || bound.length > 0) && (
                    <p>
                      {captureMode === 'local'
                        ? __('Keep in WConvert only: leads stay in Leads for export or follow-up. Nothing is sent anywhere else.', 'wconvert')
                        : bound.length === 0
                        ? handoffIssue
                          ? __('No destination selected. Finish setup in Destinations.', 'wconvert')
                          : __('No destination selected. Leads stay here for review or export.', 'wconvert')
                        : where.said}
                    </p>
                  )}
                  {bound.length > 0 && destinations === null && (
                    <p className="wconvert-launch-review__notice">
                      {__('Destination details could not be checked. Open Destinations to refresh them.', 'wconvert')}
                    </p>
                  )}
                  {issues.some(issue => issue.section === 'where') && (
                    <ul className="wconvert-launch-review__notice">
                      {issues.filter(issue => issue.section === 'where').map((issue) => (
                        <li key={issue.key}>
                          <button type="button" className="wconvert-readiness__go" onClick={() => fix(issue)}>
                            {issue.said}
                          </button>
                        </li>
                      ))}
                    </ul>
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
                {reviewsPrivacy && (
                  <ReviewSection
                    title={__('Privacy', 'wconvert')}
                    action={missingNotice
                      ? __('Edit design', 'wconvert')
                      : missingConsent
                        ? consentPath === null ? __('Edit design', 'wconvert') : __('Edit consent', 'wconvert')
                        : __('Edit notice', 'wconvert')}
                    onAction={() => {
                      if (missingNotice || (missingConsent && consentPath === null)) jump(onEditDesign);
                      else if (missingConsent && consentPath !== null) jump(() => onGoTo(consentPath));
                      else if (privacyPath !== null) jump(() => onGoTo(privacyPath));
                    }}
                  >
                    <p>
                      {privacyPath === null
                        ? __('No Privacy Policy notice is shown on this form.', 'wconvert')
                        : policyUrl
                          ? __('This form links to your Privacy Policy.', 'wconvert')
                          : __('This form includes a Privacy Policy notice.', 'wconvert')}
                    </p>
                    {expectsConsent
                      ? visibleConsentPath === null
                        ? <p className="wconvert-launch-review__notice">{__('No consent checkbox is shown for this mailing list.', 'wconvert')}</p>
                        : <p>{__('Required consent is shown for this mailing list.', 'wconvert')}</p>
                      : <p>{__('This form shows a privacy notice without a consent checkbox.', 'wconvert')}</p>}
                    {missingPolicyPage && (
                      <p className="wconvert-launch-review__notice">
                        {__('WordPress has no Privacy Policy page selected, so the form cannot link to it.', 'wconvert')}{' '}
                        <a href="options-privacy.php" target="_blank" rel="noreferrer">
                          {__('Set the Privacy Policy page', 'wconvert')}
                        </a>
                      </p>
                    )}
                  </ReviewSection>
                )}
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
                          <button type="button" className="wconvert-readiness__go" onClick={() => fix(problem)}>
                            {problem.said}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ReviewSection>
                )}
                {(outcome || startedFrom !== null) && (
                  <Disclosure variant="inline" className="wconvert-launch-review__section" title={__('Measurement & setup details', 'wconvert')}>
                    {outcome && <p>{outcome.measurement}</p>}
                    {startedFrom !== null && (
                      <p className="text-note text-muted-foreground">
                        {sprintf(
                          /* translators: %s: the name of the starting point this campaign was created from. */
                          __('Started from: %s', 'wconvert'),
                          startedFrom,
                        )}
                      </p>
                    )}
                  </Disclosure>
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
            back={
              <Button variant="outline" disabled={publishing} onClick={() => setOpen(false)}>
                {published ? __('Done', 'wconvert') : __('Keep editing', 'wconvert')}
              </Button>
            }
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
