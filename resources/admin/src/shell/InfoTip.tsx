import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

/** Shared help affordance: one icon size, keyboard dismissal and viewport collision handling. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon-sm" className="wconvert-info-trigger" aria-label={label}>
        <Info className="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="center" collisionPadding={16} className="wconvert-info-content max-w-[calc(100vw-2rem)] break-words text-note leading-relaxed" aria-label={label}>
      {children}
    </PopoverContent>
  </Popover>;
}
