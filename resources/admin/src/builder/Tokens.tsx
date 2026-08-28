import { useEffect, useId, useState, type CSSProperties } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { HexColorInput, HexColorPicker, RgbaStringColorPicker } from 'react-colorful';
import { Button } from '../components/ui/button';
import { RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { TOKENS, withToken } from './panel';
import { getThemeTokens } from './api';
import { isApplied, isColour, isTranslucent, measureOf, rangeFor, themePresets } from './themes';
import { AA_NORMAL, contrastOf } from './contrast';
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
export function Tokens({
  template,
  labels,
  design = {},
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
  onChange: (template: Template) => void;
  onError: (cause: unknown) => void;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  /*
   * ==========================================================================
   * ONE OPEN PICKER, HELD BY THE PANEL — WHICH IS ALSO WHAT CLOSES IT.
   * ==========================================================================
   * **A popover outlived its own tab.** Open the colour picker on Design,
   * switch to Content, and the picker was still on screen — over a tab with no
   * colours in it. `<Activity mode="hidden">` hides the tab's DOM and a Radix
   * popover portals to `document.body`, which is not inside it.
   *
   * The fix needs no workaround and no dependency, because React 19.2's
   * `Activity` **unmounts effects when it hides**. So an effect here whose
   * cleanup clears this state closes the picker exactly when the tab goes away
   * — which means the popover has to be CONTROLLED rather than each swatch
   * owning its own `open`.
   *
   * That is worth having on its own: two pickers can never be open at once.
   */
  const [openToken, setOpenToken] = useState<string | null>(null);
  const presets = themePresets();

  useEffect(() => () => setOpenToken(null), []);

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

      <Contrast template={template} labels={labels} />

      <details className="wconvert-advanced">
        <summary>{__('Every setting', 'wconvert')}</summary>
        {TOKENS.map((token) => (
          <TokenField
            key={token.name}
            label={nameOf(labels.tokens, token.name)}
            fallback={design[token.name] ?? token.fallback}
            design={design[token.name] ?? ''}
            value={template.tokens[token.name] ?? ''}
            open={openToken === token.name}
            onOpenChange={(open) => setOpenToken(open ? token.name : null)}
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
 * A colour gets a picker. A **plain number and unit** gets a slider with the
 * value beside it, because `26rem` is a thing a merchant drags to rather than a
 * thing they know. Anything else — a font stack, `clamp(20rem, 50vw, 30rem)`,
 * an asymmetric radius — gets the text box it always had.
 *
 * **Which is which is read off the value**, so a token added to
 * `resources/templates/manifest.json` arrives wearing the right control with
 * nothing here edited — the same property `TOKENS` already gives the list. The
 * fallback decides for a token the merchant has not touched; the STORED value
 * decides once they have, which is what stops a slider appearing over a
 * `clamp()` it could not express.
 */
function TokenField({
  label,
  fallback,
  design,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  /** What this token resolves to with nothing stored — the design's, else the manifest's. */
  fallback: string;
  /** What the design itself declared, or empty where it declared nothing. */
  design: string;
  value: string;
  /** Whether THIS token's picker is the one the panel has open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const field = useId();
  // Empty means "whatever the design says", so every control below opens on the
  // design's own value while the STORED value stays empty.
  const shown = value === '' ? fallback : value;
  const reset = <Reset label={label} value={value} design={design} onChange={onChange} />;

  if (isColour(fallback)) {
    return (
      <div className="wconvert-token wconvert-token--colour">
        <span className="wconvert-token__name">{label}</span>
        <ColourField
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

  const measure = measureOf(shown);

  return (
    /*
      **An explicit label, and the reset OUTSIDE it.** A `<label>` wrapping the
      row would take its accessible name from all of its text — so the slider
      announced itself as "Width Put Width back to the design's own", which is
      the name of the control beside it read out as part of its own.
    */
    <div className="wconvert-token">
      <label htmlFor={field}>{label}</label>
      <span className="wconvert-token__row">
        {measure === null ? (
          <input
            id={field}
            type="text"
            className="regular-text"
            // The design's own value is the placeholder rather than the value,
            // so an empty control means "whatever the design says".
            placeholder={fallback}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <MeasureField
            id={field}
            label={label}
            fallback={fallback}
            value={value}
            measure={measure}
            onChange={onChange}
          />
        )}
        {reset}
      </span>
    </div>
  );
}

/**
 * A length, dragged — with the exact value still typeable beside it.
 *
 * **Both controls, and they cannot disagree**, because both write the one
 * token. That is what makes the slider strictly additive: a merchant on `28rem`
 * can still type a `clamp()` and watch the slider step aside, which is the
 * escape hatch a slider on its own would have quietly closed.
 *
 * The range comes from the DESIGN's own value rather than from a table of token
 * names — see {@link rangeFor}.
 */
function MeasureField({
  id,
  label,
  fallback,
  value,
  measure,
  onChange,
}: {
  id: string;
  label: string;
  fallback: string;
  value: string;
  measure: { amount: number; unit: string };
  onChange: (value: string) => void;
}) {
  const { min, max, step } = rangeFor(measure);

  return (
    <>
      <input
        id={id}
        type="range"
        className="wconvert-token__slider"
        min={min}
        max={max}
        step={step}
        value={measure.amount}
        onChange={(event) => onChange(`${event.target.value}${measure.unit}`)}
      />
      {/*
        Named for the TOKEN, because two controls sharing one label is a screen
        reader announcing "Width" twice with no way to tell which is which.
      */}
      <input
        type="text"
        className="wconvert-token__exact"
        aria-label={sprintf(
          /* translators: %s: what the setting is for, e.g. “Width”. */
          __('%s value', 'wconvert'),
          label,
        )}
        placeholder={fallback}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
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
  value,
  design,
  onChange,
}: {
  label: string;
  value: string;
  /** What the design declared, or empty where it declared nothing. */
  design: string;
  onChange: (value: string) => void;
}) {
  if (value === '' || value === design) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
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
        {sprintf(
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
 * **Three pairs, and `backdrop` is deliberately not one of them.** It sits
 * behind the popup rather than behind text, so a ratio for it would be a number
 * about nothing. The three that are here are every place the renderer paints
 * words on a surface.
 */
function Contrast({ template, labels }: { template: Template; labels: TemplateLabels }) {
  // The Optin's own value, else what the manifest declares — which is exactly
  // what the renderer resolves, so the ratio is the one a visitor gets rather
  // than the one an empty control implies.
  const value = (name: string) =>
    template.tokens[name] ?? TOKENS.find((token) => token.name === name)?.fallback ?? '';

  return (
    <ul className="wconvert-contrast">
      {PAIRS.map(([fg, bg]) => {
        const ratio = contrastOf(value(fg), value(bg));
        const passes = ratio !== null && ratio >= AA_NORMAL;
        const named = sprintf(
          /* translators: 1: the text colour's name, e.g. “Quiet text”. 2: the surface's, e.g. “Background”. */
          __('%1$s on %2$s', 'wconvert'),
          nameOf(labels.tokens, fg),
          nameOf(labels.tokens, bg),
        );

        return (
          <li key={`${fg}/${bg}`} className="wconvert-contrast__pair" data-passes={passes}>
            <span>{named}</span>
            {/*
              **A refusal rather than a wrong number.** A translucent colour
              composites over whatever is behind it and a named one needs a
              browser to resolve; either way a ratio here would be a green tick
              over a design that fails.
            */}
            {ratio === null ? (
              <span className="wconvert-contrast__ratio">{__('not measurable', 'wconvert')}</span>
            ) : (
              <span className="wconvert-contrast__ratio">
                {sprintf(
                  /* translators: 1: a contrast ratio, e.g. “7.2”. 2: “passes AA” or “fails AA”. */
                  __('%1$s to 1 — %2$s', 'wconvert'),
                  ratio.toFixed(1),
                  passes ? __('passes AA', 'wconvert') : __('fails AA', 'wconvert'),
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Every place the renderer paints words on a surface. */
const PAIRS: readonly (readonly [string, string])[] = [
  ['fg', 'bg'],
  ['muted', 'bg'],
  ['accent-fg', 'accent'],
];

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
 * The name and the reset are the caller's; this is the swatch and what opens
 * behind it.
 */
function ColourField({
  label,
  fallback,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string;
  fallback: string;
  value: string;
  /**
   * **Controlled, and the panel is what holds it** — so the effect in
   * {@see Tokens} can close it when `<Activity>` hides the tab. An uncontrolled
   * Radix popover portals to `document.body` and survives its own tab being
   * hidden, which is how a colour picker came to sit over the Content tab.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  // Empty means "whatever the design says", so the swatch and the picker both
  // open on the design's own value while the STORED value stays empty.
  const shown = value === '' ? fallback : value;
  const translucent = isTranslucent(shown);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
              The way back to the design's own colour is {@see Reset}, in the
              row beside the swatch rather than a click deep inside the picker
              — which is what makes "what have I actually changed?" answerable
              by looking rather than by opening fifteen popovers.
            */}
          </div>
        </PopoverContent>
      </Popover>
  );
}

