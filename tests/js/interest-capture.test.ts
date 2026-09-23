import { treeFixture } from './support/journey';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCapture, CAPTURE_ERROR_CLASS } from '@loader/capture';
import { render } from '@renderer/render';
import type { Template, TemplateTree } from '@renderer/types';

const OPTIN = '01JQ0000000000000000000001';
const ENDPOINT = 'https://example.test/wp-json/wconvert/v1/capture';
const OPTIONS = [
  { value: 'installation', label: 'Installation' },
  { value: 'repair', label: 'Repair' },
] as const;

const template = (): Template => ({
  tree: treeFixture({
    steps: [
      {
        type: 'stack',
        children: [
          { type: 'field', name: 'email', label: 'Email address', required: true },
          { type: 'field', name: 'name', label: 'Your name' },
          {
            type: 'field',
            name: 'interest',
            label: 'Which service do you need?',
            placeholder: 'Choose a service',
            required: true,
            options: OPTIONS,
          },
          { type: 'button', label: 'Send', action: 'submit' },
        ],
      },
      { type: 'stack', children: [{ type: 'heading', text: 'Thanks' }] },
    ],
  }),
  tokens: {},
});

const firstStep = (): TemplateTree['steps'][number]['content'] => template().tree.steps[0].content;

const respondWith = (status: number, body: unknown): Promise<Response> =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);

const form = (onCaptured = vi.fn()) => {
  const design = template();
  const root = render(design.tree, design.tokens);

  document.body.appendChild(root);
  bindCapture(root, { optinId: OPTIN, endpoint: ENDPOINT, onCaptured });

  return { root, onCaptured };
};

const input = (root: HTMLElement, name: string): HTMLInputElement =>
  root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

const interest = (root: HTMLElement): HTMLSelectElement =>
  root.querySelector<HTMLSelectElement>('select[name="interest"]')!;

const submitButton = (root: HTMLElement): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>('button[type="submit"]')!;

