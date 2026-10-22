import { __ } from '@wordpress/i18n';
import type { Template, TemplateNode, TemplateScreen, TemplateTree } from '@renderer/types';
import type { GoalEntry } from '../../goals/api';
import { contactWording, privacyLink, type ContactChannel } from './captureWording';
import { referencedJourney, submissionScreen, walkNodes } from './journey';
import { isRefusal, straightenedJourney } from './straighten';

/**
 * ============================================================================
 * ADD OR REMOVE THE CONTACT FORM WITHOUT CHANGING THE DESIGN (ADR 0163).
 * ============================================================================
 * One engine behind the Screens switch, ordinary edits and the gallery. It
 * converts a simple design between no form, an email form and a phone form,
 * and returns the new config, the Goal that now fits it and what changed, so
 * every way in shows the same box and one Undo takes all of it back.
 *
 * Goals are picked by their outcome, never by id (GoalParityTest).
 */

type Config = Readonly<Record<string, unknown>>;
type Node = Record<string, unknown>;

export type CaptureTarget = { readonly capture: ContactChannel } | { readonly capture: 'none'; readonly link?: { readonly label: string; readonly href: string } };

export interface ConversionContext {
  readonly goals: readonly GoalEntry[];
  /** The site's services, with the contact channels each takes, to name what stops. */
  readonly destinations?: readonly { readonly id: string; readonly label: string; readonly channels: readonly string[] }[];
  /** The design's `form_switch`; false where it has no room for a form. */
  readonly allowed?: boolean;
}

/** One thing a screen gains or loses, named the way the box says it. */
export type ChangeItem =
  | { readonly kind: 'field'; readonly label: string }
  | { readonly kind: 'consent' }
  | { readonly kind: 'button'; readonly label: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'link'; readonly label: string };

/** What the box lists. Data only; the box words it. */
export type Change =
  | { readonly kind: 'screen-gets'; readonly screen: string; readonly gets: readonly ChangeItem[]; readonly loses: readonly ChangeItem[] }
  | { readonly kind: 'new-screen'; readonly screen: string; readonly shows: readonly ChangeItem[] }
  | { readonly kind: 'field-swap'; readonly screen: string; readonly from: string; readonly to: string; readonly consent: string }
  | { readonly kind: 'removed-screens'; readonly screens: readonly { readonly name: string; readonly words: readonly string[] }[] }
  | { readonly kind: 'goal'; readonly from: string; readonly to: string; readonly outcome: GoalEntry['outcome']; readonly link: string | null }
  | { readonly kind: 'stops-sending'; readonly destinations: readonly string[]; readonly mappings: boolean }
  | { readonly kind: 'leads-stay' };

export interface Conversion {
  readonly config: Record<string, unknown>;
  readonly goal: string;
  readonly changes: readonly Change[];
}

export interface Refusal { readonly reason: string }

const LIST_KEYS = ['children', 'start', 'end'] as const;
const LAYOUTS = new Set(['stack', 'row', 'split', 'grid', 'panel', 'media']);

const isLayout = (node: TemplateNode) => LAYOUTS.has(node.type);
const isCountedLink = (node: TemplateNode) => node.type === 'button' && 'action' in node && node.action === 'link';
const text = (node: TemplateNode | undefined, key = 'text'): string => node ? String((node as unknown as Node)[key] ?? '') : '';

/**
 * The code and, when it sits in a small group of its own (a label and a styled
 * panel), that group: it moves as one so the thank-you screen reads like the
 * offer did.
 */
function codeGroupOf(root: TemplateNode): TemplateNode | null {
  const code = walkNodes(root).find(node => node.type === 'code');
  if (!code) return null;
  const parent = walkNodes(root).find(node => isLayout(node) && node !== root
    && LIST_KEYS.some(key => ((node as unknown as Node)[key] as TemplateNode[] | undefined)?.includes(code)));
  if (!parent) return code;
  const siblings = LIST_KEYS.flatMap(key => ((parent as unknown as Node)[key] as TemplateNode[] | undefined) ?? []);
  return siblings.every(node => node.type === 'code' || (node.type === 'text' && !['headline', 'body'].includes(text(node, 'role')))) ? parent : code;
}

