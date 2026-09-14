import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
 * So this dialog's entire job is to feed `window.location`. There is no route
 * behind it, nothing is posted, and no answer comes back here — the answer is
 * on the page the merchant lands on, computed by the request that served it.
 *
 * The admin bar carries the other door, and it has to ask nothing at all
 * because the merchant is already on the page they are wondering about.
 */
export function InspectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const settings = adminSettings();
  const [url, setUrl] = useState('');

  // Prefilled with the site root rather than left blank, so the commonest
  // answer — "the home page" — is one click. `home_url()` rather than
  // `location.origin`, because a subdirectory install lands on the site rather
  // than on the domain root: `/blog/pricing` versus `/pricing` is what half
  // the real Targeting confusion is about.
  useEffect(() => {
    if (open) {
      setUrl(settings?.homeUrl ?? '');
    }
  }, [open, settings?.homeUrl]);

  const go = () => {
    const param = settings?.inspectParam;

    if (url === '' || param === undefined) {
      return;
    }

    // Built with `URL` so a page that already carries a query string keeps it
    // — a merchant asking about `/shop?filter=sale` is asking about that page,
    // and appending with a `?` would produce a different one.
    try {
      const target = new URL(url, settings?.homeUrl);

      target.searchParams.set(param, '1');
      window.location.assign(target.toString());
    } catch {
      // A URL this browser will not parse is one we cannot navigate to. The
      // field stays as the merchant typed it rather than being cleared, so
      // they can fix it rather than start again.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{__('Why did nothing show?', 'wconvert')}</DialogTitle>
          <DialogDescription>
            {__(
              'Open a page on your site and WConvert will explain, for every Campaign, exactly where it stopped.',
              'wconvert',
            )}
          </DialogDescription>
        </DialogHeader>

        <p>
          <Label htmlFor="wconvert-inspect-url">{__('Page to open', 'wconvert')}</Label>{' '}
          <Input
            id="wconvert-inspect-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                go();
              }
            }}
          />
        </p>

        {/*
          **The cache sentence belongs HERE, not in the panel.** `DONOTCACHEPAGE`
          is set during PHP, and a full-page cache holding a file for that URL
          answers before PHP runs at all — so the symptom of the case this
          warns about is that no panel appears, and a warning inside the panel
          would be one nobody could read.
        */}
        <p className="text-muted-foreground">{__(
          'If neither the panel nor the admin bar appears, a cache is serving that page before WordPress runs.',
          'wconvert',
        )}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {__('Cancel', 'wconvert')}
          </Button>
          <Button onClick={go} disabled={url === ''}>
            {__('Open the page', 'wconvert')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
