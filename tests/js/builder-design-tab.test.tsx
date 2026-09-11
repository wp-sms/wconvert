import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateEntry, TemplateLabels } from '../../resources/admin/src/templates/api';

/**
 * ============================================================================
 * THE LOOK, ON THE TAB THE WORD DESIGN ALREADY PROMISED.
 * ============================================================================
 * These assertions were `tests/js/builder-settings-panel.test.tsx`, over a
 * component that held two halves of two different questions: what the design
 * says, and how it looks. The first half moved to the inspector under the block
 * tree (`builder-structure-view.test.tsx`); this is the second.
 *
 * ============================================================================
 * ONE ASSERTION WAS DELETED RATHER THAN MOVED, AND IT IS NAMED HERE.
 * ============================================================================
 * **`'offers nothing that adds, removes or moves a slot'`** guarded ADR 0010's
 * *"the panel edits tokens, slot content and slot visibility — never
 * arrangement"* by sweeping every button on the screen for the words *add*,
 * *remove*, *delete*, *move*, *up* and *down*.
 *
 * It is gone because it stopped being true, deliberately: one surface now edits
 * words **and** arrangement, and the tab it guards has a Delete on every row.
 * The substance of ADR 0010 is untouched and is asserted elsewhere — the
 * vocabulary is still the ceiling (`builder-structure.test.ts`,
 * `catalogue.ts` reads the manifest), the gallery is still where a design comes
 * from, and a preset still cannot express a shape, which is the one clause this
 * file still holds.
 */

const api = vi.hoisted(() => ({ getThemeTokens: vi.fn() }));

vi.mock('../../resources/admin/src/builder/api', () => api);

const { Themes, Tokens } = await import('../../resources/admin/src/builder/Tokens');
const { DevExport } = await import('../../resources/admin/src/builder/DevExport');

const ENTRY = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../resources/templates/library/centred-card.json'), 'utf8'),
) as TemplateEntry;

/**
 * Stand-ins for the words the gallery route serves. The real ones are PHP's,
 * where `wp i18n make-pot` can see them, and are asserted against the manifest
 * in `tests/unit/Template/TemplateLabelParityTest.php`.
 */
const LABELS: TemplateLabels = {
  roles: {},
  nodes: {},
  layouts: {},
  layoutNotes: {},
  layoutParams: {},
  layoutParamValues: {},
  nodeParams: {},
  nodeParamValues: {},
  fields: {},
  keys: {},
  placeholders: { email: 'you@example.com', name: 'Your name', phone: '+44 7700 900000' },
  params: { submit: 'Sends the form', link: 'Goes somewhere else' },
  // Keyed `"{token}.{value}"`, exactly as `TemplateLabels::tokenValues()`
  // spells them. The font stacks are left out on purpose: `nameOf` falls back
  // to the key, which is what a build whose vocabulary is ahead of its
  // translations actually shows.
  tokenValues: {
    'align.start': 'Left',
    'align.center': 'Centre',
    'align.end': 'Right',
    'shadow.none': 'None',
    'shadow.0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.1)': 'Flat',
    'shadow.0 4px 12px -2px rgba(15, 23, 42, 0.12), 0 12px 32px -8px rgba(15, 23, 42, 0.18)': 'Raised',
    'shadow.0 18px 50px -12px rgba(15, 23, 42, 0.35)': 'Lifted',
    'shadow.0 32px 80px -16px rgba(15, 23, 42, 0.5)': 'Floating',
  },
  tokens: {
    bg: 'Background',
    fg: 'Text',
    muted: 'Quiet text',
    accent: 'Button',
    'accent-fg': 'Button text',
    width: 'Width',
    pad: 'Inner spacing',
    shadow: 'Shadow',
  },
};

/**
 * **`design` is the entry's own tokens by default, which is what a real Optin
 * has.**
 *
 * It used to be omitted, so every fallback in these assertions resolved to the
 * MANIFEST's value rather than the design's — and *"the slider's range is
 * derived from the design's own value"* was being asserted against a number the
 * design never declared. `max: '52'` (twice `26rem`) passed only because the
 * manifest's `28rem` happened to be close; it now passes because it is true.
 *
 * A test that wants the other case — an install that no longer ships the entry,
 * where the panel claims nothing — passes `design: {}` explicitly.
 */
