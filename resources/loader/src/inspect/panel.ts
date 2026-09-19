import { GATES } from './report';
import type { Funnel, Labels, Row, TargetingRow } from './report';
import type { EntryReport, RuleReport } from './explain';

/**
 * The panel: the only thing in the inspector that touches the screen.
 *
 * ============================================================================
 * IT SITS BESIDE THE THING IT EXPLAINS AND CAN ALWAYS BE GOT OUT OF THE WAY.
 * ============================================================================
 * **WCAG 2.2 SC 2.4.11 (Focus Not Obscured, AA)**: a focused element must not
 * be *entirely* hidden by author content. This panel is fixed-position over a
 * page whose whole point is that a popup is about to appear on it, so it is
 * collapsible, dismissible and capped well short of the viewport. That is a
 * real failure mode for exactly this kind of panel, and the accessibility gate
 * would catch it later at more cost.
 *
 * **Non-modal, and an OPEN shadow root.** Non-modal because the merchant is
 * meant to watch the real popup fire while reading why — a modal would take
 * focus from the page it is explaining. Open because this is a diagnostic: a
 * closed root would put the report out of reach of the devtools of the person
 * debugging with it.
 *
 * **Every merchant-facing word comes in as data.** `wp i18n make-pot` cannot
 * see a string in a TypeScript bundle, so the labels are minted in
 * `WConvert\Frontend\InspectorLabels` and handed over. What is spelled here is
 * markup, CSS and one `%s` substitution.
 */

export interface Panel {
  render(funnel: Funnel): void;
  destroy(): void;
}

const HOST_ID = 'wconvert-inspector-panel';

export function createPanel(labels: Labels): Panel {
  const host = document.createElement('div');

  host.id = HOST_ID;

  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');

  style.textContent = CSS;
  root.append(style);

  const frame = el('section', 'panel');

  frame.setAttribute('aria-label', text(labels, 'title'));

  const header = el('header', 'head');
  const heading = el('h2', 'title');

  heading.textContent = text(labels, 'title');

  const toggle = el('button', 'icon') as HTMLButtonElement;

  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.textContent = '–';
  toggle.title = text(labels, 'collapse');

  const close = el('button', 'icon') as HTMLButtonElement;

  close.type = 'button';
  close.textContent = '✕';
  close.title = text(labels, 'close');
  close.addEventListener('click', () => host.remove());

  const body = el('div', 'body');

  /** Shut or open the body, and keep the control saying which. */
  const collapse = (shut: boolean) => {
    toggle.setAttribute('aria-expanded', shut ? 'false' : 'true');
    toggle.textContent = shut ? '+' : '–';
    toggle.title = text(labels, shut ? 'expand' : 'collapse');
    body.hidden = shut;
  };

  toggle.addEventListener('click', () => collapse(toggle.getAttribute('aria-expanded') === 'true'));

  header.append(heading, toggle, close);
  frame.append(header, body);
  root.append(frame);

  document.body.append(host);

  /*
    ==========================================================================
    WCAG 2.2 SC 2.4.11 — IT GETS OUT OF THE WAY OF FOCUS, IT DOES NOT MERELY
    SIT IN A CORNER.
    ==========================================================================
    A focused element must not be ENTIRELY hidden by author content. Capping
    the panel at 60vh and putting it in the corner is necessary and it is not
    sufficient: measured on a real page, tabbing the theme's own navigation put
    three links completely behind it.

    So the panel collapses the moment focus lands somewhere it covers. It does
    NOT restore itself — the merchant re-opens it with the toggle — because
    content that pops back is content the criterion is still about.

    `focusin` rather than `focus`, because focus does not bubble; the capture
    phase would work too but this fires on the document either way.
  */
  document.addEventListener('focusin', () => {
    const focused = document.activeElement;

    if (focused === null || focused === document.body || focused === host || body.hidden) {
      return;
    }

    if (entirelyBehind(focused.getBoundingClientRect(), frame.getBoundingClientRect())) {
      collapse(true);
    }
  });

  return {
    render(funnel: Funnel): void {
      body.replaceChildren(arrivalOf(funnel, labels), ...rowsOf(funnel, labels));
    },
    destroy(): void {
      host.remove();
    },
  };
}

