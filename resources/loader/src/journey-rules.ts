import type { TemplateScreen } from '@renderer/types';

export type Answers = Record<string, string | string[]>;
export interface Clause { readonly question: string; readonly operator: 'is' | 'is_not' | 'includes_any' | 'includes_none'; readonly values: readonly string[]; }
export interface Condition { readonly match: 'all' | 'any'; readonly clauses: readonly Clause[]; }

export interface JourneyPath { readonly indices: readonly number[]; readonly answers: Answers; }
export interface JourneyDecision { readonly from: number; readonly to: number; readonly kind: 'route' | 'continue' | 'hidden'; readonly priority?: number; }
export interface JourneySkip { readonly index: number; readonly reason: 'condition' | 'route'; readonly from?: number; readonly to?: number; readonly missingQuestions?: readonly string[]; }
export interface JourneyTrace extends JourneyPath { readonly decisions: readonly JourneyDecision[]; readonly skips: readonly JourneySkip[]; }

/** A blank source makes even a negative comparison false. */
export function matches(condition: Condition | undefined, answers: Answers): boolean {
  if (!condition) return true;
  if (!condition.clauses.length) return false;
  const evaluated = condition.clauses.map(clause => {
    const raw = answers[clause.question];
    if (raw === undefined || raw === '' || (Array.isArray(raw) && !raw.length)) return false;
    const actual = Array.isArray(raw) ? raw : [raw];
    const hit = clause.values.some(value => actual.includes(value));
    return clause.operator === 'is_not' || clause.operator === 'includes_none' ? !hit : hit;
  });
  return condition.match === 'any' ? evaluated.some(Boolean) : evaluated.every(Boolean);
}

/** Resolve the visitor's route once, retaining the reason for each bypass. */
export function journeyTrace(steps: readonly TemplateScreen[], answers: Answers): JourneyTrace {
  const active: Answers = {};
  const indices: number[] = [];
  const decisions: JourneyDecision[] = [];
  const skips: JourneySkip[] = [];
  const positions = new Map(steps.map((step, index) => [step.id, index]));
  let at = 0;
  while (at < steps.length) {
    const step = steps[at];
    const shown = matches(step.when, active);
    if (shown) {
      indices.push(at);
      const nodes = [step.content];
      while (nodes.length) {
        const question = nodes.shift()!;
        if (question.type === 'question' && 'id' in question && typeof question.id === 'string' && answers[question.id] !== undefined) {
          active[question.id] = answers[question.id];
        }
        const layout = question as { children?: typeof nodes; start?: typeof nodes; end?: typeof nodes };
        nodes.push(...(layout.children ?? []), ...(layout.start ?? []), ...(layout.end ?? []));
      }
    } else {
      const missingQuestions = step.when?.clauses.filter(clause => {
        const value = active[clause.question];
        return value === undefined || value === '' || Array.isArray(value) && !value.length;
      }).map(clause => clause.question) ?? [];
      skips.push({ index: at, reason: 'condition', ...(missingQuestions.length ? { missingQuestions } : {}) });
    }
    const priority = shown ? step.paths?.findIndex(path => matches(path.when, active)) ?? -1 : -1;
    const route = priority >= 0 ? step.paths?.[priority] : undefined;
    const target = route ? positions.get(route.to) ?? at + 1 : at + 1;
    // Publication rejects missing and backward routes. The guard also keeps
    // a malformed cached payload from trapping a visitor in a loop.
    const next = target > at ? target : at + 1;
    if (next < steps.length) decisions.push({ from: at, to: next, kind: shown ? route ? 'route' : 'continue' : 'hidden', ...(route ? { priority } : {}) });
    if (shown && route) for (let bypassed = at + 1; bypassed < next; bypassed++) skips.push({ index: bypassed, reason: 'route', from: at, to: next });
    at = next;
  }
  return { indices, answers: active, decisions, skips };
}

/** Resolve a forward journey. Explicit routes have visible, first-match priority. */
export function journeyPath(steps: readonly TemplateScreen[], answers: Answers): JourneyPath {
  const { indices, answers: active } = journeyTrace(steps, answers);
  return { indices, answers: active };
}

/** A forward pass removes answers on skipped branches and hidden screens. */
export function activeAnswers(steps: readonly TemplateScreen[], answers: Answers): Answers {
  return journeyPath(steps, answers).answers;
}

export function visibleScreens(steps: readonly TemplateScreen[], answers: Answers): readonly TemplateScreen[] {
  return journeyPath(steps, answers).indices.map(index => steps[index]);
}

export function chooseResult<T extends { readonly when?: Condition }>(variants: readonly T[], answers: Answers): T | undefined {
  return variants.find(variant => variant.when && matches(variant.when, answers)) ?? variants.find(variant => !variant.when);
}
