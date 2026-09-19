# Privacy erasure is bound to one explicit identifier

WordPress's personal-data tools address requests by email. WConvert also accepts
phone-only [[Lead]]s, so those tools cannot reach every capture the plugin owns.
The answer is a narrow exact-identifier erasure, not a second request-management
system and not a stored person.

This amends [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) and
[ADR 0091](0091-shared-settings-and-submission-workflows-have-distinct-homes.md).

## Direct presence decides the scope

After the merchant verifies the requester outside WConvert, one canonical email
or E.164 phone identifies the rows to remove. Every Lead whose corresponding
column directly contains that value is deleted across every Campaign and date.
A row carrying both identifiers is still a match when the requested value is on
that row.

The erasure never follows a second identifier. A phone request does not find one
row by phone, take its email and delete other rows sharing that email. That would
turn [ADR 0021](0021-lead-identity-is-computed-not-stored.md)'s presentation-only
relationship into asserted identity at the one moment where over-matching is
irreversible.

## The screen cannot accidentally narrow an erasure

Capture history already supports exact email/phone search and streams every
matching retained row to CSV. The destructive control appears only when the
accepted scope is one exact identifier with no Campaign, date, purpose, text or
Lead-ID filter. Its confirmation repeats the identifier, names the current
matching count, offers export first and states that all Campaigns are covered.
The server canonicalises the requested and confirmed values again before one
identifier-wide `DELETE`.

There is no delete action on an individual Lead. Selective record cleanup is a
different feature and would make a privacy request look complete while leaving
other rows that directly carry the verified identifier.

## Local residue and external copies are said separately

The terminal-failure ring is WConvert-owned diagnostic storage. Entries naming
deleted Lead IDs are removed with the Leads, including their provider error
strings. Queued pushes carry no email, phone or captured fields; a worker whose
Lead has been erased stops without sending. The orphaned technical Lead ID is
left to Action Scheduler's normal attempt cleanup rather than adding a general
queue-cancellation dependency that cannot erase Action Scheduler history anyway.

WConvert does not claim to erase Contacts, exported files, provider logs or
backups. It has no per-Lead delivery ledger and cannot honestly say which remote
copy landed. The confirmation and completion text therefore hand those copies
back to the merchant as an explicit checklist. No request/case log is added;
tracking erasure work would create another personal-data lifecycle in the plugin.

## Consequences

- The existing WordPress exporter/eraser remains the email-addressed integration.
- Exact phone search plus CSV supplies the phone-only export path; the new action
  supplies its erasure path.
- Leads remain immutable capture events: erasure is a `DELETE`, never an update.
- Identity remains computed for presentation only, with no person key or Contact.
- Data & privacy still links to WordPress's request tools and explains the narrow
  phone-only exception rather than copying their request workflow.