function look(over: Partial<Parameters<typeof Tokens>[0]> = {}) {
  const onChange = vi.fn();

  render(
    <Panel
      template={ENTRY}
      labels={LABELS}
      design={ENTRY.tokens}
      onChange={onChange}
      onError={vi.fn()}
      {...over}
    />,
  );

  return onChange;
}

/**
 * **The screen holds which picker is open, so the harness has to as well.**
 *
 * It is `OptinBuilder`'s state rather than the panel's, because the panel lives
 * inside an `<Activity mode="hidden">` and a Radix popover portals outside it —
 * a picker opened on Design outlived the switch to Content, and closing it from
 * within the hidden subtree does not work (the update lands, the portal is
 * never re-rendered). This mirrors that ownership rather than papering over it
 * with a default, so a call site that forgets it is a type error here too.
 */
function Panel(props: Omit<Parameters<typeof Tokens>[0], 'openToken' | 'onOpenToken'>) {
  const [openToken, setOpenToken] = useState<string | null>(null);

  return <Tokens {...props} openToken={openToken} onOpenToken={setOpenToken} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getThemeTokens.mockResolvedValue({ tokens: { bg: '#101820', accent: '#f2aa4c' }, fonts: [] });
});

describe('the look', () => {
  /**
   * ==========================================================================
   * PRESETS CARRY THE MEDIAN CASE; THE RAW TOKENS KEEP THE TAIL (#71).
   * ==========================================================================
   * A preset is a bundle of token VALUES and nothing else, so it changes no
   * shape and needs no new vocabulary — which is the clause of ADR 0010 that
   * survived the merge intact.
   */
  it('applies a preset as token values, and touches nothing else', async () => {
    /*
      **The picker moved out of this panel and the assertion followed it.** It
      was the first group in here, which the inspector draws only while nothing
      or a whole step is selected — so selecting a headline hid the theme
      picker, and a merchant restyling a box had to deselect to change the
      palette they were restyling against. It is over all three panes now
      ({@see Themes}), and it is the same write.
    */
    const onChange = vi.fn();

    render(<Themes template={ENTRY} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Custom look|Classic/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Midnight/ }));

    const [next] = onChange.mock.calls[0] as [{ tokens: Record<string, string>; tree: unknown }];

    expect(next.tokens.bg).toBe('#0f172a');
    expect(next.tokens.accent).toBe('#38bdf8');
    // The tree is the SAME object: a preset cannot express arrangement, because
    // there is nowhere in a token bundle to put one.
    expect(next.tree).toBe(ENTRY.tree);
  });

  /**
   * **Theme inheritance is opt-in, and off until it is asked for.** A stored
   * "inherit" flag would restyle every running Optin the day the merchant
   * switches theme — the surprise ADR 0010 keeps a Template's snapshot away
   * from — so this is a button that copies values once.
   */
  it('reads nothing from the theme until the merchant asks for it', async () => {
    const changed = look();

    expect(api.getThemeTokens).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Copy my theme/ }));

    expect(api.getThemeTokens).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: expect.objectContaining({ bg: '#101820', accent: '#f2aa4c' }) }),
      ),
    );
  });

  /**
   * **Every raw token is still reachable, once** (#71).
   *
   * ==========================================================================
   * "BEHIND THE DISCLOSURE" IS DELETED, AND THE DELETION IS THE POINT.
   * ==========================================================================
   * This assertion used to say the tokens were behind `<details>Every
   * setting</details>`. That disclosure is gone: closed on load, it opened the
   * Design tab as a gallery, four presets and three contrast ratios with no
   * controls on it at all — on the tab whose entire subject those controls are.
   * Its argument survives and is what this still asserts: every token appears
   * **exactly once**, because a token with two controls is a token a merchant
   * can watch disagree with itself.
   *
   * `font` also stops being a text box here — and stops being chips too. Its N
   * is the site's rather than the manifest's now, so it wears the popover
   * `ColourField` has (ADR 0054 rule 5); what this still asserts is that it is
   * a CONTROL and that there is exactly one of it.
   */
  it('keeps every token the manifest declares, once', () => {
    look();

    // A colour is a picker rather than a text box, and it is not behind
    // anything: no disclosure has to be opened first.
    expect(screen.getByRole('button', { name: /Choose a colour for Background/ })).toBeInTheDocument();
    // The stub names only two tokens, so the rest fall back to their raw key —
    // which is what `nameOf` does on a real install missing a label too.
    expect(screen.getByRole('button', { name: 'font' })).toBeInTheDocument();
    // Once, and not once per group.
    expect(screen.getAllByRole('button', { name: /Choose a colour for Background/ })).toHaveLength(1);
  });
});

