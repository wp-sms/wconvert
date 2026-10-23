import { useId } from 'react';
import { __, _x, sprintf } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { isShown, renderingFor, tierProductName } from '../goals/availability';
import { ProviderMark } from './ProviderMark';
import { ProHint } from '../shell/ProHint';
import { adminSettings } from '../settings';
import type { Destination, DestinationType } from './api';

/*
 * **The one provider picker** (ADR 0131). The Settings screen's Add dialog and
 * the campaign editor's both start a route here, so a service reads, suggests
 * and refuses the same way wherever it is chosen. It lives beside the routes
 * rather than in the builder because the Settings bundle may not reach into
 * the lazily loaded editor (`admin-split.test.ts`).
 */

/**
 * Which audience a save point needs, and how strictly.
 *
 * A **main** signup may also use a route that takes no audience at all — the
 * lead-magnet email delivers rather than subscribes — and refuses only one
 * that subscribes into the other channel. An **optional** signup exists to
 * subscribe its channel, so a route must take it. Publish enforces the same
 * line on the server (`OptinController`).
 */
export interface ChannelRule { readonly channel: string; readonly strict: boolean }

export const channels = (requirements: DestinationType['requirements'] | Destination['requirements']) => requirements?.audience_channels ?? [];

/** Why a route taking these channels cannot receive this save point, or null where it can. */
export function channelRefusal(accepted: readonly string[], rule: ChannelRule | null): string | null {
  if (rule === null || accepted.includes(rule.channel) || (!rule.strict && accepted.length === 0)) return null;
  return rule.channel === 'phone'
    ? __('Doesn’t take phone numbers.', 'wconvert')
    : __('Doesn’t take email addresses.', 'wconvert');
}

/** Why a provider cannot be chosen here, or null where it can. */
export function providerRefusal(type: DestinationType, rule: ChannelRule | null): string | null {
  const rendering = renderingFor(type.availability, 'settings_list');
  if (rendering === 'upsell') return sprintf(/* translators: %s: the product that supplies it, e.g. “WConvert Pro”. */ __('Included with %s.', 'wconvert'), tierProductName(type.tier));
  if (rendering !== 'offer') return sprintf(/* translators: %s: the plugin or platform it needs, e.g. “WP SMS”. */ __('Needs %s on this site.', 'wconvert'), type.requires_label ?? __('something this site does not have', 'wconvert'));
  return channelRefusal(channels(type.requirements), rule);
}

/**
 * The services Pro connects to that this site has no type for. Pro's types are
 * not registered on a free install, so their names come from `tiers.json`; a
 * type registered here (or shown locked) is not named twice.
 */
export function proDestinationNames(types: readonly DestinationType[]): readonly string[] {
  const here = new Set(types.filter((type) => type.availability !== 'locked').map((type) => type.label));
  const locked = types.filter((type) => type.availability === 'locked').map((type) => type.label);
  return [...new Set([...locked, ...(adminSettings()?.tiers?.pro?.destinations ?? [])])].filter((name) => !here.has(name));
}

/** The label Pro's webhook type registers under, as `tiers.json` names it. */
const WEBHOOK = 'Webhook';

/**
 * Pro's services as one phrase — "more integrations, like Mailchimp, Brevo
 * and webhooks" — rather than every label, which grew past a line (ADR 0147,
 * amended by ADR 0148). The first two named services are the examples, and
 * "webhooks" closes the list where Pro has the webhook. Null where there is
 * nothing to name.
 */
export function proDestinationSummary(names: readonly string[]): string | null {
  const examples = [...names.filter((name) => name !== WEBHOOK).slice(0, 2), ...(names.includes(WEBHOOK) ? [__('webhooks', 'wconvert')] : [])];
  if (examples.length === 0) return null;
  return sprintf(/* translators: %s: a few services, e.g. “Mailchimp, Brevo and webhooks”. */ __('more integrations, like %s', 'wconvert'), joinedWithAnd(examples));
}

/**
 * A plain list with "and", in the msgids `builder/rules/sentence.ts` already
 * has translated — spelled here rather than imported, because the Settings
 * bundle may not reach into the editor (`admin-split.test.ts`).
 */
function joinedWithAnd(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return sprintf(
    /* translators: 1: every item but the last, already joined. 2: the conjunction, “or” or “and”. 3: the last item. */
    _x('%1$s %2$s %3$s', 'joins the last item of a list', 'wconvert'),
    items.slice(0, -1).join(_x(', ', 'separates all but the last item of a list', 'wconvert')),
    _x('and', 'joins the last item of a plain list', 'wconvert'),
    items[items.length - 1],
  );
}

/**
 * The providers a merchant can set a new route up over, as tiles.
 *
 * A locked type on a free install is not drawn (ADR 0116); every other refusal
 * stays visible with its sentence, as `aria-disabled` rather than `disabled`,
 * so a keyboard reaches the reason too.
 */
export function ProviderTiles({ types, rule, suggested, onChoose }: {
  types: readonly DestinationType[];
  rule: ChannelRule | null;
  suggested: readonly string[];
  onChoose: (type: DestinationType, trigger: HTMLElement) => void;
}) {
  const id = useId();
  const shown = types.filter((type) => isShown(type.availability));
  if (shown.length === 0) return <p className="m-0 text-note text-muted-foreground">{__('No destination providers are available on this site.', 'wconvert')}</p>;
  return (<>
    <ul className="wconvert-provider-tiles" aria-label={__('Destination providers', 'wconvert')}>
      {shown.map((type) => {
        const refusal = providerRefusal(type, rule);
        const described = refusal !== null || suggested.includes(type.id);
        return (
          <li key={type.id}>
            <button type="button" className="wconvert-provider-tile" aria-disabled={refusal === null ? undefined : true}
              aria-describedby={described ? `${id}-${type.id}` : undefined}
              onClick={(event) => { if (refusal === null) onChoose(type, event.currentTarget); }}>
              <ProviderMark type={type} className="size-6 shrink-0" />
              <span className="min-w-0">
                <span className="block font-medium">{type.label}</span>
                {refusal !== null ? <span id={`${id}-${type.id}`} className="block text-note text-muted-foreground">{refusal}</span>
                  : suggested.includes(type.id) && <Badge id={`${id}-${type.id}`} variant="outline" className="mt-1">{__('Suggested', 'wconvert')}</Badge>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    {/* The providers this install lacks are not drawn as tiles; they are named once, below (ADR 0147). */}
    <ProHint medium="destinations" features={[proDestinationSummary(proDestinationNames(types))].filter((summary): summary is string => summary !== null)} />
  </>);
}
