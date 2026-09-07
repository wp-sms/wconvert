import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Description } from './Description';
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
 * **`<h2>` by default**, because the page header owns the `<h1>` and a region is
 * a level under it — which is also what makes a screen with two regions
 * readable by heading navigation rather than by scrolling.
 *
 * `level` exists for a screen whose regions are a repeating SET rather than a
 * list of unrelated concerns: analytics draws one region per [[Goal]], and
 * those sit under the page's own subject rather than each introducing a new
 * one. `dashboard.test.tsx` pins them at level 3, which is the same reading
 * arrived at from the other side.
 *
 * `trailing` is for what belongs on the title's line and is not an action — the
 * window a set of numbers covers, a badge naming a state. Actions do not go
 * here: they are page-scoped and belong in the page header, or region-scoped
 * and belong in a {@see Toolbar} (ADR 0039).
 */
export function RegionHeader({
  title,
  description,
  level = 2,
  trailing,
}: {
  title: string;
  description?: string;
  level?: 2 | 3;
  trailing?: ReactNode;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
      <div className="min-w-0">
        <Heading className="m-0 text-heading font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </Heading>
        {description !== undefined && (
          <Description className="mt-1">{description}</Description>
        )}
      </div>
      {trailing}
    </div>
  );
}

/** Content that is not a table, at the region's own padding. */
export function RegionBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-4', className)}>{children}</div>;
}

/**
 * Below the data: a truncation notice, a step's Back and Continue, pagination
 * when it arrives.
 *
 * It exists so #66 does not have to invent a place for the sentence saying the
 * log is capped, and so the next screen that needs one finds it already decided
 * (ADR 0039).
 *
 * **Two screens invented one anyway**, at `px-4 py-3` — the creation flow's step
 * footer and the Destinations card's repair-and-remove row. Neither matched this
 * one's padding, and neither carried `.wconvert-footer`, so neither got the rule
 * in `index.css` that lets a button's label WRAP rather than push the strip
 * sideways: at 360px with a German label, *"Erfassungsdatensätze als CSV-Datei
 * herunterladen"* in a `whitespace-nowrap shrink-0` button takes the whole
 * screen with it. The class is what the rule is keyed on, so routing them
 * through here is what fixes it rather than a note asking them to remember.
 *
 * **It states no control height**, and that is deliberate: a step's Back and
 * Continue are what the merchant came to press and stand at `--control-height`,
 * while a card's repair action qualifies the card and stands at the small one.
 * Which of the two is the caller's `size`, because it is a question about the
 * control's scope rather than about the strip (ADR 0039).
 */
export function RegionFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'wconvert-footer border-t border-border px-4 py-2.5 text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
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
    <div className="border-b border-border px-4 py-2.5">
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        {/*
          **`line-clamp-none`, because `AlertTitle` ships `line-clamp-1`.** A
          region's error is a whole sentence from the server — often the only
          thing on screen saying what went wrong — and the vendored default
          truncated every one of them to a single line with an ellipsis. Two
          call sites in this admin already remembered to undo it and these two
          did not, which is the argument for undoing it HERE: the component
          that decides what an error looks like is the one place the decision
          belongs.
        */}
        <AlertTitle className="line-clamp-none">{message}</AlertTitle>
      </Alert>
    </div>
  );
}

/**
 * The failure, with a sentence saying what to do about it.
 *
 * Used where the region has nothing else to show — a first fetch that failed
 * leaves no table to sit above, so the alert IS the region's content.
 *
 * **The hint has a default, and nine of the ten call sites are why.** They all
 * spelled the identical string; the tenth spelled nothing, so the creation
 * flow's second step was the one screen in the admin whose failure named no
 * way out of itself. That is not a decision each caller should be making — an
 * error the merchant can do nothing about is the shape ADR 0042 rule 3 refuses
 * — so the door is the component's and a caller passes one only where it has a
 * better one to offer.
 */
export function RegionErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <RegionBody>
      <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
        <CircleAlert />
        <AlertTitle className="line-clamp-none">{message}</AlertTitle>
        <AlertDescription>
          {hint ?? __('Reload the page to try again.', 'wconvert')}
        </AlertDescription>
      </Alert>
    </RegionBody>
  );
}
