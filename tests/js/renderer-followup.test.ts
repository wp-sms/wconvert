import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@renderer/render';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';

const template: Template = { tokens: {}, tree: { steps: [
  { type: 'stack', children: [
    { type: 'field', name: 'email' }, { type: 'button', label: 'Send', action: 'submit' },
  ] },
  { type: 'stack', children: [
    { type: 'code', text: 'HELLO10', copy: true, copy_label: 'Copy this code', copied_label: 'Ready to use', copy_failed_label: 'Select HELLO10 manually' },
    { type: 'followup', label: 'Open guide', href: '#guide' },
  ] },
] } };

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('actions after submission', () => {
  it('copies the exact code, announces success only after completion, and never counts a conversion', async () => {
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onConvert = vi.fn();
    const anchor = document.createElement('div'); document.body.append(anchor);
    const mounted = mount({ displayType: 'inline', template, anchor, onConvert }); mounted.show(); mounted.showStep(1);
    const root = mounted.root!;
    const copy = root.querySelector('button')!;
    copy.click();
    expect(writeText).toHaveBeenCalledWith('HELLO10');
    expect(copy.disabled).toBe(true);
    expect(root.querySelector('[role=status]')?.textContent).toBe('');
    finish();
    await vi.waitFor(() => expect(root.querySelector('[role=status]')?.textContent).toBe('Ready to use'));
    expect(copy.disabled).toBe(false);
    root.querySelector('a')!.addEventListener('click', event => event.preventDefault());
    root.querySelector('a')!.click();
    expect(onConvert).not.toHaveBeenCalled();
    expect(root.tagName).toBe('DIV');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#guide');
    expect(root.querySelector('[data-convert]')).toBeNull();
    mounted.close();
  });

  it.each(['missing', 'denied'])('keeps the code selectable and reports %s clipboard access', async (access) => {
    vi.stubGlobal('navigator', access === 'missing' ? {} : { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    const root = render(template.tree, {}, 1);
    const copy = root.querySelector('button')!;
    copy.click();
    await vi.waitFor(() => expect(root.querySelector('[role=status]')?.textContent).toBe('Select HELLO10 manually'));
    expect(root.querySelector('.wc-code')?.textContent).toBe('HELLO10');
    expect(copy.disabled).toBe(false);
    expect(copy.type).toBe('button');
  });

  it('does not access the clipboard from a selectable editor preview', () => {
    const writeText = vi.fn(); vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(template.tree, {}, 1, { paths: true }).querySelector('button')!.click();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('retains the counted click for the original converting button', () => {
    const onConvert = vi.fn(); const anchor = document.createElement('div'); document.body.append(anchor);
    const mounted = mount({ displayType: 'inline', anchor, onConvert, template: { tokens: {}, tree: { steps: [{ type: 'button', action: 'link', href: '#offer', label: 'Offer' }] } } });
    mounted.show();
    const button = mounted.root!.querySelector('a')!; button.addEventListener('click', event => event.preventDefault()); button.click();
    expect(onConvert).toHaveBeenCalledOnce();
    mounted.close();
  });

  it('uses the existing safe URL boundary for resource links', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,hello']) {
      const root = render({ steps: [{ type: 'followup', label: 'Resource', href }] }, {});
      expect(root.querySelector('a')?.hasAttribute('href')).toBe(false);
    }
  });
});
