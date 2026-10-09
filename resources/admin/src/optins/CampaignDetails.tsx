import { planFrom } from '../builder/rules/plan';
import { useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';
import { getOptin, getRules, type Frequency, type Targeting } from '../builder/api';
import { summarise, summaryOf } from '../builder/rules/summaries';
import { convertingActOf } from '../builder/structure/guards';
import { nodeAt, nodesOf } from '../builder/structure/tree';
import { destinationsSaid } from '../builder/destinations';
import { capturedFields } from '../destinations/requirements';
import { readDestinations } from '../destinations/api';
import { RegionError } from '../shell/Region';
import { RowsSkeleton } from '../shell/RowsSkeleton';
import { messageOf } from '../shell/loadable';

async function readContext(id: string) {
  const [draft, vocabulary, destinations] = await Promise.all([
    getOptin(id),
    getRules(),
    readDestinations(),
  ]);
  const config = draft.config;
  const template = config.template as Template | undefined;
  const act = template ? convertingActOf(template.tree)[0] : undefined;
  const rules = summarise(
    {
      display_rules: planFrom(config.display_rules),
      targeting: (config.targeting ?? {}) as Targeting,
      frequency: (config.frequency ?? {}) as Frequency,
      schedule: {
        ...(typeof config.starts_at === 'string' ? { starts_at: config.starts_at } : {}),
        ...(typeof config.ends_at === 'string' ? { ends_at: config.ends_at } : {}),
      },
      priority: typeof config.priority === 'number' ? config.priority : 0,
    },
    vocabulary,
  );
  const bound = Array.isArray(config.destinations) ? (config.destinations as string[]) : [];
  const forwarding = destinationsSaid(bound, destinations.destinations, capturedFields(template));
  const links = template
    ? nodesOf(template.tree).flatMap((block) => {
        const node = nodeAt(template.tree, block.path);
        return node?.type === 'button' && 'action' in node && node.action === 'link' && 'href' in node && typeof node.href === 'string' && node.href ? [node.href] : [];
      })
    : [];
  return {
    rules,
    forwarding,
    act,
    inline: config.display_type === 'inline',
    links: [...new Set(links)],
  };
}

/**
 * The saved campaign's facts, grouped the way a merchant asks about them:
 * who it shows to, where, and what happens after signup (ADR 0131). Loaded
 * only when Details opens; it shares the editor's rule and forwarding
 * summaries, so the two never describe one campaign differently.
 */
export default function CampaignDetails({ id }: { id: string }) {
  const [context, setContext] = useState<Awaited<ReturnType<typeof readContext>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const heading = useId();
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
  const fact = (key: 'who' | 'when' | 'how-often' | 'dates') => {
    const rule = summaryOf(context.rules, key);
    return (
      <div key={key}>
        <dt>{rule.eyebrow}</dt>
        <dd>{rule.text}</dd>
      </div>
    );
  };
  return (
    <>
      <section className="wconvert-campaign-facts" aria-labelledby={`${heading}-shows-to`}>
        <h3 id={`${heading}-shows-to`}>{__('Shows to', 'wconvert')}</h3>
        <dl>{(['who', 'when', 'how-often', 'dates'] as const).map(fact)}</dl>
      </section>
      <section className="wconvert-campaign-facts" aria-labelledby={`${heading}-where`}>
        <h3 id={`${heading}-where`}>{__('Where', 'wconvert')}</h3>
        <p>
          {context.inline
            ? __('Where you place its block or shortcode, when the rules allow.', 'wconvert')
            : summaryOf(context.rules, 'where').text}
        </p>
      </section>
      <section className="wconvert-campaign-facts" aria-labelledby={`${heading}-after`}>
        <h3 id={`${heading}-after`}>
          {context.act === 'click' ? __('After a click', 'wconvert') : __('After signup', 'wconvert')}
        </h3>
        {context.act === 'submit' ? (
          <>
            <p>{__('New leads are saved in WConvert.', 'wconvert')}</p>
            <p>{context.forwarding.said}</p>
            {context.forwarding.problems.map((problem) => (
              <p key={problem}>{problem}</p>
            ))}
          </>
        ) : context.act === 'click' ? (
          <>
            <p>{__('Counts the click and opens the link. No lead is saved.', 'wconvert')}</p>
            {context.links.length > 0 && (
              <ul className="wconvert-campaign-facts__links">
                {context.links.map((link) => (
                  <li key={link} dir="ltr">
                    {link}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>{__('Choose what a visitor does in the editor.', 'wconvert')}</p>
        )}
      </section>
    </>
  );
}
