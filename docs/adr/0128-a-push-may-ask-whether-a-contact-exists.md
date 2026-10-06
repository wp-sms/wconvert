# 0128: A push may ask whether a Contact exists

Date: 2026-10-06. Status: accepted for the Mailtrap Destination.
Amends [0007](0007-destinations-are-outbound-and-fallible.md)'s one-way rule and
the [[Destination]] entry in `CONTEXT.md`.

Mailtrap's Contacts API answers a write immediately and applies it 3–10 seconds
later. For a few seconds after any write it refuses a second one to the same
Contact (`409 "Contact exists or being updated"`), or accepts it with a 200 and
drops it. Updating by address can also misfire for a minute or two after a
create: Mailtrap tries to create the address again and finds it taken. All of
this was observed on a live account, not read from the spec.

Every other adapter learns whether a Contact exists by attempting a create and
reading the refusal. On Mailtrap that leaves a second write to follow — the list
for an existing Contact — inside the window where it is refused. In a live run,
existing Contacts joined the list only on the second or third queue retry, or
not within three.

**So a Mailtrap push looks the address up first** (`GET /contacts/{email}`) and
then writes exactly once: a create carrying the fields and list for a new
Contact, or a `PATCH` by Mailtrap's id for an existing one. Live, every case
landed on the first attempt.

**What it may read is narrow.** Only whether the Contact exists, and its
provider id. Never its subscription status, list membership, suppression or
field values. The response carries them, and the adapter does not look. So
WConvert still has no opinion about who is subscribed, and keep mode still never
overwrites anything. The lookup happens in the queued push, after the visitor's
request has finished, so the capture path itself still reads nothing.

This is an exception for a provider whose writes cannot be sequenced, not a new
default. An adapter whose create-then-handle-the-refusal sequence works keeps
using it.
