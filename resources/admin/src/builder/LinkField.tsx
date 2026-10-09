import { forwardRef, useId, useRef, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { Popover, PopoverAnchor, PopoverContent } from '../components/ui/popover';
import { Button } from '../components/ui/button';
import { searchLinks, type LinkHit } from './rules/objects';
import { useObjectSearch } from './rules/useObjectSearch';

/**
 * A link: type a page name, or paste an address.
 *
 * ============================================================================
 * ONE BOX, THE WAY WORDPRESS'S OWN LINK CONTROL WORKS.
 * ============================================================================
 * What is typed is what is stored, keystroke by keystroke, exactly as the plain
 * URL box this replaces — so an address, a path, a `#fragment` or a `mailto:`
 * is kept as typed. Words also search published pages, posts and products, and
 * picking one stores its permalink. Nothing is rewritten unless a match is
 * picked.
 *
 * The search, the vendored popover and the `aria-activedescendant` pattern are
 * `ObjectPicker`'s; read its docblock before "fixing" focus to move into the
 * list. The one difference is where the status text lives: in the popover,
 * not beside the input, because this box sits inside a wrapping `<label>` and
 * text there would become part of its accessible name.
 */
export interface LinkFieldProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}

/**
 * Whether what was typed is already an address rather than words to search.
 * A scheme (`https:`, `mailto:`, `tel:`), a path, a fragment or query, or a
 * bare domain like `example.com/offer`.
 */
export function looksLikeAddress(text: string): boolean {
  const typed = text.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(typed) || /^[/#?.]/.test(typed) || /^(www\.)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(typed);
}

export const LinkField = forwardRef<HTMLInputElement, LinkFieldProps>(function LinkField(
  { id, value, onChange, placeholder, className = 'w-full min-w-0 max-w-full' },
  ref,
) {
  const listId = `${useId()}-listbox`;
  const noteId = `${listId}-note`;
  /** The words being searched, or null while the merchant is not searching. */
  const [query, setQuery] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const expanded = query !== null;
  const search = useObjectSearch(searchLinks, 'link', query, expanded);
  const { searching, failed, hits, active, setActive } = search;

  const setInput = (node: HTMLInputElement | null) => {
    input.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const commit = (hit: LinkHit) => {
    onChange(hit.url);
    setQuery(null);
  };

  const close = () => setQuery(null);

  /** Search the words in the box, or close the list for an address or nothing. */
  const searchFor = (text: string) => {
    if (text.trim() === '' || looksLikeAddress(text)) {
      close();
      return;
    }
    setQuery(text.trim());
    search.reset();
    setActive(0);
  };

  const retry = () => {
    search.retry();
    input.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && expanded) {
      // Esc closes the list and keeps what was typed.
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'Tab') {
      // A highlight is not a choice: leaving keeps what was typed.
      close();
      return;
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !expanded) {
      event.preventDefault();
      searchFor(value);
      return;
    }

    if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      if (failed) retry();
      else if (hits[active]) commit(hits[active]);
      return;
    }

    if (hits.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((at) => (at + (event.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : hits.length - 1);
    }
  };

  const note = searching ? __('Searching…', 'wconvert')
    : failed ? __('Search couldn’t be completed. Retry, or press Enter in the link field.', 'wconvert')
      : hits.length === 0 ? __('No published page, post or product matches. Try another name, or paste a link.', 'wconvert')
        : '';

  return (
    <Popover open={expanded} onOpenChange={(next) => !next && close()}>
      <PopoverAnchor asChild>
        <span className="wconvert-object-picker">
          <input
            id={id}
            ref={setInput}
            type="text"
            inputMode="url"
            className={className}
            role="combobox"
            autoComplete="off"
            placeholder={placeholder ?? __('Search pages or paste a link', 'wconvert')}
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-autocomplete="list"
            aria-busy={searching}
            aria-describedby={expanded && note ? noteId : undefined}
            aria-activedescendant={expanded && hits[active] ? `${listId}-${active}` : undefined}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              searchFor(event.target.value);
            }}
            onKeyDown={onKeyDown}
          />
        </span>
      </PopoverAnchor>

      <PopoverContent
        role="presentation"
        align="start"
        className="wconvert-object-picker__list"
        // DOM focus never leaves the input; see ObjectPicker.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <p role="status" id={noteId} className={note ? 'wconvert-object-picker__empty text-note text-muted-foreground' : 'sr-only'}>
          {note || countOf(hits.length)}
        </p>
        {failed && <Button type="button" variant="outline" size="sm" tabIndex={-1}
          aria-describedby={noteId}
          onMouseDown={(event) => event.preventDefault()} onClick={retry}>
          {__('Retry search', 'wconvert')}
        </Button>}
        <div role="listbox" id={listId} aria-busy={searching} aria-label={__('Matching pages, posts and products', 'wconvert')}>
          {hits.map((hit, at) => (
            // Both rules are wrong for an ARIA 1.2 combobox; see ObjectPicker.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={hit.id}
              id={`${listId}-${at}`}
              role="option"
              aria-selected={at === active}
              className="wconvert-object-picker__option"
              data-active={at === active || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(hit)}
              onMouseEnter={() => setActive(at)}
            >
              <span>{hit.title}</span>{' '}
              <span className="wconvert-object-picker__id text-micro">{kindOf(hit.subtype)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

/** The post type, in words for the three a merchant will meet most. */
const kindOf = (subtype: string): string =>
  subtype === 'page' ? __('Page', 'wconvert')
    : subtype === 'post' ? __('Post', 'wconvert')
      : subtype === 'product' ? __('Product', 'wconvert')
        : subtype;

const countOf = (count: number): string =>
  sprintf(
    /* translators: %d: how many matches the search found. */
    _n('%d result', '%d results', count, 'wconvert'),
    count,
  );
