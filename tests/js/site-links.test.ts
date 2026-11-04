import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { expect, it } from 'vitest';
import { docsUrl, docsSearchUrl, taggedUrl, GUIDES } from '../../resources/admin/src/shell/docs';
import { proDocsUrl } from '../../pro/resources/admin/src/docs';

/**
 * Links to our own sites (ADR 0189): one scheme, and no way round it. Everything
 * shipped reaches wconvert.io and veronalabs.com through the helpers, so a link
 * written by hand fails here rather than arriving with no source.
 */
const ROOT = join(import.meta.dirname, '../..');
const SHIPPED = ['src', 'resources', 'pro/src', 'pro/modules', 'pro/resources', 'wconvert.php', 'pro/wconvert-pro.php'];
const SCANNED = new Set(['.php', '.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css']);
const SKIPPED = new Set(['languages', 'node_modules', 'vendor', 'dist']);

/** The two files that may write any of our addresses. */
const HELPERS = new Set(['resources/admin/src/shell/docs.ts', 'src/Support/Docs.php']);

/** What stays untagged and where: plugin headers, the account server, API addresses. */
const EXEMPT: Readonly<Record<string, readonly string[]>> = {
  'wconvert.php': ['https://wconvert.io/', 'https://veronalabs.com/'],
  'pro/wconvert-pro.php': ['https://wconvert.io/pricing/', 'https://veronalabs.com/'],
  'resources/admin/src/shell/HeaderTools.tsx': ['https://my.wconvert.io/account/downloads'],
  'pro/src/License/SdkConfig.php': ['https://my.wconvert.io'],
  'src/Template/Catalog/TemplateCatalog.php': ['https://templates.wconvert.io'],
};

/** The readme's legal and service lines. Every other link there carries the readme's own tags. */
const README_EXEMPT: readonly string[] = ['https://my.wconvert.io', 'https://wconvert.io/terms/', 'https://wconvert.io/privacy/'];

/** Our addresses in a file's text, JSON's `\/` and scheme-relative ones included; a bare domain in prose is no link. */
const ourAddresses = (text: string): string[] =>
  [...text.matchAll(/(?:https?:)?\\?\/\\?\/(?:[\w-]+\.)*(?:wconvert\.io|veronalabs\.com)[^\s'"`)<>\]]*/g)].map(([address]) => address.replaceAll('\\/', '/'));

function shippedFiles(path: string): string[] {
  if (extname(path)) return [path];
  const full = join(ROOT, path);
  return readdirSync(full, { withFileTypes: true }).flatMap(entry => {
    const child = relative(ROOT, join(full, entry.name));
    if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : shippedFiles(child);
    return SCANNED.has(extname(entry.name)) ? [child] : [];
  });
}

const FILES = SHIPPED.flatMap(shippedFiles);

const FREE_GUIDE = 'utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=guide';

it('tags an address with the four fixed tags', () => {
  expect(taggedUrl('https://wconvert.io/', 'footer')).toBe('https://wconvert.io/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-free&utm_content=footer');
  expect(taggedUrl('https://wconvert.io/', 'license', 'wconvert-pro')).toBe('https://wconvert.io/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-pro&utm_content=license');
});

it('puts the tags before a section, where the browser still sends them', () => {
  const url = new URL(docsUrl(GUIDES.retention, 'choose-policy'));
  expect(url.hash).toBe('#choose-policy');
  expect(url.search).toBe(`?${FREE_GUIDE}`);
  expect(url.pathname).toBe('/docs/set-submission-retention/');
});

it('keeps a query the address already has', () => {
  const url = new URL(docsSearchUrl('a&b'));
  expect(url.searchParams.get('q')).toBe('a&b');
  expect(url.searchParams.get('utm_content')).toBe('help-search');
});

it('names the plugin that owns the link', () => {
  expect(docsUrl(GUIDES.update)).toContain('utm_campaign=wconvert-free');
  expect(proDocsUrl(GUIDES.update, 'update-the-files')).toBe('https://wconvert.io/docs/update-wconvert/?utm_source=wp-admin&utm_medium=plugin&utm_campaign=wconvert-pro&utm_content=guide#update-the-files');
});

it('finds a link written by hand, in code or in JSON, and not a domain in prose', () => {
  expect(ourAddresses(`href="https://wconvert.io/pricing/"`)).toEqual(['https://wconvert.io/pricing/']);
  expect(ourAddresses(`{"url":"https:\\/\\/my.wconvert.io\\/a"}`)).toEqual(['https://my.wconvert.io/a']);
  expect(ourAddresses(`const a = 'http://veronalabs.com/x?y=1';`)).toEqual(['http://veronalabs.com/x?y=1']);
  expect(ourAddresses(`src="//wconvert.io/a.js"`)).toEqual(['//wconvert.io/a.js']);
  expect(ourAddresses('// the docs live on wconvert.io')).toEqual([]);
  expect(ourAddresses(`const a = 'https://notwconvert.io/';`)).toEqual([]);
});

it('writes our addresses only in the helpers and the exempt list', () => {
  expect(FILES).toContain('resources/admin/src/shell/Footer.tsx');
  expect(FILES).toContain('pro/modules/destinations/src/WebhookDestinationType.php');

  const handWritten = FILES.filter(file => !HELPERS.has(file)).flatMap(file => {
    const allowed = EXEMPT[file] ?? [];
    return ourAddresses(readFileSync(join(ROOT, file), 'utf8')).filter(address => !allowed.includes(address)).map(address => `${file}: ${address}`);
  });

  expect(handWritten).toEqual([]);
});

it('tags every link in the readme with the readme’s own scheme, bar its legal and service lines', () => {
  const untagged = ourAddresses(readFileSync(join(ROOT, 'readme.txt'), 'utf8'))
    .filter(address => !README_EXEMPT.includes(address) && !/\?utm_source=wordpress\.org&utm_medium=plugin-directory&utm_campaign=wconvert-free&utm_content=[a-z-]+$/.test(address));
  expect(untagged).toEqual([]);
});

it('keeps the exempt list true, so it cannot quietly outlive the links it allows', () => {
  for (const [file, addresses] of Object.entries(EXEMPT)) {
    expect(ourAddresses(readFileSync(join(ROOT, file), 'utf8'))).toEqual(expect.arrayContaining([...addresses]));
  }
});

it('sends Pro’s own screens through proDocsUrl, so their guides say wconvert-pro', () => {
  const wrapper = 'pro/resources/admin/src/docs.ts';
  const bypasses = FILES.filter(file => file.startsWith('pro/') && file !== wrapper && /\.tsx?$/.test(file))
    .filter(file => /import\s*\{[^}]*\bdocsUrl\b[^}]*\}\s*from\s*'[^']*shell\/docs'/.test(readFileSync(join(ROOT, file), 'utf8')));
  expect(bypasses).toEqual([]);
});
