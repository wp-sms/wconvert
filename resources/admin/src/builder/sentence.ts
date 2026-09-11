export interface Mark { kind: 'bold' | 'italic' | 'link'; start: number; end: number; href?: string }
export interface Sentence { text: string; marks: Mark[] }
export interface SentenceValue { text: string; emphasis?: string; italic?: string; link?: { label: string; href?: string } }

/** The editor presents words; the renderer continues to receive structured values. */
export function readSentence(value: SentenceValue): Sentence {
  let text = '';
  const marks: Mark[] = [];
  for (const part of value.text.split(/(%b|%i|%s)/)) {
    const words = part === '%b' ? value.emphasis ?? '' : part === '%i' ? value.italic ?? '' : part === '%s' ? value.link?.label ?? '' : part;
    if ((part === '%b' || part === '%i' || part === '%s') && words) marks.push({ kind: part === '%b' ? 'bold' : part === '%i' ? 'italic' : 'link', start: text.length, end: text.length + words.length, ...(part === '%s' ? { href: value.link?.href } : {}) });
    text += words;
  }
  return { text, marks };
}

export function writeSentence(sentence: Sentence): SentenceValue {
  let at = 0;
  const value: SentenceValue = { text: '' };
  for (const mark of [...sentence.marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < at || mark.end <= mark.start) continue;
    const words = sentence.text.slice(mark.start, mark.end);
    value.text += sentence.text.slice(at, mark.start) + (mark.kind === 'bold' ? '%b' : mark.kind === 'italic' ? '%i' : '%s');
    if (mark.kind === 'bold') value.emphasis = words;
    else if (mark.kind === 'italic') value.italic = words;
    else value.link = { label: words, ...(mark.href ? { href: mark.href } : {}) };
    at = mark.end;
  }
  value.text += sentence.text.slice(at);
  return value;
}

/** Map selections across one text edit. Edits wholly within a mark retain it. */
export function editSentence(sentence: Sentence, text: string): Sentence {
  let start = 0;
  while (start < sentence.text.length && start < text.length && sentence.text[start] === text[start]) start++;
  let oldEnd = sentence.text.length, newEnd = text.length;
  while (oldEnd > start && newEnd > start && sentence.text[oldEnd - 1] === text[newEnd - 1]) { oldEnd--; newEnd--; }
  const delta = newEnd - oldEnd;
  const marks = sentence.marks.flatMap(mark => {
    if (mark.end <= start) return [mark];
    if (mark.start >= oldEnd) return [{ ...mark, start: mark.start + delta, end: mark.end + delta }];
    if (mark.start <= start && mark.end >= oldEnd && mark.end + delta > mark.start) return [{ ...mark, end: mark.end + delta }];
    return [];
  });
  return { text, marks };
}

/** One phrase per kind; an overlapping new selection replaces that mark. */
export function markSentence(sentence: Sentence, mark: Mark): Sentence {
  if (mark.end <= mark.start) return sentence;
  return { ...sentence, marks: [...sentence.marks.filter(m => m.kind !== mark.kind && (m.end <= mark.start || m.start >= mark.end)), mark] };
}
