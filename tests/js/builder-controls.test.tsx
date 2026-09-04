import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../../resources/rules/manifest.json';
import { ParamControl, ParamField } from '../../resources/admin/src/builder/controls';
import type { RuleParam } from '../../resources/admin/src/builder/api';

/**
 * Every control kind the rule manifest names, against the one component that
 * draws it.
 *
 * Same arrangement `tests/js/renderer-manifest-parity.test.ts` has, and for
 * the same reason: the kinds are spelled on both sides of a language boundary,
 * and a kind declared with nothing to draw it is a param the merchant can see
 * and cannot fill in. **It is behavioural, not a list against a list** — there
 * is no exported kind array in the component to compare with, deliberately,
 * because that would be a second spelling of its own switch.
 */

const KINDS = [
  ...new Set(
    Object.values(manifest).flatMap((axis) =>
      Object.values(axis).flatMap((entry) =>
        Object.values(entry.params as Record<string, { control: string; options?: string[] }>).map(
          (param) => param.control,
        ),
      ),
    ),
  ),
];

const paramFor = (control: string, options: string[] = []): RuleParam => ({
  control: control as RuleParam['control'],
  label: 'A param',
  authored: false,
  options: options.map((value) => ({ value, label: value })),
});

/** The option sets the manifest declares, so a select has something to hold. */
const OPTIONS: Readonly<Record<string, string[]>> = {
  device_set: ['mobile', 'tablet', 'desktop'],
  referrer_set: ['direct', 'search', 'social'],
  post_type: ['post', 'page'],
};

describe('every param kind the manifest declares', () => {
  it('has kinds to check, so this is not asserted about nothing', () => {
    expect(KINDS.length).toBeGreaterThan(0);
  });

  it.each(KINDS)('has a control the builder draws: %s', (control) => {
    const { container } = render(
      <ParamControl
        id="wconvert-under-test"
        param={paramFor(control, OPTIONS[control] ?? [])}
        value={undefined}
        onChange={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });
});

/**
 * **The real OR cases are set-valued scalars on ONE rule** — "mobile or
 * tablet", "from Google or Bing" — and there is no boolean nesting, ever
 * (ADR 0005). The nesting ceiling is recorded as permanent rather than "not in
 * v1" because "we'll add OR later" is the path by which an expression language
 * arrives, and a builder drawing the brackets would be that path.
 */
describe('a multi-value rule', () => {
  it('is several values on one rule, chosen from the closed set', async () => {
    const changed = vi.fn();

    render(
      <ParamControl
        id="wconvert-device"
        param={paramFor('device_set', OPTIONS.device_set)}
        value={['mobile']}
        onChange={changed}
      />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'tablet' }));

    // One rule, two values — not two rules, and not a group.
    expect(changed).toHaveBeenCalledWith(['mobile', 'tablet']);
  });

  it('offers no way to group or nest one condition inside another', () => {
    const { container } = render(
      <ParamControl
        id="wconvert-device"
        param={paramFor('device_set', OPTIONS.device_set)}
        value={['mobile']}
        onChange={vi.fn()}
      />,
    );

    // Not a tautology: it fails the day a control renders a nested rule list,
    // which is the shape a boolean group arrives in.
    expect(container.querySelectorAll('fieldset fieldset')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/any of|all of/i);
  });
});

/**
 * ============================================================================
 * ONE SET HOLDING TWO KINDS OF MEMBER, WHICH IS STILL ONE SET-VALUED SCALAR.
 * ============================================================================
 * `referrer` is the case ADR 0005 names by example — *"from Google or Bing"* —
 * with one twist: the merchant picks from the closed traffic sources AND names
 * sites of their own, and both land in one `in` array on one rule. Two params
 * would read as *"needs Came from and Any of these sites"* on every rule that
 * used only one of them, since a section summary reports a param it was given
 * no value for.
 *
 * So this control is a checkbox group and a value list sharing one value, and
 * these tests are what stop it silently reverting to the plain text box the
 * `default` branch would otherwise hand a merchant.
 */
