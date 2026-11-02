import { cn } from "@/lib/utils"

/**
 * A placeholder bar. Static, never pulsing (GUIDELINES §6, §12, §13): a shape
 * that holds the layout still says "coming" without motion, and one colour —
 * `--skeleton` — so no screen reaches for its own grey.
 *
 * `inline` draws it as a `<span>`, for a bar inside running text: a `<div>` in
 * a `<p>` is invalid, and the browser ends the paragraph to fix it.
 */
function Skeleton({ className, inline = false, ...props }: React.ComponentProps<"div"> & { inline?: boolean }) {
  const Tag = (inline ? "span" : "div") as "div"
  return (
    <Tag
      data-slot="skeleton"
      className={cn("rounded-md bg-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
