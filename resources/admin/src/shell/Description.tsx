import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * The sentence that explains the thing beside it.
 *
 * ============================================================================
 * A DESCRIPTION IS A ROLE, AND IT HAD NO SIZE OF ITS OWN.
 * ============================================================================
 * This admin spelled the same three utilities at nine call sites —
 * `text-pretty text-muted-foreground`, six of which forgot `text-pretty` — and
 * every one of them rendered at 14px by inheritance. So a description was
 * exactly as large as the body it explains, separated from it only by colour,
 * and the hierarchy a merchant was meant to read off the screen was carried by
 * one channel.
 *
 * `--text-note` is 13px and is the role's own size (see the type scale in
 * `index.css`). It is a step DOWN for eight of the nine and a step **up** for
 * the ninth: the suspension reason on the Optin list was `text-xs`, 12px — the
 * most important explanatory line on that screen set in its smallest text,
 * which is the single clearest argument for naming this role rather than
 * choosing a size per call site.
 *
 * **`max-w-2xl` travels with it**, because a description is prose and prose has
 * a measure. It was on two of the nine.
 *
 * `<p>` by default, and `as="span"` for the two places the description sits
 * inside something that is already a paragraph — a menu item's refusal reason,
 * a field's help under its own label.
 */
export function Description({
  as: Tag = 'p',
  className,
  id,
  children,
}: {
  as?: 'p' | 'span' | 'div';
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn('m-0 max-w-2xl text-pretty text-note text-muted-foreground', className)}
    >
      {children}
    </Tag>
  );
}
