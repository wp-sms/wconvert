import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_ERROR_CLASS, bindCapture } from '@loader/capture';
import { render } from '@renderer/render';
import type { Template } from '@renderer/types';

/**
 * The submit, and the two things that can come back: a [[Lead]] in the log, or
 * a refusal on screen while the visitor is still there to fix it.
 *
 * The refusal happens in the request they are still in, never in a queued job
 * (ADR 0021) — so everything here is about what the form does in the seconds
 * after the button is pressed, and nothing about what the server decided.
 */

const OPTIN = '01JQ0000000000000000000001';
const ENDPOINT = 'https://example.test/wp-json/wconvert/v1/capture';

const template = (options: { consent?: boolean; phone?: boolean } = {}): Template => ({
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', role: 'headline', text: 'Join the list' },
          { type: 'field', name: 'email', label: 'Email', required: true },
          { type: 'field', name: 'name', label: 'Name' },
          ...(options.phone ? [{ type: 'field' as const, name: 'phone' as const, label: 'Phone' }] : []),
          ...(options.consent
            ? [{ type: 'consent' as const, role: 'consent_text' as const, text: 'I agree.' }]
            : []),
          { type: 'button', role: 'cta_label', label: 'Go', action: 'submit' as const },
        ],
      },
      { type: 'stack', children: [{ type: 'heading', role: 'success_headline', text: 'Done' }] },
    ],
  },
  tokens: {},
});

/**
 * A rendered form, wired the way the container wires one: the submit default
 * is prevented by the container, and capture binds on top of it rather than
 * re-deriving a form of its own.
 */
const form = (options: { consent?: boolean; phone?: boolean; endpoint?: string | null } = {}) => {
  const design = template(options);
  const root = render(design.tree, design.tokens);
  const captured = { count: 0 };

  document.body.appendChild(root);
  root.addEventListener('submit', (event) => event.preventDefault());
  bindCapture(root, {
    optinId: OPTIN,
    endpoint: options.endpoint === undefined ? ENDPOINT : options.endpoint,
    onCaptured: () => void (captured.count += 1),
  });

  return { root, captured };
};

const fill = (root: HTMLElement, values: Record<string, string>) => {
  for (const [name, value] of Object.entries(values)) {
    root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value = value;
  }
};

const submit = async (root: HTMLElement) => {
  root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  // The response, its body and the handler are three separate microtask
  // turns. A macrotask drains all of them, whichever way the chain is written.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const respondWith = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);

const malformedResponse = (status: number) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new SyntaxError('invalid JSON')),
  } as Response);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respondWith(201, { id: '01JQ00000000000000000000LEAD' }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const bodyOf = (call: number = 0) => JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body));

const inputOf = (root: HTMLElement, name: string) => root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

const submitButtonOf = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('button[type="submit"]')!;

const expectTypedValues = (root: HTMLElement) => {
  expect(inputOf(root, 'email').value).toBe('sarah@example.com');
  expect(inputOf(root, 'name').value).toBe('Sarah');
  expect(inputOf(root, 'phone').value).toBe('+447700900000');
  expect(inputOf(root, 'consent').checked).toBe(true);
};

describe('a submission that lands', () => {
  it('posts what the visitor typed to the capture endpoint', async () => {
    const { root, captured } = form();

    fill(root, { email: 'sarah@example.com', name: 'Sarah' });
    await submit(root);

    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT);
    expect(bodyOf()).toEqual({ optin_id: OPTIN, fields: { email: 'sarah@example.com', name: 'Sarah' } });
    expect(captured.count).toBe(1);
  });

  /**
   * Canonicalisation is the SERVER's — it is what makes grouping the log
   * honest, and the endpoint is public so a client-side spelling of it would
   * be decoration (ADR 0021). The form sends what was typed, case and all.
   *
   * The surrounding whitespace is gone before this code ever sees it, by
   * `<input type="email">`'s own value sanitisation, which is the platform's
   * doing and not a canonicalisation of ours.
   */
  it('sends the value as typed and leaves canonical form to the server', async () => {
    const { root } = form();

    fill(root, { email: '  Sarah@Example.COM ', name: '  Sarah  ' });
    await submit(root);

    expect(bodyOf().fields.email).toBe('Sarah@Example.COM');
    expect(bodyOf().fields.name).toBe('  Sarah  ');
  });

  it('omits a field the visitor left blank rather than sending an empty one', async () => {
    const { root } = form();

    fill(root, { email: 'sarah@example.com', name: '' });
    await submit(root);

    expect(bodyOf().fields).toEqual({ email: 'sarah@example.com' });
  });
});

