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
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-(--control-height) max-w-full min-w-0 rounded-md border border-input bg-card ps-3 pe-9 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
