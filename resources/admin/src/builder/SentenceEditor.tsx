import { useId, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Bold, Link2, Unlink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { editSentence, markSentence, readSentence, writeSentence, type SentenceValue } from './sentence';

/** A small selection toolbar, backed by the renderer's existing sentence model. */
export function SentenceEditor({ value, label, bold, link, onChange }: {
  value: SentenceValue; label: string; bold: boolean; link: boolean;
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
  const anchor = sentence.marks.find(mark => mark.kind === 'link');
  const write = (next: typeof sentence) => onChange(writeSentence(next), false);
  const remove = (kind: 'bold' | 'link') => write({ ...sentence, marks: sentence.marks.filter(mark => mark.kind !== kind) });
  const format = (kind: 'bold' | 'link') => {
    if (!selected) {
      if (kind === 'bold' && strong) { remove('bold'); return; }
      if (kind === 'link' && anchor) { setAddress(anchor.href ?? ''); setEditingLink(true); return; }
      setNotice(__('Select the words you want to format first.', 'wconvert'));
      input.current?.focus();
      return;
    }
    setNotice('');
    if (kind === 'link') { setAddress(anchor?.href ?? ''); setEditingLink(true); return; }
    write(markSentence(sentence, { kind, ...selection }));
  };
  let offset = 0;
  const preview = [...sentence.marks].sort((a, b) => a.start - b.start).map((mark, i) => {
    const before = sentence.text.slice(offset, mark.start);
    const words = sentence.text.slice(mark.start, mark.end);
    offset = mark.end;
    return <span key={i}>{before}{mark.kind === 'bold' ? <strong>{words}</strong> : <span className="wconvert-sentence-link">{words}</span>}</span>;
  });
  return <div className="wconvert-sentence-editor">
    <label htmlFor={id}>{label}</label>
    <div className="wconvert-sentence-box">
      <div className="wconvert-sentence-toolbar" role="group" aria-label={__('Text formatting', 'wconvert')}>
        {bold && <Button variant="ghost" size="xs" aria-pressed={!!strong} onMouseDown={e => e.preventDefault()} onClick={() => format('bold')}><Bold aria-hidden="true" />{__('Bold', 'wconvert')}</Button>}
        {link && <Button variant="ghost" size="xs" aria-pressed={!!anchor} onMouseDown={e => e.preventDefault()} onClick={() => format('link')}><Link2 aria-hidden="true" />{__('Link', 'wconvert')}</Button>}
        {anchor && <Button variant="ghost" size="icon-xs" aria-label={__('Remove link', 'wconvert')} onClick={() => { remove('link'); setEditingLink(false); }}><Unlink aria-hidden="true" /></Button>}
      </div>
      <textarea id={id} ref={input} rows={4} value={sentence.text} onSelect={e => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })} onChange={e => { setEditingLink(false); onChange(writeSentence(editSentence(sentence, e.target.value)), true); }} />
    </div>
    <p className="description">{__('Select words, then choose Bold or Link. One bold phrase and one link per text element.', 'wconvert')}</p>
    {notice && <p role="status">{notice}</p>}
    {editingLink && <div className="wconvert-sentence-address">
      <label>{__('Link address', 'wconvert')}<input type="url" value={address} onChange={e => setAddress(e.target.value)} placeholder="https://" /></label>
      <p className="description">{__('Leave empty to use your site’s privacy policy.', 'wconvert')}</p>
      <div><Button size="xs" onClick={() => { const range = selected ? selection : anchor; if (range) write(markSentence(sentence, { ...range, kind: 'link', href: address })); setEditingLink(false); }}>{__('Apply link', 'wconvert')}</Button><Button variant="ghost" size="xs" onClick={() => setEditingLink(false)}>{__('Cancel', 'wconvert')}</Button></div>
    </div>}
    <div className="wconvert-sentence-preview" role="region" aria-label={__('Formatted text preview', 'wconvert')}>{preview}{sentence.text.slice(offset)}</div>
  </div>;
}
