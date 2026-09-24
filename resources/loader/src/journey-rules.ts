import type { TemplateScreen } from '@renderer/types';

export type Answers = Record<string, string | string[]>;
export interface Clause { readonly question: string; readonly operator: 'is' | 'is_not' | 'includes_any' | 'includes_none'; readonly values: readonly string[]; }
export interface Condition { readonly match: 'all' | 'any'; readonly clauses: readonly Clause[]; }

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

/** A forward pass removes hidden answers, including answers depending on them. */
export function activeAnswers(steps: readonly TemplateScreen[], answers: Answers): Answers {
  const active: Answers = {};
  for (const step of steps) {
    if (!matches(step.when, active)) continue;
    const nodes = [step.content];
    while (nodes.length) {
      const question = nodes.shift()!;
      if (question.type === 'question' && 'id' in question && typeof question.id === 'string' && answers[question.id] !== undefined) {
        active[question.id] = answers[question.id];
      }
      const layout = question as { children?: typeof nodes; start?: typeof nodes; end?: typeof nodes };
      nodes.push(...(layout.children ?? []), ...(layout.start ?? []), ...(layout.end ?? []));
    }
  }
  return active;
}

export function visibleScreens(steps: readonly TemplateScreen[], answers: Answers): readonly TemplateScreen[] {
  const active = activeAnswers(steps, answers);
  return steps.filter(step => matches(step.when, active));
}

export function chooseResult<T extends { readonly when?: Condition }>(variants: readonly T[], answers: Answers): T | undefined {
  return variants.find(variant => variant.when && matches(variant.when, answers)) ?? variants.find(variant => !variant.when);
}
