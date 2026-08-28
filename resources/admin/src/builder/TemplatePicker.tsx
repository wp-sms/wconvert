import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { LayoutTemplate } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../shell/EmptyState';
import { Toolbar, ToolbarCount } from '../shell/Toolbar';
import { Gallery } from './Gallery';
import { isNarrowed, narrow, toggled, type Chosen } from './facets';
import { nameOf, type TemplateIndex, type TemplateIndexEntry } from '../templates/api';
import type { ConvertingAct } from './structure/catalogue';
import type { Template } from '@renderer/types';

/**
 * Choosing a design: a toolbar, a grid, and the three states a region owes.
 *
 * ============================================================================
 * A REGION HOLDS EXACTLY ONE CONCERN, AND THE DESIGN TAB HELD TWO (ADR 0039).
 * ============================================================================
 * *Choose a design* and *adjust the look* are two questions, and the Design tab
 * answered both. At three cards nobody noticed. At forty the gallery swamps the
 * token controls the tab is named for — so the tab keeps **the look**, and this
 * is where choosing happens.
 *
 * **It is opened deliberately and answered.** ADR 0042 rule 7 sets the test for
 * a modal — *something that owns the screen until it is answered* — and picking
 * a design is exactly that. (Rule 7's complaint is about `DropdownMenu`
 * defaulting to `modal`, not about dialogs.) It also buys the grid the full
 * width the builder caps at, rather than one pane beside a pinned preview:
 * ADR 0038's answer to a wider screen is another pane or more air, never a
 * longer line, and a grid of cards is what "another pane" looks like here.
 *
 * The creation flow needs no dialog for the same reason — its step has the full
 * width and no pinned preview — so this component is the CONTENTS, and where it
 * is drawn is the caller's ({@see TemplatePickerDialog}).
 *
 * ============================================================================
 * THE FILTERS APPEAR ONLY WHEN THE SET IS LARGE ENOUGH TO NEED THEM.
 * ============================================================================
 * Directly mirroring `Toolbar`'s own rule for the count — *a count is stated
 * only where the set can be large enough to need one; the Optin list has none
 * and is not missing one*. A chip strip over eight designs is a line that taxes
 * every visit and informs none (ADR 0042 rule 2), and a fresh install has
 * exactly that: the gallery is the one it always was, better.
 */

/**
 * How many designs it takes before narrowing them is worth a toolbar.
 *
 * Eight is a set you read; nine is one you scan. Counted against the SHOWN set
 * rather than the library, because the picker is already filtered to one
 * [[Display Type]] and a merchant looking at six inline designs does not need
 * chips for the twelve popups they cannot see from here.
 *
 * It is the unfiltered count, not the narrowed one — otherwise the controls
 * would disappear at the moment a merchant filtered down to five and left them
 * with no way back.
 */
const ENOUGH_TO_NARROW = 9;

export interface TemplatePickerProps {
  readonly index: TemplateIndex;
  /** The designs that have arrived, keyed by id. */
  readonly trees: ReadonlyMap<string, Template>;
  readonly displayType: string;
  readonly chosen: string | undefined;
  readonly act: ConvertingAct;
  readonly busy: boolean;
  readonly onChoose: (id: string) => void;
  readonly onNear: (id: string) => void;
}

