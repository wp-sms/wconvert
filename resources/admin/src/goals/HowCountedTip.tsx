import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { InfoTip } from '../shell/InfoTip';

/** The sentence saying how a Goal's number is counted, one press away (ADR 0183, 0190). */
export function HowCountedTip({ number, children }: { number: string; children: ReactNode }) {
  return (
    <InfoTip label={sprintf(
      /* translators: %s: what the Goal's number is called, e.g. “Quiz completions”. */
      __('How %s are counted', 'wconvert'), number)}>
      {children}
    </InfoTip>
  );
}
