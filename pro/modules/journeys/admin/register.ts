import { journeyAuthoring } from '@/journeyAuthoring';
import { QuestionSettings } from './JourneySettings';
import { useJourneyAuthoring } from './useJourneyAuthoring';

/**
 * Fills free's journey authoring seam (ADR 0147).
 *
 * Set before the builder renders rather than through `lazy()`, unlike the
 * other Pro admin slots: the screens editor calls the hook on every render,
 * and a repair opens a screen and focuses a condition inside it on the next
 * frame, which a chunk still loading would leave nothing to focus. Pro's entry
 * registers this as a `renderExtensions` loader, which the builder's boundary
 * awaits before its first render, so both hold and it stays off Pro's main file.
 */
export function registerJourneyAuthoring(): void {
  journeyAuthoring.question = QuestionSettings;
  journeyAuthoring.useAuthoring = useJourneyAuthoring;
}
