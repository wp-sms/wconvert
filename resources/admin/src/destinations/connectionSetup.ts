import type { ComponentType, ReactNode } from 'react';
import type { Connection, DestinationType } from './api';

/**
 * What every account form takes, free's generic one and a type's own.
 *
 * It draws a dialog's body and footer. `title` asks it to draw the header
 * too — Accounts does, so a form with steps can say which one it is on;
 * connecting in place inside another dialog does not, and that dialog keeps
 * its own header.
 */
export interface ConnectionFormProps {
  type: DestinationType;
  account?: Connection;
  title?: ReactNode;
  meta?: ReactNode;
  /** Replaces the footer's Cancel where the form is a step inside another (Back). */
  back?: ReactNode;
  /** `revealed` holds a generated secret, shown this once (ADR 0148). */
  onSaved: (connection: Connection, revealed?: Record<string, string>) => void | Promise<void>;
  onCancel: () => void;
  /** Whether anything was typed, for the dialog's "Discard changes?". */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Account setup a type can bring its own screens to, as slots Pro's
 * `destinations` module fills — the shape of `journeyAuthoring` (ADR 0147).
 *
 * Free's bundle names no receiver: a type with no registered form gets the
 * generic one, which draws whatever its connection schema says.
 */
export const connectionSetup: {
  /** A type's own account form, by type id. */
  connectionForms: Record<string, ComponentType<ConnectionFormProps>>;
  /** Artwork for one account — a webhook pointed at a tool's host shows that tool — or undefined for the type's own. */
  connectionMark?(connection: Pick<Connection, 'type' | 'account_identity'>): string | undefined;
} = { connectionForms: {} };
