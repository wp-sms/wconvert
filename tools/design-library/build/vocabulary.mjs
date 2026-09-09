/**
 * `VOCABULARY.md` — the portable spec, generated from the manifest that
 * validates against it.
 *
 * ============================================================================
 * THIS IS THE FILE YOU PASTE INTO SOMETHING THAT HAS NEVER SEEN THIS REPO.
 * ============================================================================
 * Claude.ai, Claude Design, anything. It carries the whole closed vocabulary
 * and none of the repo — no ADRs, no glossary, no 1,100-line CONTEXT.md — and
 * that context-stripping is the POINT rather than a convenience.
 *
 * "Constraint Decay" (arXiv 2605.06445) measures capable models losing ~30
 * points of assertion pass rate as explicit structural requirements
 * accumulate, on real repositories rather than synthetic ones. A session
 * carrying 61 ADRs and a closed vocabulary IS that load. So the creative act
 * and the constrained act are separated: whatever designs sees this file and
 * nothing else, and what comes back is checked here by
 * `composer verify:templates`.
 *
 * ============================================================================
 * GENERATED, WHICH IS STRICTLY BETTER THAN PARITY-TESTED.
 * ============================================================================
 * The obvious alternative is an authored spec plus a test asserting it matches
 * the manifest. This is the move `build/tokens.mjs` makes on `index.css` one
 * tool over, for the reason `tools/design-system/build.sh` states outright:
 *
 *   > nothing here is authored twice … a hand-maintained mirror is one that is
 *   > wrong from the first commit nobody remembered to copy across.
 *
 * A generated file **cannot** drift, so there is no test to write and none to
 * forget. What is authored here is PROSE — the rules a manifest cannot state,
 * such as why a snapshot outlives its vocabulary — and prose is exactly what
 * no amount of reading JSON produces.
 *
 * It fails loudly rather than emitting a guess: a manifest missing a section
 * this expects means the vocabulary moved, and a spec generated from half of
 * it is worse than no spec at all.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const PLUGIN = process.env.WCONVERT_PLUGIN ?? process.cwd();

const manifest = JSON.parse(
  readFileSync(resolve(PLUGIN, 'resources/templates/manifest.json'), 'utf8'),
);

for (const section of ['layouts', 'nodes', 'tokens', 'roles', 'fields', 'schemes', 'facets']) {
  if (manifest[section] === undefined) {
    throw new Error(
      `manifest.json has no '${section}' section — the vocabulary moved, and a spec generated from half of it is worse than none`,
    );
  }
}

/** Which keys a layout keeps its children under. The manifest says `list` or `panes`. */
const CHILD_KEYS = { list: ['children'], panes: ['start', 'end'] };

/** Every Display Type, and the container each one is judged in. */
const DISPLAY_TYPES = {
  popup: 'A modal over a backdrop, centred, `min(width, 100%)` wide.',
  inline: 'In the flow of the page, where the merchant placed the block.',
  floating_bar: 'Pinned to the block-end edge, spanning the whole inline axis. **Pro.**',
  slide_in: 'The block-end/inline-end corner, capped at 26rem. **Pro.**',
};

const list = (values) => values.map((value) => `\`${value}\``).join(', ');

const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join(
    '\n',
  );

/**
 * A member's whole `choices` section, one group per param, defaults in bold.
 *
 * **Always prefixed with the param name**, even where there is only one group.
 * `image` declares both `fit` and `shape`, and a cell reading
 * `cover, contain · rect, circle` leaves a reader to guess which list belongs
 * to which param — a guess that produces `"fit": "circle"`, which is dropped
 * silently. Prefixing unconditionally is what stops that being a property of
 * how many params a node happens to declare today.
 */
function offered(entry) {
  const groups = Object.entries(entry.choices ?? {}).map(([param, choices]) => {
    const fallback = entry.defaults?.[param];
    const values = choices.map((value) => (value === fallback ? `**\`${value}\`**` : `\`${value}\``));

    return `\`${param}\`: ${values.join(', ')}`;
  });

  return groups.length === 0 ? '—' : groups.join(' · ');
}

