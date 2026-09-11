/**
 * The submit: a visitor fills in a rendered Optin, and a [[Lead]] lands in the
 * log — or is refused on screen while they are still there to fix it.
 *
 * **This binds to the rendered root rather than deriving a form of its own.**
 * The step that holds a submit button IS the form, which the renderer already
 * decided when it chose between `<form>` and `<div>`, and the container has
 * already prevented the navigation a handler-less form would perform. Asking
 * the question a second time here would be a second answer to keep in step.
 *
 * **Canonicalisation stays on the server.** The capture endpoint is public,
 * so a client-side check cannot authorise capture: a browser enforces `required` and a ticked
 * checkbox, and the endpoint cannot tell an honest browser from `curl`
 * (ADR 0032). Canonicalisation is the server's for the same reason — it is
 * what makes grouping the lead log honest, so it cannot live where the client
 * can skip it (ADR 0021). Native browser validation messages and server
 * refusals appear beside the field while its entered value stays in place.
 */

/** The one element a refusal draws, and the hook the stylesheet styles it by. */
export const CAPTURE_ERROR_CLASS = 'wc-error';

const ERROR_ID = 'wc-capture-error';
type CaptureInput = HTMLInputElement | HTMLSelectElement;
const isControl = (value: EventTarget | null): value is CaptureInput => value instanceof HTMLInputElement || value instanceof HTMLSelectElement;

/**
 * The one sentence the loader carries itself.
 *
 * Every other refusal is worded by the server, which is what makes it
 * translatable — the loader is a raw IIFE with no `wp.i18n` runtime, and
 * adding one would put a second script on the page for a handful of strings
 * (ADR 0004). This case is the exception because there was no response to
 * carry a usable sentence: the response was missing or malformed. It says
 * nothing about whether the server saved the Lead. Same reasoning as the
 * close button's label, and the same English.
 */
const NO_RESPONSE = 'Submission not confirmed. Please try again.';

export interface CaptureOptions {
  readonly optinId: string;
  /** Where to post, read off the payload element. Null where the page carries none. */
  readonly endpoint: string | null;
  /** The [[Conversion]]: the capture succeeded. Not called for a refusal. */
  readonly onCaptured: () => void;
}

/**
 * A `WP_Error` as REST serialises it. Named for the wire shape rather than for
 * the domain: the server's `Refusal` is a code and a field, and this is the
 * JSON it arrives in.
 */
interface RefusalBody {
  readonly message?: unknown;
  readonly data?: { readonly field?: unknown };
}

export function bindCapture(root: HTMLElement, options: CaptureOptions): void {
  let inFlight = false;

  // Native constraints still prevent submission. Use the browser's translated
  // wording, and focus only the first invalid field in a validation pass.
  root.addEventListener('invalid', (event) => {
    const input = event.target;

    if (!isControl(input)) return;

    event.preventDefault();

    // Chrome can drain microtasks between invalid events. Read native
    // validity in DOM order instead of relying on a timing-based pass guard.
    const first = [...root.querySelectorAll<CaptureInput>('input,select')]
      .find((candidate) => candidate.willValidate && !candidate.validity.valid);
    if (input !== first) return;

    refuse(root, input.validationMessage, input.name);
  }, true);

  root.addEventListener('input', (event) => {
    const input = event.target;

    if (isControl(input) && input.matches(`[aria-describedby~="${ERROR_ID}"]`)) {
      clear(root);
    }
  });

  root.addEventListener('submit', (event) => {
    // The container already prevented the default, and prevents it whether or
    // not capture ever binds — a form with no handler NAVIGATES, which would
    // reload the page underneath the popup the visitor was filling in. This is
    // belt and braces on a container that may not be ours: Pro composes its
    // own (ADR 0028).
    event.preventDefault();

    // Leads are never deduplicated (ADR 0021), so a second submit while the
    // first is in flight is genuinely a second row — and a double-click is not
    // two things the visitor did.
    if (inFlight) {
      return;
    }

    if (options.endpoint === null) {
      refuse(root, NO_RESPONSE, null);

      return;
    }

    inFlight = true;
    clear(root);
    const payload = body(root, options.optinId);
    const release = pending(root);

    void send(options.endpoint, payload)
      // A lost response says nothing about whether the Lead was saved. Use
      // the same refusal path, retaining the form and allowing another try.
      .catch((): RefusalBody => ({}))
      .then((refusal) => {
        inFlight = false;
        release();

        if (refusal === null) {
          clear(root);
          options.onCaptured();

          return;
        }

        refuse(root, text(refusal.message) ?? NO_RESPONSE, text(refusal.data?.field));
      });
  });
}

