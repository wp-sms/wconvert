import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CalendarDays, Clock, ExternalLink, Inbox, LayoutTemplate, TextCursorInput, ListChecks, MapPin, MousePointerClick, Repeat, ShieldCheck, ShoppingBasket, Users } from 'lucide-react';
import type { Template } from '@renderer/types';
import { summaryOf, type AxisSummaries } from '../builder/rules/summaries';
import type { ConvertingAct } from '../builder/structure/catalogue';
import { nodeAt, nodesOf } from '../builder/structure/tree';
import type { Fact } from '../shell/FactList';

/** A said thing that may need a look: an unfinished rule, a destination problem. */
interface Said { readonly text: ReactNode; readonly attention?: boolean }

export interface CampaignFactsInput {
  readonly rules: AxisSummaries;
  /** Where, said better than the rule summary can: the pages by name, or where an inline form is placed. */
  readonly where?: Said;
  readonly act: ConvertingAct | undefined;
  /** Where its leads go, for a design that captures them. */
  readonly forwarding: { readonly said: ReactNode; readonly problems: readonly string[] };
  /** The design's link targets, for one that counts a click. */
  readonly links: readonly string[];
  /** What the Goal calls its number, e.g. “Quiz completions”, or null while unread. */
  readonly counts: string | null;
  /** How the campaign sits on the page, where that is more than its rules say. */
  readonly placement?: Said;
  /** The consent the form shows, where it captures and privacy is reviewed. */
  readonly consent?: Said;
  /** The fields a capturing design asks for, e.g. “Email address”. */
  readonly collects?: string;
  /** Makes each rule's answer a way to its section, where the host can go there. */
  readonly onRule?: (section: 'who' | 'where' | 'when' | 'how-often' | 'dates') => void;
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
export function campaignFacts({ rules, where, act, forwarding, links, counts, placement, consent, collects, onRule }: CampaignFactsInput): Fact[] {
  const rule = (key: 'who' | 'where' | 'when' | 'how-often' | 'dates'): Said => {
    const said = summaryOf(rules, key);
    return { text: onRule ? <button type="button" className="wconvert-readiness__go" onClick={() => onRule(key)}>{said.text}</button> : said.text, attention: said.attention };
  };
  const fact = (icon: Fact['icon'], label: string, said: Said): Fact =>
    ({ icon, label, text: said.text, tone: said.attention ? 'warning' : undefined });
  const counted = counts && <span className="block text-note text-muted-foreground">
    {/* translators: %s: what the Goal's number is called, e.g. “Quiz completions”. */ sprintf(__('Counts %s', 'wconvert'), counts)}
  </span>;
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
    facts.push({
      icon: Inbox,
      label: __('Leads go to', 'wconvert'),
      tone: forwarding.problems.length > 0 ? 'warning' : undefined,
      text: <>{forwarding.said}{forwarding.problems.map((problem) => <span key={problem} className="wconvert-facts__warning">{problem}</span>)}</>,
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
      text: <>{act === 'match' ? __('Shows a matching result', 'wconvert') : __('Adds to the basket', 'wconvert')}{counted}</>,
    });
  } else {
    facts.push({ icon: MousePointerClick, label: __('Visitor action', 'wconvert'), tone: 'warning', text: __('Choose what a visitor does in the editor.', 'wconvert') });
  }
  if (consent) facts.push(fact(ShieldCheck, __('Consent', 'wconvert'), consent));
  return facts;
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
