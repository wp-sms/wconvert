import { Suspense, type ComponentType } from 'react';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import type { ReportPeriod } from './api';
import { __ } from '@wordpress/i18n';

/**
 * Linked sales in one line, for the overview's impact row (ADR 0132). Only a
 * complete report with linked orders sends one; anything else sends null, so
 * the card never shows a partial or empty total. `amount` is null when the
 * orders span several currencies or a refund left it unknown.
 */
export interface CommerceSummary { orders: number; amount: number | null; currency: string | null; }
export interface ReportExtensionProps {
  period: ReportPeriod;
  optinId?: string;
  campaignNames?: Record<string, string>;
  /** Frontend-only seam: the overview draws the hero card, the extension owns the read. */
  onSummary?: (summary: CommerceSummary | null) => void;
}
export const reportExtensions: { commerce?: ComponentType<ReportExtensionProps> } = {};
export function CommerceReport(props: ReportExtensionProps) {
  const Component = reportExtensions.commerce;
  return Component ? <Suspense fallback={<RegionSkeleton label={__('Campaign sales', 'wconvert')} lines={3} />}><Component {...props} /></Suspense> : null;
}