/** Rebuild one node's lists, child by child. `each` returns what replaces the child. */
function mapLists(node: TemplateNode, each: (child: TemplateNode, parent: TemplateNode) => TemplateNode[]): TemplateNode {
  const copy = { ...node } as Node;
  for (const key of LIST_KEYS) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).flatMap(child => each(child, node));
  return copy as unknown as TemplateNode;
}

const withoutIds = (node: TemplateNode): TemplateNode => {
  const copy = { ...mapLists(node, child => [withoutIds(child)]) } as Node;
  delete copy.id;
  return copy as unknown as TemplateNode;
};

const emptyLayout = (node: TemplateNode) => isLayout(node) && LIST_KEYS.every(key => (((node as unknown as Node)[key] as unknown[] | undefined) ?? []).length === 0);

function freshId(tree: TemplateTree, base: string): string {
  let id = base, serial = 2;
  while (tree.steps.some(step => step.id === id)) id = `${base}-${serial++}`;
  return id;
}

/** The goal this design now fits: the current one when it still does (A6), else the one its outcome names. */
function goalFor(goals: readonly GoalEntry[], current: string, target: CaptureTarget, link: boolean): GoalEntry | undefined {
  const fits = (entry: GoalEntry) => {
    const outcome = entry.outcome;
    if (target.capture === 'none') return link ? outcome.action === 'click' && outcome.link_required : outcome.action === 'none';
    return outcome.action === 'submit' && outcome.destination_type === null && outcome.capture_any_of.includes(target.capture)
      && (outcome.audience_channel === null || outcome.audience_channel === target.capture);
  };
  const held = goals.find(entry => entry.id === current);
  if (held && fits(held)) return held;
  return goals.find(entry => fits(entry) && (target.capture === 'none' || entry.outcome.audience_channel === target.capture));
}

