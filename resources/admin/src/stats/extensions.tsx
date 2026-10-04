import { Suspense, type ComponentType } from 'react';
import { RegionSkeleton } from '../shell/RegionSkeleton';
import type { DashboardPayload } from './api';
import { __ } from '@wordpress/i18n';
export interface ReportExtensionProps { period: Pick<DashboardPayload, 'from' | 'to' | 'days' | 'month'>; optinId?: string; campaignNames?: Record<string, string>; }
export const reportExtensions: { commerce?: ComponentType<ReportExtensionProps> } = {};
export function CommerceReport(props: ReportExtensionProps) {
  const Component = reportExtensions.commerce;
  return Component ? <Suspense fallback={<RegionSkeleton label={__('Campaign sales', 'wconvert')} lines={3} />}><Component {...props} /></Suspense> : null;
}
