import { useRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ChartNoAxesCombined, Copy, EyeOff, Inbox, Info, MonitorPlay, MoreHorizontal, Split, Trash2, Trophy, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionGroup, OptionItem, OptionMenuContent, OptionSeparator, refusal } from '../components/ui/option-menu';
import { renderingFor, tierProductName } from '../goals/availability';
import { adminSettings } from '../settings';
import { leadsHref, reportHref } from '../nav';
import { ProHintItem, proHintsShown } from '../shell/ProHint';
import { draftPreviewUrl } from '../siteLinks';
import { canUnpublish, statusOf, type OptinSummary } from './api';
import type { DecisionKind } from './decisionCopy';

/** Every row action past the next one, with an icon and a label (GUIDELINES §20). */
export function CampaignMenu({
  row,
  name,
  parent,
  arm,
  busy,
  navigationBusy,
  missingDesign,
  result,
  reportReady,
  days,
  range,
  onDetails,
  onDuplicate,
  onTest,
  onDecision,
}: {
  row: OptinSummary;
  name: string;
  parent: OptinSummary;
  arm: boolean;
  busy: boolean;
  navigationBusy: boolean;
  missingDesign: boolean;
  result?: { capture: boolean };
  reportReady: boolean;
  days: number;
  range?: { from: string; to: string };
  /** Absent where there is no Details dialog to open, as on an occasion's page. */
  onDetails?: (trigger: HTMLElement | null) => void;
  onDuplicate: () => void;
  /** Absent where A/B tests are not managed, as on an occasion's page. */
  onTest?: () => void;
  onDecision: (kind: DecisionKind, trigger: HTMLElement | null) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null),
    status = statusOf(row);
  const availability = adminSettings()?.variants?.availability ?? 'locked';
  const tests = onTest !== undefined;
  const upsell = tests && !arm && availability !== 'ready' && renderingFor(availability, 'settings_list') === 'upsell';
  const preview = draftPreviewUrl(row.id);
  const publish = (replaces: boolean) => (
    <OptionItem
      icon={Upload}
      name={__('Publish saved draft', 'wconvert')}
      // The one action whose result is not in its name (ADR 0139).
      hint={replaces ? __('Replaces the live version', 'wconvert') : null}
      refused={missingDesign ? refusal(__('Add a design first', 'wconvert'), __('Add a design in the editor before publishing.', 'wconvert')) : null}
      onSelect={() => onDecision('publish', trigger.current)}
    />
  );
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={sprintf(__('More actions for %s', 'wconvert'), name)}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <OptionMenuContent align="end" sideOffset={5} className="wconvert-campaign-menu" aria-label={sprintf(/* translators: %s: a campaign's name. */ __('More actions for %s', 'wconvert'), name)}>
        <OptionGroup heading={name}>
          {onDetails && <OptionItem icon={Info} name={__('Details', 'wconvert')} onSelect={() => onDetails(trigger.current)} />}
          {preview !== null && (
            <OptionItem icon={MonitorPlay} name={__('Preview on site', 'wconvert')} href={preview} newTab
              refused={missingDesign ? refusal(__('Add a design first', 'wconvert'), __('Add a design in the editor before previewing it on your site.', 'wconvert')) : null} />
          )}
          <OptionItem icon={ChartNoAxesCombined} name={__('View report', 'wconvert')} href={reportHref({ optinId: row.id, days })} />
          {reportReady && result?.capture && (
            <OptionItem icon={Inbox} name={__('View submissions', 'wconvert')} href={leadsHref({ optinId: row.id, ...range })} />
          )}
          <OptionSeparator />
          <OptionItem icon={Copy} name={__('Duplicate as draft', 'wconvert')} disabled={navigationBusy} onSelect={onDuplicate} />
          {tests && !arm && availability === 'ready' && (
            <OptionItem icon={Split} disabled={navigationBusy} onSelect={onTest}
              name={parent.arms.length ? __('Add another variant', 'wconvert') : __('Create A/B test', 'wconvert')} />
          )}
          <OptionSeparator />
          {canUnpublish(status) ? (
            <OptionItem icon={EyeOff} name={arm ? __('Unpublish variant', 'wconvert') : __('Unpublish campaign', 'wconvert')}
              onSelect={() => onDecision('pause', trigger.current)} />
          ) : publish(false)}
          {canUnpublish(status) && row.has_unpublished_changes && publish(true)}
          {tests && parent.arms.length > 0 && (
            <OptionItem icon={Trophy} name={__('Use this variant', 'wconvert')} onSelect={() => onDecision('winner', trigger.current)} />
          )}
          <OptionSeparator />
          <OptionItem icon={Trash2} destructive name={arm ? __('Delete variant', 'wconvert') : __('Delete campaign', 'wconvert')}
            onSelect={() => onDecision('delete', trigger.current)} />
        </OptionGroup>
        {/* Upsells are grey with a lock (GUIDELINES §14): a line, not a dead item, because the route does not exist on this build. */}
        {/* Where "Create A/B test" would sit: one link row, last, with no feature icon (ADR 0147). */}
        {tests && !arm && availability === 'locked' && proHintsShown() && <OptionGroup><ProHintItem medium="campaign-menu" features={[__('A/B testing', 'wconvert')]} /></OptionGroup>}
        {upsell && (
          <OptionGroup heading={sprintf(/* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */ __('With %s', 'wconvert'), tierProductName(adminSettings()?.variants?.tier ?? undefined))} icon="lock">
            <OptionItem icon={Split} name={__('Create A/B test', 'wconvert')} />
          </OptionGroup>
        )}
      </OptionMenuContent>
    </DropdownMenu>
  );
}
