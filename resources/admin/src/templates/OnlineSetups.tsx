import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState } from '../shell/EmptyState';
import { RegionError } from '../shell/Region';
import { LOADING, failed, messageOf, ready, type Loadable } from '../shell/loadable';
import { displayTypeLabel } from '../displayTypes';
import { LibraryConsent } from './LibraryConsent';
import { catalogStatus, installSetup, refreshCatalog, type CatalogStatus } from './catalog';
import { Library } from 'lucide-react';

/**
 * Hosted campaign setups for one Goal (ADR 0156). Installing one brings its
 * words, rules, the exact design revision it pins and that design's images;
 * it then joins the setups above like any other. Nothing installs by itself.
 *
 * A setup this site cannot run is left out rather than drawn locked: creation
 * hides what it cannot start (ADR 0026, ADR 0116).
 */
export function OnlineSetups({ goal, onInstalled, onLibraryChanged }: { goal: string; onInstalled: () => void; onLibraryChanged?: () => void }) {
  const [status, setStatus] = useState<Loadable<CatalogStatus>>(LOADING);
  const [retry, setRetry] = useState(0);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setStatus(LOADING);
    void catalogStatus().then(async (first) => first.consent === 'yes' ? refreshCatalog(true).catch(() => first) : first)
      .then((value) => { if (current) { setStatus(ready(value)); onLibraryChanged?.(); } })
      .catch((cause: unknown) => { if (current) setStatus(failed(cause)); });
    return () => { current = false; };
  }, [retry, onLibraryChanged]);
  if (status.status === 'loading') return <p className="text-note">{__('Loading online setups…', 'wconvert')}</p>;
  if (status.status === 'failed') return <RegionError message={status.message} onRetry={() => setRetry((value) => value + 1)} />;
  if (!status.data.enabled) return <p className="text-note">{__('The online template library is switched off on this site.', 'wconvert')}</p>;
  if (status.data.consent !== 'yes') return <LibraryConsent onAnswered={() => setRetry((value) => value + 1)} />;
  const formats = new Map(status.data.designs.map((design) => [design.id, design.format]));
  const setups = status.data.setups.filter((setup) => setup.goal === goal && ['install', 'ready'].includes(setup.state));
  const add = async (id: string, sha256: string) => {
    setInstalling(id); setError(null);
    try { const installed = await installSetup(id, sha256); setStatus(ready(installed.status)); onInstalled(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setInstalling(null); }
  };
  return <div className="flex flex-col gap-3">
    {status.data.update_required && <p className="m-0 text-note">{__('Update WConvert to see new designs from the online library.', 'wconvert')}</p>}
    {error && <RegionError message={error} onRetry={() => setError(null)} />}
    {setups.length === 0 ? <EmptyState icon={Library} title={__('No online setups for this goal yet', 'wconvert')}>
      {__('The setups above are everything available for this goal right now.', 'wconvert')}
    </EmptyState> : <ul className="wconvert-online-setups">
      {setups.map((setup) => <li key={setup.id} className="wconvert-online-setups__row">
        <span className="font-semibold"><bdi>{setup.name}</bdi></span>
        <Badge variant="outline">{displayTypeLabel(formats.get(setup.design.id) ?? 'popup')}</Badge>
        {setup.state === 'ready' ? <span className="text-note text-muted-foreground">{__('In your library', 'wconvert')}</span>
          : <Button variant="outline" disabled={installing !== null} onClick={() => { void add(setup.id, setup.sha256); }}>
            {installing === setup.id ? __('Adding…', 'wconvert') : __('Add to my setups', 'wconvert')}
          </Button>}
      </li>)}
    </ul>}
  </div>;
}
