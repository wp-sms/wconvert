import { useEffect, useId, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover';
import { Button } from '../../components/ui/button';
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
 * handling and portalling. Its content wraps a listbox plus search status and
 * retry controls, so retry is never misrepresented as a page to select.
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
type SearchResult = { kind: ObjectKind; query: string } & (
  { status: 'ready'; hits: readonly ObjectHit[] } | { status: 'error' }
);
type Resolution = { kind: ObjectKind; value: string; status: 'loading' | 'ready' | 'error' };

export function ObjectPicker({ id, kind, value, onChange }: ObjectPickerProps) {
  const listId = `${useId()}-listbox`;
  const searchNoteId = `${listId}-search-note`;
  const selectedNoteId = `${listId}-selected-note`;
  const [open, setOpen] = useState(false);
  /** What the merchant is typing, or null while they are not. */
  const [query, setQuery] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [resolutionAttempt, setResolutionAttempt] = useState(0);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState<{ kind: ObjectKind; hit: ObjectHit } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const expanded = open && query !== null;
  const current = result?.kind === kind && result.query === query ? result : null;
  const searching = expanded && current === null;
  const searchFailed = expanded && current?.status === 'error';
  const hits = expanded && current?.status === 'ready' ? current.hits : [];
  const chosen = selection?.kind === kind && selection.hit.id === value ? selection.hit : null;
  const currentResolution = resolution?.kind === kind && resolution.value === value ? resolution : null;
  const resolving = value !== '' && (currentResolution === null || currentResolution.status === 'loading');
  const resolutionFailed = currentResolution?.status === 'error';
  const missing = currentResolution?.status === 'ready' && value !== '' && chosen === null;

  /**
   * Turn the stored id back into words.
   *
   * Re-run whenever the stored value changes rather than once on mount,
   * because the value also changes when the merchant picks something — and the
   * abort is checked before every state update. Cancellation alone does not
   * prevent a completed or non-cancellable response overwriting a newer value.
   */
  useEffect(() => {
    if (value === '') {
      setSelection(null);
      setResolution(null);
      return;
    }

    const controller = new AbortController();
    setResolution({ kind, value, status: 'loading' });

    resolveObjects(kind, [value], controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        const hit = found.find((candidate) => candidate.id === value);
        setSelection(hit ? { kind, hit } : null);
        setResolution({ kind, value, status: 'ready' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolution({ kind, value, status: 'error' });
      });

    return () => controller.abort();
  }, [kind, value, resolutionAttempt]);

  /**
   * Search, debounced, with the previous request cancelled.
   *
   * Only the current query's results can be selected, including during the
   * debounce. Every completion checks cancellation; failed searches have their
   * own state rather than pretending WordPress returned no matches.
   */
  useEffect(() => {
    if (query === null || !open) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchObjects(kind, query, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setResult({ kind, query, status: 'ready', hits: found });
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ kind, query, status: 'error' });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, open, query, searchAttempt]);

  const commit = (hit: ObjectHit) => {
    onChange(hit.id);
    setSelection({ kind, hit });
    setQuery(null);
    setOpen(false);
  };

  /** Give up on the search without changing what is stored. */
  const abandon = () => {
    setQuery(null);
    setOpen(false);
  };

  const retrySearch = () => {
    setResult(null);
    setSearchAttempt((attempt) => attempt + 1);
    input.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && expanded) {
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

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !expanded) {
      event.preventDefault();
      setQuery('');
      setResult(null);
      setOpen(true);
      return;
    }

    if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      if (searchFailed) retrySearch();
      else if (hits[active]) commit(hits[active]);
      return;
    }

    if (hits.length === 0) return;

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
  };

  const resolutionNote = resolving
    ? __('Loading the saved selection’s name…', 'wconvert')
    : resolutionFailed
      ? sprintf(__('Couldn’t load the saved selection’s name. This rule still uses #%s.', 'wconvert'), value)
      : missing
        ? kind === 'post'
          ? sprintf(__('Page or post #%s is not available by name. It may be unpublished, deleted or unavailable in WordPress search. This rule still uses it.', 'wconvert'), value)
          : sprintf(__('Category or tag #%s is not available by name. It may have been deleted or be unavailable in WordPress search. This rule still uses it.', 'wconvert'), value)
        : '';
  const searchNote = searching ? __('Searching…', 'wconvert')
    : searchFailed ? __('Search couldn’t be completed. Retry, or press Enter in the search field.', 'wconvert')
      : hits.length === 0 ? kind === 'post'
        ? __('No matching pages or posts. Try another name. Only published items can be found by name.', 'wconvert')
        : __('No matching categories or tags. Try another name.', 'wconvert')
        : '';

  return (
    <Popover open={expanded} onOpenChange={(next) => !next && abandon()}>
      <PopoverAnchor asChild>
        <span className="wconvert-object-picker">
          <input
            id={id}
            ref={input}
            type="text"
            className="w-full min-w-0 max-w-full"
            role="combobox"
            autoComplete="off"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-autocomplete="list"
            aria-busy={searching || resolving}
            aria-describedby={[resolutionNote ? selectedNoteId : '', expanded && searchNote ? searchNoteId : ''].filter(Boolean).join(' ') || undefined}
            aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
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
              setResult(null);
              setActive(0);
              setOpen(true);
            }}
            onFocus={(event) => { if (query === null) event.currentTarget.select(); }}
            onClick={(event) => { if (query === null) event.currentTarget.select(); }}
            onKeyDown={onKeyDown}
          />
          {/*
            The count, announced. A merchant who cannot see the list needs to
            know it changed, and `role="status"` is polite — it waits for a
            pause rather than interrupting the typing that caused it.
          */}
          <span role="status" className="sr-only">
            {!expanded ? resolutionNote : searching || searchFailed ? searchNote : countOf(hits.length)}
          </span>
          {resolutionNote && <span id={selectedNoteId} className="block mt-1 text-micro text-muted-foreground">{resolutionNote}</span>}
          {resolutionFailed && <Button type="button" variant="outline" size="sm" className="mt-2"
            onClick={() => { setResolutionAttempt((attempt) => attempt + 1); input.current?.focus(); }}>
            {__('Retry name lookup', 'wconvert')}
          </Button>}
        </span>
      </PopoverAnchor>

      <PopoverContent
        // The actual listbox contains options only. Status and Retry are its
        // siblings, while the input retains the combobox's keyboard focus.
        role="presentation"
        align="start"
        className="wconvert-object-picker__list"
        // DOM focus never leaves the input. See the docblock: moving it into
        // the list is the mistake this pattern exists to avoid.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {searchNote && <p id={searchNoteId} className="wconvert-object-picker__empty text-note text-muted-foreground">{searchNote}</p>}
        {searchFailed && <Button type="button" variant="outline" size="sm" tabIndex={-1}
          aria-describedby={searchNoteId}
          onMouseDown={(event) => event.preventDefault()} onClick={retrySearch}>
          {__('Retry search', 'wconvert')}
        </Button>}
        <div role="listbox" id={listId} aria-busy={searching} aria-label={kind === 'post' ? __('Matching pages and posts', 'wconvert') : __('Matching categories and tags', 'wconvert')}>
        {
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
              className="wconvert-object-picker__option"
              data-active={at === active || undefined}
              // A pointer press must not blur the input, or the listbox closes
              // before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(hit)}
              onMouseEnter={() => setActive(at)}
            >
              <span>{hit.title}</span>{' '}
              {/* The id, always. Two pages genuinely do share a title. */}
              <span className="wconvert-object-picker__id text-micro">#{hit.id}</span>
            </div>
          ))
        }
        </div>
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
