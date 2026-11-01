import apiFetch from '@wordpress/api-fetch';
import type { Milestones } from './checklist';

/** All-time milestones; the checklist reads three of them (ADR 0176). */
export const readMilestones = () => apiFetch<Milestones>({ path: '/wconvert/v1/milestones' });

/** Put the checklist away for this user. */
export const hideChecklist = () => apiFetch<{ hidden: boolean }>({ path: '/wconvert/v1/getting-started/hide', method: 'POST' });
