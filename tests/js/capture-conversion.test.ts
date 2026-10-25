import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Template, TemplateNode, TemplateTree } from '@renderer/types';
import { captureSwitch, convertCapture, type Conversion } from '../../resources/admin/src/builder/structure/captureConversion';
import { upgradeToGraph } from '../../resources/admin/src/builder/structure/graph';
import { walkNodes } from '../../resources/admin/src/builder/structure/journey';
import { GOALS } from './support/goals';
import { consentShown, freeDesign } from './support/designs';

const design = freeDesign;
const nodes = (tree: TemplateTree, at: number): TemplateNode[] => walkNodes(tree.steps[at].content);
const ofType = (tree: TemplateTree, at: number, type: string) => nodes(tree, at).filter(node => node.type === type) as unknown as Record<string, unknown>[];
/** A library design as the editor holds it: its link button already points somewhere. */
const offer = (id: string, href = 'https://shop.test/sale'): Record<string, unknown> => {
  const template = design(id);
  const linked = JSON.parse(JSON.stringify(template.tree).replace('"action":"link"', `"action":"link","href":"${href}"`));
  return { template_id: id, template: { tokens: template.tokens, tree: linked } };
};
const converted = (result: ReturnType<typeof convertCapture>): Conversion => {
  if ('reason' in result) throw new Error(result.reason);
  return result;
};
const treeOf = (result: Conversion) => (result.config.template as Template).tree;