const submit = async (root: HTMLElement): Promise<void> => {
  root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respondWith(201, { id: '01JQ00000000000000000000LEAD' }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('the interest field renderer', () => {
  it.each([{}, null, 'not a list', [null, { value: 'broken' }, { value: 3, label: 'Bad value' }]])(
    'survives malformed imported options without breaking the preview', (options) => {
      const design = treeFixture({ steps: [{ type: 'stack', children: [
        { type: 'field', name: 'interest', options },
        { type: 'button', label: 'Send', action: 'submit' },
      ] }] }) as unknown as TemplateTree;
      const root = render(design, {});
      expect([...interest(root).options].map((option) => option.value)).toEqual(['']);
    },
  );

  it('renders valid imported options safely beside malformed rows', () => {
    const design = treeFixture({ steps: [{ type: 'stack', children: [
      { type: 'field', name: 'interest', options: [null, ...OPTIONS, {}] },
      { type: 'button', label: 'Send', action: 'submit' },
    ] }] }) as unknown as TemplateTree;
    const root = render(design, {});
    expect([...interest(root).options].map((option) => option.value)).toEqual(['', 'installation', 'repair']);
  });

  it('renders a labelled native select with stable option values and required state', () => {
    const root = render(treeFixture({ steps: [firstStep()] }), {});
    const select = interest(root);
    const label = root.querySelector<HTMLLabelElement>('label[for="wc-interest"]');

    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).toHaveAccessibleName('Which service do you need?');
    expect(select).toBeRequired();
    expect(label?.textContent).toBe('Which service do you need? *');
    expect([...select.options].map(({ value, text }) => ({ value, text }))).toEqual([
      { value: '', text: 'Choose a service' },
      { value: 'installation', text: 'Installation' },
      { value: 'repair', text: 'Repair' },
    ]);
  });
});

describe('interest capture', () => {
  it.each(['readonly', 'disabled', 'hidden', 'disabled fieldset'])(
    'focuses the first eligible choice after a %s email control', (state) => {
      const { root } = form();
      const email = input(root, 'email');
      email.value = 'not an address';
      if (state === 'readonly') email.readOnly = true;
      if (state === 'disabled') email.disabled = true;
      if (state === 'hidden') email.type = 'hidden';
      if (state === 'disabled fieldset') {
        const wrapper = email.closest('.wc-field')!;
        const fieldset = document.createElement('fieldset');
        fieldset.disabled = true;
        wrapper.replaceWith(fieldset);
        fieldset.appendChild(wrapper);
      }

      expect(email.willValidate).toBe(false);
      (root as HTMLFormElement).requestSubmit();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(interest(root));
      expect(interest(root)).toHaveAttribute('aria-invalid', 'true');
      expect(email).not.toHaveAttribute('aria-invalid');
    },
  );

  it('keeps the first invalid select focused across separate native invalid events', async () => {
    const { root } = form();
    input(root, 'email').value = 'sarah@example.com';
    const consent = document.createElement('input');
    consent.type = 'checkbox';
    consent.name = 'consent';
    consent.required = true;
    root.appendChild(consent);

    for (const control of root.querySelectorAll('input:invalid,select:invalid')) {
      const event = new Event('invalid', { cancelable: true });
      control.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await Promise.resolve();
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(interest(root));
    expect(root.querySelectorAll(`.${CAPTURE_ERROR_CLASS}`)).toHaveLength(1);
  });

  it('puts the stable interest value in the capture payload and preserves name/email', async () => {
    const { root, onCaptured } = form();
    input(root, 'email').value = 'sarah@example.com';
    input(root, 'name').value = 'Sarah Example';
    interest(root).value = 'installation';

    await submit(root);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      optin_id: OPTIN,
      fields: {
        email: 'sarah@example.com',
        name: 'Sarah Example',
        interest: 'installation',
      },
    });
    expect(onCaptured).toHaveBeenCalledOnce();
  });

  it('disables and restores the select while the request is pending', async () => {
    let settle: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => void (settle = resolve)));

    const { root } = form();
    input(root, 'email').value = 'sarah@example.com';
    interest(root).value = 'repair';
    root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(interest(root)).toBeDisabled();
    expect(submitButton(root)).toBeDisabled();
    expect(root).toHaveAttribute('aria-busy', 'true');

    settle(await respondWith(201, { id: '01JQ00000000000000000000LEAD' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(interest(root)).not.toBeDisabled();
    expect(submitButton(root)).not.toBeDisabled();
    expect(root).not.toHaveAttribute('aria-busy');
    expect(interest(root).value).toBe('repair');
  });

  it('focuses and preserves the choice after a server refusal, then clears its error on edit', async () => {
    fetchMock.mockImplementation(() =>
      respondWith(422, {
        code: 'wconvert_choice_invalid',
        message: 'Please choose one of the available options.',
        data: { status: 422, field: 'interest' },
      }),
    );

    const { root } = form();
    input(root, 'email').value = 'sarah@example.com';
    input(root, 'name').value = 'Sarah Example';
    input(root, 'name').setAttribute('aria-describedby', 'merchant-hint');
    interest(root).value = 'installation';

    await submit(root);

    const error = root.querySelector(`.${CAPTURE_ERROR_CLASS}`);
    expect(error).toHaveTextContent('Please choose one of the available options.');
    expect(error?.parentElement).toBe(interest(root).closest('.wc-field'));
    expect(document.activeElement).toBe(interest(root));
    expect(input(root, 'email').value).toBe('sarah@example.com');
    expect(input(root, 'name').value).toBe('Sarah Example');
    expect(interest(root).value).toBe('installation');
    expect(input(root, 'name')).toHaveAttribute('aria-describedby', 'merchant-hint');

    interest(root).value = 'repair';
    interest(root).dispatchEvent(new Event('input', { bubbles: true }));

    expect(root.querySelector(`.${CAPTURE_ERROR_CLASS}`)).toBeNull();
    expect(interest(root)).not.toHaveAttribute('aria-invalid');
  });
});
