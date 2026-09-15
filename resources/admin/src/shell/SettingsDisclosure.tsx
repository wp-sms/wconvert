import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Region, RegionHeader } from './Region';

/** Keep occasional settings nearby, with their saved state readable when closed. */
export function SettingsDisclosure({ title, summary, attention = false, expanded = false, children }: {
  title: string;
  summary: string;
  attention?: boolean;
  expanded?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (attention) setOpen(true);
  }, [attention]);

  if (expanded) return <Region><RegionHeader title={title} description={summary} />{children}</Region>;
  return (
    <Region className="wconvert-settings-disclosure">
      <h2 className="m-0">
        <button
          type="button"
          className="wconvert-settings-disclosure__trigger"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <span>
            <span className="block text-body font-semibold">{title}</span>
            <span className="mt-1 block text-note font-normal text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown aria-hidden="true" className={open ? 'rotate-180' : ''} />
        </button>
      </h2>
      <div id={id} hidden={!open} className="border-t border-border">{children}</div>
    </Region>
  );
}