/** The offer screen becomes the form; a thank-you screen styled like it gets the code and the link (A1–A3). */
function addForm(tree: TemplateTree, channel: ContactChannel, consentShown: boolean, tokens: Readonly<Record<string, string>>) {
  const offer = tree.steps[0];
  const link = walkNodes(offer.content).find(isCountedLink);
  const group = codeGroupOf(offer.content);
  const code = group ? walkNodes(group).find(node => node.type === 'code') : undefined;
  const words = contactWording(channel);
  const label = code ? __('Get my code', 'wconvert') : __('Sign up', 'wconvert');

  // A design made without a form names no input colour, so the field takes
  // the card's own ground; its outline is the text colour, which reads on it.
  const field = { type: 'field', name: channel, required: true, label: words.label, placeholder: words.placeholder,
    ...(tokens['input-bg'] ? {} : { tokens: { border: 'fg' } }) } as TemplateNode;
  const consent = { type: 'consent', role: 'consent_text', text: words.consent, link: privacyLink(), hidden: !consentShown } as TemplateNode;
  const submit = { ...(link ?? { type: 'button' }), action: 'submit', submission: 'primary', label } as Node;
  delete submit.href;

  // The submit takes the link's place. Beside a row's button there is no room
  // for a sentence, so the consent goes after the row.
  let consentPlaced = false;
  const form = (node: TemplateNode): TemplateNode => mapLists(node, (child, parent) => {
    if (child === group) return [];
    if (child === link) {
      if (parent.type === 'row' && parent !== offer.content) return [field, submit as unknown as TemplateNode];
      consentPlaced = true;
      return [field, submit as unknown as TemplateNode, consent];
    }
    const rebuilt = form(child);
    if (!consentPlaced && walkNodes(child).includes(link as TemplateNode) && child.type === 'row') { consentPlaced = true; return [rebuilt, consent]; }
    return [rebuilt];
  });
  let content = form(offer.content);
  if (!link) {
    // Nothing to replace: the form follows the headline's words.
    const headline = walkNodes(offer.content).find(node => node.type === 'heading');
    const append = (node: TemplateNode): TemplateNode => {
      // Found by its id: `form` has already copied every layout above it.
      const holds = LIST_KEYS.find(key => ((node as unknown as Node)[key] as TemplateNode[] | undefined)?.some(child => child.type === 'heading' && text(child, 'id') === text(headline, 'id')));
      if (holds) return { ...node, [holds]: [...((node as unknown as Node)[holds] as TemplateNode[]), field, submit, consent] } as unknown as TemplateNode;
      return mapLists(node, child => [append(child)]);
    };
    const rootList = LIST_KEYS.find(key => Array.isArray((content as unknown as Node)[key]));
    content = headline ? append(content)
      : rootList ? { ...content, [rootList]: [...((content as unknown as Node)[rootList] as TemplateNode[]), field, submit, consent] } as unknown as TemplateNode
        : { type: 'stack', children: [content, field, submit, consent] } as unknown as TemplateNode;
  }

  // The thank-you screen is the offer's own layout, keeping its artwork, its
  // fine print and the code; the link stays as a success action that does not
  // count again (ADR 0080).
  // One headline says thanks; a second headline was the offer's and goes.
  let headlined = false;
  const thanks = (node: TemplateNode): TemplateNode[] => {
    if (node === group) return [node];
    if (isLayout(node)) {
      const kept = mapLists(node, child => thanks(child)) as unknown as Node;
      delete kept.id;
      // A rule only separates things: none at either end of a list, never two together.
      for (const key of LIST_KEYS) if (Array.isArray(kept[key])) {
        kept[key] = (kept[key] as TemplateNode[]).filter((child, at, list) => child.type !== 'divider'
          || (at > 0 && at < list.length - 1 && list[at - 1].type !== 'divider'));
      }
      // A layout painted with its own picture is artwork, even with nothing in it.
      const pictured = (child: TemplateNode) => isLayout(child) && !['', 'none'].includes(String(((child as unknown as Node).tokens as Record<string, unknown> | undefined)?.['bg-image'] ?? '').trim());
      const says = walkNodes(kept as unknown as TemplateNode).some(child => pictured(child) || (!isLayout(child) && !['divider', 'icon'].includes(child.type)));
      return says ? [kept as unknown as TemplateNode] : [];
    }
    if (node === link) {
      const action = { type: 'followup', role: 'success_action', label: text(node, 'label'), href: text(node, 'href') } as Node;
      for (const key of ['tokens', 'narrow']) if ((node as unknown as Node)[key]) action[key] = (node as unknown as Node)[key];
      return [action as unknown as TemplateNode];
    }
    if (node.type === 'heading' && text(node, 'role') === 'headline') {
      if (headlined) return [];
      headlined = true;
      // The offer's headline may be one giant number; thanks reads at the design's size.
      const headline = { ...withoutIds(node), role: 'success_headline', text: code ? __('Here’s your code', 'wconvert') : __('You’re in', 'wconvert') } as Node;
      for (const key of ['tokens', 'narrow']) {
        const bag = { ...(headline[key] as Record<string, string> | undefined) };
        delete bag['heading-size'];
        if (Object.keys(bag).length) headline[key] = bag; else delete headline[key];
      }
      delete headline.size;
      return [headline as unknown as TemplateNode];
    }
    if (['image', 'icon', 'divider'].includes(node.type) || (node.type === 'text' && text(node, 'role') === 'fine_print')) return [withoutIds(node)];
    return [];
  };
  const thanksContent = thanks(offer.content)[0] ?? { type: 'stack', children: [] } as TemplateNode;
  const screens: TemplateScreen[] = [
    { ...offer, kind: 'input', content },
    { id: freshId(tree, 'thanks'), name: __('Thanks', 'wconvert'), kind: 'acknowledgement', content: thanksContent },
  ];
  const next = referencedJourney({ ...tree, steps: screens, submissions: [{ id: 'primary', required: true, fields: [], consents: [] }] });
  const changes: Change[] = [
    { kind: 'screen-gets', screen: offer.name, gets: [{ kind: 'field', label: words.label }, { kind: 'consent' }, { kind: 'button', label }], loses: [] },
    { kind: 'new-screen', screen: next.steps[1].name, shows: [
      ...(code ? [{ kind: 'code', text: text(code) } as const] : []),
      ...(link ? [{ kind: 'link', label: text(link, 'label') } as const] : []),
    ] },
  ];
  return { tree: next, changes, link: link ? text(link, 'label') : null };
}

