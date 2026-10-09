import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availabilityOf, pickFor, picksIn, switchPick, type SectionId } from '../../resources/admin/src/builder/rules/picks';
import type { DisplayRulesValue } from '../../resources/admin/src/builder/rules/summaries';
import { ruleTypes } from './support/rule-types';

afterEach(() => { delete window.wconvertAdmin; });

/**
 * Quick picks — the common answers to each question, matched by the SHAPE of
 * what is stored rather than by a remembered choice (ADR 0129).
 */

const base = (patch: Partial<DisplayRulesValue> = {}): DisplayRulesValue => ({
  display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'immediate' } },
  targeting: {},
  frequency: {},
  schedule: {},
  priority: 0,
  ...patch,
});

const vocabulary = ruleTypes();
const shown = (section: SectionId, value: DisplayRulesValue, chosen?: string | null) => pickFor(section, value, vocabulary, chosen).id;

describe('Where', () => {
  it('reads an untouched Optin as the entire site', () => {
    expect(shown('where', base())).toBe('entire');
  });

  it('reads the one blog-post rule as Blog posts only, and any other list as Selected pages', () => {
    expect(shown('where', base({ targeting: { mode: 'selected', include: [{ type: 'singular', value: 'post' }] } }))).toBe('blog');
    expect(shown('where', base({ targeting: { mode: 'selected', include: [{ type: 'singular', value: 'page' }] } }))).toBe('selected');
    expect(shown('where', base({ targeting: { mode: 'selected', include: [] } }))).toBe('selected');
  });

  it('never touches the exclusions', () => {
    const exclude = [{ type: 'url', value: '/checkout' }];
    for (const pick of picksIn('where')) {
      expect(pick.apply(base({ targeting: { exclude } })).targeting?.exclude).toBe(exclude);
    }
  });
});

describe('every pick round-trips', () => {
  const sections: SectionId[] = ['where', 'who', 'when', 'how-often', 'dates'];
  for (const section of sections) {
    for (const pick of picksIn(section)) {
      if (pick.open) continue;
      it(`${section} → ${pick.id}`, () => {
        const from = base({ display_rules: { audience: { mode: 'everyone' }, opening: { mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [] } }, frequency: { maxImpressions: 1, maxPerSession: 3 }, schedule: { ends_at: '2026-12-01 09:00' } });
        const next = { ...from, ...pick.apply(from, pick.param?.default) };
        expect(pick.matches(next)).toBe(true);
        expect(shown(section, next)).toBe(pick.id);
      });
    }
  }
});

const opening = (moment: NonNullable<DisplayRulesValue['display_rules']>['opening']) => base({ display_rules: { audience: { mode: 'everyone' }, opening: moment } });
const audience = (value: NonNullable<DisplayRulesValue['display_rules']>['audience']) => base({ display_rules: { audience: value, opening: { mode: 'immediate' } } });
const group = (...rules: { type: string; [key: string]: unknown }[]) => ({ id: 'g', match: 'all' as const, rules });

describe('a shape no pick has reads as Custom', () => {
  it('on When: a minimum time, or two rules that must all hold', () => {
    expect(shown('when', opening({ mode: 'automatic', match: 'any', minimum_seconds: 5, rules: [{ type: 'time_on_page', seconds: 15 }] }))).toBe('custom');
    expect(shown('when', opening({ mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ type: 'exit_intent' }, { type: 'scroll_up' }] }))).toBe('custom');
    expect(shown('when', opening({ mode: 'click', rules: [{ type: 'click_element', selector: '#a' }, { type: 'click_element', selector: '#b' }] }))).toBe('custom');
  });

  it('reads leaving-or-scrolling in either order, and a click by its own selector', () => {
    expect(shown('when', opening({ mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'scroll_up' }, { type: 'exit_intent' }] }))).toBe('leave-or-scroll-up');
    const value = opening({ mode: 'click', rules: [{ type: 'click_element', selector: '.offer' }] });
    expect(shown('when', value)).toBe('click');
    expect(pickFor('when', value, vocabulary).label(value)).toBe('When they click .offer');
  });

  it('reads the real number off the stored rule', () => {
    const value = opening({ mode: 'automatic', match: 'all', minimum_seconds: 0, rules: [{ type: 'scroll_depth', percent: 70 }] });
    expect(pickFor('when', value, vocabulary).label(value)).toBe('Scrolled 70% down');
  });

  it('on Who: an empty group, two rules, or two groups', () => {
    expect(shown('who', audience({ mode: 'groups', groups: [group()] }))).toBe('custom');
    expect(shown('who', audience({ mode: 'groups', groups: [group({ type: 'device', in: ['mobile'] }, { type: 'logged_in', value: true })] }))).toBe('custom');
    expect(shown('who', audience({ mode: 'groups', groups: [group({ type: 'device', in: ['mobile'] }), group({ type: 'logged_in', value: true })] }))).toBe('custom');
    expect(shown('who', audience({ mode: 'groups', groups: [group({ type: 'device', in: ['mobile', 'tablet'] })] }))).toBe('custom');
  });

  it('on How often: a second visit-limit, or two limits at once', () => {
    expect(shown('how-often', base({ frequency: { maxPerSession: 2 } }))).toBe('custom');
    expect(shown('how-often', base({ frequency: { maxPerSession: 1, cooldownDays: 3 } }))).toBe('custom');
  });
});

