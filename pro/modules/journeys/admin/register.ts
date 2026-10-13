import { journeyAuthoring } from '@/journeyAuthoring';
import { QuestionSettings } from './JourneySettings';
import { useJourneyAuthoring } from './useJourneyAuthoring';

/**
 * Fills free's journey authoring seam (ADR 0147).
 *
 * Eager rather than `lazy()`, unlike the other Pro admin slots: the screens
 * editor calls the hook on every render, and a repair opens a screen and
 * focuses a condition inside it on the next frame, which a chunk still
 * loading would leave nothing to focus.
 */
export function registerJourneyAuthoring(): void {
  journeyAuthoring.question = QuestionSettings;
  journeyAuthoring.useAuthoring = useJourneyAuthoring;
}
