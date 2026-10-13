# Webhooks

*WConvert Pro.* A webhook sends each signup to a URL you choose, as a signed
JSON `POST`. Use it with Zapier, Make, n8n, or your own code.

1. Open **Settings → Connections & destinations**, choose **Connect an
   account**, then **Webhook**.
2. **Choose where signups go**: Zapier, Make, n8n or Your own code. The next
   step asks only what that tool needs.
3. Paste the URL from your receiver. Treat it like a password: anyone who has
   it can send data to your Zap or scenario.
   - **Zapier:** the Catch Hook URL. Nothing else.
   - **Make:** the Custom webhook URL, and its API key if you set one. WConvert
     sends the key as the `x-make-apikey` header.
   - **n8n:** the Webhook node URL, and the Header Auth name and value if you
     use Header Auth.
   - **Your own code:** any URL, and up to five headers.

   Any tool can add more headers under **Other headers** (five in all).
4. Choose **Check and save account**. Copy the **signing secret** now. It is
   shown once, when the webhook is created or the secret is regenerated.
   Afterwards it shows only as stored. Zapier, Make and n8n don't check it, so
   you can skip it for them; your own code should (see *Verify the signature*).
5. Choose **Add a Webhook destination**, then turn it on in a campaign's
   **Destinations** tab and use **Send a test** there. That sample carries the
   campaign's own questions, with sample answers you can change, so you can
   map them before the first real signup arrives. The result says what your
   receiver answered and how long it took, for example *Answered 200 in
   0.4 s*.

Saving checks the URL and the secret. It does not send anything, so your Zap
does not get a junk sample. **Send a test** is the way to send one.

To change the URL or headers later, choose **Edit** in the account's **⋯**
menu. Stored values stay hidden: leave a field blank to keep it. **Regenerate**
makes a new secret and uses it at once, so update your receiver straight away.

An account shows the tool's logo when its URL is on that tool's own address,
and the webhook icon otherwise. On a copy of your site, such as staging, the
account says *On a copy of the site*: signups there still reach the receiver,
marked `staging`. Turn the destination off in that copy's campaigns to stop
them.

## Zapier, Make and n8n

**Zapier.** Create a Zap with **Webhooks by Zapier → Catch Hook**, copy its URL
into WConvert, then send a test from the campaign editor and choose it as the
sample in Zapier. Zapier does not check signatures; its URL is the secret.

**Make.** Add a **Webhooks → Custom webhook** module. For API key
authentication, add a key in Make, then add a header in WConvert named
`x-make-apikey` with that key as its value. Send a test so Make learns the data
structure.

**n8n.** Add a **Webhook** node with method `POST`. For **Header Auth**, use
the same header name and value in n8n and in WConvert. Set **Respond** to
*Immediately*. If it waits until the workflow ends, a slow workflow times out
here and the signup is sent again.

A self-hosted n8n on a public host works on any port, such as `:5678`.
Addresses on a private network (`localhost`, `10.x`, `192.168.x`) are refused,
and redirects are not followed. The receiver needs a valid TLS certificate;
there is no setting to skip the check.

## What is sent

One `POST` per accepted submission, with `Content-Type: application/json`.
Every key is always present and is `null` when empty.

```json
{
  "id": "msg_3f1c…",
  "type": "lead.captured",
  "version": 1,
  "timestamp": "2026-10-13T09:12:44Z",
  "test": false,
  "site": { "url": "https://shop.example", "environment": "production" },
  "data": {
    "lead_id": "01J…",
    "submission": "primary",
    "contact": { "email": "sarah@example.com", "phone": null, "name": "Sarah" },
    "interest": null,
    "answers": { "budget": { "question": "Budget?", "answer": "1k–5k" } },
    "campaign": { "id": "01J…", "name": "Spring sale popup", "goal": "grow_email_list" },
    "source": {
      "page_url": "/pricing?utm_source=fb",
      "utm": { "source": "fb", "medium": null, "campaign": null, "term": null, "content": null }
    },
    "consent": {
      "purpose": "email_marketing",
      "email": { "text": "Email me offers.", "accepted_at": "2026-10-13T09:12:44Z" },
      "sms": null
    }
  }
}
```