/** Form-owned nodes: they go with the form. */
const FORM_ACTIONS = new Set(['submit', 'skip', 'back', 'next']);
const formOwned = (node: TemplateNode) => node.type === 'field' || node.type === 'consent'
  || (node.type === 'button' && 'action' in node && FORM_ACTIONS.has(String(node.action)));
const same = (a: TemplateNode, b: TemplateNode) => JSON.stringify(withoutIds(a)) === JSON.stringify(withoutIds(b));

/**
 * The form screen becomes the offer: its words and artwork stay, the code and
 * the success link come back from the thank-you screen, and every other
 * screen goes (R1–R4). A no-form campaign is one screen.
 */
function removeForm(tree: TemplateTree, link: { readonly label: string; readonly href: string } | undefined) {
  const at = submissionScreen(tree, tree.submissions[0]?.id);
  // A form over several screens keeps its first: that is where its headline
  // and artwork are. An intro before it is a message, not the form, and goes.
  const first = tree.steps.findIndex((step, index) => index <= at && step.kind === 'input');
  const screen = tree.steps[first];
  const thanks = tree.steps.find(step => step.kind === 'acknowledgement');
  const followup = thanks ? walkNodes(thanks.content, false).find(node => node.type === 'followup') : undefined;
  const group = thanks ? codeGroupOf(thanks.content) : null;
  const code = group ? walkNodes(group).find(node => node.type === 'code') : undefined;
  const submitted = walkNodes(tree.steps[at].content).find(node => node.type === 'button' && 'action' in node && node.action === 'submit');
  // The button's place on the kept screen: its submit, or the Continue that led to it.
  const submit = first === at ? submitted
    : walkNodes(screen.content).find(node => node.type === 'button' && 'action' in node && node.action === 'next');

  // The counted link takes the submit's place, with the submit's look: the
  // success link it was turned into (ADR 0080), or the one the box offered.
  const kept = followup ? { label: text(followup, 'label'), href: text(followup, 'href') } : link;
  const button = submit && kept ? { ...(submitted as unknown as Node), action: 'link', label: kept.label, ...(kept.href ? { href: kept.href } : {}) } as Node : null;
  if (button) delete button.submission;
  // The code goes back where the thank-you screen shows it: before whatever
  // follows it there, found here by its words. Where nothing matches, it goes
  // in the submit's place, above the button.
  const moving = group && !walkNodes(screen.content).some(node => node.type === 'code') ? group : null;
  const siblings = moving ? walkNodes(thanks!.content).filter(isLayout)
    .flatMap(node => LIST_KEYS.map(key => ((node as unknown as Node)[key] as TemplateNode[] | undefined) ?? []))
    .find(list => list.includes(moving)) ?? [] : [];
  const after = moving ? siblings.slice(siblings.indexOf(moving) + 1) : [];
  const anchor = (candidate: TemplateNode) => after.some(next => next.type === 'followup' ? candidate === button : same(candidate, next));
  const anchored = !!moving && (after.some(next => next.type === 'followup') && button !== null
    || walkNodes(screen.content).some(node => node !== submit && !formOwned(node) && anchor(node)));

  // A row holds a button beside a field; the code goes above the row instead.
  const unplaced = moving && !anchored;
  const strip = (node: TemplateNode): TemplateNode => mapLists(node, (child, parent) => {
    if (child === submit) return [...(unplaced && parent.type !== 'row' ? [moving] : []), ...(button ? [button as unknown as TemplateNode] : [])];
    if (formOwned(child)) return [];
    const rebuilt = strip(child);
    const lead = unplaced && child.type === 'row' && walkNodes(child).includes(submit as TemplateNode) ? [moving] : [];
    return isLayout(child) && !emptyLayout(child) && emptyLayout(rebuilt) ? lead : [...lead, rebuilt];
  });
  let content = strip(screen.content);
  if (moving && anchored) {
    let placed = false;
    const place = (node: TemplateNode): TemplateNode => mapLists(node, child => {
      if (!placed && anchor(child)) { placed = true; return [moving, child]; }
      return [place(child)];
    });
    content = place(content);
  }

  const offer: TemplateScreen = { ...screen, kind: 'content', content };
  const next: TemplateTree = { ...tree, steps: [offer], submissions: [] };
  const shown = tree.steps.slice(first, at + 1).flatMap(step => walkNodes(step.content, false));
  const loses: ChangeItem[] = [
    ...shown.filter(node => node.type === 'field').map(node => ({ kind: 'field', label: text(node, 'label') } as const)),
    ...(shown.some(node => node.type === 'consent') ? [{ kind: 'consent' } as const] : []),
    ...(submitted ? [{ kind: 'button', label: text(submitted, 'label') } as const] : []),
  ];
  const others = tree.steps.filter(step => step !== screen);
  const changes: Change[] = [{ kind: 'screen-gets', screen: screen.name,
    gets: [...(code ? [{ kind: 'code', text: text(code) } as const] : []), ...(button ? [{ kind: 'link', label: text(button as unknown as TemplateNode, 'label') } as const] : [])],
    loses }];
  if (others.length > 0) changes.push({ kind: 'removed-screens', screens: others.map(step => ({ name: step.name,
    words: walkNodes(step.content, false).filter(node => node.type === 'heading' || node.type === 'text').map(node => text(node)).filter(Boolean) })) });
  return { tree: next, changes, link: button ? text(button as unknown as TemplateNode, 'label') : null };
}

