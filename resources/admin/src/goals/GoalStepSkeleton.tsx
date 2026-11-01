import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check } from 'lucide-react';
import { ChoiceSkeleton } from '../shell/ChoiceGrid';
import { Region, RegionBody, RegionHeader } from '../shell/Region';

/**
 * Where the creation flow is: choose a goal, then a template.
 *
 * Here rather than in {@see GoalScreen} because step one's skeleton draws it,
 * and that skeleton has to be outside the chunk it stands in for.
 */
export function Step({ at }: { at: 1 | 2 }) {
  return <nav className="wconvert-creation__steps" aria-label={sprintf(/* translators: 1: the current step's number, e.g. “1”, 2: how many steps there are, e.g. “2”. */ __('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}>
    <span className="sr-only">{sprintf(/* translators: 1: the current step's number, e.g. “1”, 2: how many steps there are, e.g. “2”. */ __('Choice %1$s of %2$s', 'wconvert'), String(at), '2')}</span>
    <ol>
      {[__('Choose a goal', 'wconvert'), __('Choose a template', 'wconvert')].map((label, index) => <li key={label} aria-current={at === index + 1 ? 'step' : undefined}>
        <span className="wconvert-creation__step-number" aria-hidden="true">{index + 1 < at ? <Check size={14} /> : index + 1}</span>{label}
      </li>)}
    </ol>
  </nav>;
}

/**
 * Step one while the [[Goal]]s are read — and while the creation chunk is
 * still downloading, because {@see GoalScreen}'s lazy wrapper draws this same
 * component as its fallback. One component for both waits is what makes the
 * hand-off invisible: the step nav, the heading and the four cards are already
 * where the loaded step puts them, and nothing redraws in between.
 *
 * Four cards because the free install ships four goals. `notice` is the
 * pinned-design notice, which the loaded step shows under its heading; the
 * chunk fallback has no design to name yet and leaves it out.
 */
export function GoalStepSkeleton({ notice }: { notice?: ReactNode }) {
  return <Region className="wconvert-creation wconvert-creation--goals">
    <Step at={1} />
    <RegionHeader title={__('What do you want to achieve?', 'wconvert')} />
    {notice}
    <RegionBody className="wconvert-creation__goals"><ChoiceSkeleton /></RegionBody>
  </Region>;
}
