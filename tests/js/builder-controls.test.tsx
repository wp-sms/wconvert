import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../../resources/rules/manifest.json';
import { ParamControl } from '../../resources/admin/src/builder/controls';
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