- `id` is the same on every retry of one submission. **Use it to ignore
  duplicates**: a retry after a slow reply sends the same `id` again.
- `timestamp` is when the visitor's submission was accepted, not when this
  request was sent.
- `answers` is keyed by question id. A multi-choice answer is a list of labels.
- `page_url` keeps only the page path and its UTM tags. Other query
  parameters are never stored or sent.
- `test` is `true` for **Send a test**, which fills every field with sample
  values.
- `site.environment` is `staging` or `development` on a copy of your site.
  A staging copy still sends to the same URL; WConvert warns you when the
  site address no longer matches the one the webhook was set up on.
- No IP address or browser details are sent.

**Two-step signups.** A form that asks for an email, then a phone number, sends
two requests with the same `lead_id` and different `submission` and `id`. The
second carries both the email and the phone. Update the record by `lead_id` or
email rather than creating a new one.

## Retries

A `2xx` reply means the signup was delivered. Reply within 10 seconds, and do
your slow work afterwards.

| Reply | What WConvert does |
| --- | --- |
| `2xx` | Delivered |
| `408`, `429`, `5xx`, timeout, host not found | Retries after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 24 hours |
| `3xx` | Needs attention: paste the address the URL redirects to |
| `401`, `403` | Needs attention: check the key, header or firewall |
| `404`, `410` | Needs attention: the Zap or scenario is off or deleted |
| Invalid certificate | Needs attention |
| Other `4xx` | Not retried |

After the last retry, the signup shows as needing attention, and you can
resend it from **Destinations** once the receiver works. Resending many old
signups runs your Zap or scenario once for each, which may use Zapier or Make
tasks.

Retries run on WordPress's scheduler. On a site with little traffic it runs
late; set up a real cron job to run `wp-cron.php` every minute.

Deleting a lead in WConvert does **not** delete it at the receiver. Remove it
there too.

## Verify the signature

Each request is signed with [Standard Webhooks](https://www.standardwebhooks.com/)
headers:

- `webhook-id`: the same value as the body's `id`.
- `webhook-timestamp`: when this attempt was sent, in Unix seconds.
- `webhook-signature`: `v1,` and a base64 HMAC-SHA256 of
  `{webhook-id}.{webhook-timestamp}.{raw body}`, keyed by the secret after
  `whsec_`, base64-decoded.

Verify against the **raw** request body, before parsing it, and reject a
timestamp more than five minutes from your clock.

**Node**, with `npm install standardwebhooks`:

```js
import { Webhook } from 'standardwebhooks';

const webhook = new Webhook(process.env.WCONVERT_SECRET); // "whsec_…"

app.post('/wconvert', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = webhook.verify(req.body.toString('utf8'), req.headers);
    res.sendStatus(204); // reply first, then work
    handle(event);
  } catch {
    res.sendStatus(401);
  }
});
```

**PHP**, with no library:

```php
$secret = base64_decode(substr(getenv('WCONVERT_SECRET'), strlen('whsec_')));
$body = file_get_contents('php://input'); // not $_POST: the body is JSON
$id = $_SERVER['HTTP_WEBHOOK_ID'] ?? '';
$timestamp = (int) ($_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ?? 0);
$expected = 'v1,' . base64_encode(hash_hmac('sha256', "{$id}.{$timestamp}.{$body}", $secret, true));

$valid = abs(time() - $timestamp) <= 300 && in_array(true, array_map(
    static fn ($sent) => hash_equals($expected, $sent),
    explode(' ', $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ?? '')
), true);

if (!$valid) {
    http_response_code(401);
    exit;
}
http_response_code(204);
$event = json_decode($body, true);
```

The PHP library `standard-webhooks/standard-webhooks` does the same in one call.

**Regenerating the secret switches at once.** The next request is signed with
the new secret, so update your receiver straight away. Until you do, it rejects
requests and the webhook shows as needing attention.

## For developers

To send to your own machine while developing, allow private addresses with a
filter in a must-use plugin. Never enable it on a live site.

```php
add_filter('wconvert_webhook_allows_private_hosts', '__return_true');
```
