import type { ReactNode } from 'react';

/** Same responsive comparison surface for designs and authored campaign setups. */
export function ComparisonGrid({ children }: { children: ReactNode }) {
  return <div className="wconvert-comparison-grid">{children}</div>;
}
