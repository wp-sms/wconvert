import { cn } from "@/lib/utils"

/**
 * A placeholder bar. Static, never pulsing (GUIDELINES §6, §12, §13): a shape
 * that holds the layout still says "coming" without motion, and one colour —
 * `--skeleton` — so no screen reaches for its own grey.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
