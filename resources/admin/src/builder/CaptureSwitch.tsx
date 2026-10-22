import { createContext, useContext, type Ref } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { OptionStrip } from '../shell/OptionStrip';
import type { SwitchOffer } from './structure/captureConversion';

export type CaptureChoice = 'none' | 'email' | 'phone';

/**
 * The form switch, for edits that reach it another way: deleting the form's
 * only field, its screen or the only counted link opens the same box rather
 * than refusing (ADR 0163). Null where the switch is not offered.
 */
export const CaptureRequest = createContext<((choice: CaptureChoice) => void) | null>(null);

export const useCaptureRequest = () => useContext(CaptureRequest);

/**
 * "Contact form · None / Email / Phone", at the top of the rail (ADR 0163).
 *
 * On a Goal that cannot change, after first publish or in an A/B test, it
 * offers a copy instead of switching in place.
 */
export function CaptureSwitch({ state, offer, copy, published, onChoose, sectionRef }: {
  /** What the main form asks for now. */
  readonly state: 'none' | 'email' | 'phone' | 'other';
  readonly offer: SwitchOffer;
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
    <div className="wconvert-capture-switch__heading"><strong>{__('Contact form', 'wconvert')}</strong>{copy && <span>{named}</span>}</div>
    {copy && offer.offered ? <>
      <Button type="button" variant="outline" size="sm" onClick={() => onChoose(state === 'none' ? 'email' : 'none')}>
        {state === 'none' ? __('Make a signup copy', 'wconvert') : __('Make an offer copy', 'wconvert')}
      </Button>
      <p>{published ? __('Published campaigns keep their goal. The copy is a new draft.', 'wconvert')
        : __('A test variant keeps the test’s goal. The copy is a standalone draft.', 'wconvert')}</p>
    </> : <>
      <OptionStrip label={__('Contact form', 'wconvert')} value={state === 'other' ? '' : state} disabled={!offer.offered || copy}
        options={[{ value: 'none', label: __('None', 'wconvert') }, { value: 'email', label: __('Email', 'wconvert') }, { value: 'phone', label: __('Phone', 'wconvert') }]}
        onChange={value => onChoose(value as CaptureChoice)} />
      {!offer.offered && <p>{offer.reason}</p>}
    </>}
  </section>;
}
