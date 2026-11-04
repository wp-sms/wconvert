# 0190: A report is titled with what it reports on

Accepted 2026-11-04. Amends [ADR 0187](0187-the-way-back-and-a-section-title-read-with-their-page.md).

Every Analytics report sat under "Analytics / How each goal is performing", which described a different page and repeated the active tab directly above it. A report's real name was a smaller heading in the body. The way back said "Overall impact", a phrase the page it leads to never showed: that page is titled "Analytics", and the phrase existed only as a screen-reader label on its card grid.

The way back was also a 36px box around 20px of text. It put the title 68px below the dark band, against 28px on a page with no way back, and left the link floating. It appeared only once the report had loaded, so the title dropped 40px on first load, and a report that failed had no way back at all.

The other two screens with a way back already titled the page with its subject: an occasion, and Sending issues.

## Decision

**The page's h1 names what it reports on. The overview keeps its section's title.**

| Page | Way back | Title | Line under it |
|---|---|---|---|
| Overview | none | Analytics | How each goal is performing. |
| Submissions-style | ← Analytics | The number's name, with its tip | none |
| Goal | ← Analytics | The goal, with how it is counted in a tip | none |
| Campaign | ← Analytics | The campaign, with how it is counted in a tip and its status | The goal |
| A/B test | ← Analytics | The campaign, with its tip | A/B comparison and variant history |
| Failed, or not available | ← Analytics | Analytics | none |

Every report's way back goes to the overview, including a campaign's.

**How a goal's number is counted moves into a tip beside the title.** The sentence repeated unchanged on every campaign under a goal, and it was already an ⓘ in the campaign dialog ([ADR 0183](0183-a-campaign-dialog-opens-on-its-preview-and-its-answer.md)). The two share `HowCountedTip`. "How these numbers work" at the foot of each report still says most of it at rest, and "Items added to basket" still says "Confirmed, not purchases". A quiz's "Product clicks and purchases are separate" is only in the tip.

What says something about this campaign or these dates stays at rest: a draft, deleted or published-after-these-dates notice, and "Nothing to compare".

**`PageHeading` is how a screen that learns its name from a read titles the page.** `Shell` owns the h1 and only the screen knows the name, and only after its read. An occasion draws its own `Shell` and Sending issues' name is fixed, so both keep `pageTitle`. `PageHeading` registers `title`, `aside` and `description` with the frame in a layout effect, so no frame shows the section's title, and clears on unmount, so the overview gets it back. It does not portal, because the frame has to know whether to draw its own title at all. With no frame above it, it draws in place, as `PageAction` and `PageBack` do.

`aside` stands beside the h1 rather than in it, so a tip's button is not part of the heading's name. It is as tall as the title's first line, so it stays there when a long name wraps.

**A report draws its way back from its first frame, on the selected dates until the report has loaded.** The title never moves down, and a report that fails keeps its way out.

**Until the name is known the title is a bar, not "Analytics".** Otherwise every report would read "Analytics" and then swap. A screen reader still hears "Analytics", because a heading needs a name. The route says whether a line belongs under the title, so that space is held too.

The bar and the link are drawn by the chunk's fallback as well as by `Dashboard`, not by `App`. The fallback unmounts when the chunk fails, so a chunk that never comes shows the section's own heading over its reload message. A bar owned by `App` would have stayed forever. The link goes too, on purpose: the overview needs the same chunk, so reloading is the only thing that can help. `loading-handoff.test.tsx` pins that the fallback is what `Dashboard` draws first.

**A page with a way back keeps a long name on one line where it can.** A merchant's own name is often longer than the room beside the date picker and Export, so from 601px the title takes its full width and the actions move under it, at the same right edge. On a phone, what stands beside the title drops under a long name. The row holds the actions' height before they arrive, so the title does not move when the chunk lands.

**The way back is a 24px box.** The heading's top padding drops from 28px to 20px when it has one, 16px on a phone. Its padding is 6px, so its margin is -9px to keep the arrow on the title's edge. Touch keeps the admin's 44px floor, with negative margins so the layout does not move. Whatever opens a report loses its top margin, so it sits under the title as any screen's content does. This is one component, so an occasion and Sending issues tighten too. "Back to leads" keeps its wording.

## Consequences

`ReportTitle`, `.wa-eyebrow-lead` and `.wa-section-title h2` are gone. "Goal report" is no longer a string in the admin. "Overall impact" stays only as the card grid's region label, so the not-available message now says "Choose a report from Analytics".

jsdom cannot see the spacing, so tests pin what the title says, where the link is and what happens while loading. The sizes were measured on WordPress.
