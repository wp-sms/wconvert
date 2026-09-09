import { useEffect, useId, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover';
import { resolveObjects, searchObjects, type ObjectHit, type ObjectKind } from './objects';

/**
 * Targeting a page by its NAME.
 *
 * ============================================================================
 * WHAT THIS REPLACES: `<input type="number" min={1}>`.
 * ============================================================================
 * Both page-object controls were a bare number box, so "show this on the
 * pricing page" meant leaving the builder, finding the post id, and coming
 * back with it. Nothing in this admin called `wp/v2/search` and there was no
 * combobox in `components/ui/` to reach for.
 *
 * ============================================================================
 * VENDOR THE BEHAVIOUR, NOT THE DEPENDENCY (ADR 0036, and `BlockTree`'s
 * PRECEDENT).
 * ============================================================================
 * It is here rather than in `components/ui/` because that directory is
 * upstream's unchanged, and shadcn's Combobox is built on `cmdk` — a new
 * runtime dependency, for one control, in a bundle that is code-split
 * precisely for size. `BlockTree.tsx` already set the precedent by writing a
 * treegrid rather than pulling one in.
 *
 * The positioning IS vendored: `components/ui/popover.tsx` gives collision
 * handling and portalling, and `role="listbox"` overrides the `role="dialog"`
 * Radix puts on its content — it spreads caller props after its own.
 *
 * ============================================================================
 * `aria-activedescendant`, NOT ROVING TABINDEX. DO NOT "FIX" THIS.
 * ============================================================================
 * DOM focus stays on the input for the whole interaction while ↑ and ↓ move
 * `aria-activedescendant` down the list. That is the APG combobox pattern, and
 * current guidance is explicit that moving real focus into the list is a
 * common mistake which breaks typeahead and confuses screen readers — the
 * merchant would type "pri", press ↓, and the next keystroke would go to an
 * option instead of the search box.
 *
 * It therefore does NOT match `BlockTree`'s roving tabindex, which is right
 * for a treegrid and wrong here. Saying so is the point of this paragraph.
 *
 * ============================================================================
 * A STORED ID THAT RESOLVES TO NOTHING RENDERS `#42`, NEVER A BLANK.
 * ============================================================================
 * Core hard-codes `post_status => 'publish'` in the search handler, so a post
 * that was unpublished or deleted is simply absent from the answer. An empty
 * box there would read as *"your rule is gone"* — which is the one thing that
 * is not true: the rule is intact and still targets that id.
 */
export interface ObjectPickerProps {
  readonly id: string;
  readonly kind: ObjectKind;
  /**
   * Held as a STRING, because that is what a Targeting rule stores:
   * `TargetingRule` casts its scalar to one on the way in, and a number here
   * would round-trip to a different value than the one that was saved.
   */
  readonly value: string;
  readonly onChange: (value: string) => void;
}

/** Long enough that typing a word is one request, short enough to feel live. */
const DEBOUNCE_MS = 250;

export function ObjectPicker({ id, kind, value, onChange }: ObjectPickerProps) {
  const listId = `${useId()}-listbox`;
  const [open, setOpen] = useState(false);
  /** What the merchant is typing, or null while they are not. */
  const [query, setQuery] = useState<string | null>(null);
  const [hits, setHits] = useState<readonly ObjectHit[]>([]);
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<ObjectHit | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /**
   * Turn the stored id back into words.
   *
   * Re-run whenever the stored value changes rather than once on mount,
   * because the value also changes when the merchant picks something — and the
   * answer is thrown away if it lands after a newer one, which is what the
   * abort is for.
   */
  useEffect(() => {
    if (value === '') {
      setChosen(null);
      return;
    }

    const controller = new AbortController();

    resolveObjects(kind, [value], controller.signal)
      .then((found) => setChosen(found.find((hit) => hit.id === value) ?? null))
      // An id core will not resolve — unpublished, deleted, or a post type
      // registered without `show_in_rest` — is not an error. It renders as its
      // id, which is the honest thing to show.
      .catch(() => setChosen(null));

    return () => controller.abort();
  }, [kind, value]);

  /**
   * Search, debounced, with the previous request cancelled.
   *
   * The abort is what stops a stale answer overwriting a newer one: typing
   * "pricing" fires on "pri" and again on "prici", and without it whichever
   * request the network returned last would win.
   */
  useEffect(() => {
    if (query === null || !open) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);

      searchObjects(kind, query, controller.signal)
        .then((found) => {
          setHits(found);
          setActive(0);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, open, query]);

  const commit = (hit: ObjectHit) => {
    onChange(hit.id);
    setChosen(hit);
    setQuery(null);
    setOpen(false);
  };

  /** Give up on the search without changing what is stored. */
  const abandon = () => {
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // Esc closes and commits NOTHING — the merchant's stored rule survives a
      // search they thought better of.
      event.preventDefault();
      abandon();
      return;
    }

    if (event.key === 'Tab') {
      // Tab leaves. It also commits nothing: a highlight is not a choice, and
      // moving on should never silently change a targeting rule.
      abandon();
      return;
    }

    if (hits.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((at) => (at + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : hits.length - 1);
      return;
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault();
      commit(hits[active]);
    }
  };

  return (
    <Popover open={open && query !== null} onOpenChange={(next) => !next && abandon()}>
      <PopoverAnchor asChild>
        <span className="wconvert-picker">
          <input
            id={id}
            ref={input}
            type="text"
            className="regular-text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open && query !== null}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && hits.length > 0 ? `${listId}-${active}` : undefined}
            // NAMED BY THE `<label for>` `ParamField` DRAWS, not by an
            // `aria-label` of its own. An `aria-label` would win over the
            // label the merchant can see, so the accessible name and the
            // visible one would be two strings that only happen to agree —
            // and a voice-control user saying the visible words would hit
            // nothing. A `<label for>` names a `role="combobox"` perfectly
            // well; the role changes what it IS, not how it is named.
            // Typing shows what is typed; not typing shows the chosen thing,
            // and an id that cannot be resolved shows as itself.
            value={query ?? displayed(chosen, value)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setQuery(query ?? '')}
            onKeyDown={onKeyDown}
          />
          {/*
            The count, announced. A merchant who cannot see the list needs to
            know it changed, and `role="status"` is polite — it waits for a
            pause rather than interrupting the typing that caused it.
          */}
          <span role="status" className="sr-only">
            {query === null ? '' : busy ? __('Searching…', 'wconvert') : countOf(hits.length)}
          </span>
        </span>
      </PopoverAnchor>

      <PopoverContent
        // `role="listbox"` beats the `role="dialog"` Radix sets, because it
        // spreads caller props after its own — and a combobox popup must be a
        // listbox for `aria-controls` and `aria-activedescendant` to mean
        // anything.
        role="listbox"
        id={listId}
        align="start"
        className="wconvert-picker__list"
        // DOM focus never leaves the input. See the docblock: moving it into
        // the list is the mistake this pattern exists to avoid.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {hits.length === 0 ? (
          <p className="wconvert-picker__empty text-note text-muted-foreground">
            {busy ? __('Searching…', 'wconvert') : __('Nothing found. Only published items can be found by name.', 'wconvert')}
          </p>
        ) : (
          hits.map((hit, at) => (
            /*
              ==================================================================
              THE TWO RULES DISABLED HERE ARE THE ONES THIS PATTERN CONTRADICTS.
              ==================================================================
              `jsx-a11y` wants an `option` focusable and wants a keyboard
              handler beside the click. Both are right for a listbox that owns
              its own focus, and both are wrong for an ARIA 1.2 combobox: DOM
              focus stays on the INPUT for the whole interaction and the
              keyboard is handled there, on `onKeyDown`, where ↑↓/Enter/Esc/
              Home/End all live. Making an option focusable is precisely the
              mistake the docblock above warns against.

              Disabled at the one element rather than in `eslint.config.js`, so
              the next listbox in this codebase still gets both rules.
            */
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={hit.id}
              id={`${listId}-${at}`}
              role="option"
              aria-selected={at === active}
              className="wconvert-picker__option"
              data-active={at === active || undefined}
              // A pointer press must not blur the input, or the listbox closes
              // before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(hit)}
              onMouseEnter={() => setActive(at)}
            >
              <span>{hit.title}</span>{' '}
              {/* The id, always. Two pages genuinely do share a title. */}
              <span className="wconvert-picker__id text-micro">#{hit.id}</span>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * What the box reads when nothing is being typed.
 *
 * An id core would not resolve renders as `#42` — never as an empty box, which
 * would read as "your rule is gone" about a rule that is intact.
 */
const displayed = (chosen: ObjectHit | null, value: string): string =>
  chosen !== null ? `${chosen.title} (#${chosen.id})` : value === '' ? '' : `#${value}`;

const countOf = (count: number): string =>
  sprintf(
    /* translators: %d: how many matches the search found. */
    _n('%d result', '%d results', count, 'wconvert'),
    count,
  );
