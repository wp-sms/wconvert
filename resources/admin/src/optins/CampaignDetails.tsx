import { planFrom } from '../builder/rules/plan';
import { useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';
import { getOptin, getRules, type Frequency, type RuleType, type Targeting } from '../builder/api';
import { summarise, summaryOf, type DisplayRulesValue } from '../builder/rules/summaries';
import { derive } from '../builder/rules/picks';
import { namedPages, whereReading } from '../builder/rules/sentence';
import { resolveObjects } from '../builder/rules/objects';
import { convertingActOf } from '../builder/structure/guards';
import { destinationsSaid } from '../builder/destinations';
import { capturedFields } from '../destinations/requirements';
import { readDestinations } from '../destinations/api';
import { listGoals } from '../goals/api';
import { FactList, type Fact } from '../shell/FactList';
import { campaignFacts, linksIn } from './campaignFacts';
import { RegionError } from '../shell/Region';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { messageOf } from '../shell/loadable';

/**
 * The first three included pages by name, or null to keep the count.
 *
 * A post or term id needs a lookup the editor's sentence cannot wait for;
 * Details can. An id core does not return (a draft, a deleted post) or a
 * failed read falls back to the count — never to `#42`, and never to nothing.
 */
async function pageNames(include: NonNullable<Targeting['include']>, types: readonly RuleType[]): Promise<string[] | null> {
  const first = include.slice(0, 3).map((rule) => ({ rule, param: types.find((type) => type.type === rule.type)?.params.value }));
  const ids = (control: string) => first.filter(({ param }) => param?.control === control).map(({ rule }) => String(rule.value));
  try {
    const [posts, terms] = await Promise.all([resolveObjects('post', ids('post_id')), resolveObjects('term', ids('term_id'))]);
    const names = first.map(({ rule, param }) => {
      const value = String(rule.value);
      if (param?.control === 'post_id') return posts.find((hit) => hit.id === value)?.title ?? null;
      if (param?.control === 'term_id') return terms.find((hit) => hit.id === value)?.title ?? null;
      if (param?.control === 'path_glob' && value.trim() !== '') return value.trim();
      return param?.options.find((option) => option.value === value)?.label ?? null;
    });
    return names.every((name): name is string => name !== null) ? names : null;
  } catch {
    return null;
  }
}

async function readContext(id: string) {
  const [draft, vocabulary, destinations, goals] = await Promise.all([
    getOptin(id),
    getRules(),
    readDestinations(),
    // The Goal only names the number; Details still reads without it.
    listGoals().catch(() => []),
  ]);
  const config = draft.config;
  const template = config.template as Template | undefined;
  const act = template ? convertingActOf(template.tree)[0] : undefined;
  const targeting = (config.targeting ?? {}) as Targeting;
  const value: DisplayRulesValue = {
    display_rules: planFrom(config.display_rules),
    targeting,
    frequency: (config.frequency ?? {}) as Frequency,
    schedule: {
      ...(typeof config.starts_at === 'string' ? { starts_at: config.starts_at } : {}),
      ...(typeof config.ends_at === 'string' ? { ends_at: config.ends_at } : {}),
    },
    priority: typeof config.priority === 'number' ? config.priority : 0,
  };
  const rules = summarise(value, vocabulary);
  const inline = config.display_type === 'inline';
  const pick = derive('where', value, vocabulary).id;
  const include = targeting.include ?? [];
  const names = !inline && pick !== 'entire' && pick !== 'blog' && include.length > 0
    ? await pageNames(include, vocabulary.targeting) : null;
  const where = names ? whereReading(pick, targeting, vocabulary.targeting, namedPages(names, include.length)).answer : summaryOf(rules, 'where');
  const bound = Array.isArray(config.destinations) ? (config.destinations as string[]) : [];
  const forwarding = destinationsSaid(bound, destinations.destinations, capturedFields(template));
  return {
    rules,
    where,
    forwarding,
    act,
    counts: goals.find((goal) => goal.id === draft.goal)?.headline_label ?? null,
    inline,
    links: linksIn(template),
  };
}

/**
 * **How it runs** — the saved campaign's rules and where its leads go, as one
 * icon list (ADR 0137), the same list Review & publish reads (ADR 0138).
 * Loaded only when Details opens from the list; it shares the editor's rule
 * and forwarding summaries, so the two never describe one campaign
 * differently.
 */
export default function CampaignDetails({ id }: { id: string }) {
  const [context, setContext] = useState<Awaited<ReturnType<typeof readContext>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setContext(null);
    setError(null);
    void readContext(id)
      .then((value) => {
        if (active) setContext(value);
      })
      .catch((cause) => {
        if (active) setError(messageOf(cause));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (error) return <RegionError message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!context) return <RowsSkeleton rows={4} />;
  return <HowItRuns facts={campaignFacts({
    ...context,
    where: context.inline ? { text: __('Where you place its block or shortcode', 'wconvert') } : context.where,
  })} />;
}

/** The section both Details hosts draw the facts in. */
export function HowItRuns({ facts }: { facts: readonly Fact[] }) {
  const heading = useId();
  return (
    <section className="wconvert-campaign-facts" aria-labelledby={heading}>
      <h3 id={heading}>{__('How it runs', 'wconvert')}</h3>
      <FactList facts={facts} />
    </section>
  );
}
