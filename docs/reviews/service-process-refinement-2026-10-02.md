# Service process strip refinement — 2 October 2026

The previous nested three-column layout produced uneven card widths and vertical alignment. Its full-width bordered form dominated the composition. Version 5 replaces those cards with a compact numbered process list beside a lightly tinted enquiry panel. Both panes stack in reading order on phones. Stable leaf IDs, submission references and campaign copy remain intact. The acknowledgement loses redundant nested padding.

Visually inspected the final desktop WordPress rendering, phone rendering and confirmation, and the 320px studio input screen including its form and wrapped CTA. The numbered stages have consistent spacing, and the form now has a useful width without a large enclosing border. The existing renderer still allows internal vertical scrolling for tall campaigns; no renderer behavior was changed.

The scoped audit passed 32 combinations: both screens, widths 320/390/768/1440, both directions, normal and longer copy with consent enabled. No horizontal overflow, undersized controls, small input text or solid-colour contrast findings. Minimum interactive height 48px; input text 16px.

Studio journey: simulated submission failure retained the entered email; retry reached Request received. Native disposable WordPress: published snapshot, required-field rejection, capture, idempotent retry and saved values passed. A browser submission using a fictional example.test address reached the acknowledgement with heading focus. External email/SMS delivery remains skipped.

Validation: 99 designs survive registration; PHP 2,436 tests / 14,787 assertions; JavaScript 3,538 tests across 194 files; studio 36 tests. This is editorial approval of one revised setup, not hosted release approval. Existing customer campaigns are not changed.
