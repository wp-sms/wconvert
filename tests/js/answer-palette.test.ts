import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Answer colors are measured, not estimated (GUIDELINES §5, ADR 0142). A line
 * is information a merchant needs to tell one answer from another, so it owes
 * 3:1 against whatever it crosses; a pill's label is text and owes 4.5:1.
 */
const css = readFileSync(resolve(__dirname, '../../resources/admin/src/index.css'), 'utf8');
const token = (name: string) => {
  const found = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(css);
  if (!found) throw new Error(`--${name} is not a hex color`);
  return found[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

describe('the answer palette', () => {
  const answers = [1, 2, 3, 4, 5, 6].map(slot => ({ slot, line: token(`answer-${slot}`), surface: token(`answer-${slot}-surface`) }));

  it.each(answers)('answer $slot draws a line that reads on the card, the canvas and the surface tint', ({ line }) => {
    for (const ground of [token('card'), token('background'), token('surface')]) expect(contrast(line, ground)).toBeGreaterThanOrEqual(3);
  });

  it.each(answers)('answer $slot labels a pill at 4.5:1 on white, and its surface carries espresso text', ({ line, surface }) => {
    expect(contrast(line, token('card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('foreground'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['question', 'message', 'form', 'result', 'ending'])('the %s tile’s icon reads on its surface', kind => {
    expect(contrast(token(`kind-${kind}`), token(`kind-${kind}-surface`))).toBeGreaterThanOrEqual(3);
  });

  it('is six distinct colors, none of them the chart ramp or the problem red', () => {
    const lines = answers.map(answer => answer.line.toLowerCase());
    expect(new Set(lines).size).toBe(6);
    const reserved = [token('destructive'), token('action'), ...[2, 3, 4, 5].map(slot => token(`chart-${slot}`))].map(hex => hex.toLowerCase());
    expect(lines.filter(line => reserved.includes(line))).toEqual([]);
  });
});
