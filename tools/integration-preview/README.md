# Integration mapping preview

Run `npx vite --config tools/integration-preview/vite.config.mjs` from the repository root and open <http://127.0.0.1:5195/>.

This isolated page renders the real campaign `ExtraAnswerMapping` control with sample Mailtrap interest fields and Mailchimp text fields. It shows where account and audience setup ends and campaign question mapping begins, without a provider key or WordPress database. All field discovery and data preview responses come from `mock-api.ts`; a test-send attempt is refused. It does not verify provider API behavior or actual delivery.

The default separate-interests example groups Running and Hiking under one
question. Scenarios also cover missing yes/no fields, keeping existing contacts,
loading, and a failed refresh that retains its earlier fields. The direction
selector switches the real component between LTR and RTL. Open **Preview and
test mapping**, enter a fictional address, select interests and choose **Preview
data**; it shows separate Yes values without contacting any service.

The scenario selector covers partially mapped and unmapped answers, a deleted target field, no compatible fields, a recoverable metadata error, and an unsupported service. The error scenario recovers with **Retry loading fields**. The shared mapping control stacks its rows in narrow containers. Sample previews omit blank answers, matching the real preview endpoint; test sends remain refused.

The source-to-destination pairing follows the familiar field-matching pattern documented by [WPForms](https://wpforms.com/how-to-create-a-mailchimp-subscribe-form-in-wordpress/) and [Zapier](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields). WConvert keeps supported contact fields automatic and limits this optional UI to extra answers. Layout and recovery copy follow ADRs 0039, 0042 and 0097.

## Shopper preference acceptance sample

`fixtures/shopper-preferences.json` is a development fixture with an optional
Running/Hiking multiple-choice question, an email signup with explicit consent,
and an acknowledgement. It uses the existing question, capture and mapping
implementation. It is not a library entry or an importable `.wconvert.zip`.

Create a fresh draft on a development WordPress site with question journeys enabled:

```sh
wp eval-file tools/integration-preview/seed-preference-sample.php
```

Each invocation creates one new **local-only, unpublished draft** and prints its
editor URL. The script does not bind an account, publish a campaign, or send any
provider requests. Use **Preview & test** to try selecting both interests, going
Back, skipping the question, and completing signup.

For a controlled provider test, pair question `n2` with a dedicated provider text
field through the existing Field mapping control. One answer maps to `Running`;
both map to `Running; Hiking`. Keep existing details preserves the earlier
provider value; Update mapped fields changes it; an omitted answer does not clear it.

The [Mailtrap acceptance record](../../docs/reviews/preferences-mailtrap-2026-10-06/README.md)
documents a real capture → queued submission → worker → provider read-back run,
including checks for existing contacts and cleanup. It is distinct from the
simulated visitor preview above. A separate test list is not account isolation:
check account-wide automation triggers before creating contacts in a shared account.
