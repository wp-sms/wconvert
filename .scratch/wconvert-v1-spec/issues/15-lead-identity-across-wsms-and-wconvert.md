# Lead identity across WSMS and WConvert

Type: grilling
Status: open
Blocked by: 01, 03

## Question

Two forms, one visitor, one phone number — what happens?

Graduated from the map's fog by [WSMS integration
surface](04-wsms-integration-surface.md), which supplied the mechanics and left the
judgement. Data ownership is settled (WSMS owns Contacts, WConvert owns Leads); this
is the dedupe and UX question underneath it.

What 04 established, so this ticket need not re-derive it:

- `ContactRepositoryInterface::create()` has **no upsert** and throws
  `ConflictException` on a duplicate email *or* phone — both carry UNIQUE indexes.
- The adapter must therefore replicate `CreateContactAction::execute()`:
  find-by-email → find-by-phone → update-or-create, treating the lookup→insert race
  as success-with-existing.
- On update, WSMS's own subscription handler uses **fill-empty-only** PII merge, so a
  public submission can never overwrite stored PII it does not own.
- MySQL UNIQUE does not constrain NULLs, so phone-only and email-only rows for the
  same human do not collide and will not be caught by the index.

Open:

- **Does WConvert dedupe its own Leads at all?** A Lead is an *event*, so two
  submissions are legitimately two rows — but the admin looking at a lead log wants to
  know it is one person. Is that a stored identity, a computed grouping on read, or
  nothing? Note the standing rule: a new column needs sign-off, and anything that
  gives a Lead a lifecycle is the drift signal `CONTEXT.md` warns about.
- **Precedence when WConvert's push updates an existing WSMS Contact.** Fill-empty-only
  is the safe default, but it means a genuine correction (someone fixing their own
  typo'd name) never lands. Is that acceptable, and does the merchant get any say?
- **What the visitor sees on a repeat submission.** Silent success, "you're already
  subscribed", or unchanged confirmation — and whether that leaks whether an address is
  on file. There is a real enumeration concern here.
- **The email-only/phone-only split.** WConvert captures whichever the Optin asks for.
  Two Leads that are obviously one person to a human are two Contacts to WSMS. Does
  WConvert try to reconcile, or is that WSMS's problem by definition of the boundary?
- **What the admin sees when a push resolves to an existing Contact** — created vs
  matched vs merged, and whether that distinction is worth storing.
