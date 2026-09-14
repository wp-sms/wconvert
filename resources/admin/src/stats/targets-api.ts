import apiFetch from '@wordpress/api-fetch';

export interface TargetMetric {
  id: string;
  label: string;
  unit: string;
  note: string;
  actual: number;
  target: number | null;
  available: boolean;
}
export interface MonthlyTargetReport {
  month: string;
  from: string;
  end: string;
  through: string | null;
  metrics: TargetMetric[];
  previous_month: string;
  previous_targets: Record<string, number>;
  max_target: number;
}
export const readMonthlyTargets = () =>
  apiFetch<MonthlyTargetReport>({ path: '/wconvert/v1/monthly-targets' });
export const saveMonthlyTargets = (
  month: string,
  targets: Record<string, number>,
) =>
  apiFetch<MonthlyTargetReport>({
    path: '/wconvert/v1/monthly-targets',
    method: 'POST',
    data: { month, targets },
  });