export function TemplatePicker({
  index,
  trees,
  displayType,
  chosen,
  act,
  busy,
  onChoose,
  onNear,
}: TemplatePickerProps) {
  const [chosenFacets, setChosenFacets] = useState<Chosen>({});
  const [query, setQuery] = useState('');

  const forType = useMemo(
    () => index.templates.filter((entry) => entry.display_type === displayType),
    [index.templates, displayType],
  );

  const shown = useMemo(
    () => narrow(index.templates, displayType, chosenFacets, query),
    [index.templates, displayType, chosenFacets, query],
  );

  const narrowed = isNarrowed(chosenFacets, query);
  const clear = useCallback(() => {
    setChosenFacets({});
    setQuery('');
  }, []);

  if (forType.length === 0) {
    return (
      /*
        **The existing message, with a door.** *"No designs for 'popup' on this
        site"* is a dead end: it states what the merchant can already see and
        leaves them to find the way out. The way out is the other Display
        Types, and the honest action is the one that shows them
        ({@see EmptyState}).
      */
      <EmptyState
        icon={LayoutTemplate}
        title={sprintf(
          /* translators: %s: a Display Type, e.g. "popup". */
          __('No designs for “%s” on this site.', 'wconvert'),
          displayType,
        )}
      >
        {__('Designs arrive with WConvert and with the plugins that extend it.', 'wconvert')}
      </EmptyState>
    );
  }

  return (
    <>
      {forType.length >= ENOUGH_TO_NARROW && (
        <Toolbar
          trailing={
            /*
              **Filtering changes the content without moving focus**, so the
              number that changed has to be spoken. That is the one genuinely
              new accessibility obligation on this screen: everything else here
              — the grid's `<ul>`, `aria-current`, `aria-describedby` — the
              gallery already had (ADR 0038).
            */
            <ToolbarCount live>
              {sprintf(
                /* translators: %s: how many designs match the filters. */
                _n('%s design', '%s designs', shown.length, 'wconvert'),
                String(shown.length),
              )}
            </ToolbarCount>
          }
        >
          {Object.entries(index.facets).map(([facet, values]) => (
            <FacetStrip
              key={facet}
              facet={facet}
              values={values}
              labels={index.labels}
              chosen={chosenFacets[facet] ?? []}
              onToggle={(value) => setChosenFacets((current) => toggled(current, facet, value))}
            />
          ))}

          {/*
            **The admin's first search box, so it needs a real label.** A
            placeholder is not one — it disappears the moment somebody types,
            which is exactly when a screen reader user asks what the field was
            for. `sr-only` is fine: the box is unmistakable to anyone who can
            see it, and a visible "Search" beside three chip strips is a word
            that earns nothing (ADR 0042 rule 2).

            No size prop: `.wconvert-toolbar` sizes what is inside it to
            `--control-height-sm`, because "a toolbar control is the small
            height" is a rule about the toolbar rather than about each control
            that lands in one.
          */}
          <label className="contents">
            <span className="sr-only">{__('Search designs', 'wconvert')}</span>
            <Input
              type="search"
              value={query}
              placeholder={__('Search designs', 'wconvert')}
              className="w-44"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </Toolbar>
      )}

      <div className="wconvert-picker__body">
        {shown.length === 0 ? (
          /*
            **One sentence and the action that fixes it** (ADR 0039). *"No
            designs match"* is a dead end; *"No designs match — clear filters"*
            is a screen. It is reachable only by narrowing, so the door is
            always the right one.
          */
          <EmptyState
            icon={LayoutTemplate}
            title={__('No designs match', 'wconvert')}
            action={
              <Button variant="outline" onClick={clear}>
                {__('Clear filters', 'wconvert')}
              </Button>
            }
          >
            {__('Nothing in the library answers all of those at once.', 'wconvert')}
          </EmptyState>
        ) : (
          <Gallery
            entries={shown}
            trees={trees}
            labels={index.labels}
            chosen={chosen}
            act={act}
            busy={busy}
            onChoose={onChoose}
            onNear={onNear}
          />
        )}
      </div>

      {/*
        **The reason a merchant can be refused every card, with the door on THIS
        screen** (ADR 0042 rules 3 and 4). A [[Goal]] that counts click-throughs
        against a library of submit-metered designs refuses all of them, and the
        error the save used to give named a door that is not here — "change the
        Goal". The door that IS here is the filter that shows the designs which
        match, so this offers it.
      */}
      {refusesEverything(shown, act) && (
        <p className="wconvert-picker__note m-0 px-4 pb-4 text-muted-foreground">
          {act === 'submit'
            ? __('None of these counts a form submission, which is what this Optin’s goal measures.', 'wconvert')
            : __('None of these counts a click-through, which is what this Optin’s goal measures.', 'wconvert')}
          {narrowed && (
            <>
              {' '}
              <Button variant="link" size="sm" className="h-auto p-0 align-baseline" onClick={clear}>
                {__('Clear filters', 'wconvert')}
              </Button>
            </>
          )}
        </p>
      )}
    </>
  );
}

/**
 * Is every design the merchant can actually take refused by their [[Goal]]?
 *
 * **Only the ones on offer are counted.** A locked design is not refused — it is
 * not offered — so a set of eight refused cards and one premium card is still a
 * screen with no way forward, and a rule that counted the premium one would say
 * nothing about it.
 *
 * False on an empty set, which is the empty state's job rather than this note's:
 * two sentences about the same nothing is the thing ADR 0042 rule 2 forbids.
 */
function refusesEverything(shown: readonly TemplateIndexEntry[], act: ConvertingAct): boolean {
  const offered = shown.filter((entry) => entry.availability === 'ready');

  return offered.length > 0 && offered.every((entry) => entry.facets.act !== act);
}