/**
 * Post, and answer with the refusal or with null.
 *
 * A response body that will not parse is treated as a refusal with no words of
 * its own rather than as a success: a capture is only captured when the server
 * says so.
 */
async function send(endpoint: string, payload: string): Promise<RefusalBody | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: controller.signal,
    });
    // Parse failures use the caller's unconfirmed-response path too; finally
    // still clears the timeout before that rejection is handled.
    const result: unknown = await response.json();

    if (typeof result !== 'object' || result === null || Array.isArray(result)) return {};
    if (response.ok) return text((result as { readonly id?: unknown }).id) !== null ? null : {};

    return result as RefusalBody;
  } finally {
    clearTimeout(timeout);
  }
}

/** Keep submitted values steady and make waiting visible; restore on failure. */
function pending(root: HTMLElement): () => void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].filter((button) => !button.disabled);
  const fields = [...root.querySelectorAll<HTMLInputElement>('input.wc-input')].filter((input) => !input.readOnly);
  const checkboxes = [...root.querySelectorAll<CaptureInput>('input.wc-checkbox,select.wc-input')].filter((input) => !input.disabled);

  const set = (busy: boolean) => {
    if (busy) root.setAttribute('aria-busy', 'true');
    else root.removeAttribute('aria-busy');
    for (const button of buttons) {
      button.disabled = busy;
      if (busy) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    }
    for (const input of fields) input.readOnly = busy;
    for (const input of checkboxes) input.disabled = busy;
  };
  set(true);
  return () => set(false);
}

/**
 * What the visitor typed, as the endpoint expects it.
 *
 * `consent` is a real boolean and is present only where the form asked — the
 * server requires exactly `true`, because the moment a string is read for
 * truth `"false"` asserts consent (ADR 0032). A blank field is omitted rather
 * than sent empty, so the server sees "not filled in" rather than "filled in
 * with nothing".
 */
function body(root: HTMLElement, optinId: string): string {
  const fields: Record<string, string> = {};

  for (const input of root.querySelectorAll<CaptureInput>('.wc-input')) {
    if (input.name !== '' && input.value.trim() !== '') {
      fields[input.name] = input.value;
    }
  }

  const consent = root.querySelector<HTMLInputElement>('input.wc-checkbox[name="consent"]');

  return JSON.stringify({
    optin_id: optinId,
    fields,
    // JSON omits undefined; an absent checkbox does not assert consent.
    consent: consent?.checked,
  });
}

/**
 * Draw the refusal, beside the input that caused it where the server named
 * one.
 *
 * One error element, replaced rather than appended to: a form that stacks
 * every attempt tells the visitor less with each one.
 */
function refuse(root: HTMLElement, message: string, field: string | null): void {
  clear(root);

  const error = document.createElement('p');

  error.id = ERROR_ID;
  error.className = CAPTURE_ERROR_CLASS;
  // `alert` rather than `status`: it is the result of something the visitor
  // just did, and it has to interrupt whatever a screen reader was saying.
  error.setAttribute('role', 'alert');
  error.textContent = message;

  const input = field === null ? null : root.querySelector<CaptureInput>(`[name="${CSS.escape(field)}"]`);
  const container = input?.closest('.wc-field,.wc-consent');

  (container ?? root).appendChild(error);

  if (input === null) {
    return;
  }

  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
  input.focus();
}

function clear(root: HTMLElement): void {
  root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.remove();

  for (const marked of root.querySelectorAll(`[aria-describedby~="${ERROR_ID}"]`)) {
    marked.removeAttribute('aria-invalid');
    const descriptions = marked.getAttribute('aria-describedby')!.split(/\s+/).filter((id) => id !== ERROR_ID).join(' ');

    if (descriptions) marked.setAttribute('aria-describedby', descriptions);
    else marked.removeAttribute('aria-describedby');
  }
}

/** A string the server sent, or null where it sent something else. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
