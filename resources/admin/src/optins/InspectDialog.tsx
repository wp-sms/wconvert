import { useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
  AdminDialog,
  AdminDialogBody,
  AdminDialogClose,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
} from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Field } from '../shell/Field';
import { adminSettings } from '../settings';

/**
 * *Which page?* — the one question the Optin list has to ask before it can
 * open the eligibility inspector.
 *
 * ============================================================================
 * IT ASKS FOR A PAGE AND THEN GOES THERE. IT NEVER EVALUATES ONE.
 * ============================================================================
 * The whole design of the inspector is that a merchant does not DESCRIBE a
 * URL, they VISIT it: a `RequestContext` cannot honestly be built from a URL,
 * because `url_to_postid()` returns 0 for archives, terms, the blog index and
 * the shop page, and a loopback breaks on staging and on basic auth and cannot
 * render the signed-out variant from a signed-in session (ADR 0048).
 *
 * So this dialog's entire job is to open that page with the inspector on.
 * There is no route behind it, nothing is posted, and no answer comes back
 * here — the answer is on the page the merchant lands on, computed by the
 * request that served it. It opens in a new tab, so the admin they came from
 * stays where it was.
 *
 * The admin bar carries the other door, and it has to ask nothing at all
 * because the merchant is already on the page they are wondering about.
 */
export function InspectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const settings = adminSettings();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const field = useId();

  // Prefilled with the site root rather than left blank, so the commonest
  // answer — "the home page" — is one click. `home_url()` rather than
  // `location.origin`, because a subdirectory install lands on the site rather
  // than on the domain root: `/blog/pricing` versus `/pricing` is what half
  // the real Targeting confusion is about.
  useEffect(() => {
    if (open) {
      setUrl(settings?.homeUrl ?? '');
      setError(null);
    }
  }, [open, settings?.homeUrl]);

  const go = () => {
    const param = settings?.inspectParam;

    if (url.trim() === '') {
      return;
    }
    if (param === undefined) {
      setError(__('Visibility checks aren’t available on this site.', 'wconvert'));
      return;
    }

    // Built with `URL` so a page that already carries a query string keeps it
    // — a merchant asking about `/shop?filter=sale` is asking about that page,
    // and appending with a `?` would produce a different one.
    let target: URL;
    try {
      target = new URL(url.trim(), settings?.homeUrl);
    } catch {
      // The field keeps what the merchant typed, so they can fix it rather
      // than start again — and it says so, rather than doing nothing.
      setError(__('Enter a full page address, like https://example.com/shop.', 'wconvert'));
      return;
    }
    target.searchParams.set(param, '1');
    window.open(target.toString(), '_blank', 'noopener');
    onOpenChange(false);
  };

  return (
    <AdminDialog open={open} onOpenChange={onOpenChange}>
      {/* Typed past the prefilled home page is worth asking about (ADR 0131). */}
      <AdminDialogContent size="sm" dirty={url !== (settings?.homeUrl ?? '')}>
        <AdminDialogHeader
          title={__('Check visibility', 'wconvert')}
          meta={__('Open a page on your site to see why each campaign did or didn’t show there.', 'wconvert')}
        />
        <AdminDialogBody>
          <form
            id={`${field}-form`}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              go();
            }}
          >
            <Field
              label={__('Page to open', 'wconvert')}
              htmlFor={field}
              hintId={`${field}-hint`}
              /*
                **The cache sentence belongs HERE, not in the panel.**
                `DONOTCACHEPAGE` is set during PHP, and a full-page cache
                holding a file for that URL answers before PHP runs at all — so
                the symptom of the case this warns about is that no panel
                appears, and a warning inside the panel would be one nobody
                could read.
              */
              hint={__('If no explanation panel or admin bar appears there, a cache is serving that page before WordPress runs.', 'wconvert')}
              error={error}
            >
              <Input
                id={field}
                type="url"
                dir="ltr"
                value={url}
                aria-describedby={`${field}-hint`}
                aria-invalid={error !== null || undefined}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError(null);
                }}
              />
            </Field>
          </form>
        </AdminDialogBody>
        <AdminDialogFooter
          back={
            <AdminDialogClose asChild>
              <Button type="button" variant="outline">{__('Cancel', 'wconvert')}</Button>
            </AdminDialogClose>
          }
          note={__('Opens in a new tab.', 'wconvert')}
        >
          <Button type="submit" form={`${field}-form`} disabled={url.trim() === ''}>
            {__('Open the page', 'wconvert')}
          </Button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  );
}