it('compares a device set ignoring its order', () => {
  expect(shown('who', audience({ mode: 'groups', groups: [group({ type: 'device', in: ['desktop'] })] }))).toBe('computers');
  const both = audience({ mode: 'groups', groups: [group({ type: 'device', in: ['desktop', 'mobile'] })] });
  const reversed = audience({ mode: 'groups', groups: [group({ type: 'device', in: ['mobile', 'desktop'] })] });
  expect(shown('who', both)).toBe(shown('who', reversed));
});

describe('How often', () => {
  it('leaves the stop settings alone, whichever pick is chosen', () => {
    const value = base({ frequency: { stopAfterDismiss: false, stopAfterConversion: false, maxImpressions: 4 } });
    for (const pick of picksIn('how-often')) {
      const next = pick.apply(value, pick.param?.default).frequency ?? value.frequency;
      expect(next.stopAfterDismiss).toBe(false);
      expect(next.stopAfterConversion).toBe(false);
      if (pick.id !== 'once') expect(next.maxImpressions).toBe(4);
    }
  });

  it('drops a total of one only when leaving Only once ever', () => {
    const once = base({ frequency: { maxImpressions: 1 } });
    const session = picksIn('how-often').find(pick => pick.id === 'session')!;
    expect(session.apply(once).frequency).toEqual({ maxPerSession: 1 });
    expect(session.apply(base({ frequency: { maxImpressions: 1, maxPerSession: 2 } })).frequency).toEqual({ maxImpressions: 1, maxPerSession: 1 });
  });
});

describe('the sticky rule', () => {
  const entire = base();
  it('keeps an open pick chosen while its value matches a quick pick', () => {
    expect(shown('where', entire, 'selected')).toBe('selected');
    expect(shown('how-often', base({ frequency: { maxPerSession: 1 } }), 'custom')).toBe('custom');
  });

  it('lets the value decide once a chosen quick pick no longer matches — an undo', () => {
    expect(shown('where', entire, 'blog')).toBe('entire');
  });

  it('derives again with nothing chosen — the section re-opened', () => {
    expect(shown('how-often', base({ frequency: { maxPerSession: 1 } }), null)).toBe('session');
  });
});

describe('switching picks', () => {
  const picks = picksIn('when');
  const by = (id: string) => picks.find(pick => pick.id === id)!;
  it('carries the number between picks that store it under the same key', () => {
    const value = opening({ mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 42 }] });
    const next = { ...value, ...switchPick(by('after'), by('pause'), value) };
    expect(next.display_rules?.opening).toMatchObject({ rules: [{ type: 'inactivity', seconds: 42 }] });
  });

  it('starts a pick with a different key at its own default', () => {
    const value = opening({ mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'time_on_page', seconds: 42 }] });
    const next = { ...value, ...switchPick(by('after'), by('scrolled'), value) };
    expect(next.display_rules?.opening).toMatchObject({ rules: [{ type: 'scroll_depth', percent: 50 }] });
    expect({ ...value, ...switchPick(by('immediate'), by('after'), value) }.display_rules?.opening).toMatchObject({ rules: [{ type: 'time_on_page', seconds: 15 }] });
  });

  it('writes every rule with a fresh id', () => {
    const next = by('after').apply(base(), 15).display_rules!.opening;
    expect(next.mode === 'automatic' && typeof next.rules[0].id).toBe('string');
  });
});

