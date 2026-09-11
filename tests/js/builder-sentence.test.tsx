import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SentenceEditor } from '../../resources/admin/src/builder/SentenceEditor';
import { readSentence, writeSentence, editSentence, markSentence, type SentenceValue } from '../../resources/admin/src/builder/sentence';
import { parseShadow, shadowValue } from '../../resources/admin/src/builder/ShadowField';
import { rgbaForPicker } from '../../resources/admin/src/builder/ColorField';

describe('structured sentence editing', () => {
  const value = { text: 'Get %b off. Read %s.', emphasis: '20%', link: { label: 'our policy', href: '/privacy' } };
  it('round trips italic alongside bold and links without treating markup as HTML', () => {
    const formatted = { text: '%b, %i and %s.', emphasis: 'Save', italic: '<em>today</em>', link: { label: 'details', href: '/details' } };
    expect(writeSentence(readSentence(formatted))).toEqual(formatted);
    expect(readSentence(formatted).text).toBe('Save, <em>today</em> and details.');
  });
  it('round trips bold and a link without markup', () => {
    expect(writeSentence(readSentence(value))).toEqual(value);
  });
  it('retains formatting when text is inserted before or inside a phrase', () => {
    expect(writeSentence(editSentence(readSentence(value), 'Today: Get 25% off. Read our policy.'))).toEqual({ ...value, text: 'Today: Get 25% off. Read %s.', emphasis: undefined });
    expect(writeSentence(editSentence(readSentence(value), 'Get 200% off. Read our policy.'))).toEqual({ ...value, emphasis: '200%' });
    expect(writeSentence(editSentence(readSentence(value), 'Hey! Get 20% off. Read our policy.'))).toEqual({ ...value, text: 'Hey! Get %b off. Read %s.' });
  });
  it('removes only the mark whose text was removed', () => {
    expect(writeSentence(editSentence(readSentence(value), 'Get  off. Read our policy.'))).toEqual({ text: 'Get  off. Read %s.', link: value.link });
  });
  it('replaces overlapping marks rather than inventing nested markup', () => {
    const next = markSentence(readSentence(value), { kind: 'bold', start: 18, end: 28 });
    expect(next.marks).toHaveLength(1);
    expect(next.marks[0].kind).toBe('bold');
  });
  it('formats selected words as one atomic edit and keeps literal HTML as text', async () => {
    const changed = vi.fn();
    function Editor() {
      const [value, setValue] = useState<SentenceValue>({ text: 'Hello world <script>' });
      return <SentenceEditor value={value} label="Text" bold link onChange={(next, typing) => { setValue(next); changed(next, typing); }} />;
    }
    render(<Editor />);
    const input = screen.getByLabelText('Text') as HTMLTextAreaElement;
    input.focus(); input.setSelectionRange(6, 11); fireEvent.select(input);
    await userEvent.click(screen.getByRole('button', { name: 'Bold', exact: true }));
    expect(changed).toHaveBeenCalledExactlyOnceWith({ text: 'Hello %b <script>', emphasis: 'world' }, false);
    expect(input).toHaveValue('Hello world <script>');
    expect(screen.getByRole('region', { name: 'Formatted text preview' }).querySelector('strong')).toHaveTextContent('world');
    expect(screen.getByRole('region').querySelector('script')).toBeNull();
  });
  it('supports italic keyboard formatting, toggling and clearing without changing the words', async () => {
    const changed = vi.fn();
    function Editor() {
      const [value, setValue] = useState<SentenceValue>({ text: 'Only today' });
      return <SentenceEditor value={value} label="Text" bold italic link onChange={(next, typing) => { setValue(next); changed(next, typing); }} />;
    }
    render(<Editor />);
    const input = screen.getByLabelText('Text') as HTMLTextAreaElement;
    input.focus(); input.setSelectionRange(5, 10); fireEvent.select(input);
    await userEvent.keyboard('{Control>}i{/Control}');
    expect(changed).toHaveBeenLastCalledWith({ text: 'Only %i', italic: 'today' }, false);
    expect(screen.getByRole('region').querySelector('em')).toHaveTextContent('today');
    await userEvent.click(screen.getByRole('button', { name: 'Clear formatting' }));
    expect(changed).toHaveBeenLastCalledWith({ text: 'Only today' }, false);
    expect(input).toHaveValue('Only today');
  });
  it('does not write until a selected link is applied', async () => {
    const changed = vi.fn();
    render(<SentenceEditor value={{ text: 'Read our policy' }} label="Text" bold link onChange={changed} />);
    const input = screen.getByLabelText('Text') as HTMLTextAreaElement;
    input.focus(); input.setSelectionRange(5, 15); fireEvent.select(input);
    await userEvent.click(screen.getByRole('button', { name: 'Link', exact: true }));
    await userEvent.type(screen.getByLabelText('Link address'), 'https://example.com/privacy');
    expect(changed).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Apply link' }));
    expect(changed).toHaveBeenCalledExactlyOnceWith({ text: 'Read %s', link: { label: 'our policy', href: 'https://example.com/privacy' } }, false);
  });
});

describe('appearance parsing preserves the original design', () => {
  it('reads alpha in short and long hex, and leaves RGB intact', () => {
    expect(rgbaForPicker('#f008')).toBe('rgba(255, 0, 0, 0.533)');
    expect(rgbaForPicker('#12345680')).toBe('rgba(18, 52, 86, 0.502)');
    expect(rgbaForPicker('rgb(100% 0% 0% / 50%)')).toBe('rgba(255, 0, 0, 0.5)');
    expect(rgbaForPicker('rgb(var(--channels))')).toBeNull();
    expect(rgbaForPicker('#abc')).toBe('rgba(170, 187, 204, 1)');
    expect(rgbaForPicker('rgba(1, 2, 3, 0.4)')).toBe('rgba(1, 2, 3, 0.4)');
  });
  it('keeps upward tinted shadows editable and declines complex CSS', () => {
    const shadow = parseShadow('0 -6px 24px rgba(69, 10, 10, 0.35)');
    expect(shadow).toEqual({ x: 0, y: -6, blur: 24, spread: 0, color: 'rgba(69, 10, 10, 0.35)', inset: false });
    expect(shadowValue({ ...shadow!, spread: -2 })).toBe('0px -6px 24px -2px rgba(69, 10, 10, 0.35)');
    for (const value of ['0 2px 4px #000, 0 1px 2px #fff', 'var(--shadow)', '0 1rem 2rem #000']) expect(parseShadow(value)).toBeNull();
  });
});