/**
 * ============================================================================
 * A PICTURE IS AN ADDRESS, NOT A CSS FUNCTION A MERCHANT TYPES.
 * ============================================================================
 * `bg-image` holds a background LAYER — `none`, a `url()`, or a gradient — and
 * without a control of its own the panel's answer is a text box expecting
 * `url(https://…)`, which is the *"type `center` into this box"* defect the
 * whole panel exists to remove. What the box shows is the address; what it
 * stores is the layer.
 *
 * And the escape hatch survives, which is the same bargain the slider makes:
 * a value the control cannot read as an address is shown and stored verbatim.
 */
describe('a background picture', () => {
  const box = () => screen.getByLabelText('bg-image');

  it('shows the address and stores the whole background layer', async () => {
    const changed = vi.fn();

    render(<Panel template={ENTRY} labels={LABELS} onChange={changed} onError={vi.fn()} />);

    // Pasted rather than typed, because the harness's `onChange` is a spy and
    // the panel never receives the value back — typing would assert the last
    // KEYSTROKE. A merchant pastes an address anyway.
    await userEvent.click(box());
    await userEvent.paste('https://example.com/x.jpg');

    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tokens: expect.objectContaining({ 'bg-image': 'url("https://example.com/x.jpg")' }),
      }),
    );
  });

  it('reads an address back out of the layer the design stored', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, 'bg-image': 'url("https://example.com/y.jpg")' } }}
        labels={LABELS}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(box()).toHaveValue('https://example.com/y.jpg');
  });

  /** The escape hatch: a gradient is not an address, so it is left alone. */
  it('shows a gradient verbatim rather than pretending it is an address', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, 'bg-image': 'linear-gradient(#fff, #000)' } }}
        labels={LABELS}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(box()).toHaveValue('linear-gradient(#fff, #000)');
  });
});

/**
 * ============================================================================
 * A SLIDER MUST NEVER BE ABLE TO CLOBBER A VALUE IT CANNOT EXPRESS.
 * ============================================================================
 * Token *names* are checked and their *values are not* — they land straight on
 * the element as custom properties — so `clamp(20rem, 50vw, 30rem)` for `width`
 * and an asymmetric `radius` already work today. Adding the slider has to take
 * nothing away.
 */
describe('a length', () => {
  const widthSlider = () => screen.getByRole('slider', { name: 'Width' });

  it('is dragged, with the exact value still typeable beside it', () => {
    look();

    // 26rem, the design's own, on a range twice as wide.
    expect(widthSlider()).toHaveValue('26');
    expect(widthSlider()).toHaveAttribute('max', '52');
    // The escape hatch, which is what keeps a `clamp()` reachable from here.
    expect(screen.getByLabelText('Width value')).toBeInTheDocument();
  });

  it('keeps the text box and drops the slider for a value it cannot say', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, width: 'clamp(20rem, 50vw, 30rem)' } }}
        labels={LABELS}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryByRole('slider', { name: 'Width' })).toBeNull();
    expect(screen.getByLabelText('Width')).toHaveValue('clamp(20rem, 50vw, 30rem)');
  });

  /**
   * **Its presence is the answer to "what have I actually changed?"** The panel
   * stores an absence rather than a copy of the fallback, so clearing a token
   * is also what lets an improved Template reach an Optin nobody overrode.
   */
  it('offers no way back where the merchant has changed nothing', () => {
    look({ design: ENTRY.tokens });

    expect(screen.queryByRole('button', { name: /Put Width back to the design/ })).toBeNull();
  });

  /**
   * **It writes the design's value back rather than clearing it.** Clearing
   * means "whatever the manifest declares", and this design ships `26rem`
   * against a manifest default of `28rem` — so a reset that cleared would land
   * on a number neither the merchant nor the design ever chose.
   */
  it('puts a changed token back to what the design itself declared', async () => {
    const changed = look({
      template: { ...ENTRY, tokens: { ...ENTRY.tokens, width: '32rem' } },
      design: ENTRY.tokens,
    });

    await userEvent.click(screen.getByRole('button', { name: /Put Width back to the design/ }));

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: expect.objectContaining({ width: '26rem' }) }),
    );
  });
});

