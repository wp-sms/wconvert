import './report.css';
import type { ReactNode } from 'react';
import { Disclosure } from '../shell/Disclosure';

/**
 * Report evidence and definitions, folded under the report they explain. It is
 * the shared `Disclosure` (ADR 0131) — inline, at the region's own inset —
 * rather than the leading chevron it used to draw.
 */
export function ReportDisclosure({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <Disclosure variant="inline" title={title} open={open} className="wa-report-details" bodyClassName="wa-report-details-body">
    {children}
  </Disclosure>;
}