/** What the main form asks for: nothing, a required email or phone, or something else. */
export function captureState(tree: TemplateTree): 'none' | 'email' | 'phone' | 'other' {
  const all = tree.steps.flatMap(step => walkNodes(step.content));
  const primary = tree.submissions[0];
  if (!primary) return all.some(node => node.type === 'field' || node.type === 'consent') || tree.steps.some(step => step.kind === 'result') ? 'other' : 'none';
  const fields = all.filter(node => node.type === 'field' && 'id' in node && primary.fields.includes(String(node.id)) && 'required' in node && node.required);
  const asks = (name: string) => fields.some(node => text(node, 'name') === name);
  return asks('email') ? 'email' : asks('phone') ? 'phone' : 'other';
}

/** The field and consent change channel; every screen and word stays (S1). */
function swapChannel(tree: TemplateTree, from: ContactChannel, to: ContactChannel, consentShown: boolean) {
  const primary = tree.submissions[0];
  const words = contactWording(to);
  let screen = '', before = '';
  const swap = (node: TemplateNode): TemplateNode => {
    const own = 'id' in node && typeof node.id === 'string';
    if (node.type === 'field' && own && primary.fields.includes(String(node.id)) && text(node, 'name') === from) {
      before = text(node, 'label');
      const field = { ...node, name: to, label: words.label, placeholder: words.placeholder } as Node;
      if (to === 'email') { delete field.phone_country; delete field.phone_dropdown; }
      return field as unknown as TemplateNode;
    }
    if (node.type === 'consent' && own && primary.consents[0] === node.id) {
      return { ...node, text: words.consent, link: privacyLink(), ...(consentShown ? { hidden: false } : {}) } as TemplateNode;
    }
    // A list always shows a consent (G4); a form that had none gets one after its field.
    return mapLists(node, child => {
      const swapped = swap(child);
      return addConsent && child.type === 'field' && swapped !== child
        ? [swapped, { type: 'consent', role: 'consent_text', text: words.consent, link: privacyLink(), hidden: false } as TemplateNode] : [swapped];
    });
  };
  const addConsent = consentShown && primary.consents.length === 0;
  const steps = tree.steps.map(step => {
    const content = swap(step.content);
    if (content !== step.content && before && !screen) screen = step.name;
    return { ...step, content };
  });
  return { tree: addConsent ? referencedJourney({ ...tree, steps }) : { ...tree, steps }, change: { kind: 'field-swap', screen, from: before, to: words.label, consent: words.consent } as Change };
}

