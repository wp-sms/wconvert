# Spam protection

Open **Settings → Spam protection**. Built-in checks run with no external
account. To add stronger verification, choose **Cloudflare Turnstile**,
**Google reCAPTCHA v2 checkbox**, or **hCaptcha**. All three integrations are
included in Free and Pro.

1. Create keys in your provider account for the website's hostname. Choose
   Turnstile Managed, Google v2 checkbox, or standard hCaptcha. Google v3 and
   Google Cloud assessment/API keys are not accepted by this adapter.
2. Enter the public site key and secret key. A saved secret is never shown;
   leaving it blank retains it only for the same provider. Choosing None clears
   both provider keys while keeping built-in protection.
3. Save and run **Test saved setup**. This verifies a real challenge against the
   saved credentials without creating a Lead or sending anything to a Destination.
4. Test a published form on desktop and phone. Review the provider's privacy
   notice and the updated WConvert Data Map before enabling on a production site.

New settings take effect at the server immediately. A form already holding an
older capture session may ask the visitor to refresh. Details previously
accepted remain saved. A lost submission response is retried with the same
journey grant, so it does not repeat the signup or its handoff.

Provider verification appears in a separate temporary dialog when required.
Cancel closes verification and keeps form values. Provider outages or blocked
scripts offer retry rather than pretending to accept a submission. Allow the
provider script/frame/connect origins in your site's Content Security Policy;
WConvert does not rewrite a site's CSP. The verification frame itself must stay
on the same origin as the visitor page.

## Pro filters

**Advanced email filters** contains exact blocked domains, exact blocked email
addresses, and email exceptions. Put one value per line, up to 100 per list.
Subdomains are separate; wildcards are not supported. Empty lists impose no
restrictions. These lists apply to every campaign on this WordPress site and
leave phone-only submissions unaffected. Exceptions bypass email filters only.

If Pro is deactivated while rules remain saved, capture cannot evaluate that
policy. Restore Pro or use **Remove unavailable filters**, then save. Keys for
Free CAPTCHA integrations are unaffected.

## Repeated requests and activity

Independent submissions remain independent Lead records. Queued resource
emails to the same address for the same resource are limited to one successful
send in ten minutes. A repeated send is skipped, not a delivery failure.
Explicit administrator test sends remain intentional tests.

Protection activity is an approximate 24-hour window of counts and reasons.
A recorded verification failure can be a real visitor whose token expired or
could not be verified. Closing the browser challenge itself is not counted. Counts are not people, confirmed spam or conversion
statistics. No rejected form details, raw IP addresses or tokens are retained
in this activity view.

Provider plans and charges are independent of WConvert. Official documentation:
[Turnstile](https://developers.cloudflare.com/turnstile/),
[reCAPTCHA v2](https://developers.google.com/recaptcha/docs/display),
[hCaptcha](https://docs.hcaptcha.com/).

## Retrying verification

Cancelling or failing verification preserves the form values and consent choice.
Submit again to retry. Content locks remain locked until capture is accepted.
The setup screen displays the hostname to register, distinguishes testing from
saving, and clears a previous test result when keys are edited. Save changes
before testing again. A successful setup test checks the saved configuration;
also submit a published form on your registered hostname.
