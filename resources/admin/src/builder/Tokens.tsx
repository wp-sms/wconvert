import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ColorField } from './ColorField';
import { ShadowField } from './ShadowField';
import { Button } from '../components/ui/button';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { CHOICES, TOKENS, groupsOf, resolvedToken, withToken, type TokenGroupId } from './panel';
import { getThemeTokens, type SiteFont } from './api';
import { MediaControl } from './SlotFields';
import { MeasurementValue } from './MeasurementValue';
import { StyleValueInput } from './StyleValueInput';
import {
  asBackgroundLayer,
  axesOf,
  isApplied,
  isColor,
  isFontStack,
  isTranslucent,
  measuresOf,
  themePresets,
  urlIn,
  type Axis,
} from './themes';
import { AA_NORMAL, READABLE_PAIRS, contrastOf, pairKey } from './contrast';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template, Tokens as TokenMap } from '@renderer/types';

/**
 * ============================================================================
 * THE LOOK LIVES ON THE **DESIGN** TAB, BECAUSE THAT IS WHAT DESIGN MEANS.
 * ============================================================================
 * It was the second half of a tab called *Content*, under a heading reading
 * *"How it looks"* — which is the one question Content is not about. The tab
 * called Design meanwhile only picked a template, so a merchant who had chosen
 * one and wanted it in their brand colours had to leave the tab named after the
 * thing they were doing.
 *
 * Nothing about the model moved with it. A preset is a bundle of token VALUES,
 * the raw tokens are the same fifteen the manifest declares, and neither can
 * express a shape — so ADR 0010's boundary is exactly where it was and this is
 * a tab, not a capability.
 */

/**
 * The look: four ready-made bundles, the site's own palette, and every token
 * the manifest declares — grouped, and each wearing the control its value
 * earns it.
 *
 * ============================================================================
 * PRESETS CARRY THE MEDIAN CASE. THE CONTROLS UNDER THEM KEEP THE TAIL.
 * ============================================================================
 * Thirteen text boxes asking for `rgba(15, 23, 42, 0.55)` and a full font stack
 * was *"the single clearest usability defect in the admin"*
 * ([#71](https://github.com/navidkashani/wconvert/issues/71)), and the reason is
 * that a merchant could not find out what a token did except by typing a value
 * and watching the preview. A preset answers that in one press.
 *
 * ============================================================================
 * `Every setting` IS GONE, AND ITS ABSENCE IS THE FIX.
 * ============================================================================
 * Every raw token used to live behind a `<details>` — closed on load, so the
 * Design tab opened as a gallery, four presets and three contrast ratios with
 * **no controls on it at all**. The disclosure's own argument was sound (*"a
 * token with two controls is a token a merchant can watch disagree with
 * itself"*) and is untouched: every token is still here exactly once. What was
 * wrong was hiding all fifteen behind one summary, on the tab whose entire
 * subject they are.
 *
 * **The groups are the disclosure now.** Four headings — colour, type, size and
 * space, and a trailing one for anything this bundle does not recognise — turn
 * a flat list of fifteen into four short lists a merchant can skip past. The
 * colour grid pays back most of the height the `<details>` used to save: six
 * full-width rows for a seven-character value become two lines.
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
/**
 * The ready-made looks, as one control over the DESIGN's own tokens.
 *
 * ============================================================================
 * IT WAS THE FIRST GROUP IN THIS PANEL, WHICH IS THE ONE PLACE IT COULD NOT BE.
 * ============================================================================
 * The inspector draws {@see Tokens} only while nothing or a whole step is
 * selected — anything else is that box's own bag (ADR 0062). So selecting a
 * headline hid the theme picker, and a merchant restyling a box had to
 * deselect to change the palette they were restyling *against*. A theme sets
 * the design's tokens whatever is selected, so it belongs over all three panes
 * rather than inside the pane that is about one box.
 *
 * **A popover and not a `Select`**, because the swatches are the whole
 * affordance: ADR 0054 rule 3 is that a control shows the shape of its value,
 * and a list of names would be six words for six palettes a merchant would
 * choose between by looking. It is a popover and not the grid itself because a
 * toolbar has one line.
 *
 * **Moved rather than repeated.** Two theme pickers is the same defect two
 * controls for one token is (#71): a merchant can watch them disagree.
 */
