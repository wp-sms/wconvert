import { useState, type CSSProperties } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { HexColorInput, HexColorPicker, RgbaStringColorPicker } from 'react-colorful';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { TOKENS, withToken } from './panel';
import { getThemeTokens } from './api';
import { isApplied, isColour, isTranslucent, themePresets } from './themes';
import { nameOf, type TemplateLabels } from '../templates/api';
import type { Template } from '@renderer/types';

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