/**
 * One facet, as a strip of toggles.
 *
 * ============================================================================
 * *SELECTED* IS ONE DECLARATION, AND THIS IS THE FIFTH STRIP THAT READS IT.
 * ============================================================================
 * The tab strip, the preview's step switcher, the device toggle and the Design
 * panel's choice chips are the other four, and each once had its own idea of
 * what selected looked like — one of them painting `--secondary` onto a
 * `--muted` group, which is the same colour. `.wconvert-segmented` in
 * `index.css` decides it once: white card, a real edge, foreground text
 * (ADR 0042 rule 5).
 *
 * **So every button is `ghost` and the group decides.** A variant that means
 * "selected" is a second place for that decision to live, and this admin had
 * four of them.
 *
 * `aria-pressed` rather than `aria-selected`, and multi-select rather than
 * one-of-N: pressing *Email* and *Phone number* means "asks for either", which
 * is what pressing two chips means. Nothing pressed is no constraint, so the
 * unfiltered state is the empty one and there is no "All" chip to define or
 * explain.
 *
 * `--control-height-sm` is 32px, which clears WCAG 2.1 AA's 24×24 target
 * (SC 2.5.8) — and it is inherited from `.wconvert-toolbar` rather than passed,
 * so no chip added later has to remember it.
 */
function FacetStrip({
  facet,
  values,
  labels,
  chosen,
  onToggle,
}: {
  facet: string;
  values: readonly string[];
  labels: TemplateIndex['labels'];
  chosen: readonly string[];
  onToggle: (value: string) => void;
}) {
  const labelId = `wconvert-facet-${facet}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/*
        **Named, because three strips in a row are three questions.** "Email"
        under no heading is ambiguous with "Column" — and `aria-labelledby`
        rather than a second `aria-label` so the group is announced once rather
        than twice.
      */}
      <span id={labelId} className="text-muted-foreground">
        {nameOf(labels.facets, facet)}
      </span>
      <div role="group" aria-labelledby={labelId} className="wconvert-segmented flex flex-wrap">
        {values.map((value) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            aria-pressed={chosen.includes(value)}
            onClick={() => onToggle(value)}
          >
            {nameOf(labels.facetValues, `${facet}.${value}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * The trees for the cards that are on screen, batched.
 *
 * ============================================================================
 * ONE REQUEST PER FRAME, NOT ONE PER CARD.
 * ============================================================================
 * A grid brings a row into view at a time, so a merchant scrolling past ten
 * cards would make ten requests if each card asked for itself. Ids are
 * collected as they arrive and flushed on a microtask, which is exactly the
 * granularity a scroll produces — one batch per render pass — and it costs no
 * timer and no debounce constant nobody can justify.
 *
 * **A failure is silent and retried by the next card that asks.** A card whose
 * tree did not arrive keeps its skeleton; the region is `ready` with what it
 * has. An error banner on a picker that is otherwise working is a sentence
 * ADR 0042 rule 2 forbids — and the one thing the merchant could do about it,
 * scroll and look again, is what re-asks.
 */
export function useTemplateTrees(
  fetchTrees: (ids: readonly string[]) => Promise<{ templates: (Template & { id: string })[] }>,
) {
  const [trees, setTrees] = useState<ReadonlyMap<string, Template>>(new Map());
  /*
   * A ref rather than state for both, because neither is drawn: `asked` is what
   * has ever been requested — so a design that came back empty is not asked for
   * again in a loop — and `pending` is the batch being filled. State here would
   * be a render per card scrolled past.
   */
  const asked = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  return {
    trees,
    want: useCallback(
      (id: string) => {
        if (asked.current.has(id) || pending.current.has(id)) {
          return;
        }

        pending.current.add(id);

        if (pending.current.size > 1) {
          return;
        }

        // The flush is scheduled by the FIRST id of a batch and picks up
        // everything added before the microtask runs, which is every card the
        // same render pass brought near the viewport.
        void Promise.resolve().then(() => {
          const batch = [...pending.current];

          pending.current.clear();

          for (const each of batch) {
            asked.current.add(each);
          }

          fetchTrees(batch)
            .then(({ templates }) => {
              if (!alive.current) {
                return;
              }

              setTrees((current) => {
                const next = new Map(current);

                for (const design of templates) {
                  next.set(design.id, { tree: design.tree, tokens: design.tokens });
                }

                return next;
              });
            })
            .catch(() => {
              // Retried by the next card that asks: forgetting the batch is
              // what makes scrolling away and back the retry.
              for (const each of batch) {
                asked.current.delete(each);
              }
            });
        });
      },
      [fetchTrees],
    ),
  };
}

