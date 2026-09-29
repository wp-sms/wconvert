import { iconFor } from '../icons';
import type { DestinationType } from './api';

const marks: Record<string, string> = {
  mailchimp: new URL('../assets/branding/mailchimp.svg', import.meta.url).href,
  brevo: new URL('../assets/branding/brevo.svg', import.meta.url).href,
};

/** Provider artwork is decorative beside the provider's visible name. */
export function ProviderMark({ type, className = 'size-5' }: {
  type: Pick<DestinationType, 'id' | 'icon'> | undefined;
  className?: string;
}) {
  const mark = type && marks[type.id];
  if (mark) return <img src={mark} alt="" aria-hidden="true" className={className} />;
  const Icon = iconFor(type?.icon ?? 'plug');
  return <Icon aria-hidden="true" className={className} />;
}
