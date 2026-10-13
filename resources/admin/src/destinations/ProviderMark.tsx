import { iconFor } from '../icons';
import type { Connection, DestinationType } from './api';
import { connectionSetup } from './connectionSetup';

/**
 * Provider artwork by destination type id. Empty here: the only providers with
 * marks are Pro's, so Pro's admin entry fills this and free's bundle carries no
 * third-party logo (ADR 0127).
 */
export const providerMarks: Record<string, string> = {};

/**
 * Provider artwork is decorative beside the provider's visible name. Given a
 * `connection`, the account's own mark wins — a webhook to a tool's host shows
 * that tool — where one is registered ({@see connectionSetup}).
 */
export function ProviderMark({ type, connection, className = 'size-5' }: {
  type: Pick<DestinationType, 'id' | 'icon'> | undefined;
  connection?: Pick<Connection, 'type' | 'account_identity'>;
  className?: string;
}) {
  const mark = (connection && connectionSetup.connectionMark?.(connection)) || (type && providerMarks[type.id]);
  if (mark) return <img src={mark} alt="" aria-hidden="true" className={className} />;
  const Icon = iconFor(type?.icon ?? 'plug');
  return <Icon aria-hidden="true" className={className} />;
}
