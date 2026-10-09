import { createContext, useCallback, useContext, useId, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import './report.css';

type ReportName = 'attention' | 'sales' | 'products' | 'activity' | 'answers';
type Target = { label: string; element: HTMLDivElement };
const ORDER: ReportName[] = ['attention', 'products', 'sales', 'activity', 'answers'];
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

/** Only mounted reports register a shortcut: no dead links for unavailable sales or empty answers. */
export function ReportTarget({ name, label, children }: { name: ReportName; label: string; children: ReactNode }) {
  const register = useContext(Navigation)?.register;
  const id = useId();
  const ref = useCallback((element: HTMLDivElement | null) => {
    register?.(name, element ? { label, element } : null);
  }, [register, name, label]);
  return register ? <div id={id} ref={ref} tabIndex={-1} role="group" aria-label={label} className="wa-report-target">{children}</div> : children;
}

export function ReportShortcuts() {
  const navigation = useContext(Navigation);
  if (!navigation || Object.keys(navigation.targets).length < 2) return null;
  return <nav aria-label={__('Report sections', 'wconvert')} className="wa-report-shortcuts wconvert-toolbar">
    <span className="wa-muted">{__('Jump to', 'wconvert')}</span>
    {ORDER.map(name => {
      const target = navigation.targets[name];
      return target && <Button key={name} variant="outline" aria-controls={target.element.id} onClick={() => {
        target.element.focus({ preventScroll: true });
        target.element.scrollIntoView({ block: 'start' });
      }}>{target.label}</Button>;
    })}
  </nav>;
}
