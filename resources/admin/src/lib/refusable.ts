import type { MouseEvent } from 'react';

/**
 * A button refused for a reason the merchant can fix (GUIDELINES §14): it stays
 * focusable, its description is the reason, and a press does nothing. Pass the
 * id of the element holding the reason, or null where it is not refused.
 *
 * Declining the click rather than the submit stops a refused submit button
 * however it was pressed, since Enter in a field clicks the form's default
 * button. Busy is separate: put the real `disabled` beside this. A radio or
 * checkbox declines in its own `onChange`, so React can put its state back.
 */
export function refusable(reasonId: string | null, press?: (event: MouseEvent<HTMLElement>) => void) {
  return {
    'aria-disabled': reasonId === null ? undefined : true,
    'aria-describedby': reasonId ?? undefined,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (reasonId !== null) {
        event.preventDefault();
        return;
      }
      press?.(event);
    },
  } as const;
}
