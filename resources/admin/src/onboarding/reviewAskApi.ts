import apiFetch from '@wordpress/api-fetch';

export type ReviewChoice = 'rated' | 'later' | 'declined';

/** Record what this user chose on the review card (ADR 0191). */
export const recordReviewChoice = (choice: ReviewChoice) =>
  apiFetch<{ choice: ReviewChoice }>({ path: '/wconvert/v1/review-ask', method: 'POST', data: { choice } });
