import { journeyAuthoring } from '@/journeyAuthoring';
import { QuestionSettings, ResultSettings, ScreenConditionSettings } from './JourneySettings';
import { RouteEditor } from './RouteEditor';

/**
 * Fills free's journey authoring slots (ADR 0147).
 *
 * Eager rather than `lazy()`, unlike the other Pro admin slots: a repair
 * opens a screen and focuses a condition inside it on the next frame, and a
 * chunk still loading would leave nothing there to focus.
 */
export function registerJourneyAuthoring(): void {
  journeyAuthoring.question = QuestionSettings;
  journeyAuthoring.result = ResultSettings;
  journeyAuthoring.screenCondition = ScreenConditionSettings;
  journeyAuthoring.route = RouteEditor;
}