const layouts = Object.entries(manifest.layouts).map(([type, entry]) =>
  [
    `\`${type}\``,
    list(CHILD_KEYS[entry.children] ?? ['children']),
    entry.params.length === 0 ? '—' : entry.params.map((param) => `\`${param}\``).join(', '),
    offered(entry),
  ],
);

const nodes = Object.entries(manifest.nodes).map(([type, entry]) => [
  `\`${type}\``,
  entry.content.length === 0 ? '—' : list(entry.content),
  entry.params.length === 0 ? '—' : entry.params.map((param) => `\`${param}\``).join(', '),
  offered(entry),
  entry.roles.length === 0 ? '—' : list(entry.roles),
]);

const tokens = Object.entries(manifest.tokens).map(([name, value]) => [
  `\`${name}\``,
  `\`${value}\``,
  manifest.choices?.[name] === undefined ? '—' : list(manifest.choices[name]),
]);

const authored = new Set(manifest.authored_roles ?? []);

const out = `# The WConvert template vocabulary

**GENERATED** from \`resources/templates/manifest.json\`. Do not edit — edit the
manifest, and rebuild with \`./tools/design-library/build.sh vocabulary\`.

---

This is everything needed to write a valid WConvert design, and it is
deliberately everything: paste this whole file into any system and it can emit
template JSON with no other context.

A **Template** is *configuration, not a document*. It is a JSON node tree over a
closed vocabulary plus a set of CSS custom properties. It carries **no HTML and
no CSS** — there is no \`class\`, no \`style\`, no \`html\`, and no way to express
one. Anything outside the vocabulary below is **dropped silently** on the way
in: the design still registers, and the part you wrote is simply not there.

That silence is the single most important thing on this page. There is no error
for a misspelled key, a node type that does not exist, or a Slot Role on the
wrong node type. Run \`php bin/verify-templates.php\` — it diffs what you wrote
against what survived, node for node.

## 1. The entry

Six keys, exactly. One JSON file per design, in
\`resources/templates/library/\` (free) or
\`pro/modules/display-types/templates/\` (Pro).

\`\`\`json
{
  "id": "kebab-case-and-unique-across-both-libraries",
  "name": "Sentence case, shown on the gallery card",
  "display_type": ${list(Object.keys(DISPLAY_TYPES))},
  "tier": "free | basic | pro | elite",
  "tokens": { },
  "tree": { "steps": [ ] }
}
\`\`\`

${table(
  ['Display Type', 'What the container does'],
  Object.entries(DISPLAY_TYPES).map(([type, note]) => [`\`${type}\``, note]),
)}

