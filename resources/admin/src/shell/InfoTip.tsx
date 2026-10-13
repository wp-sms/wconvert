import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { GuideLink } from './GuideLink';

/**
 * Shared help affordance: one icon size, keyboard dismissal and viewport collision handling.
 *
 * `guide` (a `docsUrl()`) ends the tip with a link to the full article, so a
 * screen can point at its guide without adding a line at rest (ADR 0145).
 */
export function InfoTip({ label, guide, children }: { label: string; guide?: string; children: ReactNode }) {
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon-sm" className="wconvert-info-trigger" aria-label={label}>
        <Info className="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="center" collisionPadding={16} className="wconvert-info-content max-w-[calc(100vw-2rem)] break-words text-note leading-relaxed" aria-label={label}>
      {children}
      {guide && <p><GuideLink href={guide} /></p>}
    </PopoverContent>
  </Popover>;
}
