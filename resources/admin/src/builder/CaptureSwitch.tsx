import { createContext, useContext, type Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { OptionStrip } from '../shell/OptionStrip';
import { InfoTip } from '../shell/InfoTip';
import type { CaptureChoice } from './structure/captureConversion';

export type { CaptureChoice };

/**
 * The form switch, for edits that reach it another way: adding a contact
 * field to a design with no form, or deleting the form's only email or phone
 * field or its screen, opens the same box rather than refusing (ADR 0163).
 * Null where the switch is not offered.
 */
export const CaptureRequest = createContext<((choice: CaptureChoice) => void) | null>(null);

export const useCaptureRequest = () => useContext(CaptureRequest);

/**
 * "Contact form · None / Email / Phone", at the top of the rail (ADR 0163).
 * Drawn only where the switch is offered: a campaign that cannot switch, such
 * as a quiz, does not show a control it cannot use.
 *
 * On a Goal that cannot change, after first publish or in an A/B test, it
 * offers a copy instead of switching in place, and says why in a tip.
 */
export function CaptureSwitch({ state, copy, published, onChoose, sectionRef }: {
  /** What the main form asks for now. */
  readonly state: 'none' | 'email' | 'phone';
  /** The Goal is fixed, so the switch makes a copy. */
  readonly copy: boolean;
  /** Fixed by first publish, rather than by an A/B test. */
  readonly published: boolean;
  readonly onChoose: (choice: CaptureChoice) => void;
  /** Where focus returns when the box closes. */
  readonly sectionRef?: Ref<HTMLElement>;
}) {
  const named = state === 'email' ? __('Email', 'wconvert') : state === 'phone' ? __('Phone', 'wconvert') : __('None', 'wconvert');
  return <section ref={sectionRef} tabIndex={-1} className="wconvert-capture-switch" aria-label={__('Contact form', 'wconvert')}>
    <div className="wconvert-capture-switch__heading">
      <strong>{__('Contact form', 'wconvert')}</strong>
      {copy && <span>{named}<InfoTip label={__('Why a copy', 'wconvert')}>{published
        ? __('This campaign is published, so what it counts can’t change. The change goes into a new draft instead. This campaign and its results stay as they are.', 'wconvert')
        : __('This campaign is part of an A/B test, and both versions must count the same thing. The change goes into a new, separate campaign instead. The test stays as it is.', 'wconvert')}</InfoTip></span>}
    </div>
    {copy ? <Button type="button" variant="outline" size="sm" onClick={() => onChoose(state === 'none' ? 'email' : 'none')}>
      {state === 'none' ? __('Make a signup copy', 'wconvert') : __('Make an offer copy', 'wconvert')}
    </Button> : <OptionStrip label={__('Contact form', 'wconvert')} value={state}
      options={[{ value: 'none', label: __('None', 'wconvert') }, { value: 'email', label: __('Email', 'wconvert') }, { value: 'phone', label: __('Phone', 'wconvert') }]}
      onChange={value => onChoose(value as CaptureChoice)} />}
  </section>;
}
