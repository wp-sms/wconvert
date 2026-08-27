import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { HexColorInput, HexColorPicker, RgbaStringColorPicker } from 'react-colorful';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { TOKENS, slotsOf, withHidden, withToken, withValue } from './panel';
import { exportEntry, importEntry } from './entry';
import { getThemeTokens } from './api';
import { isApplied, isColour, isTranslucent, themePresets } from './themes';
import { keyOfSlot, type Selection, type SlotKey } from './slots';
import type { Path, Slot } from './panel';
import { nameOf, type TemplateEntry, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

/**
 * The settings panel: **tokens, slot content and slot visibility. Never
 * arrangement.**
 *
 * ============================================================================
 * THAT BOUNDARY IS THE WHOLE BARGAIN OF ADR 0010.
 * ============================================================================
 * The vocabulary is the ceiling on design variety and the gallery IS the
 * design surface. A panel that could add, remove or reorder a node would move
 * that ceiling into a builder nobody designed — and it would cost the other
 * half: a canvas lands later as an editor over a tree that already exists,
 * with no migration, precisely because nothing else reshapes the tree in the
 * meantime.
 *
 * So a merchant who does not want the fine print HIDES it, and the `consent`
 * checkbox every capture design ships hidden is switched on the same way —
 * which is how ADR 0032's "off by default" and this boundary are both true at
 * once.
 *
 * ============================================================================
 * IT IS CONTROLS ONLY. THE PREVIEW BELONGS TO THE BUILDER.
 * ============================================================================
 * The preview used to live in here, which meant that editing a Trigger showed
 * no preview at all: the merchant was changing an Optin with the picture of it
 * on another tab. {@see OptinBuilder} pins it beside all four tabs instead, and
 * what is left here is the column of controls.
 *
 * The two still talk, in both directions and through one string (`slots.ts`):
 * focusing a block reports which slot it edits, so the preview outlines it, and
 * a click in the preview brings the caret here. **Selection edits nothing**, so
 * the boundary above is untouched by it (ADR 0040).
 */

export interface SettingsPanelProps {
  readonly entry: TemplateEntry;
  readonly labels: TemplateLabels;
  /** `WP_DEBUG`. The export is for whoever is authoring the library. */
  readonly dev: boolean;
  /** Which slot is live, and which side asked — see `slots.ts`. */
  readonly selection?: Selection | null;
  readonly onSelect?: (key: SlotKey) => void;
  readonly onChange: (template: Template) => void;
  readonly onError: (cause: unknown) => void;
}

export function SettingsPanel({
  entry,
  labels,
  dev,
  selection = null,
  onSelect,
  onChange,
  onError,
}: SettingsPanelProps) {
  return (
    <div className="wconvert-panel__controls">
      <Slots
        template={entry}
        labels={labels}
        selection={selection}
        onSelect={onSelect}
        onChange={onChange}
      />
      <Tokens template={entry} labels={labels} onChange={onChange} onError={onError} />
      {dev && <DevExport entry={entry} onChange={onChange} />}
    </div>
  );
}

/**
 * What each slot says, and whether it is shown.
 *
 * Headed by its [[Slot Role]] where it has one, because that is what the slot
 * IS — a `field`'s Roles are derived from what it captures rather than
 * declared, so it is headed by the kind it captures instead (CONTEXT.md, Slot
 * Role).
 *
 * **Each block carries the key the preview knows it by**, which is what makes
 * the two surfaces one surface: `data-slot-key` is how a click over there finds
 * the caret's destination over here, and `onFocus` is how the caret's arrival
 * here reaches the outline over there. Focus rather than click, because tabbing
 * into a field is the same act as reaching it with a mouse and a keyboard user
 * must not lose the preview's answer to "which one am I editing?".
 */
function Slots({
  template,
  labels,
  selection,
  onSelect,
  onChange,
}: {
  template: Template;
  labels: TemplateLabels;
  selection: Selection | null;
  onSelect?: (key: SlotKey) => void;
  onChange: (template: Template) => void;
}) {
  const slots = slotsOf(template.tree);
  const column = useRef<HTMLDivElement>(null);

  /*
   * **Only a selection made in the PREVIEW moves the caret.** One made here
   * already has it, and pulling focus back to the top of the block on every
   * keystroke's re-render would take it out of the field being typed in.
   */
  useEffect(() => {
    if (selection === null || selection.from !== 'preview' || column.current === null) {
      return;
    }

    const block = Array.from(column.current.querySelectorAll<HTMLElement>('[data-slot-key]')).find(
      (candidate) => candidate.dataset.slotKey === selection.key,
    );

    // `scrollIntoView` is absent in jsdom and optional everywhere else: getting
    // the caret there is the guarantee, and getting it on screen is the polish.
    block?.scrollIntoView?.({ block: 'nearest' });

    /*
     * **The words, not the visibility switch.** A slot the panel may hide leads
     * with a "Show this" checkbox, and a merchant who clicked a headline in the
     * preview wants to edit what it says — landing them on the control that
     * would make it disappear is the wrong answer to the right click.
     */
    const control =
      block?.querySelector<HTMLElement>('input[type="text"], textarea, select') ??
      block?.querySelector<HTMLElement>('input');

    control?.focus();
  }, [selection]);

  const edit = (path: Path, key: string, value: unknown) =>
    onChange({ ...template, tree: withValue(template.tree, path, key, value) });

  return (
    <div ref={column}>
      <h4>{__('What it says', 'wconvert')}</h4>
      {slots.map((slot) => {
        const slotKey = keyOfSlot(slot);

        return (
          <fieldset
            key={slot.path.join('.')}
            className="wconvert-slot"
            data-slot-key={slotKey ?? undefined}
            data-selected={slotKey !== null && slotKey === selection?.key ? 'true' : undefined}
            onFocus={slotKey === null || onSelect === undefined ? undefined : () => onSelect(slotKey)}
          >
            <legend>{headingFor(slot, labels)}</legend>

            {slot.hideable && (
              <label className="wconvert-slot__shown">
                <input
                  type="checkbox"
                  checked={!slot.hidden}
                  onChange={(event) =>
                    onChange({ ...template, tree: withHidden(template.tree, slot.path, !event.target.checked) })
                  }
                />{' '}
                {__('Show this', 'wconvert')}
              </label>
            )}

            {slot.keys.map((key) =>
              key === 'link' ? (
                <LinkControl
                  key={key}
                  label={nameOf(labels.keys, key)}
                  value={slot.values[key]}
                  onChange={(value) => edit(slot.path, key, value)}
                />
              ) : (
                <label key={key} className="wconvert-slot__key">
                  {nameOf(labels.keys, key)}
                  <input
                    type="text"
                    className="widefat"
                    value={typeof slot.values[key] === 'string' ? (slot.values[key] as string) : ''}
                    onChange={(event) => edit(slot.path, key, event.target.value)}
                  />
                </label>
              ),
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

function headingFor(slot: Slot, labels: TemplateLabels): string {
  if (slot.role !== null) {
    return nameOf(labels.roles, slot.role);
  }

  if (slot.captures !== null) {
    return nameOf(labels.fields, slot.captures);
  }

  return nameOf(labels.nodes, slot.type);
}

/**
 * A link inside a sentence, expressed as STRUCTURE rather than markup
 * (ADR 0013) — which is why it is two controls and not a rich-text box.
 *
 * The sentence carries `%s` where the link goes, and the renderer splits on it
 * and builds the anchor itself, so no code path reaches `innerHTML`. Leaving
 * the address empty is the ordinary case for a privacy-policy link: the
 * renderer fills it from the site's own configured policy, and with none
 * configured the link renders nothing rather than a dead `#` (ADR 0032).
 */
function LinkControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const link = (value ?? {}) as { label?: string; href?: string };

  const write = (next: { label?: string; href?: string }) =>
    onChange(next.label === undefined || next.label === '' ? undefined : next);

  return (
    <fieldset className="wconvert-slot__link">
      <legend>{label}</legend>
      <label className="wconvert-slot__key">
        {__('Link text', 'wconvert')}
        <input
          type="text"
          className="widefat"
          value={link.label ?? ''}
          onChange={(event) => write({ ...link, label: event.target.value })}
        />
      </label>
      <label className="wconvert-slot__key">
        {__('Address — leave empty for your privacy policy', 'wconvert')}
        <input
          type="text"
          className="widefat"
          value={link.href ?? ''}
          onChange={(event) => write({ ...link, href: event.target.value === '' ? undefined : event.target.value })}
        />
      </label>
      <p className="description">
        {__('Put %s in the sentence above where the link should sit.', 'wconvert')}
      </p>
    </fieldset>
  );
}

/**
 * The look: four ready-made bundles, the site's own palette, and every raw
 * token behind a disclosure.
 *
 * ============================================================================
 * PRESETS CARRY THE MEDIAN CASE. THE ESCAPE HATCH KEEPS THE TAIL.
 * ============================================================================
 * Thirteen text boxes asking for `rgba(15, 23, 42, 0.55)` and a full font stack
 * was *"the single clearest usability defect in the admin"*
 * ([#71](https://github.com/navidkashani/wconvert/issues/71)), and the reason is
 * that a merchant could not find out what a token did except by typing a value
 * and watching the preview. A preset answers that in one press.
 *
 * **Every raw token is still here, once.** Not duplicated above the disclosure
 * for the "important" ones: a token with two controls is a token a merchant can
 * watch disagree with itself. Brand-exact colour is a real want and this is
 * where it is served, with a picker rather than a text box — and hex is still
 * typeable inside the picker, because "our blue is #1a4fd8" is the whole reason
 * someone opens it.
 *
 * ============================================================================
 * COPYING THE THEME IS OPT-IN, AND A VALUE COPY.
 * ============================================================================
 * The button reads the site's palette once and writes the values into these
 * controls, where the merchant can see and change every one of them. Nothing
 * records where a value came from, so switching theme later cannot restyle a
 * running Optin — the same reason an Optin takes a copy of its Template rather
 * than a link to it (ADR 0010).
 *
 * Default off is the absence of the button having been pressed. A stored flag
 * would be the live link this exists not to be. It reads the SITE's theme and
 * never WConvert's own admin palette, which are different things that both
 * answer to the word "theme".
 */
function Tokens({
  template,
  labels,
  onChange,
  onError,
}: {
  template: Template;
  labels: TemplateLabels;
  onChange: (template: Template) => void;
  onError: (cause: unknown) => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const presets = themePresets();

  const write = (tokens: Readonly<Record<string, string>>) =>
    onChange({
      ...template,
      tokens: Object.entries(tokens).reduce(
        (carried, [name, value]) => withToken(carried, name, value),
        template.tokens,
      ),
    });

  const copyTheme = () => {
    getThemeTokens()
      .then(({ tokens }) => {
        write(tokens);
        setCopied(Object.keys(tokens).length);
      })
      .catch(onError);
  };

  return (
    <>
      <h4>{__('How it looks', 'wconvert')}</h4>

      <div className="wconvert-themes">
        {presets.map((preset) => {
          const current = isApplied(preset, template.tokens);

          return (
            <button
              key={preset.id}
              type="button"
              className="wconvert-theme"
              aria-pressed={current}
              onClick={() => write(preset.tokens)}
            >
              <span aria-hidden="true" className="wconvert-theme__swatches">
                {['bg', 'fg', 'accent'].map((token) => (
                  <span
                    key={token}
                    className="wconvert-theme__swatch"
                    style={{ background: preset.tokens[token] }}
                  />
                ))}
              </span>
              {preset.label}
            </button>
          );
        })}
      </div>

      <p className="wconvert-themes__theme">
        <Button type="button" variant="outline" size="sm" onClick={copyTheme}>
          {__('Copy my theme’s colours', 'wconvert')}
        </Button>{' '}
        {copied !== null && (
          <span className="description">
            {copied === 0
              ? __('Your theme declares no palette to copy.', 'wconvert')
              : __('Copied. Change any of them below.', 'wconvert')}
          </span>
        )}
      </p>

      <details className="wconvert-advanced">
        <summary>{__('Every setting', 'wconvert')}</summary>
        {TOKENS.map((token) => (
          <TokenField
            key={token.name}
            label={nameOf(labels.tokens, token.name)}
            fallback={token.fallback}
            value={template.tokens[token.name] ?? ''}
            onChange={(value) => onChange({ ...template, tokens: withToken(template.tokens, token.name, value) })}
          />
        ))}
      </details>
    </>
  );
}

/**
 * One token, drawn as what it holds.
 *
 * A colour gets a picker; everything else gets the text box it always had,
 * because `1.5rem` and a font stack are typed values with no visual control
 * that would be an improvement rather than a guess.
 *
 * **Which is which is read off the manifest's own fallback**, so a token added
 * to `resources/templates/manifest.json` arrives wearing the right control with
 * nothing here edited — the same property `TOKENS` already gives the list.
 */
function TokenField({
  label,
  fallback,
  value,
  onChange,
}: {
  label: string;
  fallback: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!isColour(fallback)) {
    return (
      <label className="wconvert-token">
        {label}
        <input
          type="text"
          className="regular-text"
          // The template's own value is the placeholder rather than the value,
          // so an empty control means "whatever the design says" and clearing
          // one is how a merchant undoes an edit.
          placeholder={fallback}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  return <ColourField label={label} fallback={fallback} value={value} onChange={onChange} />;
}

/**
 * A colour, chosen rather than typed — with the hex still typeable.
 *
 * `react-colorful` is ~2.8KB and has no dependencies, which is the whole reason
 * it is here rather than a picker with a colour library behind it: the admin
 * bundle is shipped to every merchant, and ADR 0038 reports its size at every
 * build rather than gating it, so a dependency has to be worth reading about.
 *
 * **Alpha where the token has it.** The backdrop is `rgba(…)` and "how dark is
 * the page behind the popup" is precisely the question a fourth number in a
 * text box cannot answer. A hex token gets the hex picker and its hex box; the
 * translucent one gets the slider and the raw string, because there is no
 * shorter honest spelling of `rgba(2, 6, 23, 0.7)`.
 *
 * The trigger is a swatch and the token's name, so the list still reads down
 * its left edge as a column of settings rather than as a row of coloured boxes.
 */
function ColourField({
  label,
  fallback,
  value,
  onChange,
}: {
  label: string;
  fallback: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Empty means "whatever the design says", so the swatch and the picker both
  // open on the design's own value while the STORED value stays empty.
  const shown = value === '' ? fallback : value;
  const translucent = isTranslucent(shown);

  return (
    <div className="wconvert-token wconvert-token--colour">
      <span className="wconvert-token__name">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="wconvert-swatch">
            {/*
              The colour arrives as a custom property rather than as
              `background`, because the chip paints a chequerboard underneath —
              a translucent backdrop has to READ as translucent, and the
              shorthand would wipe the pattern it shows through.
            */}
            <span
              aria-hidden="true"
              className="wconvert-swatch__chip"
              style={{ '--wconvert-chip': shown } as CSSProperties}
            />
            <span className="wconvert-swatch__value">{shown}</span>
            <span className="sr-only">
              {sprintf(
                /* translators: %s: what the colour is for, e.g. “Background”. */
                __('Choose a colour for %s', 'wconvert'),
                label,
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <div className="wconvert-picker">
            {translucent ? (
              <RgbaStringColorPicker color={shown} onChange={onChange} />
            ) : (
              <HexColorPicker color={shown} onChange={onChange} />
            )}

            {/*
              Named for the TOKEN rather than "Value", because a popover
              announcing "Value, edit text" tells a screen-reader user the
              value of what.
            */}
            <label className="wconvert-slot__key">
              {sprintf(
                /* translators: %s: what the colour is for, e.g. “Background”. */
                __('%s value', 'wconvert'),
                label,
              )}
              {translucent ? (
                <input
                  type="text"
                  className="regular-text"
                  placeholder={fallback}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                />
              ) : (
                <HexColorInput
                  className="regular-text"
                  prefixed
                  color={shown}
                  onChange={onChange}
                />
              )}
            </label>

            {/*
              The way back to the design's own colour. Clearing the token is
              what "undo my edit" means here — the panel stores an ABSENCE
              rather than a copy of the fallback, so an improved Template still
              reaches an Optin the merchant never overrode.
            */}
            {value !== '' && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                {__('Back to the design’s own', 'wconvert')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * The dev-only export, and the import that reads one back.
 *
 * **Authoring is the settings panel plus a dev-only export, not hand-written
 * JSON** (ADR 0010) — which is what makes the vocabulary self-testing: a
 * design arrived at here comes out as the library entry it would ship as, so
 * every shipped Template is provably reachable through this panel.
 */
function DevExport({ entry, onChange }: { entry: TemplateEntry; onChange: (template: Template) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  return (
    <details className="wconvert-export">
      <summary>{__('Library entry (developers)', 'wconvert')}</summary>
      <textarea
        className="widefat code"
        rows={12}
        spellCheck={false}
        value={draft ?? exportEntry(entry)}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefused(false);
        }}
      />
      <p>
        <button
          type="button"
          className="button"
          onClick={() => {
            const read = draft === null ? entry : importEntry(draft);

            if (read === null) {
              setRefused(true);

              return;
            }

            onChange({ tree: read.tree, tokens: read.tokens });
            setDraft(null);
            setRefused(false);
          }}
        >
          {__('Load this design', 'wconvert')}
        </button>{' '}
        {refused && <span className="description">{__('That is not a library entry.', 'wconvert')}</span>}
      </p>
    </details>
  );
}
