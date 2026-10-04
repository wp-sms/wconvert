import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { readDestinations, type DestinationsPayload } from '../destinations/api';
import { issueCount } from '../destinations/issueCount';
import { sendingIssuesHref } from '../nav';
import { Region, RegionHeader, RegionBody } from '../shell/Region';
import { Button } from '../components/ui/button';
/** Current operational evidence stays separate from historical performance windows. */
export function DeliveryAttention() {
  const [data, setData] = useState<DestinationsPayload>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void readDestinations().then(value => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  if (failed) return <p className="wa-muted">{__('Current sending health is unavailable.', 'wconvert')} <a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a></p>;
  if (!data || issueCount(data) === 0) return null;
  const affected = data.destinations.filter(d => d.health.consecutive_failures > 0 || d.health.skipped_captures > 0 || d.availability !== 'ready' || data.failures.some(f => f.destination === d.id));
  return <Region><RegionHeader title={__('Sending needs attention', 'wconvert')} description={__('Current health and retained failures, independent of the report dates.', 'wconvert')} /><RegionBody>
    <p>{sprintf(__('%d destinations have known sending issues. Captured submissions are not proof of delivery.', 'wconvert'), issueCount(data))}</p>
    <details><summary>{__('View evidence', 'wconvert')}</summary><ul>{affected.map(d => <li key={d.id}>{d.label} · {d.health.last_error_at ?? d.health.last_skipped_at ?? data.failures.find(f => f.destination === d.id)?.at ?? __('Setup needs review', 'wconvert')}</li>)}</ul></details>
    <Button variant="outline" asChild><a href={sendingIssuesHref()}>{__('Review sending issues', 'wconvert')}</a></Button>
  </RegionBody></Region>;
}