/**
 * The tree as screens one after another, or null where it branches. A flow
 * whose every screen leads to at most one other is a straight campaign drawn
 * as a map, and converts as one (G2).
 */
function simpleShape(tree: TemplateTree): TemplateTree | null {
  if (tree.steps.some(step => step.when || step.paths?.length)) return null;
  if (!tree.graph) return tree;
  const edges = tree.graph.edges;
  if (edges.some(edge => edge.when) || tree.steps.some(step => edges.filter(edge => edge.from === step.id).length > 1)) return null;
  const straight = straightenedJourney(tree);
  return isRefusal(straight) || straight.steps.length !== tree.steps.length ? null : straight;
}

export type SwitchOffer = { readonly offered: true; readonly state: 'none' | ContactChannel } | { readonly offered: false; readonly reason: string };

/**
 * Whether this campaign can add, remove or change its contact form, or the
 * one plain line saying why not (G1, G2, A4). `allowed` is the design's own
 * `form_switch`, false where the template sweep found no room for a form.
 */
export function captureSwitch(config: Config, goal: string, goals: readonly GoalEntry[], allowed = true): SwitchOffer {
  const tree = (config.template as Template | undefined)?.tree;
  if (!tree || tree.steps.length === 0) return { offered: false, reason: __('Choose a design first.', 'wconvert') };
  const outcome = goals.find(entry => entry.id === goal)?.outcome;
  const all = tree.steps.flatMap(step => walkNodes(step.content));
  const refuse = (reason: string): SwitchOffer => ({ offered: false, reason });
  if (outcome?.action === 'match' || tree.steps.some(step => step.kind === 'result') || all.some(node => node.type === 'question')) {
    return refuse(__('Quizzes have their own result setting.', 'wconvert'));
  }
  if (outcome?.action === 'add_to_cart' || all.some(node => node.type === 'products')) return refuse(__('Product recommendations can’t take a contact form.', 'wconvert'));
  if (outcome?.destination_type) return refuse(__('A lead magnet needs the email form to deliver the file.', 'wconvert'));
  if (outcome?.action === 'click' && !outcome.link_required) return refuse(__('Cart recovery sends shoppers to their cart, so it has no form.', 'wconvert'));
  if (config.content_lock != null) return refuse(__('A content lock always needs its form.', 'wconvert'));
  if (!allowed) return refuse(__('This design has no room for a form. Choose another design to ask for details.', 'wconvert'));
  const flat = simpleShape(tree);
  if (!flat) return refuse(__('This campaign has branches. Edit its screens directly.', 'wconvert'));
  const state = captureState(flat);
  if (state === 'other') return refuse(__('This form asks for neither an email nor a phone number.', 'wconvert'));
  if (state === 'none' && flat.steps.length !== 1) return refuse(__('Only a one-screen design can take a form.', 'wconvert'));
  return { offered: true, state };
}

/** Every service any form here sends to, once each. */
function boundDestinations(config: Config): string[] {
  const settings = Object.values((config.submission_settings ?? {}) as Record<string, { destination_ids?: unknown }>);
  return [...new Set([
    ...(Array.isArray(config.destinations) ? config.destinations : []),
    ...settings.flatMap(setting => Array.isArray(setting?.destination_ids) ? setting.destination_ids : []),
  ].filter((id): id is string => typeof id === 'string' && id !== ''))];
}