describe('availability', () => {
  const ids = (section: SectionId, tiers: Record<string, 'ready' | 'locked' | 'unavailable'>) => {
    const vocab = ruleTypes(tiers);
    return Object.fromEntries(picksIn(section).map(pick => [pick.id, availabilityOf(pick, vocab)]));
  };

  it('locks the Pro gestures and the cart on a lower tier, naming the tier', () => {
    const when = ids('when', { pro: 'locked', elite: 'locked' });
    expect(when.leave).toEqual({ availability: 'locked', tier: 'pro', requires_label: null });
    expect(when.click.availability).toBe('locked');
    expect(when['leave-or-scroll-up'].availability).toBe('locked');
    expect(when.after.availability).toBe('ready');
    expect(ids('who', { elite: 'locked' }).cart).toMatchObject({ availability: 'locked', tier: 'elite' });
  });

  it('locks every paid pick on a free install, even one that also needs a plugin', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'free' } as typeof window.wconvertAdmin;
    expect(ids('who', { elite: 'unavailable' }).cart).toMatchObject({ availability: 'locked', tier: 'elite' });
    expect(ids('when', { pro: 'locked' }).after.availability).toBe('ready');
  });

  it('names WooCommerce when the cart pick cannot run on this store', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'elite' } as typeof window.wconvertAdmin;
    expect(ids('who', { elite: 'unavailable' }).cart).toEqual({ availability: 'unavailable', tier: 'elite', requires_label: 'WooCommerce' });
  });

  it('reads a stored rule this site cannot run as Custom, so the rule stays on screen', () => {
    const value = opening({ mode: 'automatic', match: 'any', minimum_seconds: 0, rules: [{ type: 'exit_intent' }] });
    for (const installedTier of ['free', 'basic'] as const) {
      window.wconvertAdmin = { exportUrl: '', installedTier } as typeof window.wconvertAdmin;
      expect(pickFor('when', value, ruleTypes({ pro: 'locked' })).id, installedTier).toBe('custom');
    }
    const cart = audience({ mode: 'groups', groups: [group({ type: 'cart_has_items' })] });
    expect(pickFor('who', cart, ruleTypes({ elite: 'unavailable' })).id).toBe('custom');
    expect(pickFor('who', cart, ruleTypes()).id).toBe('cart');
  });
});

describe('the picks against the vocabulary', () => {
  it('uses only rule types the manifest knows', () => {
    const known = new Set([...vocabulary.targeting, ...vocabulary.triggers, ...vocabulary.conditions].map(type => type.type));
    for (const section of ['where', 'who', 'when', 'how-often', 'dates'] as const) {
      for (const pick of picksIn(section)) for (const type of pick.types) expect(known, `${section}/${pick.id}`).toContain(type);
    }
  });

  it('never reuses a rule type or preset label — a pick names an answer, a rule names a setting', () => {
    const php = readFileSync(resolve(import.meta.dirname, '../../src/Rules/RuleLabels.php'), 'utf8');
    const section = (name: string) => php.slice(php.indexOf(`function ${name}(`), php.indexOf('}', php.indexOf(`function ${name}(`)));
    const taken = [...`${section('types')}${section('presets')}`.matchAll(/=> __\('((?:[^'\\]|\\.)*)'/g)].map(match => match[1].toLowerCase());
    expect(taken.length).toBeGreaterThan(20);
    for (const section of ['where', 'who', 'when', 'how-often', 'dates'] as const) {
      for (const pick of picksIn(section)) expect(taken, `${section}/${pick.id}`).not.toContain(pick.template().toLowerCase());
    }
  });
});

it('keeps the rule and its id while the chosen pick’s number is edited', () => {
  const after = picksIn('when').find(pick => pick.id === 'after')!;
  const first = { ...base(), ...after.apply(base(), 15) };
  const edited = after.apply(first, 40).display_rules!.opening;
  const original = first.display_rules!.opening;
  expect(edited.mode === 'automatic' && original.mode === 'automatic' && edited.rules[0].id === original.rules[0].id).toBe(true);
  expect(edited).toMatchObject({ rules: [{ type: 'time_on_page', seconds: 40 }] });
});

it('words a chip in the plural its number takes', () => {
  const after = picksIn('when').find(pick => pick.id === 'after')!;
  expect(after.template(1)).toBe('After %s second');
  expect(after.template(15)).toBe('After %s seconds');
  const one = { ...base(), ...after.apply(base(), 1) };
  expect(after.label(one)).toBe('After 1 second');
});
