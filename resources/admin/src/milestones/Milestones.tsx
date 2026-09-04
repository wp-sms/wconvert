import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Description } from '../shell/Description';
import { Region, RegionBody, RegionHeader } from '../shell/Region';
import { LOADING, failed, ready, type Loadable } from '../shell/loadable';
import { readMilestones, stuckAt, type MilestonePayload, type StuckAt } from './api';

/**
 * ============================================================================
 * WHAT A SITE HAS REACHED — DRAWN ONLY WHERE IT CHANGES WHAT YOU DO NEXT.
 * ============================================================================
 * Five milestones instrument activation through first conversion (#94), and
 * the obvious screen for them is five dates in a list. That screen is the one
 * ADR 0042 rule 2 exists to stop: *"does knowing this change what they do?"* —
 * and **a milestone that has been reached never does**. "First shown on 4
 * March" is true, permanent, and has no action attached to it.
 *
 * What DOES change what a merchant does next is the first one they have not
 * reached, because each unmet step has a different cause and a different door:
 *
 * - Nothing published — there is nothing to see; the door is the Optins list.
 * - Published and never shown — the display rules, the pages it targets, or a
 *   caching plugin that stripped the loader (ADR 0004). This is the step that
 *   is invisible without instrumentation, because every screen looks correct.
 * - Shown and never converted — the offer and the words.
 * - Converting and nothing reaching a [[Destination]] — the Destinations
 *   screen, where the error text and the repair actions already are.
 *
 * So this region draws **at most one step**, and renders nothing at all once
 * they are all met. It is the same editorial call ADR 0042 made about the
 * contrast checker: print the pair that is wrong, and one line when none is.
 *
 * The dates themselves are still readable — see {@link WhatWasRecorded} —
 * because "the values are readable on an admin screen" is an acceptance
 * criterion. They are behind a disclosure, and the reason is not tidiness:
 * what that disclosure is FOR is the sentence at the bottom of it.
 */
export function Milestones() {
  const [milestones, setMilestones] = useState<Loadable<MilestonePayload>>(LOADING);

  useEffect(() => {
    void (async () => {
      try {
        setMilestones(ready(await readMilestones()));
      } catch (cause) {
        setMilestones(failed(cause));
      }
    })();
  }, []);

  if (milestones.status !== 'ready') {
    /*
      **No skeleton, deliberately.** A region that reserves height for
      something it will usually not draw is a region that pushes the numbers
      down on every visit and then takes the space back. The common case on a
      working site is that this renders nothing, and the honest loading state
      for nothing is nothing.
    */
    return null;
  }

  const stuck = stuckAt(milestones.data);

  return (
    <>
      {stuck !== null && <NextStep stuck={stuck} milestones={milestones.data} />}
      <WhatWasRecorded milestones={milestones.data} />
    </>
  );
}

/** One step, its reason, and the door — which is on a section this admin has. */
function NextStep({ stuck, milestones }: { stuck: StuckAt; milestones: MilestonePayload }) {
  const step = describe(stuck, milestones);

  return (
    <Region>
      <RegionHeader title={step.title} description={step.reason} />
      <RegionBody>
        <Button asChild variant="outline">
          <a href={step.href}>{step.action}</a>
        </Button>
      </RegionBody>
    </Region>
  );
}

/**
 * The words for one step.
 *
 * A `switch` and not a lookup keyed by the payload, because these are five
 * sentences rather than five rows of data — and the reason for each is
 * different in kind, not only in wording.
 */