describe('the referrer control', () => {
  const referrer = paramFor('referrer_set', OPTIONS.referrer_set);

  it('offers the closed traffic sources as a set', async () => {
    const changed = vi.fn();

    render(<ParamControl id="wconvert-referrer" param={referrer} value={['search']} onChange={changed} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'social' }));

    expect(changed).toHaveBeenCalledWith(['search', 'social']);
  });

  /**
   * A named site is the half `query_param` cannot answer: it reads a tag the
   * merchant put there themselves, so it only ever describes traffic they
   * already tagged.
   */
  it('lets the merchant name a site of their own, into the same set', async () => {
    const changed = vi.fn();

    render(<ParamControl id="wconvert-referrer" param={referrer} value={['search']} onChange={changed} />);

    await userEvent.type(screen.getByRole('textbox'), 'x');

    expect(changed).toHaveBeenLastCalledWith(['search', 'x']);
  });

  /**
   * **The two halves are one value and the merchant can see it.** A domain
   * typed into the list must not disappear from the row when a checkbox is
   * ticked, and a ticked source must not disappear when a domain is typed.
   */
  it('keeps both halves of the set on screen at once', () => {
    render(
      <ParamControl id="wconvert-referrer" param={referrer} value={['search', 'example.com']} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('checkbox', { name: 'search' })).toBeChecked();
    expect(screen.getByDisplayValue('example.com')).toBeInTheDocument();
  });

  /**
   * The order is the OPTION order then the merchant's, so two rules choosing
   * the same sources in a different order are the same rule — otherwise the
   * panel draws one preset for one of them and "Set it myself" for the other.
   */
  it('rebuilds the closed half in option order, so one rule has one spelling', async () => {
    const changed = vi.fn();

    render(
      <ParamControl id="wconvert-referrer" param={referrer} value={['social', 'example.com']} onChange={changed} />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'direct' }));

    expect(changed).toHaveBeenCalledWith(['direct', 'social', 'example.com']);
  });
});

/**
 * ============================================================================
 * ONE HOP, SAID ON THE SCREEN WHERE THE RULE IS WRITTEN.
 * ============================================================================
 * `document.referrer` is the page immediately before this one and nothing
 * more: absent on a direct visit, absent where a referrer policy strips it,
 * and never a session history. A merchant who reads the rule as *"originally
 * arrived from Google"* will target the wrong people and blame the plugin, and
 * the honest place to say so is beside the control rather than in a doc.
 *
 * Reconstructing a first touch is not the alternative — a source held across
 * page views is a per-visitor fact with a lifetime, which is the shape
 * ADR 0017 refuses.
 *
 * Attached to the CONTROL rather than to the rule type, which is how every
 * other cross-cutting fact in this bundle is keyed: the builder spells no rule
 * type of its own (`api.ts`).
 */
