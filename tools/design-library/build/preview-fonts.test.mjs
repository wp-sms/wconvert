import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewFonts } from './preview-fonts.mjs';

test('preview fonts are local, declared, deduplicated faces only', () => {
  const design = { tree: { fonts: [{ family: 'DM Sans', faces: [{ weight: 400 }, { weight: 700 }] }] } };
  const css = previewFonts([design, design]);
  assert.equal((css.match(/@font-face/g) ?? []).length, 2);
  assert.match(css, /data:font\/ttf;base64,/);
  assert.doesNotMatch(css, /https?:|Instrument Serif/);
  assert.equal(previewFonts([{}]), '');
  assert.equal(previewFonts([{ tree: { fonts: [{ family: 'Unknown font', faces: [{ weight: 400 }] }] } }]), '');
});