export function convertCapture(draft: { readonly config: Config; readonly goal: string }, target: CaptureTarget, context: ConversionContext): Conversion | Refusal {
  const offer = captureSwitch(draft.config, draft.goal, context.goals, context.allowed);
  if (!offer.offered) return { reason: offer.reason };
  const held = draft.config.template as Template;
  // A simple flow converts as the straight campaign it draws (G2).
  const template = { ...held, tree: simpleShape(held.tree)! };
  const from = context.goals.find(entry => entry.id === draft.goal);
  const done = (tree: TemplateTree, goal: GoalEntry, changes: readonly Change[], link: string | null): Conversion => ({
    config: { ...draft.config, template: { ...template, tree } },
    goal: goal.id,
    changes: [...changes, ...(from && from.id !== goal.id ? [{ kind: 'goal', from: from.label, to: goal.label, outcome: goal.outcome, link } as const] : [])],
  });
  if (target.capture === 'none') {
    if (offer.state === 'none') return { reason: __('This campaign has no form.', 'wconvert') };
    const removed = removeForm(template.tree, target.link);
    const goal = goalFor(context.goals, draft.goal, target, removed.link !== null);
    if (!goal) return { reason: __('No goal fits this design.', 'wconvert') };
    // Nothing is captured, so nothing is sent: every route and mapping goes.
    // Saved Leads and their consent records are another table and stay (R5).
    const bound = boundDestinations(draft.config);
    const mappings = Object.values((draft.config.integration_mappings ?? {}) as Record<string, Record<string, Record<string, string>>>)
      .some(byDestination => Object.values(byDestination).some(mapping => Object.keys(mapping).length > 0));
    const result = done(removed.tree, goal, [...removed.changes,
      { kind: 'stops-sending', destinations: bound.map(id => context.destinations?.find(item => item.id === id)?.label ?? id), mappings },
      { kind: 'leads-stay' }], removed.link);
    const config = { ...result.config };
    for (const key of ['destinations', 'capture_mode', 'submission_settings', 'integration_mappings']) delete config[key];
    return { ...result, config };
  }
  const goal = goalFor(context.goals, draft.goal, target, false);
  if (!goal) return { reason: __('No goal fits this design.', 'wconvert') };
  const state = offer.state;
  if (state === 'email' || state === 'phone') {
    if (state === target.capture) return { reason: __('This form already asks for that.', 'wconvert') };
    const asked = template.tree.steps.flatMap(step => walkNodes(step.content)).some(node => node.type === 'field' && text(node, 'name') === target.capture);
    if (asked) return { reason: target.capture === 'phone'
      ? __('This campaign already asks for a phone number. Edit its screens directly.', 'wconvert')
      : __('This campaign already asks for an email address. Edit its screens directly.', 'wconvert') };
    const swapped = swapChannel(template.tree, state, target.capture, goal.outcome.audience_channel !== null);
    // A service that cannot take the new channel stops; the rest stay bound.
    const fits = (id: string) => context.destinations?.find(item => item.id === id)?.channels.includes(target.capture) ?? true;
    const dropped = boundDestinations(draft.config).filter(id => !fits(id));
    const keep = (ids: unknown) => (Array.isArray(ids) ? ids : []).filter(id => !dropped.includes(id));
    const maps = (draft.config.integration_mappings ?? {}) as Record<string, Record<string, unknown>>;
    const hadMappings = Object.values(maps).some(byDestination => dropped.some(id => id in byDestination));
    const result = done(swapped.tree, goal, [swapped.change], null);
    const config: Record<string, unknown> = { ...result.config };
    if (Array.isArray(draft.config.destinations)) config.destinations = keep(draft.config.destinations);
    if (draft.config.submission_settings) config.submission_settings = Object.fromEntries(Object.entries(draft.config.submission_settings as Record<string, Record<string, unknown>>)
      .map(([id, setting]) => [id, 'destination_ids' in setting ? { ...setting, destination_ids: keep(setting.destination_ids) } : setting]));
    if (draft.config.integration_mappings) config.integration_mappings = Object.fromEntries(Object.entries(maps)
      .map(([id, byDestination]) => [id, Object.fromEntries(Object.entries(byDestination).filter(([destination]) => !dropped.includes(destination)))]));
    return { ...result, config, changes: [...result.changes,
      ...(dropped.length ? [{ kind: 'stops-sending', destinations: dropped.map(id => context.destinations?.find(item => item.id === id)?.label ?? id), mappings: hadMappings } as const] : []),
      { kind: 'leads-stay' } as const] };
  }
  const added = addForm(template.tree, target.capture, goal.outcome.audience_channel !== null, template.tokens ?? {});
  return done(added.tree, goal, added.changes, added.link);
}