/**
 * ============================================================================
 * THE FIRST CONTROL THAT LETS A MERCHANT FAIL AA FOR SOMEBODY ELSE.
 * ============================================================================
 * ADR 0038 holds this admin to AA and measures contrast at its own tokens. The
 * Optin's tokens are the merchant's and are shipped to a visitor, and the
 * picker can break them in one click. So it is measured where it is chosen.
 */
describe('the contrast readout', () => {
  /**
   * ==========================================================================
   * A PASSING RATIO IS A FACT NOBODY ACTS ON, SO IT IS NOT PRINTED.
   * ==========================================================================
   * All three pairs were listed on every visit — three lines of arithmetic read
   * once and read past forever, which is the cost `Shell`'s own subtitle
   * argument names. What is left is the pair that is actually wrong.
   */
  it('names the pair that fails, and says nothing about the two that pass', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, fg: '#111827', muted: '#d4d4d8', bg: '#ffffff' } }}
        labels={LABELS}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const failing = screen.getByText('Quiet text on Background').closest('li');

    expect(failing).toHaveAttribute('data-state', 'fail');
    expect(failing).toHaveTextContent('Under AA');
    // The ratio, and the sample that is the row's real argument.
    expect(failing).toHaveTextContent('1.48:1');
    expect(failing).toHaveTextContent('Aa');
    expect(screen.queryByText('Text on Background')).toBeNull();
    expect(screen.queryByText('Button text on Button')).toBeNull();
  });

  /**
   * ==========================================================================
   * A CLEAN DESIGN SAYS NOTHING AT ALL.
   * ==========================================================================
   * This asserted one line confirming the check had run, which was the first
   * attempt at not printing three passing ratios. It was still a line nobody
   * acts on. The check announces itself the only way that matters — by
   * appearing the moment something is wrong.
   */
  it('is not on screen at all when every pair passes', () => {
    look();

    expect(screen.queryByText('Can it be read')).toBeNull();
    expect(screen.queryByText('Text on Background')).toBeNull();
  });

  /**
   * **`backdrop` is not one of the three.** It sits behind the popup rather
   * than behind text, so a ratio for it would be a number about nothing.
   */
  it('says nothing about the backdrop, which is behind the popup and not behind text', () => {
    look();

    expect(screen.queryByText(/on Backdrop/)).toBeNull();
  });

  /**
   * A refusal rather than a wrong number: a translucent colour composites over
   * whatever is behind it, and this cannot know what that is.
   */
  it('refuses to measure a pair it cannot read rather than reporting a ratio', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, fg: 'rgba(0, 0, 0, 0.8)' } }}
        labels={LABELS}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    /*
      **Three answers, and the copy says which one this is.** It read *"not
      measurable"* in the same amber as *"fails AA"* — two different pieces of
      news painted identically, so a design whose accent is `var(--brand)`
      looked like a design that fails. `data-state` is what the stylesheet
      reads, and it is what the browser pass measures the colour of.
    */
    const pair = screen.getByText('Text on Background').closest('li');

    expect(pair).toHaveAttribute('data-state', 'unknown');
    expect(pair).toHaveTextContent('No reading');
    expect(pair).not.toHaveTextContent('Under AA');
  });
});

