import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CalendarDays, Clock, ExternalLink, Inbox, LayoutTemplate, TextCursorInput, ListChecks, MapPin, Megaphone, MousePointerClick, Repeat, ShieldCheck, ShoppingBasket, Users } from 'lucide-react';
import type { Template } from '@renderer/types';
import { summaryOf, type AxisSummaries } from '../builder/rules/summaries';
import type { ConvertingAct } from '../builder/structure/catalogue';
import { convertingActOf } from '../builder/structure/guards';
import { countsNothing } from '../goals/countsNothing';
import { nodeAt, nodesOf } from '../builder/structure/tree';
import type { DisplayRulesValue } from '../builder/rules/summaries';
import type { CaptureMode } from '../builder/captureMode';
import { Badge } from '../components/ui/badge';
import type { Fact } from '../shell/FactList';

/** A How it runs row that can still hold WConvert's starting setting. */
export type DefaultRow = 'who' | 'where' | 'when' | 'how-often' | 'leads';

/** A said thing that may need a look: an unfinished rule, a destination problem. */
interface Said { readonly text: ReactNode; readonly attention?: boolean; readonly isDefault?: boolean }

export interface CampaignFactsInput {
  readonly rules: AxisSummaries;
  /** Where, said better than the rule summary can: the pages by name, or where an inline form is placed. */
  readonly where?: Said;
  /** `none` is a message under a Goal that counts nothing ({@link factAct}). */
  readonly act: ConvertingAct | 'none' | undefined;
  /** Where its leads go, for a design that captures them. */
  readonly forwarding: { readonly said: ReactNode; readonly problems: readonly string[] };
  /** The design's link targets, for one that counts a click. */
  readonly links: readonly string[];
  /** How the campaign sits on the page, where that is more than its rules say. */
  readonly placement?: Said;
  /** The consent the form shows, where it captures and privacy is reviewed. */
  readonly consent?: Said;
  /** The fields a capturing design asks for, e.g. “Email address”. */
  readonly collects?: string;
  /** Makes each rule's answer a way to its section, where the host can go there. */
  readonly onRule?: (section: 'who' | 'where' | 'when' | 'how-often' | 'dates') => void;
  /** Makes "Leads go to" a way to the Destinations tab, where the host can go there. */
  readonly onDestinations?: () => void;
  /**
   * The rows still on WConvert's starting setting ({@link defaultRows}), each
   * tagged “Default”. Only Review & publish passes it; Campaign details does not.
   */
  readonly defaults?: ReadonlySet<DefaultRow>;
}

/**
 * The rows whose value is still WConvert's plain starting setting — the one
 * "Start from scratch" writes (`DisplayPlan::immediate()`, `Prefill::fromScratch()`)
 * and the one `captureModeOf` reads with no service chosen.
 *
 * A neutral fact about the value, not a record of whether anyone looked: a
 * Playbook's own rules are tagged only where they equal it. "Leads go to" is
 * tagged only where the install has another place to send them (`outbound`):
 * on Free, outbound Destinations are Pro, so the tag would only nag.
 */
export function defaultRows(value: DisplayRulesValue, captureMode: CaptureMode, outbound: boolean): Set<DefaultRow> {
  const rows = new Set<DefaultRow>();
  const { display_rules: plan, targeting, frequency } = value;
  if (plan?.audience.mode === 'everyone' && targeting.logged_in === undefined && (targeting.roles ?? []).length === 0) rows.add('who');
  if (targeting.mode !== 'selected' && (targeting.include ?? []).length === 0 && (targeting.exclude ?? []).length === 0) rows.add('where');
  if (plan?.opening.mode === 'immediate') rows.add('when');
  if (frequency.maxPerSession === 1 && frequency.stopAfterDismiss === false && frequency.maxImpressions === undefined
    && frequency.cooldownDays === undefined && frequency.stopAfterConversion !== false) rows.add('how-often');
  if (outbound && captureMode === 'local') rows.add('leads');
  return rows;
}

/** The muted tag beside a value still on its starting setting. */
function DefaultTag() {
  return <Badge variant="outline" className="wconvert-facts__default">{__('Default', 'wconvert')}</Badge>;
}

/**
 * **How it runs** — the one fact list Review & publish and Campaign details
 * both read (ADR 0138), so one campaign is never described two ways.
 *
 * Who, Where, Opens, How often and Runs come from the rule summaries; the last
 * line says what the visitor does: where leads go, where links point, or the
 * act a quiz or basket design counts. Only a design with no converting act at
 * all reads as unfinished.
 */
