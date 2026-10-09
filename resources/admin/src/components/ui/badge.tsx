import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-micro font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        /*
         * WCONVERT'S, not upstream's — and the escalation ADR 0036 names
         * ("if the vendored components turn out to fight the design, the
         * escalation is to edit them").
         *
         * ADR 0037 reserves green and amber for MEANING and forbids spending
         * them on chrome. A [[Suspended]] Optin and a published one are that
         * meaning exactly: the site is holding one back and serving the other,
         * and a merchant scanning the Status column is reading for which. So
         * this is the reserved palette being spent on what it was reserved for
         * (ADR 0039).
         *
         * Tinted rather than solid: each sits on its own measured surface
         * (`--success-surface` 5.32:1, `--warning-surface` 5.08:1, ADR 0130),
         * leaving the solid fills to the chart ramp, where a run of solid green badges down a table would
         * shout louder than the numbers.
         */
        success: "border-success/25 bg-success-surface text-success",
        warning: "border-warning/25 bg-warning-surface text-warning",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // In --link and underlined at rest: espresso --primary is the colour of body text (ADR 0130).
        link: "text-link underline-offset-4 [a&]:underline [a&]:decoration-link/40 [a&]:hover:decoration-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
