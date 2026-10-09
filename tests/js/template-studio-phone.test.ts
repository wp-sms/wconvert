import { afterEach, expect, it } from 'vitest';
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
