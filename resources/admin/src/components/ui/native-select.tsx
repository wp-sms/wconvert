import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * **The one select** (ADR 0131): native, at the shared control height, with
 * the shared chevron and logical end padding from `index.css` (§6). A native
 * `<select>` inherits the page's direction and the platform's own picker,
 * which is why Leads' Radix `Select` was retired rather than copied.
 *
 * Inside a toolbar, table or footer the container drops it to the small
 * height (§3); never pass a size.
 *
 * **A tiny list stays native, and inside a sentence it is drawn as a word**
 * (ADR 0139). Rich lists — headings, icons, hints, refusals — are the option
 * menu's; two or three words are a select's:
 *
 * - `word` is the bordered word in *"Match [all ▾] of these"*.
 * - `pill` is a rounded word in a rule row: *is / is not*, *Signed in /
 *   Signed out*, *any of / all of / none of*. `data-negated` tints it amber,
 *   so a negation is never missed.
 *
 * The variants' look is `index.css`'s, beside the global select restyle it
 * has to outrank.
 */
function NativeSelect({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"select"> & {
  variant?: "default" | "word" | "pill"
}) {
  return (
    <select
      data-slot="native-select"
      data-variant={variant}
      className={cn(
        variant === "default"
          ? "h-(--control-height) max-w-full min-w-0 rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60 aria-invalid:border-destructive"
          : "wconvert-select-word max-w-full min-w-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
