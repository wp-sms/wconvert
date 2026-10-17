import { useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { NativeSelect } from '../components/ui/native-select';
import type { Occasion } from '../discovery/api';
import { readOccasions } from './api';

/**
 * Which occasion this campaign belongs to, in the editor's Campaign details
 * (#276). Choosing one moves none of its dates: only a campaign created
 * inside an occasion starts with them (ADR 0149 §3). None takes it out.
 *
 * Drawn only once the site has an occasion, as the list's filter is.
 */
export function CampaignOccasion({ value, onChange }: { value: string | undefined; onChange: (occasion: string | undefined) => void }) {
  const id = useId();
  const [occasions, setOccasions] = useState<Occasion[] | null>(null);
  useEffect(() => {
    let active = true;
    readOccasions().then((data) => { if (active) setOccasions(data.items); }, () => { if (active) setOccasions([]); });
    return () => { active = false; };
  }, []);
  if (occasions === null || occasions.length === 0) return null;
  return (
    <div className="wconvert-details-section">
      <h3 id={`${id}-title`}>{__('Occasion', 'wconvert')}</h3>
      <NativeSelect aria-labelledby={`${id}-title`} value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">{__('None', 'wconvert')}</option>
        {occasions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </NativeSelect>
    </div>
  );
}
