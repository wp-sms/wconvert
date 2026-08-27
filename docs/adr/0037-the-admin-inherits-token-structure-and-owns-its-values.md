# The admin inherits token structure and owns its values

WConvert's admin uses **the same token names as WSMS and none of its values**.
`--primary`, `--background`, `--foreground`, `--muted`, `--destructive`, the
chart ramp and the sidebar set are spelled exactly as the sibling spells them, so
a component vendored against one drops into the other. What each resolves to is
WConvert's.

`--primary` is petrol `#0f6e79`. `--radius` stays `0.25rem` and the
`4px 4px 0` shadow stays, both taken from WSMS deliberately.

## Structure is what makes the components portable; values are what make it a product

The two halves of the sibling relationship pull opposite ways. Family
resemblance is worth having — same publisher, and WP SMS integration is a
headline feature, so a merchant may well run both side by side and should not
feel handed to a different company halfway through. But WConvert reskinned as
WP SMS is not a family, it is a suffix.

Splitting on *structure versus values* resolves it cleanly, and it is the same
move [ADR 0036](0036-admin-components-are-vendored-from-upstream.md) makes on
components. Shared names are what let a `card.tsx` from either upstream work
here. Shared values would be what makes the two products indistinguishable.

Radius and the shadow are the deliberate exception. They are structural enough to
read as house style and specific enough to be recognised — a tight `0.25rem` and
a hard offset shadow are the two things about WSMS's surface a person could
describe from memory. Keeping them is what carries the resemblance once the
colour stops doing it.

## Green was disqualified by the screen that would have used it

The obvious primary for a conversion product is green. Growth, "converted",
money. It was the first candidate and it is the one worth writing down the
refusal of, because it will be proposed again.

**The analytics dashboard needs green.** [ADR 0020](0020-conversions-are-interpreted-at-read.md)
makes conversions the interpreted headline number and
[ADR 0019](0019-analytics-stores-daily-counters-not-events.md) puts impressions,
conversions and dismissals side by side; a per-Goal card reads *converted* against
*dismissed*, and the failure count against them both. Those want green, amber and
red doing semantic work.

A green `--primary` means every button, every active tab and every focus ring on
the screen is also green — so the one colour that has to mean *"this converted"*
is simultaneously the colour of the Save button. The semantic reading dies, and it
dies on the screen the product is sold on.

That argument disqualifies green independently of taste, which is why it is here
rather than in a design file.

_Completed by [ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md):
there is a design document now, and this refusal still does not belong in it. 0039
holds layout — page parts, where a control goes, what a region owes — and this is
an argument about what a colour is allowed to mean, which is a property of the
product rather than of a screen. What 0039 does add is the other half of the same
rule: green and amber are **spent** on `Badge`'s `success` and `warning` variants,
where *published* and *suspended* are exactly the meaning they were reserved for._

## Indigo lost on confidence, not on correctness

`#4f46e5` and its neighbours leave the semantic palette free and would have
worked. They are refused because they are the default — the colour a product
picks when nobody picked.

WSMS chose burnt orange `#b54a00` on a warm `#faf9f7`. That is an unusual,
committed choice, and a sibling arriving in the safest possible cool blue reads
as the lesser product next to it. Petrol is cool against the sibling's warm, so
the two are obviously related and obviously not the same; it leaves green, amber
and red entirely free; and it is a choice rather than a default.

## Contrast was measured, not assumed

`#0f6e79` has a relative luminance of `0.126`, giving **5.95:1 against white** —
AA for normal text in both directions, so petrol text on white and a petrol
button with a white label both pass without a second shade. It fails AAA (`7:1`),
which is not the bar
[ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md) sets.

This is recorded because "we picked a colour and it looked fine" is how a palette
acquires a `--primary` that fails on the one control nobody screenshotted.

## Consequences

- **The token *names* are a compatibility surface**, so renaming one is not a
  local change — it breaks the drop-in property with every component vendored
  against the shadcn contract. Adding names is free; renaming them is not.
- **Dark mode is a second set of values under the same names**, and needs no
  component touched. [ADR 0035](0035-the-admin-owns-its-page.md) already refused
  WordPress's admin colour schemes, so nothing external constrains what those
  values may be. It is out of scope for 0.1.0 and shaped to land later.
- **Green, amber and red are reserved for meaning** and may not be spent on
  chrome. A "success" button in green is the same collision the primary was
  refused for, one control down.
- **This palette is the ADMIN's and not an [[Optin]]'s.** A rendered Optin draws
  from the tokens the merchant set in the builder over a closed shadow root
  ([ADR 0010](0010-templates-are-configuration-not-documents.md)), and the two
  vocabularies never meet — the admin's `--primary` has no path into a popup, and
  "copy my theme's colours" copies the *site's* theme, never WConvert's.
- **A future WConvert brand does not start from zero.** Whatever a logo and a
  wordmark eventually say, the surface they land on already has a committed
  colour rather than a placeholder to be negotiated then.