/**
 * The delivery report, and the request as the server saw it.
 *
 * It is above the rows rather than below them because it is the one thing that
 * can make every row below it wrong: a payload that never arrived explains
 * every Optin on the page at once.
 */
function arrivalOf(funnel: Funnel, labels: Labels): HTMLElement {
  const section = el('div', 'arrival');
  const intro = el('p', 'muted');

  intro.textContent = text(labels, 'intro');
  section.append(intro);

  if (!funnel.arrival.payloadFound || funnel.arrival.entries === 0) {
    // Absent is NORMAL on most pages of most sites — no published Optin
    // matched — so this is stated as a fact rather than as a warning.
    section.append(note(text(labels, 'sections', 'server_only')));
  }

  // None of these three is an error — `boot.ts` survives all of them. They are
  // the observations ADR 0004 says a merchant has no other way to make.
  if (!funnel.arrival.loaderFound) {
    section.append(note(text(labels, 'arrival', 'aggregated')));
  }

  if (funnel.arrival.loaderFound && !funnel.arrival.deferred) {
    section.append(note(text(labels, 'arrival', 'defer')));
  }

  if (funnel.arrival.loaderFound && funnel.arrival.loaderBeforePayload) {
    section.append(note(text(labels, 'arrival', 'order')));
  }

  return section;
}

function rowsOf(funnel: Funnel, labels: Labels): HTMLElement[] {
  if (funnel.rows.length === 0) {
    return [note(text(labels, 'nothing'))];
  }

  return funnel.rows.map((row) => rowOf(row, labels));
}

function rowOf(row: Row, labels: Labels): HTMLElement {
  const details = el('details', 'row');
  const summary = el('summary', 'summary');
  const name = el('strong', 'name');

  name.textContent = row.optin.name;

  const verdict = el('span', row.stopped === null ? 'ok' : 'stop');

  verdict.textContent = sentenceFor(row, labels);
  summary.append(name, verdict);
  details.append(summary, gatesOf(row, labels));

  if (row.browser?.displayType === 'fullscreen') {
    details.append(note(text(labels, 'fullscreen')));
  }

  const placement = row.browser === null ? null : placementOf(row.browser);
  if (placement !== null) {
    const position = el('p', 'muted');
    position.textContent = text(labels, 'placement', 'position').replace(
      '%s',
      text(labels, 'placement', placement),
    );
    details.append(position);
  }

  if (row.optin.targeting !== null) {
    details.append(targetingOf(row, labels));
  }

  if (row.browser === null) {
    details.append(note(text(labels, 'sections', 'server_only')));

    return details;
  }

  details.append(
    ruleTable(text(labels, 'sections', 'triggers'), row.browser.triggers, labels),
    ruleTable(text(labels, 'sections', 'conditions'), row.browser.conditions, labels),
  );

  return details;
}

function placementOf(entry: EntryReport): string | null {
  if (entry.displayType === 'floating_bar') {
    return entry.placement === 'block_start' ? 'block_start' : 'block_end';
  }
  if (entry.displayType === 'slide_in') {
    return [
      'block_start_inline_start',
      'block_start_inline_end',
      'block_end_inline_start',
    ].includes(entry.placement ?? '')
      ? entry.placement ?? null
      : 'block_end_inline_end';
  }
  return null;
}

/**
 * Where it stopped, in words.
 *
 * A SUSPENDED Optin carries the Optin list's own sentence verbatim rather than
 * a key — the two screens must not be able to disagree about why an Optin is
 * suspended, and the list's sentence already names the missing plugin.
 */
function sentenceFor(row: Row, labels: Labels): string {
  if (row.stopped === null) {
    return text(labels, 'stopped', 'showing');
  }

  if (row.stopped === 'suspended') {
    return row.optin.suspended ?? '';
  }

  const sentence = text(labels, 'stopped', row.stopped);

  // ==========================================================================
  // ONE `%s`, SUBSTITUTED BY HAND, AND NEVER TWO.
  // ==========================================================================
  // The inspector takes no `@wordpress/i18n` — it is composed from the
  // loader's own module set, which has no dependencies at all (ADR 0004) — so
  // a formatter here would be a dependency in the loader's graph. One
  // placeholder is what a single `replace` can do honestly, and
  // `InspectorLabels` is written to that limit.
  return row.subject === null ? sentence : sentence.replace('%s', row.subject);
}