function describe(
  stuck: StuckAt,
  milestones: MilestonePayload,
): { title: string; reason: string; action: string; href: string } {
  const optins = { action: __('Go to Optins', 'wconvert'), href: '#optins' };
  const destinations = { action: __('Go to Destinations', 'wconvert'), href: '#destinations' };

  switch (stuck) {
    case 'publish':
      return {
        title: __('Nothing is live yet', 'wconvert'),
        reason: __(
          'An Optin has to be published before it can be shown to anyone or counted here.',
          'wconvert',
        ),
        ...optins,
      };
    case 'impression':
      return {
        title: __('Published, and not shown to anyone yet', 'wconvert'),
        reason: sprintf(
          /* translators: %s: a date, in the site's timezone. */
          __(
            'Live since %s and nothing has been counted. That is usually the display rules, the pages it targets, or a caching or optimisation plugin removing the script.',
            'wconvert',
          ),
          milestones.first_publish ?? '',
        ),
        ...optins,
      };
    case 'conversion':
      return {
        title: __('Shown, and nobody has converted yet', 'wconvert'),
        reason: sprintf(
          /* translators: %s: a date, in the site's timezone. */
          __(
            'First shown on %s. Visitors are seeing it, so the offer and the words are where to look.',
            'wconvert',
          ),
          milestones.first_impression ?? '',
        ),
        ...optins,
      };
    case 'failing':
      return {
        title: __('A Destination is refusing what you capture', 'wconvert'),
        reason: __(
          'Every Lead is safe in the lead log either way. The error and the re-push are on the Destinations screen.',
          'wconvert',
        ),
        ...destinations,
      };
    case 'delivery':
      return {
        title: __('Converting, and nothing has reached a Destination yet', 'wconvert'),
        reason: sprintf(
          /* translators: %s: a date, in the site's timezone. */
          __(
            'First conversion on %s. Every Lead is safe in the lead log; check that a Destination is bound to the Optin that captured it.',
            'wconvert',
          ),
          milestones.first_conversion ?? '',
        ),
        ...destinations,
      };
  }
}

/**
 * ============================================================================
 * THE DISCLOSURE IS FOR ITS LAST SENTENCE, NOT FOR ITS DATES.
 * ============================================================================
 * `readme.txt` promises no licence key, no analytics sent anywhere and no
 * visitor identifier. That promise is the reason a privacy-conscious merchant
 * installs this rather than something else, and a promise nobody can check is
 * worth less than one they can — so this is the claim made checkable on the
 * merchant's own screen, with the whole of what was recorded as its evidence.
 *
 * **That is what earns it a place under ADR 0042 rule 2.** The dates on their
 * own change nothing a merchant does; a merchant deciding whether to believe
 * the privacy claim behaves differently depending on whether they can see it.
 *
 * `<details>`, closed, so it costs one line on every visit rather than a
 * block — and a native one rather than the vendored accordion, because it
 * needs no animation, no state and no portal, and it works before this bundle
 * has hydrated.
 */
function WhatWasRecorded({ milestones }: { milestones: MilestonePayload }) {
  const notYet = __('Not yet', 'wconvert');
  const rows: { label: string; value: string }[] = [
    { label: __('First published', 'wconvert'), value: milestones.first_publish ?? notYet },
    { label: __('First shown', 'wconvert'), value: milestones.first_impression ?? notYet },
    { label: __('First conversion', 'wconvert'), value: milestones.first_conversion ?? notYet },
    {
      label: __('First change to a starting point', 'wconvert'),
      value:
        milestones.first_edit === null
          ? notYet
          : sprintf(
              /* translators: 1: what was changed. 2: a date, in the site's timezone. */
              __('%1$s, on %2$s', 'wconvert'),
              milestones.first_edit.part_label,
              milestones.first_edit.on,
            ),
    },
    {
      label: __('Reaching a Destination', 'wconvert'),
      value: destinationState(milestones),
    },
  ];

  return (
    <Region>
      {/*
        `[&>summary]` rather than a class on the element: the marker and the
        hand cursor are one decision about what a summary IS, and this admin
        states such rules once for the ROLE (ADR 0042 rule 8).
      */}
      <details className="group">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-foreground marker:content-['']">
          {__('What WConvert has recorded about this site', 'wconvert')}
        </summary>

        <RegionBody className="flex flex-col gap-4 border-t border-border">
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="m-0 tabular-nums text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/*
            **The sentence this disclosure exists for.** Five local facts about
            the site, no visitor identifier anywhere near them (ADR 0017), and
            nothing that leaves.
          */}
          <Description>
            {__(
              'All of it is stored on this site, in your own database, and none of it is sent anywhere. WConvert records nothing about individual visitors.',
              'wconvert',
            )}
          </Description>
        </RegionBody>
      </details>
    </Region>
  );
}

/** Three booleans as one sentence, and never as a number the other screen owns. */
function destinationState(milestones: MilestonePayload): string {
  const { configured, landed, failing } = milestones.destinations;

  if (!configured) {
    return __('None configured', 'wconvert');
  }

  if (failing) {
    return __('Something is failing', 'wconvert');
  }

  return landed ? __('Yes', 'wconvert') : __('Nothing has landed yet', 'wconvert');
}
