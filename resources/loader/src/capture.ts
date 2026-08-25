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
 * **Nothing here validates.** The capture endpoint is public, so a client-side
 * check is decoration: an honest browser enforces `required` and a ticked
 * checkbox, and the endpoint cannot tell an honest browser from `curl`
 * (ADR 0032). Canonicalisation is the server's for the same reason — it is
 * what makes grouping the lead log honest, so it cannot live where the client
 * can skip it (ADR 0021). What this does is send what was typed and render
 * what came back.
 */

/** The one element a refusal draws, and the hook the stylesheet styles it by. */
export const CAPTURE_ERROR_CLASS = 'wc-error';

const ERROR_ID = 'wc-capture-error';

/**
 * The one sentence the loader carries itself.
 *
 * Every other refusal is worded by the server, which is what makes it
 * translatable — the loader is a raw IIFE with no `wp.i18n` runtime, and
 * adding one would put a second script on the page for a handful of strings
 * (ADR 0004). This case is the exception because there was no response to
 * carry a sentence: the request never arrived. Same reasoning as the close
 * button's label, and the same English.
 */
const NO_RESPONSE = 'Something went wrong. Please try again.';

export interface CaptureOptions {
  readonly optinId: string;
  /** Where to post, read off the payload element. Null where the page carries none. */
  readonly endpoint: string | null;
  /** The [[Conversion]]: the capture succeeded. Not called for a refusal. */
  readonly onCaptured: () => void;
}

interface Refusal {
  readonly message?: unknown;
  readonly data?: { readonly field?: unknown };
}

export function bindCapture(root: HTMLElement, options: CaptureOptions): void {
  let inFlight = false;

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

    void send(options.endpoint, body(root, options.optinId))
      .then((refusal) => {
        inFlight = false;

        if (refusal === null) {
          clear(root);
          options.onCaptured();

          return;
        }

        refuse(root, text(refusal.message) ?? NO_RESPONSE, text(refusal.data?.field));
      })
      .catch(() => {
        // A capture that fell over in transit is not a capture. The visitor
        // pressed a button, so something has to happen on screen — and they
        // must be able to press it again.
        inFlight = false;
        refuse(root, NO_RESPONSE, null);
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
async function send(endpoint: string, payload: string): Promise<Refusal | null> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (response.ok) {
    return null;
  }

  return await response.json().catch((): Refusal => ({}));
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

  for (const input of root.querySelectorAll<HTMLInputElement>('input.wc-input')) {
    if (input.name !== '' && input.value.trim() !== '') {
      fields[input.name] = input.value;
    }
  }

  const consent = root.querySelector<HTMLInputElement>('input.wc-checkbox[name="consent"]');

  return JSON.stringify({
    optin_id: optinId,
    fields,
    ...(consent === null ? {} : { consent: consent.checked }),
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
  root.appendChild(error);

  const input = field === null ? null : root.querySelector<HTMLInputElement>(`[name="${CSS.escape(field)}"]`);

  if (input === null) {
    return;
  }

  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', error.id);
  input.focus();
}

function clear(root: HTMLElement): void {
  root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.remove();

  for (const marked of root.querySelectorAll('[aria-invalid]')) {
    marked.removeAttribute('aria-invalid');
    marked.removeAttribute('aria-describedby');
  }
}

/** A string the server sent, or null where it sent something else. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
