import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * What a region shows when it has nothing, and the way out of it.
 *
 * **Inside the region, centred, one sentence and the action that fixes it**
 * (ADR 0039). All three halves were wrong somewhere in this admin before it was
 * written down: Optins and Leads put theirs inside the table as a `colSpan` row,
 * Analytics used a page-level `<p>`, Destinations had none at all — and not one
 * of them carried an action.
 *
 * The action is the part that matters. *"No Optins yet."* is a dead end: it
 * tells a merchant the state they can already see and leaves them to find the
 * door. *"No Optins yet"* beside the button that creates one is a screen.
 *
 * **It is not the loading state and cannot be reached from one.** A region is
 * `loading` until its first fetch lands, and this renders only on a `ready`
 * region with nothing in it — which is the distinction that made the creation
 * flow claim a Goal had no Playbooks while they were still arriving.
 *
 * The action is optional because the door is not always on this screen: the Lead
 * log fills when a published Optin captures something, and the honest action
 * there is a link to the Optins section rather than a button that pretends to
 * make a Lead.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-12 text-center">
      <Icon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="m-0 text-base font-semibold text-foreground">{title}</p>
      {children !== undefined && (
        <p className="m-0 text-pretty text-muted-foreground">{children}</p>
      )}
      {action}
    </div>
  );
}