/** **Authoring is the editor plus a DEV-ONLY export** (ADR 0010). */
describe('the library entry', () => {
  it('reads a design back out as the entry it would ship as', async () => {
    const changed = vi.fn();

    render(<DevExport entry={ENTRY} onChange={changed} />);

    // The entry as it would ship, in the key order the library files use — so
    // an export can be dropped into `resources/templates/library/` and diffed
    // against its neighbours rather than reformatted first.
    expect((screen.getByLabelText('Library entry JSON') as HTMLTextAreaElement).value).toContain(
      '"id": "centred-card"',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Load this design' }));

    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ tree: expect.anything() }));
  });

  it('says so rather than throwing when what was pasted is not one', async () => {
    const changed = vi.fn();

    render(<DevExport entry={ENTRY} onChange={changed} />);

    await userEvent.clear(screen.getByLabelText('Library entry JSON'));
    await userEvent.type(screen.getByLabelText('Library entry JSON'), 'not json');
    await userEvent.click(screen.getByRole('button', { name: 'Load this design' }));

    expect(screen.getByText('That is not a library entry.')).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});

/**
 * ============================================================================
 * A CONTROL THAT ENUMERATES READS THE MANIFEST. ONE THAT INFERS READS THE VALUE.
 * ============================================================================
 * `align` is a three-value enum that looks like the word `start` and `font` is
 * a curated choice that looks like any other string, so neither shape says what
 * it is — which is why both were text boxes asking a merchant to type `center`.
 * The manifest now says, in a sibling `choices` section.
 *
 * **`choices` is what the panel OFFERS and never what is allowed.** Token
 * values stay unvalidated on both sides of the boundary (ADR 0010), which is
 * what keeps `clamp(20rem, 50vw, 30rem)` typeable — so every one of these has
 * a text box beside it and nothing here refuses a value the manifest never
 * named.
 */
describe('a token the manifest offers choices for', () => {
  it('is a group of chips rather than a box to type a keyword into', async () => {
    const changed = look({
      labels: { ...LABELS, tokens: { ...LABELS.tokens, align: 'Alignment' } },
    });

    const group = screen.getByRole('group', { name: 'Alignment' });

    // Three offered plus Custom, each named by the vocabulary rather than by
    // its CSS keyword — a merchant chooses "Left", not `start`.
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
    // The design ships `center`, so that is the one checked on arrival — and
    // Custom is not, because the value IS one of the offered three.
    expect(within(group).getByRole('radio', { name: 'Centre' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Custom' })).not.toBeChecked();

    await userEvent.click(within(group).getByRole('radio', { name: 'Right' }));

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: expect.objectContaining({ align: 'end' }) }),
    );
  });

  /**
   * ==========================================================================
   * THE ESCAPE HATCH IS A CHOICE, NOT PERMANENT FURNITURE.
   * ==========================================================================
   * A text box holding `center` sat under *Left · Centre · Right* on every
   * visit, labelled "Alignment value", and a merchant had no way to know what
   * it was for. The property it protects — a value the manifest never offered
   * is still expressible — never required the box being on screen.
   */
  it('keeps the typed box out of the way until Custom is chosen', async () => {
    look({ labels: { ...LABELS, tokens: { ...LABELS.tokens, align: 'Alignment' } } });

    // Scoped to the group: `font` offers choices too, so it has a Custom of
    // its own — which is the point, and is why the query names the group.
    const group = screen.getByRole('group', { name: 'Alignment' });

    expect(screen.queryByLabelText('Alignment value')).toBeNull();

    await userEvent.click(within(group).getByRole('radio', { name: 'Custom' }));

    expect(screen.getByLabelText('Alignment value')).toBeInTheDocument();
  });

  /**
   * The escape hatch, and it is what makes `choices` a suggestion: a merchant
   * may type a value the manifest never offered, and it reaches `onChange`
   * unaltered.
   */
  it('still accepts a value nothing offered', async () => {
    const changed = look({
      labels: { ...LABELS, tokens: { ...LABELS.tokens, align: 'Alignment' } },
    });

    // The design ships `center`, so a keystroke lands on the end of it — which
    // is a value the manifest offers nothing for, and it goes through anyway.
    const group = screen.getByRole('group', { name: 'Alignment' });

    await userEvent.click(within(group).getByRole('radio', { name: 'Custom' }));
    await userEvent.type(screen.getByLabelText('Alignment value'), 'j');

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: expect.objectContaining({ align: 'centerj' }) }),
    );
  });

  /**
   * And when the stored value is one nothing offered, **no chip is checked** —
   * which is the honest picture, rather than a control quietly disagreeing with
   * the value beside it.
   */
  it('checks nothing where the value is one it never offered', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, align: 'justify' } }}
        labels={{ ...LABELS, tokens: { ...LABELS.tokens, align: 'Alignment' } }}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'Alignment' });

    /*
      **Custom is what is checked**, which is the honest picture of this state.
      Before, nothing was checked and a text box quietly disagreed with a
      control that looked authoritative.
    */
    expect(within(group).getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByLabelText('Alignment value')).toHaveValue('justify');
  });
});

