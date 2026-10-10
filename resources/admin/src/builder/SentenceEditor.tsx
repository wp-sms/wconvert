import { useId, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Bold, Italic, Link2, RemoveFormatting, Unlink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LinkField } from './LinkField';
import { AutoGrowTextarea } from './AutoGrowTextarea';
import { FieldHeading, PanelField, PanelHint } from './PanelSection';
import { editSentence, markSentence, readSentence, writeSentence, type SentenceValue } from './sentence';

/** A small selection toolbar, backed by the renderer's existing sentence model. */
export function SentenceEditor({ value, label, bold, italic = false, link, policy = false, onChange }: {
  value: SentenceValue; label: string; bold: boolean; italic?: boolean; link: boolean;
  /** Whether an empty address means the privacy policy here: consent wording and fine print only (ADR 0133). */
  policy?: boolean;
  onChange: (value: SentenceValue, typing: boolean) => void;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const sentence = readSentence(value);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [editingLink, setEditingLink] = useState(false);
  const [address, setAddress] = useState('');
  const [notice, setNotice] = useState('');
  const selected = selection.end > selection.start;
  const strong = sentence.marks.find(mark => mark.kind === 'bold');
  const slanted = sentence.marks.find(mark => mark.kind === 'italic');
  const anchor = sentence.marks.find(mark => mark.kind === 'link');
  const write = (next: typeof sentence) => onChange(writeSentence(next), false);
  const remove = (kind: 'bold' | 'italic' | 'link') => write({ ...sentence, marks: sentence.marks.filter(mark => mark.kind !== kind) });
  const format = (kind: 'bold' | 'italic' | 'link') => {
    if (!selected) {
      if (kind === 'bold' && strong) { remove('bold'); return; }
      if (kind === 'italic' && slanted) { remove('italic'); return; }
      if (kind === 'link' && anchor) { setAddress(anchor.href ?? ''); setEditingLink(true); return; }
      setNotice(__('Select the words you want to format first.', 'wconvert'));
      input.current?.focus();
      return;
    }
    setNotice('');
    if (kind === 'link') { setAddress(anchor?.href ?? ''); setEditingLink(true); return; }
    const existing = sentence.marks.find(mark => mark.kind === kind);
    if (existing?.start === selection.start && existing.end === selection.end) remove(kind);
    else write(markSentence(sentence, { kind, ...selection }));
  };
  let offset = 0;
  const preview = [...sentence.marks].sort((a, b) => a.start - b.start).map((mark, i) => {
    const before = sentence.text.slice(offset, mark.start);
    const words = sentence.text.slice(mark.start, mark.end);
    offset = mark.end;
    return <span key={i}>{before}{mark.kind === 'bold' ? <strong>{words}</strong> : mark.kind === 'italic' ? <em>{words}</em> : <span className="wconvert-sentence-link">{words}</span>}</span>;
  });
  const anchorWords = anchor ? sentence.text.slice(anchor.start, anchor.end) : '';
  return <div className="wconvert-sentence-editor wconvert-panel-field">
    <FieldHeading label={label} htmlFor={id} tip={__('Select words, then press Bold, Italic or Link. One phrase per style.', 'wconvert')} />
    <div className="wconvert-sentence-box">
      <div className="wconvert-sentence-toolbar" role="group" aria-label={__('Text formatting', 'wconvert')}>
        {bold && <Button variant="ghost" size="xs" aria-pressed={!!strong} onMouseDown={e => e.preventDefault()} onClick={() => format('bold')}><Bold aria-hidden="true" />{__('Bold', 'wconvert')}</Button>}
        {italic && <Button variant="ghost" size="xs" aria-pressed={!!slanted} onMouseDown={e => e.preventDefault()} onClick={() => format('italic')}><Italic aria-hidden="true" />{__('Italic', 'wconvert')}</Button>}
        {link && <Button variant="ghost" size="xs" aria-pressed={!!anchor} onMouseDown={e => e.preventDefault()} onClick={() => format('link')}><Link2 aria-hidden="true" />{__('Link', 'wconvert')}</Button>}
        {anchor && <Button variant="ghost" size="icon-xs" aria-label={__('Remove link', 'wconvert')} onClick={() => { remove('link'); setEditingLink(false); }}><Unlink aria-hidden="true" /></Button>}
        <Button variant="ghost" size="icon-xs" className="wconvert-sentence-toolbar__end" aria-label={__('Clear formatting', 'wconvert')} disabled={sentence.marks.length === 0} onMouseDown={e => e.preventDefault()} onClick={() => {
          write({ ...sentence, marks: selected ? sentence.marks.filter(mark => mark.end <= selection.start || mark.start >= selection.end) : [] });
          setEditingLink(false);
        }}><RemoveFormatting aria-hidden="true" /></Button>
      </div>
      <AutoGrowTextarea id={id} ref={input} value={sentence.text} onKeyDown={event => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
        const kind = event.key.toLowerCase() === 'b' && bold ? 'bold' : event.key.toLowerCase() === 'i' && italic ? 'italic' : event.key.toLowerCase() === 'k' && link ? 'link' : null;
        if (kind) { event.preventDefault(); format(kind); }
      }} onSelect={e => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })} onChange={e => { setEditingLink(false); onChange(writeSentence(editSentence(sentence, e.target.value)), true); }} />
    </div>
    {notice && <p role="status" className="wconvert-panel-hint">{notice}</p>}
    {/* How it reads, set as one quiet line: the box above holds plain words. */}
    <p className="wconvert-sentence-preview" role="region" aria-label={__('Formatted text preview', 'wconvert')}>{preview}{sentence.text.slice(offset)}</p>
    {editingLink && <div className="wconvert-sentence-address">
      <label>{__('Link address', 'wconvert')}<LinkField value={address} onChange={setAddress} /></label>
      {policy && <PanelHint>{__('Empty uses your privacy policy.', 'wconvert')}</PanelHint>}
      <div><Button size="xs" onClick={() => { const range = selected ? selection : anchor; if (range) write(markSentence(sentence, { ...range, kind: 'link', href: address })); setEditingLink(false); }}>{__('Apply link', 'wconvert')}</Button><Button variant="ghost" size="xs" onClick={() => setEditingLink(false)}>{__('Cancel', 'wconvert')}</Button></div>
    </div>}
    {/* A linked phrase shows where it goes, without a press on Link first (ADR 0136). */}
    {anchor && !editingLink && <PanelField htmlFor={`${id}-href`}
      label={sprintf(/* translators: %s: the linked words, e.g. “Privacy Policy”. */ __('Link: “%s”', 'wconvert'), anchorWords)}
      hint={policy && !anchor.href ? __('Empty uses your privacy policy.', 'wconvert') : undefined}>
      <LinkField id={`${id}-href`} value={anchor.href ?? ''} onChange={href => onChange(writeSentence(markSentence(sentence, { ...anchor, href })), true)} />
    </PanelField>}
  </div>;
}
