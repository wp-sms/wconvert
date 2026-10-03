import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleRow } from '../../resources/admin/src/builder/rules/RuleRow';
import { allRuleTypes } from './support/rule-types';

/**
 * A saved rule this install cannot run, and what the row says about it.
 *
 * Only a paid install is told which rung would run it; a free install reaches
 * these rows only after Pro was removed, and is sold nothing (ADR 0116).
 */
afterEach(() => {
  cleanup();
  delete window.wconvertAdmin;
});

const row = (rule: { type: string; [key: string]: unknown }) =>
  render(<RuleRow rule={rule} at={0} types={allRuleTypes({ pro: 'locked' })} onChange={vi.fn()} />);

describe('a saved rule a free install cannot run', () => {
  it('says so without naming a product', () => {
    row({ type: 'exit_intent' });

    expect(screen.getByText('This rule isn’t available on this site.')).toBeInTheDocument();
    expect(screen.queryByText(/WConvert Pro/)).toBeNull();
  });

  it('names the rule a substitute stands in for, and nothing to buy', () => {
    row({ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' });

    expect(screen.getByText(/^Standing in for “.+”, which isn’t available on this site\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/WConvert Pro/)).toBeNull();
  });
});

describe('a saved rule a paid install cannot run', () => {
  it('names the product that would run it', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    row({ type: 'exit_intent' });

    expect(screen.getByText('Needs WConvert Pro to run.')).toBeInTheDocument();
  });

  it('names the product a substitute stands in for', () => {
    window.wconvertAdmin = { exportUrl: '', installedTier: 'basic' };
    row({ type: 'time_on_page', seconds: 15, degraded_from: 'exit_intent' });

    expect(screen.getByText(/^Standing in for “.+”, which is available with WConvert Pro\.$/)).toBeInTheDocument();
  });
});