export function Themes({
  template,
  onChange,
}: {
  template: Template;
  onChange: (template: Template) => void;
}) {
  const [open, setOpen] = useState(false);
  const presets = themePresets();
  const current = presets.find((preset) => isApplied(preset, template.tokens));

  const write = (tokens: Readonly<Record<string, string>>) =>
    onChange({
      ...template,
      tokens: Object.entries(tokens).reduce(
        (carried, [name, value]) => withToken(carried, name, value),
        template.tokens,
      ),
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <span aria-hidden="true" className="wconvert-theme__swatches" data-shape="row">
            {['bg', 'fg', 'accent'].map((token) => (
              <span
                key={token}
                className="wconvert-theme__swatch"
                style={{ background: template.tokens[token] }}
              />
            ))}
          </span>
          {/*
            **The name where there is one, and the word for "none of these"
            where there is not.** A design the merchant has since edited matches
            no preset, and a picker showing the first one would be claiming a
            palette they are not on.
          */}
          {current?.label ?? __('Custom look', 'wconvert')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <div className="wconvert-themes" role="group" aria-label={__('Ready-made looks', 'wconvert')}>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="wconvert-theme"
              aria-pressed={isApplied(preset, template.tokens)}
              onClick={() => {
                write(preset.tokens);
                setOpen(false);
              }}
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
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Tokens({
  template,
  labels,
  design = {},
  openToken,
  onOpenToken,
  onChange,
  onError,
}: {
  template: Template;
  labels: TemplateLabels;
  /**
   * What the LIBRARY ENTRY this Optin's copy was taken for declares, which is
   * the only thing that can answer *"what have I actually changed?"*.
   *
   * An Optin's `tokens` map is a snapshot of the design's, so every token the
   * design set looks "set" here on day one — measuring against the manifest's
   * fallback instead would put a reset control on thirteen of fifteen tokens
   * before the merchant touched anything, and clearing one would jump the value
   * to a default the design never used.
   *
   * This is the same comparison {@see \WConvert\Template\MerchantsOwn} makes
   * on the other side of the boundary, and it takes the same stance where the
   * entry cannot be resolved: **empty, so nothing is claimed.** An install that
   * no longer ships the design has no way to tell the merchant's value from the
   * design's, and guessing would offer a "back to the design's own" that goes
   * somewhere else.
   */
  design?: TokenMap;
  /**
   * ==========================================================================
   * WHICH PICKER IS OPEN IS THE **SCREEN's** STATE, NOT THIS PANEL's.
   * ==========================================================================
   * **A popover outlived its own tab.** Open the colour picker on Design,
   * switch to Content, and the picker was still on screen — over a tab with no
   * colours in it. `<Activity mode="hidden">` hides the tab's DOM; a Radix
   * popover portals to `document.body`, which is not inside it.
   *
   * The obvious fix is a local `useState` here cleared by an effect, on the
   * strength of `Activity` unmounting effects when it hides. **Tried in a
   * browser, and it does not work** — and the reason is worth writing down
   * because it will be proposed again. Radix already closes on an outside
   * click, so the tab click DOES call `onOpenChange(false)`; what does not
   * happen is the re-render. By the time React processes that update this
   * component is inside a hidden `Activity`, whose subtree is reconciled at low
   * priority — so the state changes, the portal is never re-rendered, and the
   * picker stays exactly where it was. An uncontrolled popover fails the same
   * way for the same reason, which is why this was a bug before it was
   * controlled.
   *
   * So the state has to live OUTSIDE the hidden subtree, and the honest owner
   * is the thing that knows a tab changed: {@see OptinBuilder} clears it in the
   * same handler that sets the tab. That generalises — the next portaled
   * overlay on a tab gets the same treatment — and it keeps the property this
   * was worth having anyway: two pickers can never be open at once.
   */
  openToken: string | null;
  onOpenToken: (token: string | null) => void;
  onChange: (template: Template) => void;
  onError: (cause: unknown) => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const groups = groupsOf();
  const hasDesign = Object.keys(design).length > 0;

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
      {/*
        **No `<h4>How it looks</h4>`.** The tab is called Design, the region is
        labelled *The design*, and a heading here was the third naming of one
        thing before a single control — the exact failure {@see TabNote}'s own
        docblock describes for the tabs that had a `RegionHeader`. The groups
        below are the structure, in one register, and this is the first of them.
      */}
      <section className="wconvert-group" aria-label={__('Your theme’s own palette', 'wconvert')}>
        <h5 className="wconvert-group__name">{__('Your theme’s own palette', 'wconvert')}</h5>

        <p className="wconvert-themes__theme">
        {/*
          **The label names what it actually writes.** It read *"Copy my theme's
          colours"* and `ThemeTokens::fromSite()` writes five things, one of
          which is the font and two of which — `muted` and `border` — it does
          not write at all. So copying a dark theme could flip *Quiet text on
          Background* to a fail in the readout the merchant is watching, under a
          button that had promised to handle the colours. The promise and the
          method agree now, and the note points at the readings.

          It stays here with the presets rather than inside either group,
          because what it writes spans two of them.
        */}
          {/* An action inside the work surface, not one a merchant came to the
              screen to press — the 24px tier, like the resets and swatches
              around it. */}
          <Button type="button" variant="outline" size="xs" onClick={copyTheme}>
            {__('Copy my theme’s palette and font', 'wconvert')}
          </Button>
          {copied !== null && (
            <span className="text-note text-muted-foreground">
              {copied === 0
                ? __('Your theme declares no palette to copy.', 'wconvert')
                : __('Copied. Change any of them below.', 'wconvert')}
            </span>
          )}
        </p>
      </section>

      {groups.map((group) => (
        <section key={group.id} className="wconvert-group" aria-label={groupName(group.id)}>
          <h5 className="wconvert-group__name">{groupName(group.id)}</h5>

          {group.id === 'color' ? (
            <Palette
              template={template}
              labels={labels}
              design={design}
              tokens={group.tokens}
              openToken={openToken}
              onOpenChange={onOpenToken}
              onChange={onChange}
            />
          ) : (
            group.tokens.map((token) => (
              <TokenField
                key={token.name}
                token={token.name}
                label={nameOf(labels.tokens, token.name)}
                labels={labels}
                fallback={design[token.name] ?? token.fallback}
                standard={token.fallback}
                design={hasDesign ? (design[token.name] ?? '') : undefined}
                value={template.tokens[token.name] ?? ''}
                open={openToken === token.name}
                onOpenChange={(open) => onOpenToken(open ? token.name : null)}
                onChange={(value) =>
                  onChange({ ...template, tokens: withToken(template.tokens, token.name, value) })
                }
              />
            ))
          )}
        </section>
      ))}
    </>
  );
}

/**
 * What a group of tokens is called.
 *
 * **In the bundle rather than in `TemplateLabels`, and that is the line.** A
 * group is a way of arranging one panel — chrome — while a Slot Role or a token
 * name is vocabulary two runtimes agree on. The manifest declares no groups and
 * is not asked to; a token it declares that this bundle recognises nothing
 * about lands under `other` and gets a text box, which is ADR 0010 kept rather
 * than a fifth cross-cutting list to maintain.
 */
export function groupName(id: TokenGroupId): string {
  switch (id) {
    case 'color':
      return __('Color', 'wconvert');
    case 'type':
      return __('Type', 'wconvert');
    case 'space':
      return __('Size and space', 'wconvert');
    case 'other':
      return __('Other settings', 'wconvert');
  }
}

/**
 * Every colour at once, and the verdict on whether a visitor can read them.
 *
 * ============================================================================
 * A GRID, BECAUSE A PALETTE IS COMPARED RATHER THAN READ DOWN.
 * ============================================================================
 * These were six full-width rows for a seven-character value — a column of
 * settings, which is right for a column of *different questions* and wrong for
 * six answers to one. Two lines of swatches is the whole palette at a glance,
 * and that is what makes the readout under it land as a verdict on something
 * the merchant can see rather than as three sentences about colours that are
 * somewhere else.
 *
 * It also fixes the reset: a colour row was a one-column grid, so applying a
 * preset dropped eight reset buttons each onto a line of its own.
 *
 * **`backdrop` sits under the grid as a full-width row.** It is 22 characters
 * rather than 7, it is the one translucent token, and it is deliberately
 * outside the contrast set — it goes behind the popup rather than behind text,
 * so a ratio for it would be a number about nothing.
 */
function Palette({
  template,
  labels,
  design,
  tokens,
  openToken,
  onOpenChange,
  onChange,
}: {
  template: Template;
  labels: TemplateLabels;
  design: TokenMap;
  tokens: readonly { readonly name: string; readonly fallback: string }[];
  openToken: string | null;
  onOpenChange: (token: string | null) => void;
  onChange: (template: Template) => void;
}) {
  const hasDesign = Object.keys(design).length > 0;
  const write = (name: string) => (value: string) =>
    onChange({ ...template, tokens: withToken(template.tokens, name, value) });

  const field = (token: { name: string; fallback: string }) => (
    <TokenField
      key={token.name}
      token={token.name}
      label={nameOf(labels.tokens, token.name)}
      labels={labels}
      fallback={design[token.name] ?? token.fallback}
      standard={token.fallback}
      design={hasDesign ? (design[token.name] ?? '') : undefined}
      value={template.tokens[token.name] ?? ''}
      open={openToken === token.name}
      onOpenChange={(open) => onOpenChange(open ? token.name : null)}
      onChange={write(token.name)}
    />
  );

  // The translucent ones are the wide rows; everything else is a grid cell.
  // Read off the value rather than off the name `backdrop`, so a second
  // translucent token added to the manifest lands in the right place.
  const solid = tokens.filter((token) => !isTranslucent(design[token.name] ?? token.fallback));
  const wide = tokens.filter((token) => isTranslucent(design[token.name] ?? token.fallback));

  return (
    <>
      <div className="wconvert-palette">{solid.map(field)}</div>
      <Contrast template={template} labels={labels} />
      {wide.map(field)}
    </>
  );
}

/**
 * One token, drawn as what it holds.
 *
 * A color gets a picker. A plain length gets amount/unit inputs and a slider
 * wherever the design's scale can represent it. A token the manifest offers choices for gets those
 * choices as a segmented control. Anything else — `clamp(20rem, 50vw, 30rem)`,
 * an asymmetric radius, a token this bundle has never heard of — gets the text
 * box it always had.
 *
 * ============================================================================
 * A CONTROL THAT ENUMERATES READS THE MANIFEST. ONE THAT INFERS READS THE VALUE.
 * ============================================================================
 * That is the whole dispatch rule, and it is what keeps ADR 0010's promise: a
 * token added to `resources/templates/manifest.json` arrives wearing the right
 * control with nothing here edited, and one that declares no choices still gets
 * whatever its value earns it.
 *
 * **The value it reads is the RESOLVED one, and that is a fix.** `isColor` was
 * asked about the FALLBACK — so a merchant who typed `var(--brand)` into
 * `accent` kept a hex picker sitting over it, ready to overwrite a working
 * reference on the first drag. It branches on what is actually stored now, the
 * same way `measureOf` already did on the length side, and a color it cannot
 * parse gets a text box with a decorative chip beside it: `var()` resolves in
 * the browser, so the merchant still sees the color without a control offering
 * to destroy it.
 */
export function TokenField({
  token,
  label,
  labels,
  fallback,
  standard,
  design,
  value,
  open,
  onOpenChange,
  onChange,
  resetSaid,
}: {
  /** The token's own name — the key its choices and its value labels are under. */
  token: string;
  label: string;
  labels: TemplateLabels;
  /** What this token resolves to with nothing stored — the design's, else the manifest's. */
  fallback: string;
  /**
   * What the MANIFEST declares for this token, whatever the design did.
   *
   * It answers exactly one question and it is worth saying which, because
   * `fallback` answers every other one: **what unit does a design that shipped a
   * bare `0` grow into?** `split-hero`'s `"pad": "0"` has none, a drag has to
   * write something, and `1.5rem` is the vocabulary's own answer ({@see axesOf}).
   */
  standard: string;
  /** The original value; empty means unset, undefined means the original is unavailable. */
  design: string | undefined;
  value: string;
  /** Whether THIS token's picker is the one the panel has open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  /**
   * What the reset control SAYS, where "back to the design's own" is not what
   * pressing it does.
   *
   * At a scope, clearing a token means *back to whatever this box sits inside*
   * — which may be a box two levels out rather than the design — so
   * {@see ScopeStyle} passes its own sentence. Optional, because the design
   * panel's own sentence is right for the design panel and a required prop
   * would be one more thing for every call site to get right.
   */
  resetSaid?: string;
}) {
  const field = useId();
  // Empty means "whatever the design says", so every control below opens on the
  // design's own value while the STORED value stays empty.
  const shown = value === '' ? fallback : value;
  const reset = (
    <Reset label={label} said={resetSaid} value={value} design={design} onChange={onChange} />
  );
  const offered = CHOICES[token];

  if (TOKENS.find(declaration => declaration.name === token)?.control === 'shadow') {
    return <ShadowField label={label} shown={shown} value={value} fallback={fallback} offered={offered ?? []} labels={labels} token={token} reset={reset} open={open} onOpenChange={onOpenChange} onChange={onChange} />;
  }

  if (isColor(shown)) {
    return (
      <div className="wconvert-token wconvert-token--color">
        <ColorField
          label={label}
          fallback={fallback}
          value={value}
          open={open}
          onOpenChange={onOpenChange}
          onChange={onChange}
        />
        {reset}
      </div>
    );
  }

  // Image controls are declared in the manifest; gradients on overlays remain editable values.
  if (TOKENS.find(declaration => declaration.name === token)?.control === 'image') {
    return (
      <ImageField id={field} label={label} value={shown} reset={reset} onChange={onChange} />
    );
  }

  /*
    ==========================================================================
    A ONE-OF-N CONTROL IS CHIPS WHILE N IS SMALL, AND A LIST ONCE IT IS NOT.
    ==========================================================================
    Every other enumerated token has an N the manifest controls — three
    alignments, four weights, four speeds. `font` is the first that does not:
    what it should offer is the families THIS SITE declares, and a block theme
    may declare twenty or thirty. Thirty chips in a wrapping segmented strip is
    not a font picker (ADR 0054 rule 5).

    So it wears the shape `ColourField` already has, which is what keeps ADR
    0042 rule 5 — one job, one control — rather than inventing a fifth
    treatment. **Dispatched on what the LIST is** and never on the token's
    name: a choice list made of font stacks is a font picker, and a second one
    added to the manifest tomorrow gets the same control with nothing here
    edited.
  */
  if (offered !== undefined && offered.length > 0 && offered.every(isFontStack)) {
    return (
      <FontField
        id={field}
        token={token}
        label={label}
        labels={labels}
        offered={offered}
        fallback={fallback}
        shown={shown}
        value={value}
        reset={reset}
        open={open}
        onOpenChange={onOpenChange}
        onChange={onChange}
      />
    );
  }

  if (offered !== undefined) {
    return (
      <ChoiceField
        id={field}
        token={token}
        label={label}
        labels={labels}
        offered={offered}
        fallback={fallback}
        shown={shown}
        value={value}
        reset={reset}
        onChange={onChange}
      />
    );
  }

  /*
    **The range comes from the DESIGN's own value, not the merchant's.** A scale
    derived from what is currently stored moves under the thumb on every drag —
    drag right, the maximum grows, the thumb slides back. What the design
    shipped does not move while the panel is open.

    Sliders appear only where they can say the stored value: the design's
    unit, inside its range. Other plain lengths still have amount/unit controls;
    expressions such as clamp() keep their full CSS text.

    **One slider per axis, and `axesOf` decides how many** — a two-value
    shorthand like `0.75rem 1.25rem` is two, and it is four designs' inner
    spacing. Everything that decision needs is in `themes.ts`, so this branch
    stayed one call and this file still names no token (ADR 0054).
  */
  const axes = axesOf(fallback, standard, shown);
  const measured = measuresOf(shown) !== null;

  return (
    /*
      **An explicit label, and the reset OUTSIDE it.** A `<label>` wrapping the
      row would take its accessible name from all of its text — so the slider
      announced itself as "Width Put Width back to the design's own", which is
      the name of the control beside it read out as part of its own.
    */
    <div className="wconvert-token">
      <label htmlFor={field}>{label}</label>
      {/* Multiple axes stack their numeric controls; reset stays beside the group. */}
      <span className={`wconvert-token__row${measured ? ' items-start' : ''}`}>
        {measured ? (
          <MeasureField
            id={field}
            label={label}
            fallback={fallback}
            standard={standard}
            value={value}
            axes={axes}
            onChange={onChange}
          />
        ) : (
          <StyleValueInput
            id={field}
            type="text"
            className="regular-text"
            // The design's own value is the placeholder rather than the value,
            // so an empty control means "whatever the design says".
            placeholder={fallback}
            value={value}
            onCommit={onChange}
          />
        )}
        {reset}
      </span>
    </div>
  );
}

/**
 * A background picture, as the address a merchant actually has.
 *
 * ============================================================================
 * ONE BOX, AND IT IS STILL THE ESCAPE HATCH.
 * ============================================================================
 * What is SHOWN is the address inside the `url()`; what is STORED is the whole
 * layer. A merchant pastes `https://…/photo.jpg` and the token becomes
 * `url("https://…/photo.jpg")`, which is the only thing CSS will accept in a
 * background layer and the last thing anybody should be asked to type.
 *
 * **A value this cannot read as an address is shown and stored verbatim.** A
 * `linear-gradient()` therefore survives being looked at and can still be
 * typed, which is the same bargain every other control here makes: the panel
 * offers the common case a control and never takes the uncommon one away
 * ({@see asBackgroundLayer}).
 *
 * `type="text"` and not `type="url"`, for that last reason exactly — a `url`
 * input would refuse a gradient, and refuse a site-relative path while it was
 * at it.
 */
function ImageField({
  id,
  label,
  value,
  reset,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  reset: ReactNode;
  onChange: (value: string) => void;
}) {
  const address = urlIn(value);

  return (
    <div className="wconvert-token">
      <label htmlFor={id}>{label}</label>
      <span className="wconvert-token__row">
        <MediaControl
          id={id}
          label={label}
          type="text"
          // What the box SHOWS is the address; what it stores is the whole
          // layer. A value this cannot read as an address — a gradient — is
          // shown and stored verbatim, which is the escape hatch.
          value={address ?? (value === 'none' ? '' : value)}
          preview={address ?? undefined}
          onChange={(next) =>
            onChange(asBackgroundLayer(next))
          }
        />
        {reset}
      </span>
    </div>
  );
}

/**
 * What each half of a two-value shorthand is called.
 *
 * ============================================================================
 * BLOCK THEN INLINE, WHICH IS A FACT ABOUT CSS AND NOT ABOUT `pad`.
 * ============================================================================
 * `padding: a b` is the block axis then the inline one, in every two-value
 * shorthand CSS has. So this names a SHAPE, the way every other test in this
 * panel does, and a second two-value token added to the manifest tomorrow gets
 * the same two words with nothing here edited.
 *
 * **Never *Left and right*.** The renderer is written in logical properties
 * precisely because writing direction crosses every boundary, and the admin has
 * `useDirection` — so the inline axis is *Sides*, which is true in both. *Top
 * and bottom* is the block axis and stays physical: it is physical in every
 * writing mode wp-admin is ever laid out in, and *Block* is not a word to put
 * in front of a merchant.
 */
function axisName(index: number): string {
  return index === 0
    ? /* translators: one half of a spacing setting — the top and bottom edges. */
      __('Top and bottom', 'wconvert')
    : /* translators: one half of a spacing setting — the two edges the text runs between, whichever way it reads. */
      __('Sides', 'wconvert');
}

/**
 * Sliders keep their design-based scale. Amount/unit fields can go beyond that
 * scale or use another unit, while Custom CSS preserves the unparsed tail.
 * Typing is committed when finished so partial values cannot replace this UI.
 */
function MeasureField({
  id, label, fallback, standard, value, axes, onChange,
}: {
  id: string;
  label: string;
  fallback: string;
  standard: string;
  value: string;
  axes: readonly Axis[] | null;
  onChange: (value: string) => void;
}) {
  const write = (index: number, amount: string) => onChange(
    axes!.map((axis, at) => `${at === index ? amount : axis.amount}${axis.unit}`).join(' '),
  );
  const slider = (axis: Axis, index: number, name?: string) => <input
    id={index === 0 ? id : undefined} type="range" className="wconvert-token__slider"
    aria-label={name} min={axis.range.min} max={axis.range.max} step={axis.range.step}
    value={axis.amount} onChange={(event) => write(index, event.target.value)} />;

  return <div className="flex min-w-0 w-full flex-col gap-2">
    {axes !== null && (axes.length === 1 ? slider(axes[0], 0) : <span className="wconvert-token__axes">
      {axes.map((axis, index) => <label key={index} className="wconvert-token__axis">
        <span className="wconvert-token__axis-name">{axisName(index)}</span>
        {slider(axis, index, sprintf(__('%1$s, %2$s', 'wconvert'), label, axisName(index).toLocaleLowerCase()))}
      </label>)}
    </span>)}
    <MeasurementValue id={axes === null ? id : undefined} label={label}
      rawLabel={sprintf(__('%s value', 'wconvert'), label)}
      fallback={fallback} standard={standard} value={value} onChange={onChange} />
  </div>;
}

/**
 * The values the manifest offers for this token, as a segmented control — with
 * the box that can still say something else.
 *
 * ============================================================================
 * NATIVE RADIOS IN A `role="group"`, AND BOTH HALVES ARE DELIBERATE.
 * ============================================================================
 * **Radios**, because one of these excludes the others and that is what a radio
 * group IS: arrow keys move between them, the set is announced as a set, and
 * only the checked one is a tab stop. Radix's `ToggleGroup` would buy roving
 * focus and arrow keys the browser already gives, at bundle bytes this admin
 * prints on every build.
 *
 * **`role="group"` and not a `<label>` around the three**, because a label
 * names ONE control. Wrapping the set made the token's name part of the
 * accessible name of whichever radio happened to be inside it.
 *
 * **Chips rather than a `<select>`**, an argument `font` made and then took
 * with it: reading *Serif* set in Georgia is the whole value of that control,
 * and `font-family` on an `<option>` is unreliable across browsers. `font` is a
 * popover list now, because its N is the site's rather than the manifest's
 * (ADR 0055); what is left here is every one-of-N the manifest does control,
 * where a strip of three or four is the right shape.
 *
 * **And the text box stays.** `choices` is what the panel offers, never what is
 * allowed — token values are unvalidated on both sides of the boundary — so a
 * merchant may type a fifth stack or a fourth alignment and nothing here
 * refuses it. When they do, no chip is checked, which is the honest picture.
 */
function ChoiceField({
  id,
  token,
  label,
  labels,
  offered,
  fallback,
  shown,
  value,
  reset,
  onChange,
}: {
  id: string;
  token: string;
  label: string;
  labels: TemplateLabels;
  offered: readonly string[];
  fallback: string;
  shown: string;
  value: string;
  reset: React.ReactNode;
  onChange: (value: string) => void;
}) {
  const named = `${id}-name`;
  /*
    ==========================================================================
    THE ESCAPE HATCH IS A CHOICE, NOT PERMANENT FURNITURE.
    ==========================================================================
    A text box sat under the three alignment chips on every visit, holding
    `center`, labelled *"Alignment value"* — and a merchant looking at *Left ·
    Centre · Right* has no idea what it is for or what would happen if they
    typed in it. It is the escape hatch that keeps `choices` a suggestion rather
    than validation, and that property is load-bearing (ADR 0010: token values
    are unvalidated on both sides of the boundary) — but keeping the property
    never required keeping the box on screen.

    So it is a fourth option. **Custom** is checked whenever the stored value is
    one the manifest never offered — which is also the honest picture of that
    state, where before no chip was checked and the box quietly disagreed with a
    control that looked authoritative — and also whenever the merchant has just
    asked for it.

    That second half needs local state, and the reason is worth a line: this
    control is otherwise a pure function of the token's value, so pressing
    Custom while the value is still `center` would write `center`, leave the
    value on the list, and snap straight back to Centre. *"I want to type
    something"* is a fact about the merchant rather than about the token, so it
    is the only thing here that is not derived.
  */
  const [asked, setAsked] = useState(false);
  const custom = !offered.includes(shown) || asked;

  return (
    <div className="wconvert-token">
      <span id={named}>{label}</span>
      <span className="wconvert-token__row">
        <span role="group" aria-labelledby={named} className={TOKENS.find(item => item.name === token)?.control === 'position' ? 'wconvert-choice-set grid grid-cols-3 w-full' : 'wconvert-choice-set'}>
          {offered.map((choice) => (
            <label key={choice} className="wconvert-choice">
              <input
                type="radio"
                className="sr-only"
                name={id}
                value={choice}
                checked={!custom && shown === choice}
                onChange={() => {
                  setAsked(false);
                  onChange(choice);
                }}
              />
              {/*
                Set in the face it names, which is the whole point of offering a
                font as chips. `align` gets no such style — its own words are
                the affordance, and words rather than mirrored icons is what
                stops this control needing to know which way the admin reads.
              */}
              <span
                className={TOKENS.find(item => item.name === token)?.control === 'position' ? 'wconvert-choice__label whitespace-normal text-center' : 'wconvert-choice__label'}
                style={isFontStack(choice) ? { fontFamily: choice } : undefined}
              >
                {nameOf(labels.tokenValues, `${token}.${choice}`)}
              </span>
            </label>
          ))}

          <label className="wconvert-choice">
            <input
              type="radio"
              className="sr-only"
              name={id}
              checked={custom}
              /*
                It writes nothing. The token keeps the value it had, which is
                what the box then opens on — asking to type is not itself an
                edit, and writing here would put a value in the box the merchant
                did not choose.
              */
              onChange={() => setAsked(true)}
            />
            <span className="wconvert-choice__label">{__('Custom', 'wconvert')}</span>
          </label>
        </span>
        {reset}
      </span>

      {custom && (
        <input
          type="text"
          className="wconvert-token__typed"
          aria-label={sprintf(
            /* translators: %s: what the setting is for, e.g. “Alignment”. */
            __('%s value', 'wconvert'),
            label,
          )}
          placeholder={fallback}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

/**
 * A typeface, picked from the ones this SITE already serves.
 *
 * ============================================================================
 * THE LIST IS THE SITE'S, AND WCONVERT LOADS NO FACE TO MAKE IT TRUE.
 * ============================================================================
 * Every stack offered here is one the site already serves — the four system
 * ones the manifest declares, and the families the theme declares in its
 * `theme.json`. On the front end the shadow root resolves the stored stack
 * against the document-level `@font-face` rules the theme already printed, so
 * nothing is fetched and nothing is bundled.
 *
 * That is not a saving, it is the only arrangement that works: a face declared
 * INSIDE a shadow root is silently ignored, with an identical computed
 * `font-family` and a `document.fonts.check()` that lies about it
 * (`resources/renderer/src/css.ts`). This avoids the problem rather than
 * working around it. See
 * `docs/adr/0055-the-font-list-is-the-sites.md`, which also records why Google
 * Fonts is refused.
 *
 * ============================================================================
 * A POPOVER, AND NATIVE RADIOS INSIDE IT.
 * ============================================================================
 * The popover is `ColourField`'s shape, applied to a second token rather than
 * invented (ADR 0042 rule 5). The radios are `ChoiceField`'s, for its reason
 * exactly: one of these excludes the others, and that is what a radio group IS
 * — arrow keys between them, one tab stop for the set, and the set announced
 * as a set, all from the browser. A hand-authored `role="listbox"` would be
 * that behaviour rewritten, worse.
 *
 * **Rows rather than a `<select>`**, because the whole value of this control is
 * reading *Georgia* set in Georgia, and `font-family` on an `<option>` is
 * unreliable across browsers (`index.css`). That was the argument for chips and
 * it is the argument for this: what changed is the count, not the reason.
 *
 * **The site's list is read on the first OPEN**, not on mount. It is a fact
 * about the site that a merchant asks for rarely, which is the same reason
 * `ThemeController` is a route of its own — and a Design tab that fetched it on
 * every visit would pay for a control most visits never touch.
 */
function FontField({
  id,
  token,
  label,
  labels,
  offered,
  fallback,
  shown,
  value,
  reset,
  open,
  onOpenChange,
  onChange,
}: {
  id: string;
  token: string;
  label: string;
  labels: TemplateLabels;
  offered: readonly string[];
  fallback: string;
  shown: string;
  value: string;
  reset: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const named = `${id}-name`;
  const [site, setSite] = useState<readonly SiteFont[] | null>(null);
  const [search, setSearch] = useState('');
  const [libraryUrl, setLibraryUrl] = useState<string | null>(null);
  const [fontError, setFontError] = useState(false);

  const read = () => {
    setFontError(false);
    getThemeTokens()
      .then(({ fonts, font_library_url }) => { setSite(fonts ?? []); setLibraryUrl(font_library_url ?? null); })
      // Keep system stacks available and offer a local retry for site fonts.
      .catch(() => { setSite([]); setFontError(true); });
  };

  /*
    The theme's families first and the system stacks under them, because a
    merchant who has a brand face is looking for it. A family whose stack the
    manifest already offers is dropped rather than drawn twice — the same
    dedupe `ThemeTokens` makes one boundary over, for the same reason.
  */
  const theirs = (site ?? []).filter((font) => !offered.includes(font.stack));

  const nameOfStack = (stack: string): string => {
    const declared = labels.tokenValues[`${token}.${stack}`];

    if (declared !== undefined) {
      return declared;
    }

    // The theme's own name for it. It is a proper noun and is deliberately not
    // translated — "Playfair Display" is what it is called everywhere.
    return (site ?? []).find((font) => font.stack === stack)?.label ?? familyIn(stack);
  };

  return (
    <div className="wconvert-token">
      <span id={named}>{label}</span>
      <span className="wconvert-token__row">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) {
              setSearch('');
              read();
            }

            onOpenChange(next);
          }}
        >
          <PopoverTrigger asChild>
            <button type="button" className="wconvert-font" aria-labelledby={named}>
              {/*
                Set in the face it names, which is the whole point of this
                control — and the one thing a `<select>` could not do.
              */}
              <span className="wconvert-font__name" style={{ fontFamily: shown }}>
                {nameOfStack(shown)}
              </span>
              <ChevronDown aria-hidden="true" className="wconvert-font__chevron" />
            </button>
          </PopoverTrigger>

          <PopoverContent align="end" side="left" collisionPadding={12} className="wconvert-font-popover">
            <label className="wconvert-font-search">{__('Find a font', 'wconvert')}<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={__('Search site and system fonts…', 'wconvert')} /></label>
            {site === null && <p role="status">{__('Loading site fonts…', 'wconvert')}</p>}
            {fontError && <p role="status">{__('Site fonts could not load.', 'wconvert')} <button type="button" onClick={read}>{__('Retry', 'wconvert')}</button></p>}
            <div className="wconvert-fonts" role="group" aria-labelledby={named}>
              {theirs.length > 0 && (
                <>
                  <p className="wconvert-fonts__group text-micro uppercase text-muted-foreground">
                    {__('Site fonts', 'wconvert')}
                  </p>
                  {theirs.filter(font => font.label.toLowerCase().includes(search.toLowerCase())).map((font) => (
                    <FontRow
                      key={font.stack}
                      name={id}
                      stack={font.stack}
                      label={font.label}
                      checked={shown === font.stack}
                      onChange={onChange}
                    />
                  ))}
                </>
              )}

              <p className="wconvert-fonts__group text-micro uppercase text-muted-foreground">
                {__('On every device', 'wconvert')}
              </p>
              {offered.filter(stack => nameOfStack(stack).toLowerCase().includes(search.toLowerCase())).map((stack) => (
                <FontRow
                  key={stack}
                  name={id}
                  stack={stack}
                  label={nameOfStack(stack)}
                  checked={shown === stack}
                  onChange={onChange}
                />
              ))}

            </div>

            {search && ![...theirs.map(font => font.label), ...offered.map(nameOfStack)].some(name => name.toLowerCase().includes(search.toLowerCase())) && <p role="status">{__('No matching fonts.', 'wconvert')}</p>}
            <div className="wconvert-font-library">
              <strong>{__('Want a Google Font?', 'wconvert')}</strong>
              <p>{__('Install it in the WordPress Font Library. Save your draft and reload the editor to refresh font previews. WordPress hosts the font on your site.', 'wconvert')}</p>
              <a href={libraryUrl ?? 'https://wordpress.org/documentation/article/the-font-library/'} target="_blank" rel="noreferrer">{libraryUrl ? __('Open Font Library ↗', 'wconvert') : __('Font Library instructions ↗', 'wconvert')}</a>
            </div>
            {/*
              **The escape hatch, inside the thing you opened — and OUTSIDE the
              scroller.** `choices` is what the panel offers and never what is
              allowed (ADR 0010), so a merchant may type a stack nobody listed;
              it is not permanent furniture on the panel, which is ADR 0054 rule
              2 satisfied. Under the list rather than in it, because a theme
              declaring thirty families would otherwise put it thirty rows down.
            */}
            <label className="wconvert-slot__key wconvert-fonts__typed">
              {sprintf(
                /* translators: %s: what the setting is for, e.g. “Font”. */
                __('%s value', 'wconvert'),
                label,
              )}
              <input
                type="text"
                className="regular-text"
                placeholder={fallback}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            </label>
          </PopoverContent>
        </Popover>
        {reset}
      </span>
    </div>
  );
}

/** One family, set in itself. */
function FontRow({
  name,
  stack,
  label,
  checked,
  onChange,
}: {
  name: string;
  stack: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="wconvert-font-row">
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={stack}
        checked={checked}
        onChange={() => onChange(stack)}
      />
      <span className="wconvert-font-row__name" style={{ fontFamily: stack }}>
        {label}
      </span>
    </label>
  );
}

/**
 * The first family a stack names, unquoted — a last resort for a name.
 *
 * Used only where nothing else has a word for the stack: not the manifest's
 * labels, and not the theme's own `name`. A merchant who typed their own stack
 * reads back the face they asked for rather than the whole declaration.
 */
function familyIn(stack: string): string {
  return (stack.split(',')[0] ?? stack).trim().replace(/^['"]|['"]$/g, '');
}

/**
 * The way back to the design's own value, shown only where there is one.
 *
 * **Its presence is the answer to "what have I actually changed?"**, which was
 * otherwise unanswerable without opening fifteen controls and remembering what
 * each design shipped. The panel stores an ABSENCE rather than a copy of the
 * fallback, so clearing a token is also what lets an improved Template reach an
 * Optin the merchant never overrode.
 */
function Reset({
  label,
  said,
  value,
  design,
  onChange,
}: {
  label: string;
  /** {@see TokenField.resetSaid} — the design panel's own sentence where absent. */
  said?: string;
  value: string;
  /** The original value; empty means unset, undefined means the original is unavailable. */
  design: string | undefined;
  onChange: (value: string) => void;
}) {
  if (design === undefined || value === '' || value === design) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      /*
        24px — `--control-height-xs`, the height of a control INSIDE the work
        surface. A reset appears beside a swatch in a 9.5rem grid cell, so at
        32px it was a third of the cell for a control that is absent whenever
        nothing has been changed.
      */
      size="icon-xs"
      className="wconvert-token__reset"
      /*
        **It writes the design's value back rather than clearing**, because
        clearing means "whatever the manifest declares" and that is a different
        number: a design shipping `width: 26rem` would jump to the manifest's
        28rem, which is neither what the merchant had nor what they asked for.
        Where the design declared nothing, absence IS its own value.
      */
      onClick={() => onChange(design)}
    >
      <RotateCcw aria-hidden="true" />
      <span className="sr-only">
        {said ??
          sprintf(
            /* translators: %s: what the setting is for, e.g. “Background”. */
            __('Put %s back to the design’s own', 'wconvert'),
            label,
          )}
      </span>
    </Button>
  );
}

/**
 * The three pairs a visitor has to be able to READ, measured against AA.
 *
 * ============================================================================
 * MEASURED WHERE IT IS CHOSEN, BECAUSE NOTHING DOWNSTREAM WILL CATCH IT.
 * ============================================================================
 * ADR 0038 holds this admin to AA and measures contrast at its own tokens. The
 * Optin's tokens are the merchant's and go to a visitor, and the colour picker
 * is the first control in this product that lets someone fail AA for somebody
 * else — in one click, silently, discovered later from a customer.
 *
 * **Four pairs, and `backdrop` is deliberately not one of them.** It sits
 * behind the popup rather than behind text, so a ratio for it would be a number
 * about nothing. The four that are here are every place the renderer paints
 * words on a surface.
 *
 * **It sits WITH the colours now.** It was above a closed disclosure that
 * contained them, so the default view of the Design tab was three ratios and no
 * colours at all — a verdict on something the merchant could not see.
 */
function Contrast({ template, labels }: { template: Template; labels: TemplateLabels }) {
  // The Optin's own value, else the token this one chains to, else what the
  // manifest declares — which is exactly what the renderer resolves, so the
  // ratio is the one a visitor gets rather than the one an empty control
  // implies ({@see resolvedToken}).
  const value = (name: string) => resolvedToken(template.tokens, name);

  const read = READABLE_PAIRS.map(([fg, bg]) => {
    const sample = SAMPLE[pairKey(fg, bg)] ?? 'Aa';

    const ratio = contrastOf(value(fg), value(bg));

    return {
      key: `${fg}/${bg}`,
      fg,
      bg,
      sample,
      ratio,
      state: ratio === null ? 'unknown' : ratio >= AA_NORMAL ? 'pass' : 'fail',
      named: sprintf(
        /* translators: 1: the text colour's name, e.g. “Quiet text”. 2: the surface's, e.g. “Background”. */
        __('%1$s on %2$s', 'wconvert'),
        nameOf(labels.tokens, fg),
        nameOf(labels.tokens, bg),
      ),
    };
  });

  const wrong = read.filter((pair) => pair.state !== 'pass');

  /*
    ==========================================================================
    A PASSING RATIO IS A FACT NOBODY ACTS ON, SO IT IS NOT ON SCREEN AT ALL.
    ==========================================================================
    Every pair was printed on every visit — *"Text on Background 17.7 to 1 —
    passes AA"* three times over — which is three lines of arithmetic a merchant
    reads once and reads past forever. That is the cost {@see Shell}'s own
    subtitle argument names: a permanent line that taxes every visit and informs
    one.

    The first fix replaced it with one line saying everything passed, on the
    reasoning that silence would hide the check. That was still a line nobody
    acts on. **A clean design says nothing**, and the check announces itself the
    only way that matters: by appearing the moment something is wrong.
  */
  if (wrong.length === 0) {
    return null;
  }

  return (
    <div className="wconvert-contrast">
      {/*
        Named, because a group of rows that appears out of nowhere under a
        palette needs to say what it is measuring. Micro register, like every
        other group name in this panel.
      */}
      <h6 className="wconvert-contrast__name">{__('Can it be read', 'wconvert')}</h6>

      <ul className="wconvert-contrast__list">
        {wrong.map((pair) => (
          /*
            **The sample is the point.** A ratio is a number a merchant has no
            intuition for; two letters drawn in the actual pair, at the actual
            size, is the same fact in a form they can judge in a glance — and it
            is the only part of this row that would still mean something with
            the numbers removed.
          */
          <li key={pair.key} className="wconvert-contrast__pair" data-state={pair.state}>
            <span
              aria-hidden="true"
              className="wconvert-contrast__sample"
              style={
                {
                  '--wconvert-sample-fg': value(pair.fg),
                  '--wconvert-sample-bg': value(pair.bg),
                } as CSSProperties
              }
            >
              {pair.sample}
            </span>

            <span className="wconvert-contrast__what">{pair.named}</span>

            {pair.ratio !== null && (
              <span className="wconvert-contrast__ratio">
                {sprintf(
                  /* translators: %s: a contrast ratio, e.g. “4.8”. */
                  __('%s:1', 'wconvert'),
                  pair.ratio.toFixed(2),
                )}
              </span>
            )}

            {/*
              **A refusal rather than a wrong number.** A translucent colour
              composites over whatever is behind it and a named one needs a
              browser to resolve; either way a ratio here would be a green tick
              over a design that fails.
            */}
            <span className="wconvert-contrast__badge">
              {pair.ratio === null ? __('No reading', 'wconvert') : __('Under AA', 'wconvert')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every place the renderer paints words on a surface, and the two characters
 * that stand for what is painted there.
 *
 * The sample is not decoration: a ratio is a number nobody has an intuition
 * for, and the same pair drawn as letters is a judgement a merchant can make
 * without knowing what 4.5 means. `Go` for the button, because that is what a
 * button says.
 */
/**
 * The lettered sample per pair, keyed by the pair {@see READABLE_PAIRS}
 * declares. The pairs are shared; the letters are this readout's.
 */
const SAMPLE: Readonly<Record<string, string>> = {
  'fg/bg': 'Aa',
  'muted/bg': 'Aa',
  'accent-fg/accent': 'Go',
  'fg/input-bg': 'Aa',
};
