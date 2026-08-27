import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { cn } from '../lib/utils';

/**
 * A card with its own edge, holding **exactly one concern** (ADR 0039).
 *
 * That is the whole rule, and the Leads screen is why it needed writing down: a
 * table of captured [[Lead]]s and the setting that deletes them shared one
 * block, so the object a merchant was looking at was "leads and also a thing
 * that destroys leads". Two concerns are two regions, and the edge between them
 * is what says so.
 *
 * **The shell draws no surface** — that was removed in #63 for exactly this
 * reason — so a region drawing its own is not decoration. It is the only thing
 * between the page background and the content.
 *
 * `label` names the region for a screen reader where there is no visible
 * heading. A region that renders a {@see RegionHeader} does not need it: the
 * heading is already the name, and passing both spells one thing twice.
 */
export function Region({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn('overflow-hidden rounded-md border border-border bg-card', className)}
    >
      {children}
    </section>
  );
}

/**
 * What this region is, where the page header does not already say it.
 *
 * An `<h2>` because the page header owns the `<h1>` and a region is a level
 * under it — which is also what makes a screen with two regions readable by
 * heading navigation rather than by scrolling.
 */
export function RegionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-border px-4 py-3">
      <h2 className="m-0 text-base font-semibold leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      {description !== undefined && (
        <p className="mt-1 mb-0 max-w-2xl text-pretty text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Content that is not a table, at the region's own padding. */
export function RegionBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}

/**
 * Below the data: a truncation notice today, pagination when it arrives.
 *
 * It exists so #66 does not have to invent a place for the sentence saying the
 * log is capped, and so the next screen that needs one finds it already decided
 * (ADR 0039).
 */
export function RegionFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-2.5 text-muted-foreground">{children}</div>
  );
}

/**
 * The failure, at the top of **the region that failed**.
 *
 * **Not at the top of the page**, which is where all five screens put every
 * error regardless of what produced it. A screen has more than one thing on it
 * that can fail independently, and an error a long way from the control that
 * caused it is an error the merchant has to guess the subject of.
 *
 * It carries no dismiss control on purpose: it clears when the next fetch
 * succeeds, so there is no path where a merchant hides a failure and then
 * reads the stale data underneath it as current.
 */
export function RegionError({ message }: { message: string }) {
  return (
    <div className="border-b border-border p-3">
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        <AlertTitle>{message}</AlertTitle>
      </Alert>
    </div>
  );
}

/**
 * The failure, with a sentence saying what to do about it.
 *
 * Used where the region has nothing else to show — a first fetch that failed
 * leaves no table to sit above, so the alert IS the region's content.
 */
export function RegionErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <RegionBody>
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        <AlertTitle>{message}</AlertTitle>
        {hint !== undefined && <AlertDescription>{hint}</AlertDescription>}
      </Alert>
    </RegionBody>
  );
}
