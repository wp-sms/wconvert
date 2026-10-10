import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** One fact: a short label beside its icon, and its answer. */
export interface Fact {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly text: ReactNode;
  /** A fact that needs a look — a destination problem, an unfinished rule. */
  readonly tone?: 'warning';
}

/**
 * **Facts at a glance** — one icon line each (ADR 0137). Campaign Details, the
 * setup preview and the editor's design preview all read their facts through
 * this, so the three look and scan the same.
 */
export function FactList({ facts, className }: { facts: readonly Fact[]; className?: string }) {
  return <dl className={className ? `wconvert-facts ${className}` : 'wconvert-facts'}>
    {facts.map(({ icon: Icon, label, text, tone }) => <div key={label} data-tone={tone}>
      <dt><Icon size={16} aria-hidden="true" />{label}</dt><dd>{text}</dd>
    </div>)}
  </dl>;
}