/**
 * ============================================================================
 * THE SCALE CANNOT MOVE UNDER THE THUMB.
 * ============================================================================
 * A range derived from what is currently STORED grows every time the merchant
 * drags right — so the thumb slides back towards the middle as they pull it,
 * and the control never arrives anywhere. It comes from the DESIGN's own value,
 * which does not move while the panel is open.
 */
describe('the size slider', () => {
  const widthSlider = () => screen.getByRole('slider', { name: 'Width' });

  it('keeps the same range whatever the merchant has stored', () => {
    const { unmount } = render(
      <Panel
        template={ENTRY}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    // The design ships 26rem, so the range is 0–52 whatever is stored on top.
    expect(widthSlider()).toHaveAttribute('max', '52');
    unmount();

    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, width: '40rem' } }}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(widthSlider()).toHaveValue('40');
    expect(widthSlider()).toHaveAttribute('max', '52');
  });

  /**
   * **Outside the design's scale, the slider goes and the box stays.** Pinning
   * the thumb at the end while the box says `80rem` would be a control lying
   * about its own value — the same refusal the panel already makes for a
   * `clamp()`, arriving from the other direction.
   */
  it('steps aside for a length its scale cannot reach', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, width: '80rem' } }}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryByRole('slider', { name: 'Width' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Width amount' })).toHaveValue(80);
    expect(screen.getByRole('combobox', { name: 'Width unit' })).toHaveValue('rem');
  });

  /** And for a length in a unit the design's scale is not written in. */
  it('steps aside for a length in another unit', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, width: '400px' } }}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryByRole('slider', { name: 'Width' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Width amount' })).toHaveValue(400);
    expect(screen.getByRole('combobox', { name: 'Width unit' })).toHaveValue('px');
  });
});

/**
 * ============================================================================
 * A COLOUR CONTROL MUST NOT BE OFFERED OVER A VALUE IT WOULD DESTROY.
 * ============================================================================
 * `isColour` was asked about the FALLBACK, so a merchant who typed
 * `var(--brand)` into `accent` kept a hex picker sitting over it — one drag
 * from overwriting a working reference with `#3f8ea3`. It branches on what is
 * actually stored now, the same way the length side already did.
 */
describe('a colour the panel cannot parse', () => {
  it('keeps the text box rather than offering a picker that would clobber it', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, accent: 'var(--brand)' } }}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Choose a colour for Button$/ })).toBeNull();
    expect(screen.getByLabelText('Button')).toHaveValue('var(--brand)');
  });
});

/**
 * ============================================================================
 * THE TWO TOKENS THAT NEVER REACHED A CONTROL, AND WHY EACH ONE DIDN'T.
 * ============================================================================
 * ADR 0054 rule 2: a free-text box is an escape you opt into, never the control
 * you land on. Both of these landed on one, for two unrelated reasons —
 * `shadow` had no `choices` and a value no shape test can read, and `pad`'s
 * parser wanted a unit and read one component.
 */
