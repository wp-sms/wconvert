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

const template = (consent = false): Template => ({
  tree: {
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'heading', role: 'headline', text: 'Join the list' },
          { type: 'field', name: 'email', label: 'Email', required: true },
          { type: 'field', name: 'name', label: 'Name' },
          ...(consent
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
const form = (options: { consent?: boolean; endpoint?: string | null } = {}) => {
  const design = template(options.consent ?? false);
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respondWith(201, { id: '01JQ00000000000000000000LEAD' }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const bodyOf = (call: number = 0) => JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body));

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
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error?.id);
    expect(captured.count).toBe(0);
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
    const { root, captured } = form();

    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)?.textContent).not.toBe('');
    expect(captured.count).toBe(0);
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

    settle({ ok: true, status: 201, json: () => Promise.resolve({}) } as Response);
  });

  it('lets them try again once a refusal has come back', async () => {
    const { root } = form();

    fetchMock.mockImplementation(() =>
      respondWith(422, { code: 'wconvert_x', message: 'Fix it.', data: { status: 422, field: 'email' } }),
    );
    fill(root, { email: 'nope' });
    await submit(root);

    fill(root, { email: 'sarah@example.com' });
    await submit(root);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
