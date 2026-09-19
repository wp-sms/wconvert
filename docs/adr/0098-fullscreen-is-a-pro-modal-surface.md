# Fullscreen is a Pro modal surface

Phase 2 of #165 adds `fullscreen` to the closed Display Type set. The user
confirmed all paid Pro tiers, alongside floating bars and slide-ins. Goal-first
creation stays intact: merchants choose a Goal, then filter setups by Format.

## Contract

- A fullscreen campaign covers the viewport until dismissed. It is not the
  browser Fullscreen API, scroll mat, page push, teaser or a new Goal.
- Pro owns geometry and decoration. Free exports the shared modal lifecycle;
  dependencies still run Pro → Free only. No fullscreen runtime or tree ships
  in Free; its metadata cards are informational.
- Native `dialog.showModal()` owns modality, inert background, keyboard
  traversal, Escape and focus restoration. No custom focus trap. Initial and
  success-step focus goes to a heading, avoiding automatic software-keyboard
  activation. A plain-string dialog name crosses the closed shadow boundary.
- Close remains a 44px target at the safe top/end edge. It sits outside the
  size-contained content root, which would otherwise make a fixed close button
  scroll away. Background clicks do not dismiss fullscreen.
- Dynamic viewport height, safe-area padding and an internally scrolling
  dialog accommodate long content. Page overflow is locked while open and its
  exact previous inline value/priority is restored on close or failed show.
  Fullscreen introduces no entry motion; reduced-motion needs no exception.
- Template `width` limits content, not the viewport. The container owns the
  edge padding; existing layouts and scoped tokens style the content. There is
  no new Template JSON field, token, version or database change. Placement is
  invalid for this type and is removed on save.
- Existing capture, conversion, dismissal, frequency and one-overlay-per-page
  arbitration are reused. Failed/unsupported mounts report no impression.

## Merchant experience and starter library

Three `basic` designs: editorial newsletter, split guide request, and poster
link offer. Their playbooks live beside the Pro module's trees and are composed
through the existing additional-playbooks seam, with installed packs preserved.
Free cannot register a playbook against an absent premium tree. Existing Goals
are reused, including email growth, lead magnet and promotion.

Capture setups wait for 50% scroll; the offer waits 15 seconds. All advise
reviewing targeting and frequency before publishing. Request acknowledgement
never claims an email was delivered or a provider subscribed the visitor.

The active format, setup-card badge, filters, design switching and undo use
existing mechanisms. Pro gallery/details/editor previews use the same content
surface as the visitor container, without putting a modal over wp-admin.
Readiness and the real-page inspector describe the fullscreen behavior.

The user explicitly approved "Included in Pro" cards with **no preview link**
until public preview pages exist. This amends ADRs 0010 and 0043; do not invent
URLs or ship premium trees into Free to compensate. Publishing these pages is
separate website work.

## Size and verification

The measured largest loader is 13,344 B gzip-9, versus 12,567 B before this phase.
The shared modal lifecycle, accessible focus/exit and scroll restoration account
for the added behavior. Raise the hard per-build gate from 12,800 to 13,500 B;
no warning-only mode, chunking or bypass. Free measures 10,482 B. A `fullscreen`
bundle marker now guards the premium container boundary as well as source scans.

Amended by [ADR 0099](0099-automatic-inline-placement-uses-rendered-content.md):
automatic inline raises the current hard ceiling to 14,012 B; the figures above
describe the fullscreen-only build.

Tests cover the closed type, placement removal, tier/library registration,
preview parity, focus/step lifecycle, exact style restoration, failure without
impressions, and existing overlay arbitration. Disposable WordPress Playground
tests use both production plugins, real capture and a transformed hostile theme
at 320/768/1440px in LTR/RTL, short viewports, enlarged text and reduced motion.
They also exercise goal-first filtering and creation. Native device software
keyboards and VoiceOver/TalkBack require device-level release QA; desktop browser
emulation does not prove those behaviors.
