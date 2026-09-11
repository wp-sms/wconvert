# Success actions do not count again

The first collection examples needed a code people can copy and a resource they
can open after submitting. A second converting button would inflate the opt-in’s
results, while a static success paragraph cannot provide either action.

The closed vocabulary adds a `followup` leaf, shown in the editor as **Resource
link**. Its label and URL travel together under `success_action`. It renders as a
normal link styled like a button; only the existing converting `button` receives
`data-convert`, and mount binds conversion tracking to that explicit marker.
Copy buttons use `type=button`, so they neither submit a form nor count a click.
Existing submit/click registration and step-count rules remain unchanged.

The Add menu offers Resource link only on step 1 after a form on step 0. Readiness
and server publication checks require every visible resource link to have a
label, a normalized safe URL and that placement. Drafts may remain incomplete,
and hidden optional links do not block publication. The URL uses the vocabulary’s
existing scheme boundary. It opens a file or page; it does not promise an email,
a forced download or a resource that the merchant has not supplied.

A `code` keeps its existing display by default. Enabling `copy` adds a button and
an initially empty status region. A visitor press writes the exact code through
the Clipboard API; success is announced only after the promise resolves. Missing
or denied clipboard access reports failure and leaves the code selectable.
The button is disabled while its request is pending. `copy_label`, `copied_label`
and `copy_failed_label` are editable content, copied by Role and translated by
stable leaf identity. Absent labels use English defaults. Rendering performs no
clipboard access; selectable editor previews do not bind the click handler.

Two layout controls accompany those actions. **Swap sides** exchanges both
complete split panes and reverses an authored ratio in one undoable edit. This
retains content, tokens and leaf IDs, and changes the stacked order too.
**Picture focus** writes `image-position` for background-position and
object-position, using nine offered points or a custom value. The existing
`narrow` bag can override it for mobile, independently of cover/contain. Layout
controls now precede their appearance controls in the inspector.

The 12,288-byte loader limit remains enforced for all tiers. Narrow CSS mirrors
are assembled once from literal closed names rather than repeating their full
property spellings. Only renderer-produced `data-narrow` elements are retuned,
so their individual layout-class qualifiers are redundant. Visitor builds also
compile out editor addresses and capture metadata; `fine_print` retains the Role
used by CSS. Admin builds retain editing metadata. This build distinction removes
bookkeeping, never a template node or a tier capability. The design comparison
uses the visitor build too.

Validation covers clipboard success/pending/denied/missing access, safe URLs,
uncounted resource and copy actions, the original counted navigation, editor
preview isolation, publication readiness, pane identity and ratio preservation,
and manifest/renderer parity. Browser checks cover WordPress controls and undo,
readiness before and after setting a URL, mobile overrides, the local resource
placeholder and clipboard failure feedback on the HTTP preview.

The work leaves broader movement between arbitrary containers, remote catalog
installation and the twelve-design collection for subsequent phases. No database
schema or published campaign is changed.
