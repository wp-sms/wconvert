import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { flushSync } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import './report.css';

type ReportName = 'performance' | 'campaigns' | 'attention' | 'goals' | 'products' | 'sales' | 'activity' | 'answers' | 'targets';
type Target = { label: string; element: HTMLDivElement; onJump?: () => void };
/** The order the reports stand in on the page, on every page, so the menu reads down it. */
const ORDER: ReportName[] = ['performance', 'campaigns', 'attention', 'goals', 'products', 'sales', 'activity', 'answers', 'targets'];
const Navigation = createContext<{
  targets: Partial<Record<ReportName, Target>>;
  register: (name: ReportName, target: Target | null) => void;
} | null>(null);

export function ReportNavigationProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<Partial<Record<ReportName, Target>>>({});
  const register = useCallback((name: ReportName, target: Target | null) => {
    setTargets(previous => {
      const next = { ...previous };
      if (target) next[name] = target;
      else delete next[name];
      return next;
    });
  }, []);
  return <Navigation.Provider value={{ targets, register }}>{children}</Navigation.Provider>;
}

/**
 * Only mounted reports register a shortcut: no dead links for unavailable sales or empty answers.
 *
 * `onJump` runs just before a jump lands, for a report that has to open first
 * (ADR 0185). Keep it stable: a new function registers the target again.
 */
export function ReportTarget({ name, label, onJump, children }: { name: ReportName; label: string; onJump?: () => void; children: ReactNode }) {
  const register = useContext(Navigation)?.register;
  const id = useId();
  const ref = useCallback((element: HTMLDivElement | null) => {
    register?.(name, element ? { label, element, onJump } : null);
  }, [register, name, label, onJump]);
  return register ? <div id={id} ref={ref} tabIndex={-1} role="group" aria-label={label} className="wa-report-target">{children}</div> : children;
}

function jumpTo(target: Target) {
  // Laid out before the scroll: a report near the foot may only reach the top once it is open.
  if (target.onJump) flushSync(target.onJump);
  target.element.focus({ preventScroll: true });
  target.element.scrollIntoView({ block: 'start' });
}

/**
 * A way into one mounted report from elsewhere on the page, such as the
 * Linked sales card into Campaign sales, or null while it is not mounted.
 */
export function useReportJump(name: ReportName): { controls: string; jump: () => void } | null {
  const target = useContext(Navigation)?.targets[name];
  return target ? { controls: target.element.id, jump: () => jumpTo(target) } : null;
}

/**
 * One quiet menu beside the page's other actions (ADR 0185), which costs the
 * report no height and does not wrap on a phone. The jump waits for the menu to
 * close, and takes focus with it, so choosing a section does not hand focus back
 * to this button; closing without a choice does.
 */
export function ReportShortcuts() {
  const navigation = useContext(Navigation);
  const chosen = useRef<Target | null>(null);
  const sections = ORDER.flatMap(name => navigation?.targets[name] ?? []);
  if (sections.length < 2) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="wa-jump-to">{__('Jump to', 'wconvert')}<ChevronDown aria-hidden="true" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      onCloseAutoFocus={(event) => {
        const target = chosen.current;
        if (!target) return;
        chosen.current = null;
        event.preventDefault();
        jumpTo(target);
      }}
    >
      {sections.map(target => <DropdownMenuItem key={target.label} onSelect={() => { chosen.current = target; }}>{target.label}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
