import { useId, type ReactNode, type Ref } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { InfoTip } from '../shell/InfoTip';
import { Description } from '../shell/Description';
import { cn } from '../lib/utils';

/**
 * The one grammar every editor panel is written in (ADR 0136).
 *
 * ============================================================================
 * ONE HEADER, ONE SECTION, ONE FACT ROW, ONE FIELD HEADING, ONE HINT.
 * ============================================================================
 * The Look, screen and element panels had grown eight section-title styles,
 * four section wrappers with four spacings, three label-to-control gaps and
 * seven ways to say a sentence of help. Each was right where it was written
 * and the panels read as three products. These five pieces are the whole
 * vocabulary; a panel that needs something else adds it here, once.
 */

/**
 * A panel's head: an optional way back, the kind's icon, the title, one muted
 * caption and at most two icon actions.
 */
export function PanelHeader({ back, icon, title, titleId, tip, caption, actions, className }: {
  back?: { label: string; onClick(): void };
  icon: ReactNode;
  /** A heading, or a rename input standing in for one. */
  title: ReactNode;
  titleId?: string;
  /** An InfoTip beside the title, for what used to be a permanent line under it. */
  tip?: { label: string; content: ReactNode };
  caption?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <div className={cn('wconvert-panel-header', className)}>
    {back && <button type="button" className="wconvert-panel-header__back" onClick={back.onClick}
      aria-label={sprintf(/* translators: %s: where the button goes back to, e.g. a screen's name. */ __('Back to %s', 'wconvert'), back.label)}>
      <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
      <span>{back.label}</span>
    </button>}
    <div className="wconvert-panel-header__row">
      <span className="wconvert-panel-header__icon" aria-hidden="true">{icon}</span>
      <div className="wconvert-panel-header__text">
        <div className="wconvert-panel-header__title" id={titleId}>
          {title}
          {tip && <InfoTip label={tip.label}>{tip.content}</InfoTip>}
        </div>
        {caption && <span className="wconvert-panel-header__caption">{caption}</span>}
      </div>
      {actions && <div className="wconvert-panel-header__actions">{actions}</div>}
    </div>
  </div>;
}

/**
 * A titled group of fields: a 14/600 sentence-case title, an optional InfoTip
 * and trailing action, then its fields 12px apart. Sections are 16px apart
 * and divided by one rule. Untitled, it is still a section: the rule and the
 * spacing are what separate it.
 */
export function PanelSection({ ref, title, tip, tipLabel, action, className, children, label }: {
  ref?: Ref<HTMLElement>;
  title?: ReactNode;
  tip?: ReactNode;
  tipLabel?: string;
  /** A link-style action on the title row: "Use my theme's colors", "Add result". */
  action?: ReactNode;
  className?: string;
  /** An accessible name for an untitled section. */
  label?: string;
  children: ReactNode;
}) {
  const id = useId();
  if (title === undefined) {
    return <div ref={ref as Ref<HTMLDivElement>} className={cn('wconvert-panel-section', className)} role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
  }
  return <section ref={ref} className={cn('wconvert-panel-section', className)} aria-labelledby={id}>
    <div className="wconvert-panel-section__head">
      <h4 id={id}>{title}</h4>
      {tip && <InfoTip label={tipLabel ?? (typeof title === 'string' ? sprintf(/* translators: %s: a section title, e.g. “Results”. */ __('About %s', 'wconvert'), title) : __('About this section', 'wconvert'))}>{tip}</InfoTip>}
      {action && <span className="wconvert-panel-section__action">{action}</span>}
    </div>
    {children}
  </section>;
}

/** Facts in a column: label, value, and the way to where each is changed. */
export function FactList({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="wconvert-facts" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

/**
 * "When it opens · Everyone · After 8 seconds · Display rules": one row, no
 * card. The value may be a control (Then's select), named by `htmlFor`.
 */
export function FactRow({ label, htmlFor, children, action, onAction }: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  action?: ReactNode;
  onAction?(): void;
}) {
  return <div className="wconvert-fact">
    {htmlFor ? <label className="wconvert-fact__label" htmlFor={htmlFor}>{label}</label> : <span className="wconvert-fact__label">{label}</span>}
    <span className="wconvert-fact__value">{children}</span>
    {action && onAction ? <button type="button" className="wconvert-fact__action" onClick={onAction}>{action}</button> : <span />}
  </div>;
}

/**
 * A field's label row: the label left, its InfoTip beside it, and whatever
 * acts on the field (reset, link sides, edit CSS) at the far end — the same
 * for every field type.
 */
export function FieldHeading({ label, htmlFor, labelId, tip, tipLabel, children, as = 'label' }: {
  label: ReactNode;
  htmlFor?: string;
  labelId?: string;
  tip?: ReactNode;
  tipLabel?: string;
  /** Trailing actions: a reset, a link toggle. */
  children?: ReactNode;
  /** `span` where the label names a group rather than one control. */
  as?: 'label' | 'span';
}) {
  return <span className="wconvert-field-heading">
    {as === 'label' ? <label id={labelId} htmlFor={htmlFor}>{label}</label> : <span id={labelId}>{label}</span>}
    {tip && <InfoTip label={tipLabel ?? (typeof label === 'string' ? sprintf(/* translators: %s: a field label, e.g. “Answer type”. */ __('About %s', 'wconvert'), label) : __('About this field', 'wconvert'))}>{tip}</InfoTip>}
    {children && <span className="wconvert-field-heading__actions">{children}</span>}
  </span>;
}

/**
 * One field: heading, 6px, control, and at most one line of hint.
 */
export function PanelField({ label, htmlFor, tip, tipLabel, actions, hint, hintId, className, children }: {
  label: ReactNode;
  htmlFor?: string;
  tip?: ReactNode;
  tipLabel?: string;
  actions?: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('wconvert-panel-field', className)}>
    <FieldHeading label={label} htmlFor={htmlFor} tip={tip} tipLabel={tipLabel}>{actions}</FieldHeading>
    {children}
    {hint && <PanelHint id={hintId}>{hint}</PanelHint>}
  </div>;
}

/** The one line of help a field may keep: 12px, muted (ADR 0136; GUIDELINES §4 `hint`). */
export function PanelHint({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  // The admin's one Description, a step smaller in a panel.
  return <Description id={id} className={cn('wconvert-panel-hint', className)}>{children}</Description>;
}
