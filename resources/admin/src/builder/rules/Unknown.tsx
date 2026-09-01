import { __ } from '@wordpress/i18n';
import { Description } from '../../shell/Description';
import { RuleRows, type Row } from '../RuleRows';
import { RuleRow } from './RuleRow';
import type { Entry } from './axis';
import type { RuleType } from '../api';

/**
 * The rules whose type is on **no axis this build knows** — and a way out of
 * each.
 *
 * Filtering them away would leave such a rule invisible AND unremovable: still
 * in `config`, still saved back on every edit, with nothing on screen to act
 * on. The vocabulary is closed (ADR 0005), so this is rare — and "rare and
 * silent" is the combination that earns a section of its own rather than a
 * shrug.
 *
 * It is not one of the four disclosures. The four answer questions a merchant
 * asks; this answers one they did not, so it renders only when there is
 * something in it, below the rest, with no summary sentence to write about a
 * rule nothing can read.
 */
export interface UnknownProps {
  readonly entries: readonly Entry[];
  readonly remove: (at: number) => void;
  readonly all: readonly RuleType[];
}

export function Unknown({ entries, remove, all }: UnknownProps) {
  if (entries.length === 0) {
    return null;
  }

  const rows: Row[] = entries.map(([rule, at]) => ({
    key: String(at),
    content: <RuleRow rule={rule} at={at} types={all} onChange={() => undefined} />,
    onRemove: () => remove(at),
  }));

  return (
    <div className="wconvert-rules__unknown">
      <h3>{__('Not available on this site', 'wconvert')}</h3>
      <Description>{__('Still saved with the Optin. Remove one you no longer want.', 'wconvert')}</Description>
      <RuleRows rows={rows} empty="" />
    </div>
  );
}