describe('a shadow', () => {
  it('is chips rather than a box wanting a CSS box-shadow typed into it', () => {
    look({ design: {} });

    // Checked on the manifest's own fallback, which is the common case.
    expect(screen.getByRole('radio', { name: 'Lifted' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'None' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Floating' })).toBeInTheDocument();
  });

  /**
   * **`none` is a keyword `shadow` and `bg-image` share**, and `isCssImage`
   * runs before the choice branch — so the moment `shadow` got a `choices`
   * entry, `inline-cart-nudge` was handed a media picker asking for the address
   * of a picture. The token's own list is what breaks the tie.
   */
  it('is still chips for the one value a background layer also spells', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, shadow: 'none' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, shadow: 'none' }}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
    // Not the media picker `isCssImage` would otherwise have handed it.
    expect(screen.queryByRole('textbox', { name: 'Shadow' })).toBeNull();
  });

  /**
   * **Seven of the nine designs that declare a shadow declare one off this
   * list**, and three of those cast upward because a bar sits at the bottom of
   * the viewport. `choices` is an offer and never a limit (ADR 0010), so they
   * open on Custom wearing their own value — the library is not renormalised to
   * match the chips.
   */
  it('opens on Custom, value intact, for a design casting its own', () => {
    const upward = '0 -6px 24px rgba(69, 10, 10, 0.35)';

    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, shadow: upward } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, shadow: upward }}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    // Scoped to this token: every choice control on the tab has a Custom chip.
    const shadow = screen.getByText('Shadow').closest('.wconvert-token') as HTMLElement;

    expect(within(shadow).getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByLabelText('Shadow value')).toHaveValue(upward);
  });
});

describe('inner spacing', () => {
  const sliders = () => screen.getAllByRole('slider', { name: /Inner spacing/ });

  /**
   * `split-hero` ships `"pad": "0"` and zero is the one length CSS writes
   * without a unit — so the old parser returned null and every Optin started
   * from that design inherited a permanent text box.
   */
  it('is dragged from a bare zero, in the unit the manifest declares', () => {
    const changed = vi.fn();

    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, pad: '0' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, pad: '0' }}
        onChange={changed}
        onError={vi.fn()}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Inner spacing' });

    expect(slider).toHaveValue('0');
    // 1.5rem is the manifest's own, so the range is 0–2 and the unit is rem.
    expect(slider).toHaveAttribute('max', '2');

    fireEvent.change(slider, { target: { value: '0.125' } });

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: expect.objectContaining({ pad: '0.125rem' }) }),
    );
  });

  /**
   * Four designs ship a two-value `pad` — the three bars and
   * `inline-cart-nudge` — and no single slider expresses two axes. `padding:
   * a b` is block then inline, so the names are logical and never *Left and
   * right*.
   */
  it('draws one slider per axis of a two-value shorthand', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, pad: '1rem 1.25rem' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, pad: '1rem 1.25rem' }}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(sliders()).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Inner spacing, top and bottom' })).toHaveValue('1');
    expect(screen.getByRole('slider', { name: 'Inner spacing, sides' })).toHaveValue('1.25');
  });

  it('writes the whole shorthand back when one axis moves', () => {
    const changed = vi.fn();

    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, pad: '1rem 1.25rem' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, pad: '1rem 1.25rem' }}
        onChange={changed}
        onError={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Inner spacing, sides' }), {
      target: { value: '1.375' },
    });

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ tokens: expect.objectContaining({ pad: '1rem 1.375rem' }) }),
    );
  });

  /**
   * Each axis keeps its own unit and its own scale. Normalising them would be
   * the panel deciding a design's value was written wrong.
   */
  it('keeps two units apart rather than reconciling them', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, pad: '1rem 20px' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, pad: '1rem 20px' }}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByRole('slider', { name: 'Inner spacing, sides' })).toHaveAttribute(
      'max',
      '40',
    );
    expect(screen.getByRole('slider', { name: 'Inner spacing, top and bottom' })).toHaveAttribute(
      'max',
      '3',
    );
  });

  /** CSS allows three and four values; the parser stops at two and says so. */
  it('keeps the text box for a padding with more axes than it reads', () => {
    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, pad: '1rem 2rem 3rem 4rem' } }}
        labels={LABELS}
        design={{ ...ENTRY.tokens, pad: '1rem 2rem 3rem 4rem' }}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole('slider', { name: /Inner spacing/ })).toHaveLength(0);
    expect(screen.getByLabelText('Inner spacing')).toHaveValue('1rem 2rem 3rem 4rem');
  });
});