describe('consent', () => {
  /**
   * Consent travels as a JSON boolean and nothing else. The server requires
   * exactly `true`, because the moment a string is read for truth `"false"`
   * asserts consent (ADR 0032).
   */
  it('travels as a boolean, ticked', async () => {
    const { root } = form({ consent: true });

    fill(root, { email: 'sarah@example.com' });
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked = true;
    await submit(root);

    expect(bodyOf().consent).toBe(true);
  });

  it('travels as a boolean, unticked', async () => {
    const { root } = form({ consent: true });

    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(bodyOf().consent).toBe(false);
  });

  it('is absent entirely from a form that never asked', async () => {
    const { root } = form();

    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(bodyOf()).not.toHaveProperty('consent');
  });
});

describe('native browser validation', () => {
  it('keeps the first invalid field focused when Chrome drains microtasks between invalid events', async () => {
    const { root } = form({ consent: true, phone: true });
    const email = inputOf(root, 'email');
    inputOf(root, 'phone').required = true;

    // A trusted browser validation pass can checkpoint after each listener.
    // requestSubmit() inside JSDOM's JS call stack does not reproduce that.
    for (const input of root.querySelectorAll('input:invalid')) {
      const event = new Event('invalid', { cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await Promise.resolve();
    }

    expect(document.activeElement).toBe(email);
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.parentElement).toBe(email.closest('.wc-field'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not post an invalid form and reports the first invalid field', () => {
    const { root, captured } = form({ consent: true, phone: true });
    const email = inputOf(root, 'email');
    inputOf(root, 'phone').required = true;

    (root as HTMLFormElement).requestSubmit();

    const error = root.querySelector(`.${CAPTURE_ERROR_CLASS}`);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(captured.count).toBe(0);
    expect(document.activeElement).toBe(email);
    expect(error).toHaveTextContent(email.validationMessage);
    expect(error?.parentElement).toBe(email.closest('.wc-field'));
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toContain(error?.id);
  });
});

describe('a submission that is refused', () => {
  const refuse = (field: string | null, message: string) =>
    fetchMock.mockImplementation(() =>
      respondWith(422, { code: 'wconvert_x', message, data: { status: 422, field } }),
    );

  /**
   * The visitor is still on the page, and the form is the only place they can
   * fix it. The wording comes from the SERVER because the loader is a raw IIFE
   * with no `wp.i18n` runtime, so a sentence it carried could never be
   * translated.
   */
  it("shows the server's own words, beside the input that caused it", async () => {
    const { root, captured } = form();

    refuse('email', 'Please enter a valid email address.');
    fill(root, { email: 'nope' });
    await submit(root);

    const error = root.querySelector(`.${CAPTURE_ERROR_CLASS}`);
    const input = root.querySelector<HTMLInputElement>('input[name="email"]')!;

    expect(error?.textContent).toBe('Please enter a valid email address.');
    expect(error?.parentElement).toBe(input.closest('.wc-field'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error?.id);
    expect(captured.count).toBe(0);
  });

  it('places a consent refusal inside the consent control', async () => {
    const { root } = form({ consent: true });

    refuse('consent', 'Please tick the box.');
    fill(root, { email: 'sarah@example.com' });
    root.querySelector<HTMLInputElement>('input[name="consent"]')!.checked = true;
    await submit(root);

    const input = inputOf(root, 'consent');
    const error = root.querySelector(`.${CAPTURE_ERROR_CLASS}`);

    expect(error).toHaveTextContent('Please tick the box.');
    expect(error?.parentElement).toBe(input.closest('.wc-consent'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(error?.id);
  });

  it('preserves all entered values and unrelated descriptions after a field refusal', async () => {
    const { root } = form({ consent: true, phone: true });

    inputOf(root, 'email').setAttribute('aria-describedby', 'merchant-hint');
    refuse('phone', 'Please enter a valid phone number.');
    fill(root, { email: 'sarah@example.com', name: 'Sarah', phone: '+447700900000' });
    inputOf(root, 'consent').checked = true;
    await submit(root);

    const phone = inputOf(root, 'phone');
    const error = root.querySelector(`.${CAPTURE_ERROR_CLASS}`);

    expectTypedValues(root);
    expect(phone.getAttribute('aria-describedby')).toContain(error?.id);
    expect(inputOf(root, 'email')).toHaveAttribute('aria-describedby', 'merchant-hint');
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeTruthy();
    expect(submitButtonOf(root)).not.toBeDisabled();
    expect(phone).not.toHaveAttribute('readonly');
    expect(root).not.toHaveAttribute('aria-busy');
  });

  it('clears its own field error on edit while preserving unrelated descriptions', async () => {
    const { root } = form();
    const email = inputOf(root, 'email');

    email.setAttribute('aria-describedby', 'merchant-hint');
    refuse('email', 'Fix the address.');
    fill(root, { email: 'nope' });
    await submit(root);

    email.value = 'sarah@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));

    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeNull();
    expect(email).not.toHaveAttribute('aria-invalid');
    expect(email).toHaveAttribute('aria-describedby', 'merchant-hint');
  });

  it('shows a refusal that blames no single input, with nothing marked', async () => {
    const { root } = form();

    refuse(null, 'Please enter an email address or a phone number.');
    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.textContent).toBe(
      'Please enter an email address or a phone number.',
    );
    expect(root.querySelector('[aria-invalid]')).toBeNull();
  });

  it('clears the last refusal before showing the next, and never stacks them', async () => {
    const { root } = form();

    refuse('email', 'First problem.');
    fill(root, { email: 'nope' });
    await submit(root);

    refuse('name', 'Second problem.');
    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(root.querySelectorAll(`.${CAPTURE_ERROR_CLASS}`)).toHaveLength(1);
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.textContent).toBe('Second problem.');
    expect(root.querySelectorAll('[aria-invalid]')).toHaveLength(1);
    expect(root.querySelector('input[name="name"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  /**
   * A capture that fell over in transit is not a capture. The visitor pressed
   * a button, so something has to happen on screen — and this is the one
   * sentence the loader carries itself, because there was no response to carry
   * one for it.
   */
  it('says so when the request never arrives', async () => {
    const { root, captured } = form({ consent: true, phone: true });

    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    fill(root, { email: 'sarah@example.com', name: 'Sarah', phone: '+447700900000' });
    inputOf(root, 'consent').checked = true;
    await submit(root);

    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.textContent).not.toBe('');
    expect(captured.count).toBe(0);
    expectTypedValues(root);
  });

  it('times out a stalled request and restores the form controls', async () => {
    vi.useFakeTimers();

    try {
      const { root, captured } = form({ consent: true, phone: true });
      const button = submitButtonOf(root);
      const signal = inputOf(root, 'email');

      fetchMock.mockImplementation((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
      );
      fill(root, { email: 'sarah@example.com', name: 'Sarah', phone: '+447700900000' });
      inputOf(root, 'consent').checked = true;

      root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();
      expect(signal).toHaveAttribute('readonly');
      expect(inputOf(root, 'consent')).toBeDisabled();
      expect(root).toHaveAttribute('aria-busy', 'true');

      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
      await Promise.resolve();

      expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toHaveTextContent('We couldn’t confirm your submission. Please try again.');
      expect(button).not.toBeDisabled();
      expect(signal).not.toHaveAttribute('readonly');
      expect(inputOf(root, 'consent')).not.toBeDisabled();
      expect(root).not.toHaveAttribute('aria-busy');
      expectTypedValues(root);
      expect(captured.count).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the page carries no endpoint to post to', async () => {
    const { root, captured } = form({ endpoint: null });

    fill(root, { email: 'sarah@example.com' });
    root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.textContent).not.toBe('');
    expect(captured.count).toBe(0);
  });
});

describe('the capture response contract', () => {
  it.each([
    ['201 without a lead id', 201, {}],
    ['201 with a null body', 201, null],
    ['201 with an array body', 201, []],
    ['204 with no body', 204, null],
    ['422 with a null body', 422, null],
  ] as const)('does not advance on %s', async (_label, status, responseBody) => {
    const { root, captured } = form();

    fetchMock.mockImplementation(() => respondWith(status, responseBody));
    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(captured.count).toBe(0);
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeTruthy();
  });

  it('does not advance when a successful response is not JSON', async () => {
    const { root, captured } = form();

    fetchMock.mockImplementation(() => malformedResponse(201));
    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(captured.count).toBe(0);
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeTruthy();
  });
});

/**
 * Leads are never deduplicated (ADR 0021), so a double-click is genuinely two
 * rows unless something stops it — and a double-click is not two things the
 * visitor did.
 */
describe('a visitor pressing the button twice', () => {
  it('captures once while the first request is still in flight', async () => {
    const { root } = form();
    let settle: (response: Response) => void = () => undefined;

    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => void (settle = resolve)));
    fill(root, { email: 'sarah@example.com' });

    root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    settle({ ok: true, status: 201, json: () => Promise.resolve({ id: '01JQ00000000000000000000LEAD' }) } as Response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(submitButtonOf(root)).not.toBeDisabled();
    expect(inputOf(root, 'email')).not.toHaveAttribute('readonly');
  });

  it('clears the refusal and lets them try again successfully', async () => {
    const { root, captured } = form();

    fetchMock.mockImplementationOnce(() =>
      respondWith(422, { code: 'wconvert_x', message: 'Fix it.', data: { status: 422, field: 'email' } }),
    );
    fill(root, { email: 'nope' });
    await submit(root);

    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeNull();
    expect(inputOf(root, 'email')).not.toHaveAttribute('aria-invalid');
    expect(captured.count).toBe(1);
  });
});
