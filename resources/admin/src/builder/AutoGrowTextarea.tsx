import { useLayoutEffect, useRef, type Ref, type TextareaHTMLAttributes } from 'react';

/**
 * A text box as tall as its words (ADR 0136).
 *
 * A one-line headline sat in a four-row box, and a two-line one in the same
 * box with two empty rows under it. This starts at one row and grows with
 * each line, so where a headline breaks is what the merchant sees.
 */
export function AutoGrowTextarea({ ref, value, className, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows' | 'value'> & {
  ref?: Ref<HTMLTextAreaElement>;
  value: string;
}) {
  const box = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    element.style.blockSize = 'auto';
    // jsdom measures nothing, and neither does a hidden panel: keep the CSS sizing there.
    if (element.scrollHeight > 0) element.style.blockSize = `${element.scrollHeight + 2}px`;
  }, [value]);
  return <textarea {...props} rows={1} value={value} className={['wconvert-autogrow', className].filter(Boolean).join(' ')} ref={element => {
    box.current = element;
    if (typeof ref === 'function') ref(element);
    else if (ref) ref.current = element;
  }} />;
}