export function campaignFacts({ rules, where, act, forwarding, links, placement, consent, collects, onRule, onDestinations, defaults }: CampaignFactsInput): Fact[] {
  const tagged = (text: ReactNode, isDefault: boolean): ReactNode => isDefault ? <>{text} <DefaultTag /></> : text;
  const rule = (key: 'who' | 'where' | 'when' | 'how-often' | 'dates'): Said => {
    const said = summaryOf(rules, key);
    const text = onRule ? <button type="button" className="wconvert-readiness__go" onClick={() => onRule(key)}>{said.text}</button> : said.text;
    // A row that needs a look reads its problem, never a tag beside it.
    const isDefault = key !== 'dates' && !said.attention && defaults?.has(key) === true;
    return { text: tagged(text, isDefault), attention: said.attention, isDefault };
  };
  const fact = (icon: Fact['icon'], label: string, said: Said): Fact =>
    ({ icon, label, text: said.text, tone: said.attention ? 'warning' : undefined, ...(said.isDefault ? { isDefault: true } : {}) });
  const leadsSaid = onDestinations
    ? <button type="button" className="wconvert-readiness__go" onClick={onDestinations}>{forwarding.said}</button>
    : forwarding.said;
  const facts: Fact[] = [
    fact(Users, __('Who', 'wconvert'), rule('who')),
    fact(MapPin, __('Where', 'wconvert'), where ?? rule('where')),
    ...(placement ? [fact(LayoutTemplate, __('Placement', 'wconvert'), placement)] : []),
    fact(Clock, __('Opens', 'wconvert'), rule('when')),
    fact(Repeat, __('How often', 'wconvert'), rule('how-often')),
    fact(CalendarDays, __('Runs', 'wconvert'), rule('dates')),
  ];
  if (act === 'submit') {
    if (collects) facts.push({ icon: TextCursorInput, label: __('Collects', 'wconvert'), text: collects });
    const leadsDefault = defaults?.has('leads') === true;
    facts.push({
      icon: Inbox,
      label: __('Leads go to', 'wconvert'),
      tone: forwarding.problems.length > 0 ? 'warning' : undefined,
      ...(leadsDefault ? { isDefault: true } : {}),
      text: <>{tagged(leadsSaid, leadsDefault)}{forwarding.problems.map((problem) => <span key={problem} className="wconvert-facts__warning">{problem}</span>)}</>,
    });
  } else if (act === 'click') {
    facts.push({
      icon: ExternalLink,
      label: __('Visitors go to', 'wconvert'),
      text: <>
        {links.length > 0
          ? <ul className="wconvert-facts__links">{links.map((link) => <li key={link} dir="ltr">{link}</li>)}</ul>
          // Product cards and other designed links carry no button href to list.
          : __('Where its links point', 'wconvert')}
        <span className="block text-note text-muted-foreground">{__('Counts the click. No lead is saved.', 'wconvert')}</span>
      </>,
    });
  } else if (act === 'match' || act === 'add_to_cart') {
    facts.push({
      icon: act === 'match' ? ListChecks : ShoppingBasket,
      label: __('Visitor action', 'wconvert'),
      text: actWords(act),
    });
  } else if (act === 'none') {
    facts.push({ icon: Megaphone, label: __('Visitor action', 'wconvert'), text: __('Reads the message', 'wconvert') });
  } else {
    facts.push({ icon: MousePointerClick, label: __('Visitor action', 'wconvert'), tone: 'warning', text: __('Choose what a visitor does in the editor.', 'wconvert') });
  }
  if (consent) facts.push(fact(ShieldCheck, __('Consent', 'wconvert'), consent));
  return facts;
}

/** What a visitor does to convert, in the words every fact list uses for it (#375). */
export function actWords(act: ConvertingAct): string {
  switch (act) {
    case 'submit': return __('Submits a form', 'wconvert');
    case 'click': return __('Follows a link', 'wconvert');
    case 'match': return __('Shows a matching result', 'wconvert');
    case 'add_to_cart': return __('Adds to the basket', 'wconvert');
  }
}

/** The act a design offers; a design offering none is a message when its Goal counts nothing (ADR 0163). */
export function factAct(template: Template | undefined, outcome: { readonly action: string } | undefined): ConvertingAct | 'none' | undefined {
  if (!template || template.tree.steps.length === 0) return undefined;
  return convertingActOf(template.tree)[0] ?? (countsNothing(outcome) ? 'none' : undefined);
}

/** The distinct targets of a design's link buttons. */
export function linksIn(template: Template | undefined): string[] {
  if (!template) return [];
  const links = nodesOf(template.tree).flatMap((block) => {
    const node = nodeAt(template.tree, block.path);
    return node?.type === 'button' && 'action' in node && node.action === 'link' && 'href' in node && typeof node.href === 'string' && node.href ? [node.href] : [];
  });
  return [...new Set(links)];
}
