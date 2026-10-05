import { iconFor } from '../icons';
import type { DestinationType } from './api';

/**
 * Provider artwork by destination type id. Empty here: the only providers with
 * marks are Pro's, so Pro's admin entry fills this and free's bundle carries no
 * third-party logo (ADR 0127).
 */
export const providerMarks: Record<string, string> = {};

/** Provider artwork is decorative beside the provider's visible name. */
export function ProviderMark({ type, className = 'size-5' }: {
  type: Pick<DestinationType, 'id' | 'icon'> | undefined;
  className?: string;
}) {
  const mark = type && providerMarks[type.id];
  if (mark) return <img src={mark} alt="" aria-hidden="true" className={className} />;
  const Icon = iconFor(type?.icon ?? 'plug');
  return <Icon aria-hidden="true" className={className} />;
}
