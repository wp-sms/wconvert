# Review: multiple screens versus multiple submissions

Reviewed with the user on 2026-09-22. The user accepted the recommendation below:
one final submission by default, plus a deliberate optional email/SMS signup.
The [final plan](../184-progressive-capture.md) and [revised storage design](storage.md)
record the resulting implementation scope. No new tables are planned; the user
approved extending the existing statistics table with one scope column/key.

## Conclusion

Preserving an explicitly completed email signup before an optional SMS signup
has a concrete customer benefit. It is not merely an implementation preference.
However, saving each screen is not necessary to support multi-screen forms, and
immediate Destination handoff is a separate choice from local persistence.

Recommend two clear experiences through one shared screen system:

1. Default: one submission spread across screens. Next/Back retain answers in
   memory; the final Submit saves once and starts one handoff.
2. Optional follow-up signup: the visitor explicitly submits a complete email
   signup, then may submit an additional SMS signup. Retain the first capture
   if the visitor skips/closes the second. Each acceptance has separate evidence.

For the first implementation, the strongest case for the second experience is
email plus optional SMS (or the reverse for an SMS-primary Campaign). Do not
generalize this into autosaving arbitrary question screens, cross-visit profiles,
or independently configurable save/send/recovery policies everywhere.

## Needs and appropriate capture behavior

| Need | Recommended behavior | Why |
|---|---|---|
| Offer before email | One final submission | The opening offer adds no captured information |
| Preference then email | One final submission | The merchant receives the preference with usable contact details |
| Multi-screen enquiry | One final submission | The business needs a complete request; a half-completed request can create premature follow-up |
| Newsletter then optional SMS | Save email at its explicit submission, then add accepted SMS | The first signup is valuable even when the second is declined |
| Download then optional extra signup | Fulfill the submitted request independently of the optional signup | The later offer must not withhold what the visitor already requested |
| Additional optional profile questions | Prefer before the final submission initially | Less evidence of need for a generalized progressive-profile system in WConvert |

The proposed email-to-SMS behavior protects a completed outcome, rather than
salvaging every partially typed form. Clear button labels and channel-specific
consent are necessary: Next is not permission to subscribe or send anything.

## Competitor evidence checked

- [Klaviyo: Understanding multi-step forms](https://help.klaviyo.com/hc/en-us/articles/4404256496283)
  explicitly recommends email first then phone to preserve email acquisition
  when the visitor does not finish the later screen. It stores information from
  submitted steps. It is also a Contact/profile platform, so its full state model
  is not automatically appropriate for WConvert.
- [OptinMonster: Progressive forms](https://optinmonster.com/docs/how-to-create-progressive-form-in-optinmonster/)
  documents forms across multiple views. Its FAQ explicitly says information
  from completed views is captured and sent to connected integrations even if
  the visitor closes the remaining campaign. This is stronger evidence than
  merely observing that a competitor has a Yes/No screen.
- [OptiMonk: Sync to integration and Smart Sync](https://support.optimonk.com/en/articles/11874669-sync-to-integration-smart-sync)
  offers immediate sync and a Smart Sync option. It describes immediate sync as
  potentially starting an email flow before later information is available.
  Smart Sync sends the combined information on completion, or the gathered
  information if the visitor abandons. This establishes that persistence and
  external dispatch timing are distinct product choices.
- [Thrive Leads: States and multi-step forms](https://thrivethemes.com/docs/how-to-use-states-and-multi-step-forms-complete-guide/)
  demonstrates an offer/Yes-No screen before a form. That pattern needs screen
  navigation but does not itself establish a requirement for multiple captures.

These are vendor descriptions of supported behavior, not independent evidence
of a conversion-rate increase or proof of demand from WConvert's own users.

## Complexity attributable to each decision

Screen navigation itself requires explicit screen identity, editor operations,
value preservation, validation scope, focus, and acknowledgement behavior.

Multiple saved submissions add safe continuation authorization, append-only
accepted details, separately timed consent evidence, and retry semantics that
do not create another Lead. Those requirements protect the chosen experience;
removing the safeguards while keeping the behavior would be an incomplete design.

Immediate external handoffs additionally require submission-specific routing
and accepted inputs so later SMS cannot replay email actions. They prevent later
answers from being available to an automation that has already started. Questions
needed by the email automation should therefore precede the email Submit.

Full screen/channel reports are a separately chosen feature; they are not a
prerequisite for saving an email before an optional SMS signup. Likewise, a
general state machine, branching, resume across visits, and new database tables
do not follow automatically from the capture decision.

## Recommended limit

Keep one-final-submit as the ordinary experience. Keep separately submitted
email/SMS signups as an intentional optional follow-up, because preserving the
first signup is a meaningful benefit for WConvert's email/SMS audience. Use
immediate handoff for those clearly separate purposes, with no replay of the
earlier action. Defer Smart Sync and arbitrary per-screen dispatch configuration.

If we decide the additional capture implementation is not justified for launch,
ship final-only journeys honestly: skipping an optional field can finish the
form, but closing before Submit saves nothing. Do not claim that this preserves
the email-first benefit documented by competitors.

The earlier two-table proposal is withdrawn. Use existing Lead JSON for bounded
accepted snapshots, Action Scheduler for jobs and an explicit scope in existing
statistics. The revised storage plan uses short-lived request receipts in owned,
non-autoloaded WordPress options to make first-submit retries safe while minting
Lead ULIDs at actual capture time. A signed start/continuation grant limits those
receipts to one short journey; no visitor-answer log or cross-visit profile is
created. This preserves the current Lead retention and timestamp relationship.
