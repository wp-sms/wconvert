# Final translation review

The independent standards review found six choice values wrapped in translation calls in two generated Playbooks: Start a conversation (`website`, `identity`, `exploring`) and Another good round (`strap`, `zip`, `other`). The one-time generator now excludes `value` alongside `href` from translation, and both sources were regenerated.

`ChoiceTranslationTest` runs the actual PHP sources in a separate process with a translating `__()` function. Before the fix it failed because submitted IDs acquired the translation prefix. After the fix all ten assertions pass: the six IDs are unchanged and all six visible labels translate.

Rebuilding the pilot produces unchanged rendered setup revisions. No native JSON, copy wording, responsive styling or artwork changed; the existing 100 WordPress journeys and visual captures still describe the exact prepared English trees. Only the collection's source dependency hashes change. Its approval is appended to the existing review chain.

Spec review: no actionable findings. Standards review: the stable-choice-value violation is corrected; the previously disclosed scoped-colour fidelity exception remains documented in review.md.

The corrected local release also passed installation through disposable WordPress with Pro fixtures: 178 available designs and 201 setups installed, 60 images retained, and offline registration passed. All 50 Everyday designs and setups were available; only unrelated WooCommerce-dependent entries were unavailable. `install.json` records the result. The standard runner initially encountered a Playground startup line before its JSON; a temporary wrapper captured and parsed the report without changing the verifier. No repository acceptance logic was relaxed.
