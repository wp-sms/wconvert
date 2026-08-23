# WSMS integration surface

Type: research
Status: claimed

## Question

What does WSMS 8 actually expose that WConvert can push a Lead into, and which
surface should WConvert couple to?

Flagged during charting and deliberately deferred: coupling to WSMS's **PHP
classes** is fast and typed but binds WConvert to WSMS internals across two
independent release cycles; coupling to its **REST API** is stable and versioned
but pays HTTP cost for a same-server call and needs auth. There may also be a
hooks/filters surface, or `ExtensionRegistry` may imply an intended add-on path.

Investigate in
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`:

- `src/Contact/` — `ContactRepository`, `ListRepository`, `TagRepository` and
  their `Contracts/` interfaces. What is the supported way to create a contact?
- `src/Rest/ContactController.php` — what does the REST surface offer, and what
  authentication does it require for a same-site server-side caller?
- `src/Extension/ExtensionRegistry.php` and `ExtensionServiceProvider.php` — what
  does registering actually buy an add-on? The `page` key suggests admin
  mounting; confirm what it renders.
- `src/Integration/` — `WpSmsIntegration`, `ContactIntegration`, and the
  `Contracts/` capability interfaces. Is there already an intended path for an
  external plugin to register as an integration?
- `src/Event/` — `ContactOptedInEvent` and friends. Is the event bus a viable
  entry point, and is it public API or internal?
- Whether WSMS is namespaced/scoped (`WSms\Dependencies\…` suggests php-scoper),
  and what that means for a second plugin calling its classes.

Report the surfaces, their apparent stability, and a recommendation with the
coupling trade-off stated plainly. Note anything that is clearly internal.