describe('the referrer hint', () => {
  it('says this is the page immediately before, not where they first arrived', () => {
    render(
      <ParamField
        id="wconvert-referrer"
        param={paramFor('referrer_set', OPTIONS.referrer_set)}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    const hint = document.getElementById('wconvert-referrer-hint');

    expect(hint).toBeInTheDocument();
    expect(hint?.textContent ?? '').toMatch(/immediately before/i);
    expect(hint?.textContent ?? '').toMatch(/not where they first/i);
  });

  /** The group points at it, or a screen reader never reaches the caveat. */
  it('is announced with the control rather than left beside it', () => {
    render(
      <ParamField
        id="wconvert-referrer"
        param={paramFor('referrer_set', OPTIONS.referrer_set)}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'wconvert-referrer-hint');
  });

  /** And no other set control grows one, since none of them has this trap. */
  it('is not attached to a control that has no such caveat', () => {
    render(
      <ParamField
        id="wconvert-device"
        param={paramFor('device_set', OPTIONS.device_set)}
        value={[]}
        onChange={vi.fn()}
      />,
    );

    expect(document.getElementById('wconvert-device-hint')).not.toBeInTheDocument();
  });
});

/**
 * ============================================================================
 * ONE PARAM, TWO BOXES — BECAUSE A DAILY WINDOW HAS NO HALF-FILLED STATE.
 * ============================================================================
 * `time_of_day` is a recurring window, and a window has two ends. Declared as
 * two params, a merchant who had filled one would read *"Time of day — needs
 * To"* on the collapsed row forever, because a section summary reports any
 * declared param it was given no value for — and worse, a `from` with no `to`
 * would be a saveable rule that holds for nobody.
 *
 * One param has no such state: what is stored is either a whole window or
 * nothing, and the summary says *"needs Hours"* until the merchant has chosen
 * both ends. That is the same answer #91 arrived at for `referrer`, from the
 * other direction.
 */
describe('the hours control', () => {
  const hours = paramFor('hours');

  const boxes = () => screen.getAllByLabelText(/^(From|To)$/);

  it('is two times rather than a box to type a range into', () => {
    render(<ParamControl id="wconvert-hours" param={hours} value={undefined} onChange={vi.fn()} />);

    expect(boxes()).toHaveLength(2);
    expect(boxes()[0]).toHaveAttribute('type', 'time');
  });

  it('reads a stored window back into its two ends', () => {
    render(<ParamControl id="wconvert-hours" param={hours} value="09:00-17:00" onChange={vi.fn()} />);

    expect(boxes()[0]).toHaveValue('09:00');
    expect(boxes()[1]).toHaveValue('17:00');
  });

  it('writes one value once both ends are chosen', () => {
    const changed = vi.fn();

    render(<ParamControl id="wconvert-hours" param={hours} value="09:00-17:00" onChange={changed} />);

    // `fireEvent` rather than typing: a `<input type="time">` is edited
    // segment by segment, and what is under test is what one settled value
    // writes rather than how a browser assembles it.
    fireEvent.change(boxes()[1], { target: { value: '18:00' } });

    expect(changed).toHaveBeenLastCalledWith('09:00-18:00');
  });

  /**
   * **A half-filled window is written as no window**, so the row says it needs
   * one rather than claiming a rule that holds for nobody. The typed end stays
   * on screen while the merchant finishes.
   */
  it('writes nothing at all while only one end is chosen', () => {
    const changed = vi.fn();

    render(<ParamControl id="wconvert-hours" param={hours} value={undefined} onChange={changed} />);

    fireEvent.change(boxes()[0], { target: { value: '09:00' } });

    expect(changed).toHaveBeenLastCalledWith(undefined);
    expect(boxes()[0]).toHaveValue('09:00');
  });

  /** And emptying one end takes the window away rather than half of it. */
  it('unsets the window when an end is cleared', () => {
    const changed = vi.fn();

    render(<ParamControl id="wconvert-hours" param={hours} value="09:00-17:00" onChange={changed} />);

    fireEvent.change(boxes()[0], { target: { value: '' } });

    expect(changed).toHaveBeenLastCalledWith(undefined);
  });
});

/**
 * **Whose clock it is, said where the merchant is choosing the hours.**
 *
 * A merchant who reads "9am to 5pm" as the visitor's own morning targets the
 * wrong people and blames the plugin — the same mis-reading `referrer_set`
 * carries a hint for, and the same mechanism: keyed on the CONTROL, because
 * this bundle spells no rule type of its own (`api.ts`).
 */
describe('the hint under a control that needs one', () => {
  it('tells the merchant the hours are the site’s, not the visitor’s', () => {
    render(
      <ParamField id="wconvert-hours" param={paramFor('hours')} value={undefined} onChange={vi.fn()} />,
    );

    expect(screen.getByText(/your site/i)).toBeInTheDocument();
  });

  /** The two ends are two controls, so the param's name is a GROUP's name. */
  it('names the pair as a group rather than labelling one of them', () => {
    const { container } = render(
      <ParamField id="wconvert-hours" param={paramFor('hours')} value={undefined} onChange={vi.fn()} />,
    );

    expect(container.querySelector('[role=group]')).toHaveAttribute(
      'aria-labelledby',
      'wconvert-hours',
    );
  });
});
