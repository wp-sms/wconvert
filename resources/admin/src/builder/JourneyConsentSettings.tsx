import type { TemplateTree } from '@renderer/types';
import type { TemplateLabels } from '../templates/api';
import { slotsOf, withHidden, withValue } from './panel';
import { SlotFields } from './SlotFields';

/** Reuse the element editor so consent wording, links and visibility have one contract. */
export function JourneyConsentSettings({ tree, step, labels, onChange }: {
  tree: TemplateTree; step: number; labels: TemplateLabels;
  onChange(tree: TemplateTree, coalesce?: string): void;
}) {
  const slots = slotsOf(tree).filter(slot => slot.path[0] === step && slot.type === 'consent');
  if (!slots.length) return null;
  // The "Consent" disclosure around this is the Form section's (ADR 0136): this draws its wording only.
  return <>
    {slots.map(slot => <div key={slot.path.join('.')} className="wconvert-journey-consent">
      <SlotFields slot={slot} labels={labels} showVisibility
        onValue={(key, value) => onChange(withValue(tree, slot.path, key, value), `consent:${slot.path.join('.')}:${key}`)}
        onParam={(key, value) => onChange(withValue(tree, slot.path, key, value))}
        onHidden={hidden => onChange(withHidden(tree, slot.path, hidden))}
        onSentence={(value, typing) => {
          let next = tree;
          for (const key of ['text', 'emphasis', 'italic', 'link'] as const) if (slot.keys.includes(key)) next = withValue(next, slot.path, key, value[key]);
          onChange(next, typing ? `consent:${slot.path.join('.')}:sentence` : undefined);
        }} />
    </div>)}
  </>;
}