**Never author \`facets\`, \`v\` or \`id\` on a node.** Facets are derived from the
tree, \`v\` is stamped by PHP, and node ids are minted on the way in. Writing one
by hand is a fact that can disagree with the design.

## 2. The tree, and how many steps it has

\`steps\` is an array of **root layout nodes**, one per step, and how many is not
a choice — it follows from the converting act:

| The design's button | \`steps\` | Why |
|---|---|---|
| \`"action": "submit"\` | **2** | Step 0 is the form; step 1 is the terminal success state. |
| \`"action": "link"\` | **1** | The click navigates the visitor away, and an interstitial is worse than the navigation it delays. |

**Exactly one converting act per design.** A tree with two buttons, or with
none, is refused at registration — not dropped, refused, so the design is
missing from the gallery entirely.

The step holding the submit button **is** the \`<form>\`. So every \`field\` and
every \`consent\` node must live in that step. A field on any other step draws,
takes typing, and is read by nothing.

## 3. The ${Object.keys(manifest.layouts).length} layouts

${table(['Layout', 'Children go in', 'Params', 'Values (**default**)'], layouts)}

- \`stack\` — a flex column. **Every step is already one**, so a \`stack\` directly
  inside a step is a no-op.
- \`row\` — a wrapping flex row, vertically centred.
- \`split\` — exactly two panes, side by side, stacking below a narrow width.
  Children go in \`start\` and \`end\`, **not** \`children\`. This is where an
  \`image\` earns its place.
- \`grid\` — \`repeat(auto-fit, minmax(8rem, 1fr))\`. As many equal columns as
  fit, wrapping by construction: three across on a desktop, one per line on a
  phone. The only route to a three-up, since \`split\` is exactly two panes.
- \`panel\` — the only layout that **paints**. It holds its children in a column
  exactly as \`stack\` does, and it draws the tokens in scope as a box: ground,
  picture, wash, padding, corner, edge. That is what makes a scoped bag
  *visible* — a cream box beside a dark one is two panels with different bags.
  A photo pane with nothing written on it is a \`panel\` carrying \`bg-image\`,
  \`overlay\` and \`min\`.

  **It inherits the design's colours and not its picture.** A panel resets
  \`bg-image\` and \`overlay\` before its own bag is applied, so one \`bg-image\` on
  the design is not painted again inside every panel in it. A panel that wants
  a picture says so in its own bag.

  \`notch: true\` punches two circles out of its top corners so the page shows
  through — the torn-ticket perforation, and the one ornament a token cannot
  reach. Pair it with \`edges: "block-start"\`: the rule is the tear line and the
  holes are its ends.
- \`media\` — the **second** layout that paints, and the difference from
  \`panel\` is what it does with spare room. A panel stacks its children at the
  top; a media pushes the first to its top edge and the last to its bottom.
  That is a wordmark above a display line on one photograph, which is the
  commonest shape in the reference set.

  It takes the same picture reset a panel does, so a media with no \`bg-image\`
  in its own bag is an empty box waiting for one. Give it \`min\` — the spread
  has nothing to spread across otherwise — and \`fg\`, because the design's own
  ink is chosen against the design's own ground and not against your
  photograph.

  The \`overlay\` on a media is a **layer between the picture and the words**
  rather than the background wash a panel paints, so it darkens the photograph
  and never the type on it.

**Every layout takes a \`tokens\` bag**, which is why the param appears on all of
them. It is not a value from a list — it is the same token object the design
carries, re-declared for this box and everything inside it. See §6.

## 4. The ${Object.keys(manifest.nodes).length} leaves

${table(['Leaf', 'Content keys', 'Params', 'Values (**default**)', 'Slot Roles it may claim'], nodes)}

Every leaf takes \`hidden: true\` where the manifest lists \`hidden\` above —
a slot the merchant can switch back on, which is different from one that was
never there. \`button\` and \`field\` deliberately cannot hide: hiding the button
that converts leaves a design with no countable act.

Notes that the table cannot carry:

- **\`text\` and \`consent\` can hold a link, as STRUCTURE and never markup.**
  Write \`%s\` in the text and a sibling \`link\` object:
  \`"text": "See our %s.", "link": { "label": "Privacy Policy" }\`. The renderer
  splits on \`%s\` and builds the \`<a>\` itself. **Omit \`href\` for the privacy
  policy** — the site fills it in at render, and with no policy configured the
  link renders nothing rather than a dead \`#\`.
- **They can hold one run of emphasis too, the same way.** Write \`%b\` and a
  sibling \`emphasis\` string:
  \`"text": "Take %b your first order.", "emphasis": "10% off"\`. It renders as a
  \`<strong>\` and is **weight only** — it inherits the colour of the sentence
  around it, so the same mark is safe in fine print.

  One link and one emphasis per sentence. A second \`%s\` or \`%b\` is literal
  text, and a mark with nothing to fill it renders nothing — along with the
  space in front of it.
- **A newline in any authored text is a line break.** \`"Room\\nto grow."\`
  renders as two lines with a real \`<br>\` between them, on a \`heading\`, a
  \`text\`, an \`eyebrow\`, a \`badge\` and a \`code\` alike. Where a display
  headline breaks is most of what it IS, so write the break rather than hoping
  for the wrap — and two \`heading\` nodes with a gap between them is a
  different thing that only looks similar at one width.
- **\`icon\` is a closed set of six glyphs** the renderer owns. There is no
  \`src\`: a remote SVG is an off-site asset and an inline one is markup.
- **\`image\` needs a \`src\`, or it renders nothing at all.** Use a \`data:\` URI so
  the design carries its own picture. Always write \`alt\`.
- **\`countdown\` carries no deadline.** It counts to the Optin's own schedule
  end and nothing else, so it has no \`until\`, no \`minutes\` and no evergreen
  flag. With no end date set it draws its shape and no time, and the builder
  says so on the screen where it is fixed.
- **\`code\` is one static string, identical for every visitor.** The payload is
  baked into HTML a full-page cache serves byte-identically, so a per-visitor
  code is impossible here. Ship a plausible placeholder — \`WELCOME10\` — and the
  merchant types theirs in.
- **\`consent\` ships \`hidden: true\`** in every design that has one.
- **\`size\` on a \`heading\` or a \`text\` is a step on the type scale**, and it
  MULTIPLIES that leaf's own size token rather than replacing it — so
  \`heading-size\` still sets the scale and a step moves with it. \`m\` is the base
  and the default. This is what puts *"15%"* at 90px beside its own sentence at
  24px, and it is a different question from \`heading.level\`, which is the
  document outline and not a size.

## 5. Slot Roles

A Slot Role is the semantic name of a slot. It is the seam a **Playbook** binds
words to, so the words survive the merchant switching design. **Binding is by
name**, and that is the whole guarantee.

${list(manifest.roles)}

- **A Role may repeat.** Three \`body\` nodes are three benefit lines; a Playbook
  supplying an array fills them **in tree order**.
- **A Role must suit the node type.** The table in §4 is the authority. A \`text\`
  node claiming \`cta_label\` is *kept* by the validator and binds a button's
  label into a paragraph — one of the few mistakes nothing at runtime mentions.
- **A \`field\` declares no Role.** Its Roles are derived from what it captures:
  a \`name: "email"\` field gets \`email_label\` and \`email_placeholder\`.
- **A leaf that could carry a Role and does not loses its words** on the next
  design switch. There is no rescue for a role-less paragraph.
${
  authored.size === 0
    ? ''
    : `- **${[...authored].map((role) => `\`${role}\``).join(', ')} ${authored.size === 1 ? 'is' : 'are'} author-only.** A Playbook may not fill ${
        authored.size === 1 ? 'it' : 'them'
      } — a discount code names a row on one particular site — so the design ships the placeholder and the merchant replaces it.
