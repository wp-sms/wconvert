import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { prepareControls, readFields, restoreFields, disposePreview, validQuestions, type PreviewValues } from '../../tools/design-library/preview/controls';

const mounts: HTMLElement[] = [];
afterEach(() => { mounts.forEach(disposePreview); document.body.replaceChildren(); mounts.length = 0; });
function mount() {
  const host = document.createElement('div');
  document.body.append(host); mounts.push(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const root = document.createElement('form'); root.className = 'wc-root';
  root.innerHTML = '<label for="phone">Mobile number</label><input type="tel" id="phone" name="phone" data-capture-id="mobile" placeholder="+44 7700 900000" required>';
  shadow.append(root); prepareControls(root, shadow);
  return { root, host, ui: within(shadow as unknown as HTMLElement) };
}

it('uses real country selection and preserves canonical phone details across screen replacement', async () => {
  const user = userEvent.setup();
  const first = mount();
  expect(first.ui.getByRole('textbox')).not.toHaveAttribute('placeholder', '+44 7700 900000');
  await user.click(first.ui.getByRole('button', { name: 'Select country: United Kingdom (+44)' }));
  await user.type(first.ui.getByRole('combobox', { name: 'Search countries' }), 'Canada');
  fireEvent.click(first.ui.getByRole('option', { name: /Canada/ }));
  expect(first.ui.getByRole('textbox').getAttribute('placeholder')).not.toContain('+44');
  await user.type(first.ui.getByRole('textbox', { name: 'Mobile number' }), '5065550123');
  const values: PreviewValues = {}; readFields(first.root, values);
  expect(values.mobile).toEqual({ value: '+15065550123', country: 'CA' });
  disposePreview(first.host);
  expect(first.host.shadowRoot!.querySelector('.wc-phone-portal')).toBeNull();
  first.host.remove(); mounts.splice(mounts.indexOf(first.host), 1);
  const next = mount(); restoreFields(next.root, values, ['mobile']);
  await Promise.resolve();
  expect(next.ui.getByRole('textbox')).toHaveAttribute('data-e164', '+15065550123');
  expect(next.ui.getByRole('textbox')).toHaveAttribute('readonly');
  expect(next.ui.getByRole('button', { name: 'Select country: Canada (+1)' })).toBeDisabled();
  const reset = mount(); expect(reset.ui.getByRole('textbox')).toHaveValue('');
  expect(reset.ui.getByRole('button', { name: 'Select country: United Kingdom (+44)' })).toBeEnabled();
});

it('blocks an incomplete phone number before showing an acknowledgement', async () => {
  const user = userEvent.setup(); const { root, ui } = mount();
  await user.type(ui.getByRole('textbox'), '123');
  expect(root.checkValidity()).toBe(false);
});

it('validates a required multi-choice group without requiring every option', () => {
  const root = document.createElement('form');
  root.innerHTML = '<input type="checkbox" data-question-id="q"><input type="checkbox" data-question-id="q">';
  const content = { type: 'question', id: 'q', required: true };
  expect(validQuestions(root, content)).toBe(false);
  root.querySelectorAll('input')[1].checked = true;
  expect(validQuestions(root, content)).toBe(true);
  expect(root.checkValidity()).toBe(true);
});

it('keeps a font-independent chevron when the phone country changes', async () => {
  const user = userEvent.setup(); const { root, ui } = mount();
  const arrow = () => root.querySelector('.lpi__arrow');
  expect(arrow()?.textContent).toBe('');
  expect(arrow()?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  await user.click(ui.getByRole('button', { name: 'Select country: United Kingdom (+44)' }));
  await user.type(ui.getByRole('combobox', { name: 'Search countries' }), 'Canada');
  fireEvent.click(ui.getByRole('option', { name: /Canada/ }));
  expect(arrow()?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(ui.getByRole('button', { name: 'Select country: Canada (+1)' })).toBeEnabled();
});

describe('the country list beside its field', () => {
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView; });

  /** jsdom has no layout, so the field and the window are stated. */
  async function open(field: DOMRect, windowSize = { width: 1280, height: 800 }) {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(windowSize.height);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(windowSize.width);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { root, host, ui } = mount();
    // The library anchors to the trigger, the narrower button inside the field.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ ...field, left: field.left + 1, width: 100 });
    vi.spyOn(root.querySelector('.wc-phone')!, 'getBoundingClientRect').mockReturnValue(field);
    await user.click(ui.getByRole('button', { name: /^Select country/ }));
    const dropdown = host.shadowRoot!.querySelector<HTMLElement>('.lpi__dropdown')!;
    return { dropdown, list: dropdown.querySelector<HTMLElement>('.lpi__list')! };
  }
  const wheel = (target: Element) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, deltaY: 100 });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('takes the field’s left edge and width', async () => {
    const { dropdown } = await open(rect(484, 300, 312, 46));
    expect(dropdown.style.left).toBe('484px');
    expect(dropdown.style.width).toBe('312px');
  });

  it('keeps a narrow field’s list at its minimum width and on screen', async () => {
    const { dropdown } = await open(rect(1100, 300, 160, 46));
    expect(dropdown.style.width).toBe('280px');
    expect(dropdown.style.left).toBe('992px');
  });

  it('stops short of the window’s bottom when opening below', async () => {
    const { dropdown } = await open(rect(484, 50, 312, 46), { width: 1280, height: 300 });
    expect(dropdown).not.toHaveClass('lpi__dropdown--above');
    expect(dropdown.style.maxHeight).toBe('196px');
  });

  it('stops short of the window’s top when opening above', async () => {
    const { dropdown } = await open(rect(484, 150, 312, 46), { width: 1280, height: 300 });
    expect(dropdown).toHaveClass('lpi__dropdown--above');
    expect(dropdown.style.maxHeight).toBe('142px');
    expect(dropdown.style.top).toBe('auto');
    expect(dropdown.style.bottom).toBe('150px');
  });

  it('leaves 300px as the cap when the window has room', async () => {
    const { dropdown } = await open(rect(484, 100, 312, 46));
    expect(dropdown.style.maxHeight).toBe('300px');
  });

  it('leaves the fullscreen list to the stylesheet', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { dropdown } = await open(rect(40, 300, 310, 46), { width: 390, height: 800 });
    expect(dropdown).toHaveClass('lpi__dropdown--fullscreen');
    expect(dropdown.style.left).toBe('');
    expect(dropdown.style.width).toBe('');
    expect(dropdown.style.maxHeight).toBe('');
  });

  it('scrolls the selected country into view once the field’s font is applied', async () => {
    const seen: Array<{ row: string; font: string; maxHeight: string }> = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      const dropdown = this.closest<HTMLElement>('.lpi__dropdown')!;
      seen.push({ row: this.dataset.code || '', font: dropdown.parentElement!.style.font, maxHeight: dropdown.style.maxHeight });
    };
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ font: '16px serif', getPropertyValue: () => '' } as unknown as CSSStyleDeclaration);
    await open(rect(484, 100, 312, 46));
    expect(seen.at(-1)).toEqual({ row: 'GB', font: '16px serif', maxHeight: '300px' });
  });

  it('blocks the wheel when the list has nothing to scroll', async () => {
    const { list } = await open(rect(484, 100, 312, 46));
    vi.spyOn(list, 'scrollHeight', 'get').mockReturnValue(120);
    vi.spyOn(list, 'clientHeight', 'get').mockReturnValue(240);
    expect(wheel(list.querySelector('.lpi__option')!)).toBe(true);
  });

  it('leaves the wheel to a list that can scroll', async () => {
    const { list } = await open(rect(484, 100, 312, 46));
    vi.spyOn(list, 'scrollHeight', 'get').mockReturnValue(9000);
    vi.spyOn(list, 'clientHeight', 'get').mockReturnValue(240);
    expect(wheel(list.querySelector('.lpi__option')!)).toBe(false);
  });

  it('blocks the wheel over the search box, where the page would take it', async () => {
    const { dropdown, list } = await open(rect(484, 100, 312, 46));
    vi.spyOn(list, 'scrollHeight', 'get').mockReturnValue(9000);
    vi.spyOn(list, 'clientHeight', 'get').mockReturnValue(240);
    expect(wheel(dropdown.querySelector('.lpi__search')!)).toBe(true);
  });
});
