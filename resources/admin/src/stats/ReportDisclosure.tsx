import './report.css';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Consistent, keyboard-native disclosure for report evidence and definitions. */
export function ReportDisclosure({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="wa-report-details" open={open}>
    <summary><ChevronRight aria-hidden="true" className="size-4" /><span>{title}</span></summary>
    <div className="wa-report-details-body">{children}</div>
  </details>;
}