`
}
## 6. The ${Object.keys(manifest.tokens).length} tokens

${table(['Token', 'Default', 'Suggested values'], tokens)}

**Token NAMES are validated and token VALUES are not.** A name outside this
list is dropped; a value is written straight onto the element as a custom
property. The "suggested values" column is what the settings panel offers as
chips — *an offer, not a limit*. All of this is legal and none of it is
unusual:

\`\`\`json
"bg-image": "linear-gradient(135deg, #4f46e5, #0ea5e9)",
"overlay":  "rgba(2, 6, 23, 0.55)",
"pad":      "2.5rem 1.5rem",
"width":    "clamp(20rem, 60vw, 34rem)",
"radius":   "1.5rem 1.5rem 0 0",
"shadow":   "0 32px 80px rgba(79, 70, 229, 0.35)"
\`\`\`

### Scope: the same names, set on one box

The design's \`tokens\` object applies to the whole design. **Any layout node may
re-declare any of the same ${Object.keys(manifest.tokens).length} names for itself and everything inside it**, by
carrying a \`tokens\` bag of its own:

\`\`\`json
{ "type": "stack",
  "tokens": { "bg": "#fff4df", "fg": "#331e17", "pad": "2rem" },
  "children": [ ] }
\`\`\`

They are CSS custom properties, so they inherit — a bag is the design's value
overridden for one subtree, and a leaf reads the nearest bag above it. This is
how one design holds a cream panel beside a dark one, or gives the form a
different ground from the headline.

**The names are the same ${Object.keys(manifest.tokens).length} and the closure is the same.** A name outside the
table is dropped from a bag exactly as it is from the design's own tokens, and a
value that is not a string or a number is dropped too. There is no per-node
\`class\` and no \`style\`; a bag is the only way a node says anything about how it
looks.

A bag is **arrangement, not copy** — it survives \`withoutCopy\`, so a Playbook
fills words into a design and never repaints it.

Bags nest. A \`split\` may set the design's dark ground on itself and a \`stack\`
inside one pane may set a light one, and the pane that sets nothing keeps what
it inherited.

Two background layers, and the order is the feature: \`overlay\` paints **on top
of** \`bg-image\`, which is the only reason light text over a photograph is
legible.

### A token as a VALUE, so a scope follows the theme

A colour token's value may be the **name of another colour token**, and it then
resolves to whatever that one is in scope:

\`\`\`json
{ "type": "panel", "tokens": { "bg": "accent", "fg": "accent-fg" } }
\`\`\`

Only these names may be used this way: ${list(manifest.referable)}. Anything
else is written verbatim, as every value always was — including a name
referring to itself, which is a cycle CSS would discard.

**This is what makes a scope survive a theme.** A theme moves the design's
colours; a bag that spelled a hex does not move with it, so the box a merchant
most wants to follow the palette is the one that never would. Reach for a
literal colour where the box is deliberately outside the palette — a
photographic ground, a brand black — and for a name everywhere else.

**Only set the tokens a design actually decides.** Anything omitted falls back
to the default above.

## 7. Field kinds and link schemes

- A \`field\` captures one of ${list(manifest.fields)}. One field per kind, at most.
- An \`href\` may use one of ${list(manifest.schemes)}. Anything else renders no
  anchor at all.

## 8. The seven silent authoring failures

Ranked by how long each one costs before you notice.

1. **A missing or misspelled \`tree\` key turns the design into a Pro upsell
   card.** No \`tree\` is the whole discriminator for *"a design this install did
   not get"* — so \`"trees"\` or \`"steps"\` at the top level ships a locked stub
   with a **Pro** badge and a *"See this design"* link to a page that does not
   exist. Nothing is logged.
2. **A JSON syntax error skips the file entirely.** The reader returns null, the
   library is never handed it, no rejection is recorded and nothing is warned.
   The design is simply absent from the gallery.
3. **A dropped Slot Role goes without a word.** A snapshot strips the text from
   every text node and binds it back only where a Role binds, so a node that
   lost its Role reaches a real visitor as an **empty paragraph** — while the
   gallery card looks right, because the entry keeps its own placeholder text.
4. **A Role on the wrong node type is KEPT.** The validator checks a Role
   against the whole list, not against the ones its node type declares.
5. **An undeclared param or token is dropped**, so the design renders with the
   default and looks nearly right. This includes a name inside a node's
   \`tokens\` bag — and a bag that keeps nothing leaves no key at all, so the
   node looks untouched rather than empty.
6. **A \`tokens\` bag on a LEAF is dropped whole.** Only layouts declare the
   param. A \`heading\` given its own ground silently keeps the one it inherited.
7. **A \`split\` written with \`children\`** loses both panes and everything in
   them.

\`php bin/verify-templates.php\` reports every one of these by name. Run it
before believing a design exists.
`;

writeFileSync(resolve(OUT, 'VOCABULARY.md'), out);

console.log(
  `  VOCABULARY.md (${Object.keys(manifest.layouts).length} layouts, ${Object.keys(manifest.nodes).length} leaves, ${Object.keys(manifest.tokens).length} tokens, ${manifest.roles.length} Slot Roles)`,
);
