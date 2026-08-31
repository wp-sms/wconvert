import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible } from 'radix-ui';

/**
 * One of the four disclosures — Where, When, Who, How often.
 *
 * ============================================================================
 * THE SENTENCE IS THE LABEL OF A BUTTON, NOT A ROW OF CONTROLS.
 * ============================================================================
 * A literal mad-libs sentence — *"Fires after ⟨15⟩ seconds"* with a number
 * input in it — cannot be localised: `sprintf` returns a string rather than
 * JSX, and a language that reorders subject and object cannot be served by
 * splitting one translation around React children. It is also not a shape a
 * `<button>` may take, since phrasing content excludes form controls.
 *
 * So the collapsed row reads as a sentence and expanding reveals an ordinary
 * form. The merchant gets the same thing; the translator gets one string per
 * clause with the placeholders in it; the disclosure gets the ARIA it already
 * had.
 *
 * **Radix `Collapsible`, which is already in `radix-ui@1.6.7`** — no new
 * dependency, and `aria-expanded` and `aria-controls` come with it rather than
 * being written out per section. It is used from `builder/rules/` rather than
 * vendored into `components/ui/`, because that directory is upstream's
 * unchanged (ADR 0036) and this is one component with a job specific to this
 * screen.
 *
 * **`data-attention` rather than a second sentence.** Where a section holds a
 * rule that will not do what it looks like it does — a Trigger with no
 * selector, a Trigger sitting behind "shows immediately", an Optin with no
 * Trigger at all — the summary already SAYS so, in words the merchant can act
 * on. Repeating it as a badge would be the same fact twice; what the attribute
 * buys is the emphasis, which is CSS's to give.
 */
export interface SectionProps {
  /** A stable key, so a control id inside is never a translated string. */
  readonly id: string;
  /** Which question this section answers — "Where", "When". */
  readonly eyebrow: string;
  /** The section, read as prose. This is the button's accessible name. */
  readonly summary: string;
  /** Something in here will not do what it looks like it does. */
  readonly attention?: boolean;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

export function Section({ id, eyebrow, summary, attention = false, defaultOpen = false, children }: SectionProps) {
  return (
    <Collapsible.Root className="wconvert-section" defaultOpen={defaultOpen} data-attention={attention || undefined}>
      <Collapsible.Trigger className="wconvert-section__summary">
        <span className="wconvert-section__eyebrow text-micro uppercase text-muted-foreground">{eyebrow}</span>
        <span className="wconvert-section__sentence text-body">{summary}</span>
        {/*
          Decorative: the state it depicts is on `aria-expanded`, which Radix
          puts on this same button, so announcing the chevron would say it
          twice.
        */}
        <ChevronDown aria-hidden="true" className="wconvert-section__chevron" />
      </Collapsible.Trigger>
      <Collapsible.Content className="wconvert-section__body" id={`wconvert-section-${id}`}>
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