/**
 * How far this Optin got, as the sequence it had to pass.
 *
 * ============================================================================
 * THE GATES IT PASSED ARE THE HALF A SENTENCE CANNOT CARRY.
 * ============================================================================
 * "This browser has already had its allowance" answers *what stopped it*. It
 * does not answer *what is already fine*, and that is most of what a merchant
 * debugging a popup needs: the Optin is published, not suspended, allowed on
 * this page, and it reached the browser. Nine facts they no longer have to
 * check by hand.
 *
 * It lives INSIDE the disclosure. The collapsed row is what a merchant scans
 * to find the Optin they care about, and ten rows per Optin there would bury
 * it; open, this is the first thing under the summary, because it is the
 * shape of the answer.
 */
function gatesOf(row: Row, labels: Labels): HTMLElement {
  const list = el('ol', 'gates');
  // Null means every gate opened, so nothing is marked closed and the whole
  // sequence reads as passed.
  const closed = row.gate === null ? GATES.length : GATES.indexOf(row.gate);

  GATES.forEach((gate, at) => {
    const item = el('li', at < closed ? 'gate gate--open' : at === closed ? 'gate gate--shut' : 'gate');
    const mark = el('span', at < closed ? 'yes' : at === closed ? 'no' : 'unknown');

    mark.textContent = at < closed ? '✓' : at === closed ? '✕' : '·';

    const words = el('span', 'gate__name');

    words.textContent = text(labels, 'gates', gate);
    item.append(mark, words);
    list.append(item);
  });

  return list;
}

function targetingOf(row: Row, labels: Labels): HTMLElement {
  const section = el('div', 'section');
  const heading = el('h3', 'section-title');

  heading.textContent = text(labels, 'sections', 'targeting');
  section.append(heading);

  const targeting = row.optin.targeting;

  if (targeting === null) {
    return section;
  }

  for (const [key, rows] of [
    ['include', targeting.include],
    ['exclude', targeting.exclude],
  ] as const) {
    if (rows.length === 0) {
      continue;
    }

    const list = el('ul', 'list');
    const label = el('p', 'muted');

    label.textContent = text(labels, 'sections', key);
    section.append(label);

    for (const rule of rows) {
      list.append(targetingRow(rule, labels));
    }

    section.append(list);
  }

  return section;
}

function targetingRow(rule: TargetingRow, labels: Labels): HTMLElement {
  const item = el('li', 'item');
  const mark = el('span', rule.matches ? 'yes' : 'no');

  mark.textContent = rule.matches ? '✓' : '✕';

  const words = el('span', 'rule');

  words.textContent = `${text(labels, 'rules', rule.type)}: ${rule.value}`;
  item.append(mark, words);

  return item;
}

/**
 * One axis of client rules, as the table ADR 0005 predicted.
 *
 * **Three marks, never two.** `null` is NOT EVALUATED and gets its own mark:
 * a red cross against a rule a consent plugin withheld teaches the merchant to
 * go and fix a rule that is perfectly fine.
 */
function ruleTable(heading: string, rules: readonly RuleReport[], labels: Labels): HTMLElement {
  const section = el('div', 'section');
  const title = el('h3', 'section-title');

  title.textContent = heading;
  section.append(title);

  if (rules.length === 0) {
    return section;
  }

  const list = el('ul', 'list');

  for (const report of rules) {
    const item = el('li', 'item');
    const mark = el('span', report.answer === true ? 'yes' : report.answer === false ? 'no' : 'unknown');

    mark.textContent = report.answer === true ? '✓' : report.answer === false ? '✕' : '?';

    const words = el('span', 'rule');
    const answer = report.unsupported
      ? text(labels, 'answer', 'unsupported')
      : text(labels, 'answer', report.answer === true ? 'yes' : report.answer === false ? 'no' : 'unknown');

    words.textContent = `${text(labels, 'rules', report.rule.type)} — ${answer}`;
    item.append(mark, words);
    list.append(item);
  }

  section.append(list);

  return section;
}

