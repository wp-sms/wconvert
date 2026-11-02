#!/usr/bin/env node
//
// template-words.mjs — the lists a site reads its design and setup words from.
//
//     npm run templates:words            sync each language's .po, write its lists
//     npm run templates:words -- --check fail where one is out of date or incomplete
//
// A design's and a setup's words reach another language by one generated list
// per language, "English" => "translation" (ADR 0183). `WConvert\Template\DesignWords`
// reads the lists and says which keys are words; this asks it for them through
// `export-designs.php`, so the two can never disagree about what is a word.
//
//   tools/design-library/translations/<locale>.po   the source, which never ships
//   resources/templates/words/<locale>.json         Free's designs and setups
//   pro/resources/templates/words/<locale>.json     Pro's, and the paid online setups
//   */resources/templates/words/labels/<locale>.json  the words the popup writes itself
//
// The online library's public list is built from the same .po when a release is
// published (`publish-local.mjs`, `publicWords` below). A word missing from it costs
// its object's translation rather than an English word in a German popup, so it is
// reported rather than refused.
//
// To add a language: create an empty <locale>.po, run this, translate what it
// wrote. No code changes. Generated lists are never edited by hand.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePot } from './pot-coverage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'tools/design-library/translations';

// Each set's words reach sites from its ZIP, so every one must be translated: a
// list is applied a word at a time, and a gap is an English word in a German popup.
const SETS = [
  { name: 'free', out: 'resources/templates/words' },
  { name: 'pro', out: 'pro/resources/templates/words' },
  // Small on purpose: these are read on visitor pages, the lists above never are.
  { name: 'labels', out: 'resources/templates/words/labels' },
  { name: 'pro-labels', out: 'pro/resources/templates/words/labels' },
];

const quote = text => JSON.stringify(text);

/** One locale's .po. Sorted by first use, so a design's words stay together for a translator. */
export function poFile(locale, words, translated) {
  const entries = Object.entries(words)
    .sort(([a, x], [b, y]) => x.refs[0].localeCompare(y.refs[0]) || a.localeCompare(b))
    .map(([english, { kind, limit, refs }]) => [
      `#. ${kind}${limit < 2000 ? `, at most ${limit} bytes` : ''}`,
      `#: ${[...new Set(refs)].slice(0, 3).join(' ')}`,
      `msgid ${quote(english)}`,
      `msgstr ${quote(translated.get(english) ?? '')}`,
    ].join('\n'));
  return [
    'msgid ""',
    'msgstr ""',
    `"Language: ${locale}\\n"`,
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '"X-Generator: bin/template-words.mjs\\n"',
    '',
    entries.join('\n\n'),
    '',
  ].join('\n');
}

/** The translations a .po holds, by English. An empty msgstr is not one. */
export function readPo(text) {
  const translated = new Map();
  for (const [key, entry] of parsePot(text)) {
    if (entry.msgstr !== '') translated.set(key.slice(1), entry.msgstr); // No context: the key is its separator, then the msgid.
  }
  return translated;
}

/** A list's file: one pair to a line, so a changed word is a one-line diff. */
export function wordsFile(words, translated) {
  const pairs = Object.keys(words).sort().filter(english => translated.has(english))
    .map(english => `${quote(english)}:${quote(translated.get(english))}`);
  return `{\n${pairs.join(',\n')}\n}\n`;
}

/**
 * Every language's translations of a release's public words, and how many it lacks.
 *
 * @param english what `export-designs.php`'s release-words mode says the release holds
 * @param root where the sources are
 */
export function publicWords(english, root = ROOT) {
  const words = {}, missing = {}, all = {};
  const sourceDir = join(root, SOURCE);
  for (const file of existsSync(sourceDir) ? readdirSync(sourceDir).filter(name => name.endsWith('.po')).sort() : []) {
    const locale = file.slice(0, -3);
    const translated = readPo(readFileSync(join(sourceDir, file), 'utf8'));
    words[locale] = Object.fromEntries(english.filter(word => translated.has(word)).map(word => [word, translated.get(word)]));
    missing[locale] = english.filter(word => !translated.has(word)).length;
    all[locale] = Object.fromEntries(translated);
  }
  return { words, missing, all };
}

function inventory(translations) {
  return JSON.parse(execFileSync('php', [join(ROOT, 'tools/design-library/build/export-designs.php'), ROOT], {
    input: JSON.stringify({ mode: 'words', translations }), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  }));
}

function main() {
  const check = process.argv.includes('--check');
  const sourceDir = join(ROOT, SOURCE);
  const locales = existsSync(sourceDir) ? readdirSync(sourceDir).filter(file => file.endsWith('.po')).map(file => file.slice(0, -3)).sort() : [];
  const held = new Map(locales.map(locale => [locale, readPo(readFileSync(join(sourceDir, `${locale}.po`), 'utf8'))]));
  const { sets, refused } = inventory(Object.fromEntries([...held].map(([locale, translated]) => [locale, Object.fromEntries(translated)])));
  const everyWord = {};
  for (const words of Object.values(sets)) {
    for (const [english, word] of Object.entries(words)) {
      const known = everyWord[english];
      everyWord[english] = known
        ? { kind: known.kind, limit: Math.min(known.limit, word.limit), refs: [...known.refs, ...word.refs] }
        : word;
    }
  }

  const problems = [];
  const write = (path, content) => {
    const full = join(ROOT, path);
    if (check) {
      if (!existsSync(full) || readFileSync(full, 'utf8') !== content) problems.push(`${path} is out of date — run npm run templates:words`);
    } else {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
      console.log(`  ${path}`);
    }
  };

  for (const [locale, translated] of held) {
    const known = new Map([...translated].filter(([english]) => english in everyWord));
    write(`${SOURCE}/${locale}.po`, poFile(locale, everyWord, known));
    for (const row of refused[locale] ?? []) {
      if (row.english in everyWord) problems.push(`${locale}: “${row.english}” — ${row.reason}`);
    }
    const refusedWords = new Set((refused[locale] ?? []).map(row => row.english));
    const usable = new Map([...known].filter(([english]) => !refusedWords.has(english)));
    for (const { name, out } of SETS) {
      const missing = Object.keys(sets[name]).filter(english => !known.has(english));
      if (missing.length) problems.push(`${locale}: ${missing.length} of ${name}'s words are untranslated, for example “${missing[0]}”`);
      write(`${out}/${locale}.json`, wordsFile(sets[name], usable));
    }
  }

  if (problems.length) {
    console.error(problems.map(line => `✗ ${line}`).join('\n'));
    process.exit(1);
  }
  if (check) console.log(`✓ template words are current for ${locales.join(', ') || 'no language yet'}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