describe('adding a form to an offer', () => {
  it('keeps the coupon amount on the offer and uses readable acknowledgement type', () => {
    const template = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../pro/modules/display-types/templates/campaign-extra-ten-coupon.json'), 'utf8')) as Template;
    const result = converted(convertCapture({ config: { template_id: 'campaign-extra-ten-coupon', template }, goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(ofType(treeOf(result), 0, 'heading')).toMatchObject([{ role: 'offer_amount', text: '10%' }]);
    expect(ofType(treeOf(result), 1, 'heading')).toMatchObject([{ role: 'success_headline', text: 'Here’s your code', tokens: { 'heading-size': '32px' }, narrow: { 'heading-size': '32px' } }]);
  });

  it('turns the offer into the form and moves the code and link to a new thank-you screen (A1)', () => {
    const result = converted(convertCapture({ config: offer('offer-receipt'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    const tree = treeOf(result);

    expect(result.goal).toBe('grow_email_list');
    expect(tree.steps.map(step => step.kind)).toEqual(['input', 'acknowledgement']);
    expect(ofType(tree, 0, 'field')).toMatchObject([{ name: 'email', required: true, label: 'Email address' }]);
    expect(ofType(tree, 0, 'consent')).toMatchObject([{ hidden: false }]);
    expect(ofType(tree, 0, 'button')).toMatchObject([{ action: 'submit', submission: 'primary', label: 'Get my code' }]);
    expect(ofType(tree, 0, 'code')).toEqual([]);
    // The merchant's own words stay on the form screen.
    expect(ofType(tree, 0, 'heading')).toMatchObject([{ text: '10% off', role: 'headline' }]);
    expect(ofType(tree, 1, 'code')).toMatchObject([{ text: 'WELCOME10' }]);
    expect(ofType(tree, 1, 'followup')).toMatchObject([{ label: 'Find your first piece', href: 'https://shop.test/sale' }]);
    expect(ofType(tree, 1, 'heading')).toMatchObject([{ role: 'success_headline', text: 'Here’s your code' }]);
    expect(ofType(tree, 1, 'button')).toEqual([]);
    expect(tree.submissions).toEqual([{ id: 'primary', required: true, fields: [ofType(tree, 0, 'field')[0].id], consents: [ofType(tree, 0, 'consent')[0].id] }]);
  });
});

/** Ids are the only thing a round trip may change. */
const idless = (value: unknown): unknown => Array.isArray(value) ? value.map(idless)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').map(([key, item]) => [key, idless(item)])) : value;

describe('removing the form', () => {
  it.each(['offer-receipt', 'inline-cta', 'flash-offer'])('returns %s exactly as it was, apart from ids (H2)', (id) => {
    const start = offer(id);
    const signup = converted(convertCapture({ config: start, goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    const back = converted(convertCapture({ config: signup.config, goal: signup.goal }, { capture: 'none' }, { goals: GOALS }));

    expect(back.goal).toBe('promote_offer');
    expect(idless(treeOf(back).steps)).toEqual(idless((start.template as Template).tree.steps));
    expect(treeOf(back).submissions).toEqual([]);
  });
});

describe('removing a form with no link to carry back (R2)', () => {
  const signup = () => ({ template_id: 'centred-card', template: design('centred-card') });

  it('shows a message when no button is added', () => {
    const result = converted(convertCapture({ config: signup(), goal: 'grow_email_list' }, { capture: 'none' }, { goals: GOALS }));
    const tree = treeOf(result);
    expect(result.goal).toBe('show_message');
    expect(tree.steps).toHaveLength(1);
    expect(tree.steps[0].kind).toBe('content');
    expect(ofType(tree, 0, 'button')).toEqual([]);
    expect(ofType(tree, 0, 'field')).toEqual([]);
    // The merchant's words stay word for word.
    expect(ofType(tree, 0, 'heading')).toMatchObject([{ text: 'Five good reads. Every Friday.' }]);
    expect(ofType(tree, 0, 'text').map(node => node.text)).toEqual(['A short selection of stories worth your time. Free, once a week.', 'One email each Friday. Unsubscribe any time.']);
  });

  it('counts clicks on the Shop now button the box adds', () => {
    const result = converted(convertCapture({ config: signup(), goal: 'grow_email_list' }, { capture: 'none', link: { label: 'Shop now', href: 'https://shop.test/shop/' } }, { goals: GOALS }));
    expect(result.goal).toBe('promote_offer');
    expect(ofType(treeOf(result), 0, 'button')).toMatchObject([{ action: 'link', label: 'Shop now', href: 'https://shop.test/shop/' }]);
    expect(ofType(treeOf(result), 0, 'button')[0]).not.toHaveProperty('submission');
  });
});

describe('removing every form from a longer campaign (R3–R5)', () => {
  const DESTINATIONS = [
    { id: 'mc', label: 'Mailchimp · Newsletter', channels: ['email'] },
    { id: 'wsms', label: 'WP SMS · Coffee texts', channels: ['phone'] },
  ];
  const journey = () => {
    const template = consentShown(design('journey-email-then-sms'));
    const intro = { id: 'intro', name: 'Intro', kind: 'content', content: { type: 'stack', children: [
      { type: 'heading', id: 'i1', role: 'headline', text: 'Wait! Before you go…' },
      { type: 'button', id: 'i2', role: 'next_label', label: 'Continue', action: 'next' },
    ] } };
    return { template_id: 'journey-email-then-sms', template: { ...template, tree: { ...template.tree, steps: [intro, ...template.tree.steps] } },
      destinations: ['mc'], capture_mode: 'connected',
      submission_settings: { 'sms-signup': { destination_ids: ['wsms'] } },
      integration_mappings: { 'email-signup': { mc: { 'field:interest': 'INTEREST' } } } };
  };

  it('keeps the signup screen as the offer and names every screen, service and mapping that goes', () => {
    const result = converted(convertCapture({ config: journey(), goal: 'grow_email_list' }, { capture: 'none' }, { goals: GOALS, destinations: DESTINATIONS }));

    expect(treeOf(result).steps.map(step => step.name)).toEqual(['Email signup']);
    expect(treeOf(result).steps[0].kind).toBe('content');
    expect(result.config).not.toHaveProperty('destinations');
    expect(result.config).not.toHaveProperty('capture_mode');
    expect(result.config).not.toHaveProperty('submission_settings');
    expect(result.config).not.toHaveProperty('integration_mappings');
    expect(result.changes).toContainEqual({ kind: 'screen-changes', screen: 'Email signup', gets: [],
      loses: [{ kind: 'field', label: 'Email address' }, { kind: 'consent' }, { kind: 'button', label: 'Sign up for email' }] });
    expect(result.changes).toContainEqual({ kind: 'removed-screens', screens: [
      { name: 'Intro', words: ['Wait! Before you go…'] },
      { name: 'Optional SMS signup', words: ['Would you also like text updates?', 'Your email signup request was received. This next step is optional.'] },
      { name: 'Acknowledgement', words: ['Details received', 'Thank you. We have received the details you submitted.'] },
    ] });
    expect(result.changes).toContainEqual({ kind: 'stops-sending', destinations: ['Mailchimp · Newsletter', 'WP SMS · Coffee texts'], mappings: true });
    expect(result.changes).toContainEqual({ kind: 'leads-stay' });
  });
});

describe('adding a form to a message (A2, A3)', () => {
  /** A message: the design with its counted link taken out, as prefill leaves it. */
  const message = () => {
    const template = design('inline-cta');
    const tree = JSON.parse(JSON.stringify(template.tree).replace(/,\{"type":"button"[^}]*"action":"link"\}/u, '').replace(/\{"type":"button"[^}]*"action":"link"\},?/u, ''));
    return { template_id: 'inline-cta', template: { ...template, tree } };
  };

  it('asks to sign up, says “You’re in” after, and counts the signups', () => {
    expect(walkNodes(message().template.tree.steps[0].content).some(node => node.type === 'button')).toBe(false);
    const result = converted(convertCapture({ config: message(), goal: 'show_message' }, { capture: 'email' }, { goals: GOALS }));
    const tree = treeOf(result);

    expect(result.goal).toBe('grow_email_list');
    expect(ofType(tree, 0, 'button')).toMatchObject([{ action: 'submit', label: 'Sign up' }]);
    expect(ofType(tree, 0, 'field')).toHaveLength(1);
    expect(ofType(tree, 1, 'heading')).toMatchObject([{ text: 'You’re in', role: 'success_headline' }]);
    expect(ofType(tree, 1, 'followup')).toEqual([]);
    // And back to the same message.
    const back = converted(convertCapture({ config: result.config, goal: result.goal }, { capture: 'none' }, { goals: GOALS }));
    expect(back.goal).toBe('show_message');
    expect(idless(treeOf(back).steps)).toEqual(idless(message().template.tree.steps));
  });
});

describe('which goal a new form serves', () => {
  it('asks for a phone number with SMS consent and grows the SMS list (A5)', () => {
    const result = converted(convertCapture({ config: offer('offer-receipt'), goal: 'promote_offer' }, { capture: 'phone' }, { goals: GOALS }));
    expect(result.goal).toBe('grow_sms_list');
    expect(ofType(treeOf(result), 0, 'field')).toMatchObject([{ name: 'phone', label: 'Phone number', required: true }]);
    expect(ofType(treeOf(result), 0, 'consent')).toMatchObject([{ hidden: false, text: 'Text me offers and news. Reply STOP to opt out. %s' }]);
  });

  it('keeps a goal the form already fits, such as enquiries (A6)', () => {
    const result = converted(convertCapture({ config: offer('offer-panel'), goal: 'collect_enquiries' }, { capture: 'email' }, { goals: GOALS }));
    expect(result.goal).toBe('collect_enquiries');
    expect(result.changes.some(change => change.kind === 'goal')).toBe(false);
  });

  it('names the goal it moves to and the link that stops counting', () => {
    const result = converted(convertCapture({ config: offer('offer-panel'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(result.changes).toContainEqual(expect.objectContaining({ kind: 'goal', from: 'Promote an offer or content', to: 'Grow my email list', link: expect.any(String) }));
  });
});

describe('switching between email and phone (S1)', () => {
  const DESTINATIONS = [{ id: 'mc', label: 'Mailchimp · Black Friday list', channels: ['email'] }, { id: 'wsms', label: 'WP SMS', channels: ['phone'] }];
  const signup = () => ({ template_id: 'centred-card', template: design('centred-card'), destinations: ['mc'], capture_mode: 'connected',
    integration_mappings: { primary: { mc: { 'field:interest': 'INTEREST' } } } });

  it('swaps the field, its consent and the list, and stops sending to the email service', () => {
    const result = converted(convertCapture({ config: signup(), goal: 'grow_email_list' }, { capture: 'phone' }, { goals: GOALS, destinations: DESTINATIONS }));
    const tree = treeOf(result);

    expect(result.goal).toBe('grow_sms_list');
    expect(tree.steps.map(step => step.kind)).toEqual(['input', 'acknowledgement']);
    expect(ofType(tree, 0, 'field')).toMatchObject([{ name: 'phone', label: 'Phone number', placeholder: '+44 7700 900000', required: true }]);
    expect(ofType(tree, 0, 'consent')).toMatchObject([{ text: 'Text me offers and news. Reply STOP to opt out. %s' }]);
    // Everything else is the merchant's and stays.
    expect(ofType(tree, 0, 'button')).toMatchObject([{ label: 'Send me the Friday reads' }]);
    expect(tree.submissions[0].fields).toEqual([ofType(tree, 0, 'field')[0].id]);
    expect(result.config.destinations).toEqual([]);
    expect(result.config.integration_mappings).toEqual({ primary: {} });
    expect(result.config.capture_mode).toBe('connected');
    expect(result.changes).toEqual([
      { kind: 'field-swap', screen: 'Details', from: 'Email address', to: 'Phone number', consent: 'Text me offers and news. Reply STOP to opt out. %s' },
      expect.objectContaining({ kind: 'goal', from: 'Grow my email list', to: 'Grow my SMS list' }),
      { kind: 'stops-sending', destinations: ['Mailchimp · Black Friday list'], mappings: true },
      { kind: 'leads-stay' },
    ]);
  });

  it('keeps an enquiry an enquiry', () => {
    const result = converted(convertCapture({ config: signup(), goal: 'collect_enquiries' }, { capture: 'phone' }, { goals: GOALS, destinations: DESTINATIONS }));
    expect(result.goal).toBe('collect_enquiries');
  });
});

describe('where the switch is offered (G1, G2)', () => {
  const pro = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../pro/modules/journeys/templates/${id}.json`), 'utf8'));
  const ask = (tree: TemplateTree, goal: string, config: Record<string, unknown> = {}) => captureSwitch({ ...config, template: { tokens: {}, tree } }, goal, GOALS);

  it('is offered on an offer, a message and a simple signup', () => {
    expect(ask(design('offer-receipt').tree, 'promote_offer')).toEqual({ offered: true, state: 'none' });
    expect(ask(design('centred-card').tree, 'grow_email_list')).toEqual({ offered: true, state: 'email' });
    expect(ask(design('stacked-signup').tree, 'collect_enquiries')).toEqual({ offered: true, state: 'phone' });
  });

  it('says in one line why it is not offered', () => {
    expect(ask(pro('space-planner').tree, 'find_match')).toEqual({ offered: false, reason: 'Quizzes have their own result setting.' });
    expect(ask(design('centred-card').tree, 'deliver_lead_magnet')).toEqual({ offered: false, reason: 'A lead magnet needs the email form to deliver the file.' });
    expect(ask(design('offer-receipt').tree, 'recover_cart')).toEqual({ offered: false, reason: 'Cart recovery sends shoppers to their cart, so it has no form.' });
    expect(ask(design('centred-card').tree, 'grow_email_list', { content_lock: { selector: 'main' } })).toEqual({ offered: false, reason: 'A content lock always needs its form.' });
    const products = { ...design('offer-receipt').tree, steps: [{ ...design('offer-receipt').tree.steps[0], content: { type: 'products', id: 'p', action: 'link' } }] } as unknown as TemplateTree;
    expect(ask(products, 'promote_offer')).toEqual({ offered: false, reason: 'Product recommendations can’t take a contact form.' });
    const named = JSON.parse(JSON.stringify(design('centred-card').tree).replace('"name":"email"', '"name":"name"')) as TemplateTree;
    expect(ask(named, 'collect_enquiries')).toEqual({ offered: false, reason: 'This form asks for neither an email nor a phone number.' });
  });

  it('takes a flow with the simple shape, and refuses one with branches', () => {
    const flow = upgradeToGraph(design('journey-email-then-sms').tree);
    expect(ask(flow, 'grow_email_list')).toEqual({ offered: true, state: 'email' });
    const branches = { ...flow, graph: { ...flow.graph!, edges: [...flow.graph!.edges, { id: 'extra', from: flow.graph!.entry, to: 'received', kind: 'default' as const }] } };
    expect(ask(branches, 'grow_email_list')).toEqual({ offered: false, reason: 'This campaign has branches. Edit its screens directly.' });
  });
});

describe('the thank-you screen reads as one thing (screenshot sweep)', () => {
  it('says thanks once, even where the offer had two headlines', () => {
    const template = design('offer-panel');
    const twice = JSON.parse(JSON.stringify(template.tree).replace('"role":"headline"', '"role":"headline","x":1')) as TemplateTree;
    const root = twice.steps[0].content as unknown as { children: TemplateNode[] };
    root.children.push({ type: 'heading', id: 'second', role: 'headline', text: 'And a second line' } as TemplateNode);
    const result = converted(convertCapture({ config: { template: { ...template, tree: twice } }, goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(ofType(treeOf(result), 1, 'heading')).toHaveLength(1);
  });

  it('keeps no row that would only hold a rule', () => {
    const result = converted(convertCapture({ config: offer('agenda-card'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    const thanks = treeOf(result).steps[1].content;
    const layouts = walkNodes(thanks).filter(node => ['stack', 'row', 'panel', 'grid', 'split', 'media'].includes(node.type) && node !== thanks);
    for (const layout of layouts) expect(walkNodes(layout).some(node => !['stack', 'row', 'panel', 'grid', 'split', 'media', 'divider', 'icon'].includes(node.type))).toBe(true);
  });
});

describe('what the screenshot sweep caught', () => {
  const pro = (id: string): Template => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../pro/modules/display-types/templates/${id}.json`), 'utf8'));

  it('keeps the first screen of a form over two screens, where its headline is', () => {
    const result = converted(convertCapture({ config: { template: design('request-folio') }, goal: 'collect_enquiries' },
      { capture: 'none', link: { label: 'Shop now', href: 'https://shop.test/' } }, { goals: GOALS }));
    const tree = treeOf(result);
    expect(tree.steps.map(step => step.id)).toEqual(['request']);
    expect(ofType(tree, 0, 'heading')).toMatchObject([{ text: 'Could it be repaired?' }]);
    expect(ofType(tree, 0, 'button')).toMatchObject([{ action: 'link', label: 'Shop now' }]);
    expect(result.changes[0]).toMatchObject({ loses: [{ kind: 'field', label: expect.stringContaining('What needs attention') }, { kind: 'field', label: 'Email address' }, { kind: 'button', label: 'Send request' }] });
  });

  it('brings a code back above a row, never into it', () => {
    const template = pro('inline-code-strip');
    const result = converted(convertCapture({ config: { template }, goal: 'grow_email_list' },
      { capture: 'none', link: { label: 'Shop now', href: 'https://shop.test/' } }, { goals: GOALS }));
    const root = treeOf(result).steps[0].content as unknown as { children: TemplateNode[] };
    expect(root.children.map(child => child.type)).toEqual(['heading', 'code', 'row', 'text']);
  });

  it('outlines a new field in the text colour on a design that names no input colour', () => {
    const plain = converted(convertCapture({ config: offer('reading-slip'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(ofType(treeOf(plain), 0, 'field')[0].tokens).toEqual({ border: 'fg' });
    const styled = converted(convertCapture({ config: offer('offer-receipt'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(ofType(treeOf(styled), 0, 'field')[0]).not.toHaveProperty('tokens');
  });

  it('says thanks at the design’s heading size, not the offer’s giant number', () => {
    const result = converted(convertCapture({ config: offer('offer-receipt'), goal: 'promote_offer' }, { capture: 'email' }, { goals: GOALS }));
    expect(ofType(treeOf(result), 1, 'heading')[0].tokens).not.toHaveProperty('heading-size');
  });
});

describe('what the switch never touches', () => {
  const rules = { display_rules: { opening: { mode: 'automatic', rules: [{ type: 'exit_intent' }] } }, frequency: { maxPerSession: 1 },
    targeting: { include: ['/shop/*'] }, starts_at: '2026-11-27 00:00', ends_at: '2026-12-01 23:59', priority: 3, inline_placement: { after: 'p' } };

  it.each(['email', 'none'] as const)('keeps display rules, triggers, frequency, dates and placement as they were (%s)', (capture) => {
    const start = capture === 'email' ? { ...offer('offer-receipt'), ...rules } : { template_id: 'centred-card', template: design('centred-card'), ...rules };
    const result = converted(convertCapture({ config: start, goal: capture === 'email' ? 'promote_offer' : 'grow_email_list' }, { capture }, { goals: GOALS }));
    for (const [key, value] of Object.entries(rules)) expect(result.config[key]).toEqual(value);
  });

  it('keeps a flow a flow when only the channel changes', () => {
    const flow = upgradeToGraph(design('centred-card').tree);
    const result = converted(convertCapture({ config: { template: { ...design('centred-card'), tree: flow } }, goal: 'grow_email_list' }, { capture: 'phone' }, { goals: GOALS }));
    expect(treeOf(result).graph).toEqual(flow.graph);
    expect(ofType(treeOf(result), 0, 'field')).toMatchObject([{ name: 'phone' }]);
  });
});