/**
 * Is this box completely inside that one?
 *
 * "Entirely" is the whole of SC 2.4.11: a focused element half behind the
 * panel still shows a focus ring, and hiding the panel for that would make it
 * flicker away on most of the page. Only a element with nothing visible left
 * of it is a failure.
 */
const entirelyBehind = (focused: DOMRect, panel: DOMRect): boolean =>
  focused.left >= panel.left &&
  focused.right <= panel.right &&
  focused.top >= panel.top &&
  focused.bottom <= panel.bottom;

function note(words: string): HTMLElement {
  const paragraph = el('p', 'note');

  paragraph.textContent = words;

  return paragraph;
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);

  node.className = className;

  return node;
}

/**
 * One word out of the dictionary PHP minted.
 *
 * Falls back to the last key rather than to an empty string, for the reason
 * `RuleLabels` gives: a build whose labels are behind its code shows a
 * merchant `cart_has_items` rather than a blank, and a blank is the failure
 * nobody reports.
 */
function text(labels: Labels, ...path: string[]): string {
  let node: string | Labels = labels;

  for (const key of path) {
    if (typeof node === 'string') {
      return path[path.length - 1];
    }

    node = node[key];

    if (node === undefined) {
      return path[path.length - 1];
    }
  }

  return typeof node === 'string' ? node : path[path.length - 1];
}

/**
 * The panel's own styles, inside its shadow root.
 *
 * ============================================================================
 * EVERY MEASUREMENT IS LOGICAL, AND THE BOX IS DELIBERATELY SMALL.
 * ============================================================================
 * `inset-inline-end` rather than `right`, so the panel lands on the correct
 * side of a Persian admin's page — the same rule the admin bundle keeps
 * throughout. And `max-block-size: 60vh` with `overflow: auto` is the
 * WCAG 2.2 SC 2.4.11 half: a fixed panel that grew to the viewport could
 * entirely hide a focused element on the page underneath, which is precisely
 * the failure that criterion names.
 *
 * A shadow root means none of this can leak onto the merchant's site and none
 * of the theme's CSS can reach in — the same isolation the renderer relies on
 * (ADR 0009), applied to a panel that has to survive being dropped onto any
 * theme in the world.
 */
const CSS = `
:host { all: initial; }
.panel {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
  z-index: 2147483000;
  inline-size: min(26rem, calc(100vw - 2rem));
  max-block-size: 60vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1e1e1e;
  border: 1px solid #c3c4c7;
  border-radius: 6px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 18%);
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.head {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .5rem .75rem;
  border-block-end: 1px solid #e0e0e0;
}
.title { flex: 1; margin: 0; font-size: 13px; font-weight: 600; }
.icon {
  flex: none;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  padding: 0;
  background: none;
  border: 1px solid #c3c4c7;
  border-radius: 4px;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.icon:focus-visible { outline: 2px solid #2271b1; outline-offset: 1px; }
.body { overflow: auto; padding: .5rem .75rem .75rem; }
.muted, .note { color: #646970; margin: .25rem 0; }
.row { border-block-start: 1px solid #f0f0f1; padding-block: .375rem; }
.row:first-of-type { border-block-start: 0; }
.summary { cursor: pointer; display: flex; flex-direction: column; gap: .125rem; }
.summary::marker { color: #646970; }
.name { font-weight: 600; }
.ok { color: #007017; }
.stop { color: #646970; }
.section { margin-block-start: .5rem; }
.section-title { margin: 0 0 .25rem; font-size: 12px; font-weight: 600; color: #646970; }
/* The funnel: how far it got, and where it stopped. */
.gates { margin: .375rem 0 0; padding: 0; list-style: none; }
.gate { display: flex; gap: .375rem; align-items: baseline; color: #646970; }
/* The one that closed is the answer, so it is the only line at full weight. */
.gate--shut { color: #1e1e1e; font-weight: 600; }
.list { margin: 0; padding: 0; list-style: none; }
.item { display: flex; gap: .375rem; align-items: baseline; }
.rule { flex: 1; }
.yes { color: #007017; }
.no { color: #b32d2e; }
/* NOT a cross. "Not evaluated" is not a failure, and a red mark here sends a
   merchant to fix a rule that is fine. */
.unknown { color: #996800; }
`;
