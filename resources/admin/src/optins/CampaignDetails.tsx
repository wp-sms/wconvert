import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { Template } from '@renderer/types';
import { getOptin, getRules, type Frequency, type Rule, type Targeting } from '../builder/api';
import { summarise } from '../builder/rules/summaries';
import { convertingActOf } from '../builder/structure/guards';
import { nodeAt, nodesOf } from '../builder/structure/tree';
import { destinationsSaid } from '../builder/destinations';
import { capturedFields } from '../destinations/requirements';
import { readDestinations } from '../destinations/api';
import { Button } from '../components/ui/button';
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
      rules: Array.isArray(config.rules) ? (config.rules as Rule[]) : [],
      targeting: (config.targeting ?? {}) as Targeting,
      frequency: (config.frequency ?? {}) as Frequency,
      schedule: {
        ...(typeof config.starts_at === 'string' ? { starts_at: config.starts_at } : {}),
        ...(typeof config.ends_at === 'string' ? { ends_at: config.ends_at } : {}),
      },
      priority: typeof config.priority === 'number' ? config.priority : 0,
    },
    vocabulary,
    config.display_type !== 'inline',
    act,
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

/** Loaded only when details open; shares the editor's rule and forwarding summaries. */
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
  if (error)
    return (
      <div role="alert">
        <p>
          {__('Campaign details couldn’t load.', 'wconvert')} {error}
        </p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          {__('Try again', 'wconvert')}
        </Button>
      </div>
    );
  if (!context) return <p role="status">{__('Loading campaign details…', 'wconvert')}</p>;
  return (
    <div className="wc-campaign-context">
      <h3>{__('Audience & placement', 'wconvert')}</h3>
      {context.inline && (
        <p>
          {__(
            'Appears where you place its block or shortcode, when these rules allow it.',
            'wconvert',
          )}
        </p>
      )}
      <dl>
        {context.rules.map((rule) => (
          <div key={rule.id}>
            <dt>{rule.eyebrow}</dt>
            <dd>{rule.text}</dd>
          </div>
        ))}
      </dl>
      <h3>{__('After conversion', 'wconvert')}</h3>
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
          <p>
            {__(
              'Records button clicks to the linked destination. No lead is captured.',
              'wconvert',
            )}
          </p>
          {context.links.map((link) => (
            <p className="wc-campaign-context-url" key={link}>
              {link}
            </p>
          ))}
        </>
      ) : (
        <p>{__('Choose a converting action in the editor.', 'wconvert')}</p>
      )}
    </div>
  );
}
