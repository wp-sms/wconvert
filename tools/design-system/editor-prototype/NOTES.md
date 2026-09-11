# Fieldwork editor prototype

Question: can a merchant customize a rich template comfortably with a large preview,
a contextual inspector, and optional Layers?

One direction, as agreed with the user. This is an isolated prototype beside the
existing admin design tools. It does not call WordPress APIs, change saved Optins,
or alter the shipping editor. It uses the repository's React/Vite/Lucide dependencies
and WConvert's existing petrol colors. The specimen uses the original locally
provided collection's Fieldwork photo, DM Sans and Instrument Serif.

Run `npm run prototype:editor`, then open the printed local URL.

Try editing the headline, replacing the image, selecting a parent with the breadcrumb,
opening Layers, adjusting mobile styles, and submitting the visitor preview. Undo/Redo
and Save operate in memory; reload starts fresh. Switching templates offers a warning
and applies a reversible draft layout change. It is only a split/centred demonstration,
not the production template catalog or a content migration implementation.

The WordPress context toggle shows a static approximation of the admin surroundings
for judging density. It does not embed or control WordPress. The specimen is a faithful
independent composition, not the production renderer. The production integration
is recorded in ADR 0067; template typography and imagery remain a separate pass.

## Verdict

Approved by the user. The real editor now adopts the compact shell, direct selection,
contextual controls and optional Layers, with its own production state and handlers.
Address Fieldwork template fidelity separately. This prototype remains the reference
for the agreed flow and does not call the production APIs.

## Verification

Built successfully with the isolated Vite config. Browser checks covered live text
editing, grouped Undo, mobile-only font changes preserving desktop styles, local
image replacement, demo form submission to success, template change warning and
Undo, WordPress-context density, and a 390px-wide editor viewport. Clean startup
and responsive switching produced no console warnings or errors after separating
the React entry point from the component for development reloads.

Visual snapshot (static controls; use localhost for interactions):
https://superdesign.dev/teams/19b0ff33-2e1f-4875-b754-3dfb32ce86e2/projects/7be56eac-3a61-418d-a075-1713d80e9b21?node=draft-variant-0ae34da8-41a5-4650-8c22-b4dfb8ae9ef2
