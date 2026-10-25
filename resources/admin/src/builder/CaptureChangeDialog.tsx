import { useId, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowRight } from 'lucide-react';
import type { Template } from '@renderer/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { adminSettings } from '../settings';
import { listWithAnd } from './rules/sentence';
import { DesignStage } from '../stage/DesignStage';
import { captureState, type CaptureTarget, type Change, type ChangeItem, type Conversion, type NotConverted } from './structure/captureConversion';
import type { ContactChannel } from './structure/captureWording';
import { walkNodes } from './structure/journey';

/**
 * ============================================================================
 * THE ONE BOX EVERY WAY INTO THE FORM SWITCH SHOWS (ADR 0163).
 * ============================================================================
 * The Screens switch, deleting the form in the editor and the gallery all
 * open this before anything changes. It names what the screens gain and lose,
 * what the Goal becomes and which Destinations stop, from the engine's own
 * change list, and says once that Undo takes all of it back.
 *
 * `copy` makes a new draft for a Goal that cannot change; `preview` only
 * explains, for the gallery.
 */
export interface CaptureChangeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly before: Template;
  /** The campaign's format, so the screen tiles stand in its slot (ADR 0170). */
  readonly displayType: string;
  /** What was asked for. A channel the merchant may still change in `copy`. */
  readonly target: CaptureTarget;
  readonly convert: (target: CaptureTarget) => Conversion | NotConverted;
  readonly mode?: 'apply' | 'copy' | 'preview';
  /** The copy's name, in `copy`. */
  readonly copyName?: string;
  /** The campaign had a form before, so a new one starts from default wording. */
  readonly hadForm?: boolean;
  /** Resolves once applied or copied; a rejection stays in this box. */
  readonly onConfirm?: (result: Conversion) => Promise<void> | void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}

/** The consent sentence without its privacy-link placeholder. */
const sentence = (text: string) => text.replace(/\s*%s\s*$/u, '').trim();
const quoted = (text: string) => sprintf(/* translators: %s: words quoted from the design. */ __('“%s”', 'wconvert'), text);

function itemWords(item: ChangeItem): string {
  switch (item.kind) {
    /* translators: %s: a field's label, e.g. “Email address”. */
    case 'field': return sprintf(__('the “%s” field', 'wconvert'), item.label);
    case 'consent': return __('consent', 'wconvert');
    /* translators: %s: a button's label. */
    case 'button': return sprintf(__('the “%s” button', 'wconvert'), item.label);
    /* translators: %s: a discount code. */
    case 'code': return item.text.trim() ? sprintf(__('the code %s', 'wconvert'), item.text) : __('the code', 'wconvert');
    case 'link': return quoted(item.label);
  }
}