/**
 * ============================================================================
 * A ONE-OF-N CONTROL IS CHIPS WHILE N IS SMALL, AND A LIST ONCE IT IS NOT.
 * ============================================================================
 * ADR 0054 rule 5. Every other enumerated token has an N the manifest controls;
 * `font` offers the families the SITE declares, and a block theme may declare
 * thirty. So it wears the popover `ColourField` already has, rather than a
 * fifth treatment (ADR 0042 rule 5).
 *
 * **The list is read on the first open**, never on mount: it is a fact about
 * the site that a merchant asks for rarely, which is the same reason the theme
 * route exists at all.
 */
describe('the font picker', () => {
  const trigger = () => screen.getByRole('button', { name: 'font' });

  /**
   * The rows inside the popover, and only those — the Design tab is full of
   * radios and a global query counts every chip on it.
   */
  const rows = async () =>
    within(await screen.findByRole('group', { name: 'font' })).getAllByRole('radio');

  it('reads nothing from the site until the picker is opened', () => {
    look();

    expect(trigger()).toBeInTheDocument();
    expect(api.getThemeTokens).not.toHaveBeenCalled();
  });

  it('offers the theme’s own families above the ones every device has', async () => {
    api.getThemeTokens.mockResolvedValue({
      tokens: {},
      fonts: [
        { label: 'Inter', stack: '"Inter", sans-serif' },
        { label: 'Playfair Display', stack: '"Playfair Display", serif' },
      ],
    });

    look();

    await userEvent.click(trigger());

    expect(await screen.findByRole('radio', { name: 'Inter' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Playfair Display' })).toBeInTheDocument();
    // And the four the manifest declares are still there under them.
    expect(await rows()).toHaveLength(6);
  });

  /**
   * **A classic theme with no `theme.json` declares none.** The list is empty,
   * the picker shows the stacks it always did, and the feature degrades to
   * nothing rather than to something broken.
   */
  it('falls back to the system stacks where the site declares no families', async () => {
    look();

    await userEvent.click(trigger());

    expect(await rows()).toHaveLength(4);
  });

  /** A failed read costs a longer list, never the control. */
  it('keeps working when the site cannot be read at all', async () => {
    api.getThemeTokens.mockRejectedValue(new Error('nope'));

    look();

    await userEvent.click(trigger());

    expect(await rows()).toHaveLength(4);
    expect(screen.queryByText('nope')).toBeNull();
  });

  it('writes the stack, which is what the renderer resolves', async () => {
    api.getThemeTokens.mockResolvedValue({
      tokens: {},
      fonts: [{ label: 'Inter', stack: '"Inter", sans-serif' }],
    });

    const changed = look();

    await userEvent.click(trigger());
    await userEvent.click(await screen.findByRole('radio', { name: 'Inter' }));

    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: expect.objectContaining({ font: '"Inter", sans-serif' }),
      }),
    );
  });

  /**
   * `choices` is what the panel offers and never what is allowed (ADR 0010), so
   * a fifth stack stays typeable — inside the popover, which is rule 2 of
   * ADR 0054 satisfied: an escape you opt into rather than the control you land
   * on.
   */
  it('keeps a stack nobody listed typeable, inside the thing you opened', async () => {
    const changed = look();

    await userEvent.click(trigger());
    await userEvent.type(await screen.findByLabelText('font value'), 'x');

    expect(changed).toHaveBeenCalled();
  });

  /** A family the site declared is named by the THEME's word for it. */
  it('names the current face with the theme’s own noun', async () => {
    api.getThemeTokens.mockResolvedValue({
      tokens: {},
      fonts: [{ label: 'Playfair Display', stack: '"Playfair Display", serif' }],
    });

    render(
      <Panel
        template={{ ...ENTRY, tokens: { ...ENTRY.tokens, font: '"Playfair Display", serif' } }}
        labels={LABELS}
        design={ENTRY.tokens}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    );

    // Before the read there is nothing but the stack, so the first family in it
    // is the honest name — and after it, the theme's own.
    expect(screen.getByRole('button', { name: 'font' })).toHaveTextContent('Playfair Display');
  });
});
