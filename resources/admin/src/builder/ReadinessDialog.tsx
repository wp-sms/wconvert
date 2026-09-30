import { useRef, useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Check, TriangleAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { StatusBadge } from '../optins/StatusBadge';
import { statusOf, type OptinState } from '../optins/api';
import { Code } from '../shell/Code';
import { messageOf, type Loadable } from '../shell/loadable';
import { destinationsSaid } from './destinations';
import { capturedFields } from '../destinations/requirements';
import { problemsIn, type Problem } from './structure/problems';
import { captureReadiness } from './structure/captureReadiness';
import { journeyIssues as collectJourneyIssues } from './structure/journeyIssues';
import { type JourneyRepair } from './structure/journeyReadiness';
import { capturesTaken, nodeAt, nodesOf } from './structure/tree';
import { convertingActOf } from './structure/guards';
import { summarise } from './rules/summaries';
import { PlacementGuidance } from './PlacementGuidance';
import { inlinePlacementLabel } from '../inlinePlacement';
import { physicalPlacementLabel, resolvedPlacement } from './PlacementControl';
import { useDirection } from '../hooks/useDirection';
import type { Path } from './panel';
import type { RuleVocabulary } from './api';
import type { DisplayRulesValue } from './rules/summaries';
import type { Destination } from '../destinations/api';
import { goalSaid } from '../goals/said';
import { outcomeDesignIssue, outcomeHandoffIssue } from '../goals/outcome';
import type { GoalEntry } from '../goals/api';
import type { Template } from '@renderer/types';

export interface ReadinessDialogProps {
  readonly captureMode?: string;
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
  readonly onEditJourney?: (repair?: JourneyRepair) => void;
  readonly onPreview: () => void;
  /** Saves any unsaved draft before promoting it; rejects without hiding the dialog. */
  readonly onPublish: () => Promise<void>;
}

export function ReadinessDialog({
  captureMode = 'connected',
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
  onEditJourney = onEditDesign,
  onPreview,
  onPublish,
}: ReadinessDialogProps) {
  const [open, setOpen] = useState(false);
  const direction = useDirection();
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRepair, setErrorRepair] = useState<JourneyRepair | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const where = destinationsSaid(bound, destinations, capturedFields(template));
  const overlay = displayType !== 'inline';
  const position = physicalPlacementLabel(displayType, placement, direction);
  const summaries = summarise(rules, vocabulary, overlay, template ? convertingActOf(template.tree)[0] : undefined);
  const hasDesign = template !== undefined && template.tree.steps.length > 0;
  const captures = hasDesign ? capturesTaken(template.tree) : [];
  const outcome = goal.status === 'ready' ? goal.data?.outcome : undefined;
  const privacyPath = template ? visiblePolicyLinkIn(template, policyUrl) : null;
  const consentPath = template ? consentIn(template) : null;
  const visibleConsentPath = template ? consentIn(template, true) : null;
  const reviewsPrivacy = privacyGuidance && captures.length > 0;
  const expectsConsent = reviewsPrivacy && outcome?.audience_channel != null;
  const missingPolicyPage = reviewsPrivacy && !policyUrl;
  const missingNotice = reviewsPrivacy && privacyPath === null;
  const missingConsent = expectsConsent && visibleConsentPath === null;
  const problems = hasDesign ? [...problemsIn(template, rules.schedule.ends_at), ...captureReadiness(template, outcome?.audience_channel)] : [];
  const journeyIssues = template ? collectJourneyIssues(template.tree, outcome?.action) : [];
  const needsCapture = bound.length > 0;
  const goalIssue = outcome && hasDesign ? outcomeDesignIssue(outcome, template) : null;
  const handoffIssue = outcome ? outcomeHandoffIssue(outcome, bound, destinations, captureMode) : null;
  const inlineTriggerIssue = !overlay && (inlinePlacement != null || contentLock != null) && rules.display_rules?.opening.mode !== 'immediate';
  const blocking: { said: string; fix: () => void }[] = [
    ...summaries.filter(summary => summary.attention && ['who', 'when', 'where'].includes(summary.id)).map(summary => ({ said: summary.text, fix: () => onGoToRules(summary.id) })),
    ...(contentLock != null && (overlay || inlinePlacement != null || !template || convertingActOf(template.tree)[0] !== 'submit')
      ? [{ said: __('Content lock requires an inline submission form and manual placement.', 'wconvert'), fix: onGoToPlacement }] : []),
    ...(!overlay && inlinePlacement != null && inlinePlacementLabel(inlinePlacement) === null
      ? [{ said: __('Choose a valid inline position and a whole paragraph number from 1 to 100.', 'wconvert'), fix: onGoToPlacement }] : []),
    ...(inlineTriggerIssue ? [{ said: __('This placement requires page load as its only trigger. Change When it appears or use manual placement.', 'wconvert'), fix: () => onGoToRules('when') }] : []),
    ...(!outcome ? [{ said: __('Goal requirements could not be checked. Reload before publishing.', 'wconvert'), fix: onGoToDesign }] : []),
    ...(goalIssue ? [{ said: goalIssue, fix: template && convertingActOf(template.tree)[0] === outcome?.action ? onEditDesign : onGoToDesign }] : []),
    ...(handoffIssue ? [{ said: handoffIssue, fix: onGoToDestinations }] : []),
    ...(!hasDesign ? [{ said: __('Choose a design before publishing.', 'wconvert'), fix: onGoToDesign }] : []),
    ...journeyIssues.map(issue => ({ said: issue.said, fix: () => onEditJourney(issue.repair) })),
    ...problems.filter((problem) => problem.check === 'converts' || problem.blocksPublish).map((problem) => ({
      said: problem.said,
      fix: problem.path !== null ? () => onGoTo(problem.path as Path) : onEditDesign,
    })),
    ...(hasDesign && needsCapture && captures.length === 0
      ? [{ said: __('This Campaign needs a form field to collect leads. Choose a design with a form.', 'wconvert'), fix: onGoToDesign }]
      : []),
  ];
  const warnings = problems.filter((problem) => problem.check !== 'converts' && !problem.blocksPublish);
  const reviewCount = blocking.length + warnings.length + where.problems.length
    + (missingPolicyPage ? 1 : 0) + (missingNotice ? 1 : 0) + (missingConsent ? 1 : 0);
  const isPublished = optin.published_at !== null;
  const current = isPublished && !dirty && !optin.has_unpublished_changes;
  const canPublish = blocking.length === 0 && optin.deleted_at === null && !current;

  const jump = (action: () => void) => {
    if (publishing) return;
    afterClose.current = action;
    setOpen(false);
  };
  const fix = (problem: Problem) => {
    if (problem.go === 'schedule') jump(onGoToSchedule);
    else if (problem.path !== null) jump(() => onGoTo(problem.path as Path));
    else jump(onGoToDesign);
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
        const result = template?.tree.steps.find(screen => screen.kind === 'result' && screen.products_required);
        if (result) setErrorRepair({ screenId: result.id, section: 'content', focus: 'products-required' });
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Button
        ref={trigger}
        disabled={busy}
        onClick={() => {
          setPublished(false);
          setError(null);
          setErrorRepair(null);
          setOpen(true);
        }}
      >
        {reviewCount > 0 && <TriangleAlert aria-hidden="true" />}
        {__('Review & publish', 'wconvert')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!publishing) setOpen(next);
        }}
      >
        <DialogContent
          className="wconvert-launch-review flex flex-col gap-0 p-0 sm:max-w-2xl"
          showCloseButton={!publishing}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const action = afterClose.current;
            afterClose.current = null;
            if (action) action();
            else trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {published
                ? __('Published version updated', 'wconvert')
                : __('Review & publish', 'wconvert')}
            </DialogTitle>
            <DialogDescription>
              {published
                ? __('Your saved draft is now the published version. Check placement and display rules on your site next.', 'wconvert')
                : __('Check the design, where it appears and where leads go before publishing.', 'wconvert')}
            </DialogDescription>
          </DialogHeader>
          <div className="wconvert-launch-review__scroll" inert={publishing}>
            <div className="wconvert-launch-review__status">
              <StatusBadge status={statusOf(optin)} />
              <span>{goalSaid(goal, goalId)}</span>
              {!published && (dirty || optin.has_unpublished_changes) && (
                <span>{__('Unpublished changes', 'wconvert')}</span>
              )}
            </div>
            {optin.suspended !== null && (
              <p className="wconvert-launch-review__notice">{optin.suspended}</p>
            )}
            {published ? (
              <div className="wconvert-launch-review__success" role="status">
                <Check aria-hidden="true" />
                {__('Saved and published. Appearance still depends on your rules and placement.', 'wconvert')}
              </div>
            ) : (
              <>
                {blocking.length > 0 && (
                  <ReviewSection title={__('Before you can publish', 'wconvert')}>
                    <ul className="wconvert-launch-review__notice">
                      {blocking.map((problem) => (
                        <li key={problem.said}>
                          <button className="wconvert-readiness__go" onClick={() => jump(problem.fix)}>
                            {problem.said}
                          </button>
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
                            captures.map((field) => fieldLabels[field] ?? field).join(', '),
                          )
                        : convertingActOf(template.tree).includes('click')
                          ? __('No lead fields. This design tracks button clicks.', 'wconvert')
                          : __('This design has no fields to collect leads.', 'wconvert')
                      : __('No design selected yet.', 'wconvert')}
                  </p>
                </ReviewSection>
                <ReviewSection title={__('Placement & timing', 'wconvert')}>
                  {displayType === 'fullscreen' && (
                    <p>{__('Fullscreen covers the page until dismissed. Check mobile sizing, page targeting and frequency; prefer a visitor action or meaningful engagement over immediate display.', 'wconvert')}</p>
                  )}
                  {position !== null && (
                    <p>
                      <button className="wconvert-readiness__go" onClick={() => jump(onGoToDesign)}>
                        {sprintf(__('Position: %s', 'wconvert'), position)}
                      </button>
                      {displayType === 'floating_bar' && resolvedPlacement(displayType, placement) === 'block_start' && (
                        <> {__('A top bar moves the page down; check it with your site header.', 'wconvert')}</>
                      )}
                    </p>
                  )}
                  {teaser != null && ['popup', 'slide_in'].includes(displayType) && <p><button className="wconvert-readiness__go" onClick={() => jump(onGoToDesign)}>{__('Reopen button enabled: follows eligible pages in this tab after dismissal. Check mobile placement beside checkout, chat and cookie controls.', 'wconvert')}</button></p>}
                  {!overlay && (
                    <p><button className="wconvert-readiness__go" onClick={() => jump(onGoToPlacement)}>
                      {contentLock != null ? __('Content lock: selected region, remembered for 30 days in this browser. Content stays readable if the form is unavailable. Check the actual page before sharing it.', 'wconvert') : inlinePlacementLabel(inlinePlacement) ?? __('Appears where you place its block or shortcode, when these rules allow it.', 'wconvert')}
                    </button></p>
                  )}
                  <dl className="wconvert-launch-review__rules">
                    {summaries.map((summary) => (
                      <div key={summary.id}>
                        <dt>
                          <button
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
                  title={__('Lead storage & forwarding', 'wconvert')}
                  action={__('Edit destinations', 'wconvert')}
                  onAction={() => jump(onGoToDestinations)}
                >
                  <p>
                    {captures.length > 0
                      ? __('New leads are saved in WConvert.', 'wconvert')
                      : __('This design does not collect leads to save or forward.', 'wconvert')}
                  </p>
                  {(captures.length > 0 || bound.length > 0) && (
                    <p>
                      {captureMode === 'local'
                        ? __('Collect only: saved in Leads for export or follow-up. Nothing is forwarded and no subscription messages are sent by this campaign.', 'wconvert')
                        : bound.length === 0
                        ? handoffIssue
                          ? __('No destination selected. Finish setup in Destinations.', 'wconvert')
                          : __('No forwarding selected. Leads stay here for review or export.', 'wconvert')
                        : where.said}
                    </p>
                  )}
                  {bound.length > 0 && destinations === null && (
                    <p className="wconvert-launch-review__notice">
                      {__('Destination details could not be checked. Open Destinations to refresh them.', 'wconvert')}
                    </p>
                  )}
                  {where.problems.length > 0 && (
                    <ul className="wconvert-launch-review__notice">
                      {where.problems.map((said) => (
                        <li key={said}>
                          <button
                            className="wconvert-readiness__go"
                            onClick={() => jump(onGoToDestinations)}
                          >
                            {said}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {bound.length > 0 && (
                    <p className="text-note text-muted-foreground">
                      {__('Publishing does not test delivery. Check that the destination is configured and can use the fields this form collects.', 'wconvert')}
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
                        ? <p className="wconvert-launch-review__notice">{__('No consent checkbox is shown for this marketing list.', 'wconvert')}</p>
                        : <p>{__('Required consent is shown for this marketing list.', 'wconvert')}</p>
                      : <p>{__('This starting point uses a privacy notice without a consent checkbox.', 'wconvert')}</p>}
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
                      {warnings.map((problem, i) => (
                        <li key={i}>
                          <button className="wconvert-readiness__go" onClick={() => fix(problem)}>
                            {problem.said}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </ReviewSection>
                )}
                {(outcome || playbookId !== '') && (
                  <details className="wconvert-launch-review__section">
                    <summary>{__('Measurement & setup details', 'wconvert')}</summary>
                    {outcome && <p>{outcome.measurement}</p>}
                    {playbookId !== '' && playbook.status !== 'loading' && (
                      <p className="text-note text-muted-foreground">
                        {__('Started from', 'wconvert')}: {playbook.status === 'ready' && playbook.data !== null
                          ? playbook.data
                          : <Code>{playbookId}</Code>}
                      </p>
                    )}
                  </details>
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
              />
            )}
          </div>
          <div className="wconvert-launch-review__footer">
            {error !== null && (
              <p role="alert" className="wconvert-launch-review__notice">{error}</p>
            )}
            {errorRepair && <button className="wconvert-readiness__go" onClick={() => jump(() => onEditJourney(errorRepair))}>
              {__('Review product requirements', 'wconvert')}
            </button>}
            {!published && (
              <p className="text-note text-muted-foreground">
                {current
                  ? __('Your saved draft matches the published version.', 'wconvert')
                  : dirty
                    ? __('Publishing saves your latest edits first. Save draft keeps them unpublished.', 'wconvert')
                    : isPublished
                      ? __('This replaces the published version with your saved draft.', 'wconvert')
                      : __('Publishing makes this Campaign available to visitors according to its display rules.', 'wconvert')}
              </p>
            )}
            <div className="wconvert-launch-review__buttons">
              <Button variant="outline" disabled={publishing} onClick={() => setOpen(false)}>
                {published ? __('Done', 'wconvert') : __('Keep editing', 'wconvert')}
              </Button>
              {!published && (
                <Button disabled={publishing || !canPublish} onClick={() => void publish()}>
                  {publishing
                    ? __('Publishing…', 'wconvert')
                    : dirty
                      ? __('Save & publish', 'wconvert')
                      : isPublished
                        ? __('Publish changes', 'wconvert')
                        : __('Publish Campaign', 'wconvert')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A visible sentence whose address is supplied by this site's policy setting. */
function visiblePolicyLinkIn(template: Template, policyUrl?: string): Path | null {
  for (const block of nodesOf(template.tree)) {
    if (block.hidden) continue;
    const node = nodeAt(template.tree, block.path) as { link?: { label?: unknown; href?: unknown } } | null;
    const link = node?.link;
    if (!link || typeof link.label !== 'string' || link.label.trim() === '') continue;
    if (link.href === undefined || link.href === '' || link.href === policyUrl) return block.path;
  }

  return null;
}

function consentIn(template: Template, visibleOnly = false): Path | null {
  return nodesOf(template.tree).find((block) => block.type === 'consent' && (!visibleOnly || !block.hidden))?.path ?? null;
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
          <Button variant="link" size="sm" onClick={onAction}>{action}</Button>
        )}
      </div>
      {children}
    </section>
  );
}