/** What the new Goal counts, in the merchant's words. */
function counts(change: Extract<Change, { kind: 'goal' }>): string {
  const outcome = change.outcome;
  if (outcome.action === 'none') return __('Only appearances are counted.', 'wconvert');
  if (outcome.action === 'click') return change.link
    ? sprintf(/* translators: %s: a button's label. */ __('Clicks on “%s” count.', 'wconvert'), change.link) : __('Clicks count.', 'wconvert');
  const signups = outcome.audience_channel === 'phone' ? __('Phone signups count.', 'wconvert')
    : outcome.audience_channel === 'email' ? __('Signups count.', 'wconvert') : __('Enquiries count.', 'wconvert');
  return change.link ? `${signups} ${sprintf(/* translators: %s: a button's label. */ __('Clicks on “%s” no longer count.', 'wconvert'), change.link)}` : signups;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/** The rows in the prototype's order: the screens, then the Goal, then where leads go. */
const SCREEN_ROWS: readonly Change['kind'][] = ['screen-changes', 'new-screen', 'removed-screens', 'field-swap'];
const LEAD_ROWS: readonly Change['kind'][] = ['stops-sending', 'leads-stay'];

/** For a swap: the list Goal now needs a Destination for its own channel. */
type SwapNote = string | null;

function changeRows(changes: readonly Change[], copy: boolean, swapNote: SwapNote = null): ReactNode[] {
  const leads = changes.some(change => change.kind === 'leads-stay');
  const stops = changes.some(change => change.kind === 'stops-sending');
  return changes.flatMap((change, at): ReactNode[] => {
    const screenLabel = (name: string) => sprintf(/* translators: %s: a screen's name, e.g. “Offer”. */ __('%s screen', 'wconvert'), name);
    switch (change.kind) {
      case 'screen-changes': {
        const gets = change.gets.length ? sprintf(/* translators: %s: a list of things, e.g. “the code FRIDAY25 and “Shop now””. */ __('Gets %s.', 'wconvert'), listWithAnd(change.gets.map(itemWords))) : '';
        const loses = change.loses.length ? sprintf(/* translators: %s: a list of things. */ __('Loses %s.', 'wconvert'), listWithAnd(change.loses.map(itemWords))) : '';
        return [<Row key={at} label={screenLabel(change.screen)}>{[gets, loses].filter(Boolean).join(' ')}
          <small>{__('Its artwork, headline and text stay.', 'wconvert')}</small></Row>];
      }
      case 'new-screen': return [<Row key={at} label={__('New screen', 'wconvert')}>
        {/* translators: %s: the new screen's name. */ sprintf(__('“%s”, styled like the offer.', 'wconvert'), change.screen)}
        {change.shows.length > 0 && ` ${sprintf(/* translators: %s: a list of things. */ __('It shows %s.', 'wconvert'), listWithAnd(change.shows.map(itemWords)))}`}</Row>];
      case 'removed-screens': return [<Row key={at} label={_n('Removed screen', 'Removed screens', change.screens.length, 'wconvert')}>
        <ul>{change.screens.map(screen => <li key={screen.name}>{screen.words.length
          ? sprintf(/* translators: 1: a screen's name. 2: its words, quoted. */ __('%1$s, with its words %2$s', 'wconvert'), quoted(screen.name), listWithAnd(screen.words.map(quoted)))
          : quoted(screen.name)}</li>)}</ul></Row>];
      case 'field-swap': return [<Row key={at} label={screenLabel(change.screen)}>
        {/* translators: 1: the old field's label. 2: the new one. */ sprintf(__('“%1$s” becomes “%2$s”.', 'wconvert'), change.from, change.to)}
        <small>{/* translators: %s: the new consent sentence. */ sprintf(__('The consent becomes “%s”', 'wconvert'), sentence(change.consent))}</small></Row>];
      case 'goal': return [<Row key={at} label={copy ? __('Goal of the copy', 'wconvert') : __('Goal', 'wconvert')}>
        {copy ? change.to : <span className="wconvert-capture-box__goal"><span>{change.from}</span><ArrowRight aria-hidden="true" size={14} className="rtl:-scale-x-100" /><span data-new>{change.to}</span></span>}
        <small>{counts(change)}</small></Row>];
      case 'stops-sending': return [<Row key={at} label={__('Stops sending to', 'wconvert')}>
        {change.destinations.length === 0 ? __('Nothing connected. Leads stayed in WConvert.', 'wconvert')
          : <ul>{change.destinations.map(name => <li key={name}>{name}</li>)}</ul>}
        {change.mappings && <small>{__('Their field mappings go too.', 'wconvert')}</small>}
        {swapNote ? <small>{swapNote}</small> : leads && <small>{__('Leads already saved and their consent records stay.', 'wconvert')}</small>}</Row>];
      case 'leads-stay': return stops ? [] : [<Row key={at} label={__('Leads', 'wconvert')}>{__('Leads already saved stay.', 'wconvert')}</Row>];
    }
  });
}

/** One screen, drawn small and inert. */
function ScreenTile({ template, displayType, step, caption }: { template: Template; displayType: string; step: number; caption: string }) {
  return <figure className="wconvert-capture-box__tile">
    <div className="wconvert-journey-card__preview" aria-hidden="true"><DesignStage size="thumb" displayType={displayType} step={step} source={{ live: { template } }} /></div>
    <figcaption><strong>{template.tree.steps[step].name}</strong><small>{caption}</small></figcaption>
  </figure>;
}

export function CaptureChangeDialog({ open, onOpenChange, before, displayType, target, convert, mode = 'apply', copyName, hadForm = false, onConfirm, returnFocusTo }: CaptureChangeDialogProps) {
  const offer = adminSettings()?.offerLink;
  const was = captureState(before.tree);
  const [channel, setChannel] = useState<ContactChannel>(target.capture === 'none' ? 'email' : target.capture);
  const [withLink, setWithLink] = useState(true);
  const [href, setHref] = useState(offer?.href ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hrefId = useId();
  const radioName = useId();

  // The box offers a "Shop now" button only where no link comes back on its own.
  const plain = useMemo(() => target.capture === 'none' ? convert({ capture: 'none' }) : null, [convert, target]);
  const needsLink = plain !== null && !('reason' in plain)
    && !plain.changes.some(change => change.kind === 'screen-changes' && change.gets.some(item => item.kind === 'link'));
  const linkHref = needsLink && withLink ? href.trim() : '';
  const effective = useMemo((): CaptureTarget => target.capture === 'none'
    ? (linkHref ? { capture: 'none', link: { label: __('Shop now', 'wconvert'), href: linkHref } } : { capture: 'none' })
    : mode === 'copy' && was === 'none' ? { capture: channel } : target, [target, linkHref, mode, was, channel]);
  const result = useMemo(() => convert(effective), [convert, effective]);

  const adding = was === 'none';
  const removing = effective.capture === 'none';
  const signups = before.tree.submissions.length;
  const copy = mode === 'copy';
  const title = copy ? (adding ? __('Make a signup copy', 'wconvert') : __('Make an offer copy', 'wconvert'))
    : adding ? (channel === 'phone' ? __('Add a phone form?', 'wconvert') : __('Add an email form?', 'wconvert'))
      : removing ? (signups > 1 ? __('Remove both signups?', 'wconvert') : was === 'phone' ? __('Remove the phone form?', 'wconvert') : __('Remove the email form?', 'wconvert'))
        : effective.capture === 'phone' ? __('Ask for a phone number instead?', 'wconvert') : __('Ask for an email address instead?', 'wconvert');
  const code = before.tree.steps.some(screen => walkNodes(screen.content).some(node => node.type === 'code'));
  const meta = copy ? __('The original keeps its published version and all its results.', 'wconvert')
    : adding ? (code ? __('Visitors sign up first, then see the code.', 'wconvert') : __('Visitors sign up first, then see the thank-you screen.', 'wconvert'))
      : removing ? (before.tree.steps.length > 2
        ? sprintf(/* translators: %d: how many screens go. */ _n('A campaign without a form is one screen, so %d screen goes.', 'A campaign without a form is one screen, so %d screens go.', before.tree.steps.length - 1, 'wconvert'), before.tree.steps.length - 1)
        : code ? __('Visitors see the offer and the code straight away.', 'wconvert') : __('Visitors see the offer straight away.', 'wconvert'))
        : __('The screens stay the same. Only the field and its consent change.', 'wconvert');
  const confirmLabel = copy ? (adding ? __('Create signup copy', 'wconvert') : __('Create offer copy', 'wconvert'))
    : adding ? (channel === 'phone' ? __('Add phone form', 'wconvert') : __('Add email form', 'wconvert'))
      : removing ? (signups > 1 ? __('Remove both', 'wconvert') : __('Remove form', 'wconvert'))
        : effective.capture === 'phone' ? __('Ask for phone', 'wconvert') : __('Ask for email', 'wconvert');

  // A ticked button needs somewhere to go; the box will not quietly drop it.
  const missingLink = needsLink && withLink && href.trim() === '';
  const close = (next: boolean) => { if (!saving) onOpenChange(next); };
  const confirm = () => {
    if ('reason' in result || !onConfirm) return;
    setSaving(true); setError(null);
    Promise.resolve(onConfirm(result))
      .then(() => { setSaving(false); onOpenChange(false); })
      .catch((cause: unknown) => { setSaving(false); setError(cause instanceof Error ? cause.message : String(cause)); });
  };

  const after = 'reason' in result ? null : (result.config.template as Template);
  const changes = 'reason' in result ? [] : result.changes;
  const goalRow = changes.filter(change => change.kind === 'goal');
  const screenRows = changes.filter(change => SCREEN_ROWS.includes(change.kind));
  const leadRows = changes.filter(change => LEAD_ROWS.includes(change.kind));
  const swapped = !adding && !removing ? goalRow.find(change => change.kind === 'goal')?.outcome.audience_channel ?? null : null;
  const swapNote = swapped === 'phone' ? __('Choose an SMS destination before publishing. Leads already saved stay.', 'wconvert')
    : swapped === 'email' ? __('Choose an email destination before publishing. Leads already saved stay.', 'wconvert') : null;
  const kept = after?.tree.steps[0]?.id;

  return <AdminDialog open={open} onOpenChange={close}>
    <AdminDialogContent size="md" showCloseButton={!saving} onCloseAutoFocus={returnFocusTo ? event => { event.preventDefault(); returnFocusTo.current?.focus(); } : undefined}>
      <AdminDialogHeader title={title} meta={meta} />
      <AdminDialogBody className="wconvert-capture-box">
        {copy && adding && <div className="wconvert-capture-box__choice" role="radiogroup" aria-label={__('What the copy asks for', 'wconvert')}>
          {(['email', 'phone'] as const).map(value => <label key={value} data-checked={channel === value || undefined}>
            <input type="radio" name={radioName} checked={channel === value} onChange={() => setChannel(value)} />
            {value === 'email' ? __('Ask for email', 'wconvert') : __('Ask for phone', 'wconvert')}</label>)}
        </div>}
        {'reason' in result ? <p role="alert">{result.reason}</p> : <>
          {/* Before and after, drawn small, for every change the box describes, copies included. */}
          {after && <div className="wconvert-capture-box__tiles" aria-hidden="true">
            {before.tree.steps.map((screen, index) => <ScreenTile key={screen.id} template={before} displayType={displayType} step={index}
              caption={adding ? __('Now', 'wconvert') : !removing ? (index === 0 ? __('Now', 'wconvert') : __('Stays', 'wconvert'))
                : screen.id !== kept ? __('Removed', 'wconvert') : index === 0 ? __('With the form', 'wconvert') : __('Becomes the offer', 'wconvert')} />)}
            <ArrowRight aria-hidden="true" className="wconvert-capture-box__arrow rtl:-scale-x-100" />
            {after.tree.steps.map((screen, index) => <ScreenTile key={screen.id} template={after} displayType={displayType} step={index}
              caption={removing ? __('One screen', 'wconvert') : !adding ? (index === 0
                ? (effective.capture === 'phone' ? __('Phone field', 'wconvert') : __('Email field', 'wconvert')) : __('Stays', 'wconvert'))
                : index === 0 ? __('With the form', 'wconvert') : __('New screen', 'wconvert')} />)}
          </div>}
          <dl className="wconvert-capture-box__rows">
            {copy && <Row label={__('New draft', 'wconvert')}>{quoted(copyName ?? '')}
              <small>{__('Same design, display rules and placement. Its results start at zero.', 'wconvert')}</small></Row>}
            {changeRows(screenRows, copy)}
            {!needsLink && changeRows(goalRow, copy)}
            {changeRows(leadRows, copy, swapNote)}
            {adding && <Row label={__('Where leads go', 'wconvert')}>{__('Kept in WConvert. You can add a service in Destinations.', 'wconvert')}</Row>}
            {copy && <Row label={__('Original', 'wconvert')}>{__('Stays live, unchanged.', 'wconvert')}</Row>}
          </dl>
          {needsLink && <div className="wconvert-capture-box__link">
            <label><input type="checkbox" checked={withLink} onChange={event => setWithLink(event.target.checked)} />
              <strong>{__('Add a “Shop now” button', 'wconvert')}</strong></label>
            {withLink && <div><label htmlFor={hrefId}>{__('Link', 'wconvert')}</label>
              <Input id={hrefId} type="url" dir="ltr" value={href} onChange={event => setHref(event.target.value)} />
              <small>{offer?.place === 'home' ? __('Your home page. Change it if the offer lives somewhere else.', 'wconvert')
                : __('Your shop page. Change it if the offer lives somewhere else.', 'wconvert')}</small>
              {missingLink && <small role="alert">{__('Add a link, or untick the button.', 'wconvert')}</small>}</div>}
          </div>}
          {needsLink && <dl className="wconvert-capture-box__rows">{changeRows(goalRow, copy)}</dl>}
          {hadForm && adding && !copy && <p className="wconvert-capture-box__note">{__('This campaign had a form before. A new one is built, so earlier changes to its wording come back only with Undo.', 'wconvert')}</p>}
        </>}
      </AdminDialogBody>
      <AdminDialogFooter note={mode === 'preview' ? undefined : copy ? __('Nothing is published automatically.', 'wconvert') : __('Undo reverts all of this.', 'wconvert')} error={error}>
        <Button type="button" variant="outline" disabled={saving} onClick={() => close(false)}>{mode === 'preview' ? __('Done', 'wconvert') : __('Cancel', 'wconvert')}</Button>
        {mode !== 'preview' && <Button type="button" disabled={saving || 'reason' in result || missingLink} onClick={confirm}>{confirmLabel}</Button>}
      </AdminDialogFooter>
    </AdminDialogContent>
  </AdminDialog>;
}
