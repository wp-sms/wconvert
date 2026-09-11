import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

/** Keep incomplete CSS or numbers local until the merchant finishes typing. */
export function StyleValueInput({ value, onCommit, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'> & {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState({ source: value, text: value });
  if (draft.source !== value) setDraft({ source: value, text: value });
  return <input {...input} value={draft.text} data-style-value-pending={draft.text !== value ? 'true' : undefined}
    onChange={(event) => setDraft({ source: value, text: event.target.value })}
    onBlur={() => {
      setDraft({ source: value, text: value });
      if (draft.text !== value) onCommit(draft.text);
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDraft({ source: value, text: value });
      }
    }} />;
}
