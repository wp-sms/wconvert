import { AnalyticsIntegrationSettings } from '../analyticsIntegration';
import { isFreeInstall } from '../goals/availability';
import { MoreWithPro } from './MoreWithPro';
import { useEffect, useState } from 'react';
import './settings.css';
import { __ } from '@wordpress/i18n';
import { Eye, Plug, Search, Shield } from 'lucide-react';
import { Input } from '../components/ui/input';
import { settingsHref, type SettingsGroup } from '../nav';
import { SiteAllowance } from '../optins/SiteAllowance';
import { SpamProtection } from './SpamProtection';
import { SitePhoneCountry } from './SitePhoneCountry';
import { LeadRetention } from '../leads/LeadRetention';
import { PrivacyDataMap } from '../privacy/PrivacyDataMap';
import { PrivacyGuidanceSettings } from '../privacy/PrivacyGuidanceSettings';
import { Destinations } from '../destinations/Destinations';
import type { SettingsEditing } from './useSettingsEditing';
import type { EditingState } from '../hooks/useAdminNavigation';
import { Region, RegionBody, RegionHeader } from '../shell/Region';

/** A persistent category rail; the chosen category goes straight to its controls. */
export function Settings({
  group: asked,
  destinationId,
  onEditingStateChange,
}: {
  group: SettingsGroup;
  destinationId?: string;
  onEditingStateChange?: SettingsEditing;
}) {
  const [search, setSearch] = useState('');
  // Analytics integrations arrive with Pro; a free install has no such page
  // to open (ADR 0116), so a deep link lands on the default group.
  const free = isFreeInstall();
  const group = free && asked === 'integrations' ? 'experience' : asked;
  const categories = [
    { id: 'integrations', label: __('Analytics integrations', 'wconvert'), description: __('Google Analytics, GTM and Plausible', 'wconvert'), icon: Plug, terms: 'GA4 GTM Plausible analytics tracking consent' },
    { id: 'protection', label: __('Spam protection', 'wconvert'), description: __('Bot verification and form filters', 'wconvert'), icon: Shield, terms: __('spam captcha turnstile recaptcha hcaptcha bot protection filters', 'wconvert') },
    {
      id: 'experience',
      label: __('Visitor experience', 'wconvert'),
      description: __('Site-wide display and phone settings', 'wconvert'),
      icon: Eye,
      terms: __('frequency appearances wait close conversion timing phone country', 'wconvert'),
    },
    {
      id: 'connections',
      label: __('Connections & destinations', 'wconvert'),
      description: __('Accounts and where leads go', 'wconvert'),
      icon: Plug,
      terms: __('email sending account provider list credentials', 'wconvert'),
    },
    {
      id: 'data',
      label: __('Data & privacy', 'wconvert'),
      description: __('Retention and personal data', 'wconvert'),
      icon: Shield,
      terms: __('retention delete export erase personal data privacy guidance notice consent campaign editor policy', 'wconvert'),
    },
  ] as const;
  const matching = categories.filter((category) => !(free && category.id === 'integrations')).filter((category) => search.trim().toLocaleLowerCase().split(/\s+/).every((word) => `${category.label} ${category.description} ${category.terms}`.toLocaleLowerCase().includes(word)));
  return (
    <div className="wconvert-settings grid min-w-0 items-start gap-7 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav
        aria-label={__('Settings categories', 'wconvert')}
        className="rounded-md border border-border bg-card p-3"
      >
        <div className="relative mb-3"><Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input className="ps-9" type="search" aria-label={__('Find a setting', 'wconvert')} placeholder={__('Find a setting…', 'wconvert')} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {matching.map(({ id, label, description, icon: Icon }) => (
          <a
            key={id}
            href={settingsHref(id)}
            aria-current={id === group ? 'page' : undefined}
            className={`flex gap-3 rounded-sm p-3 focus-visible:outline-2 focus-visible:outline-ring ${id === group ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted'}`}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              <span className="mt-1 block text-note text-muted-foreground">
                {description}
              </span>
            </span>
          </a>
        ))}
        {matching.length === 0 && <p role="status" className="px-3 text-note text-muted-foreground">{__('No settings match. Try “retention” or “email”.', 'wconvert')}</p>}
        <p className="mb-1 mt-5 border-t border-border px-3 pt-4 text-note text-muted-foreground">{__('Need a campaign’s design, timing or audience?', 'wconvert')} <a href="#optins" className="underline">{__('Open that campaign.', 'wconvert')}</a></p>
        {free && <MoreWithPro />}
      </nav>
      <div className="min-w-0">
        {group === 'integrations' && <AnalyticsIntegrationSettings onEditingStateChange={onEditingStateChange} />}
        {group === 'protection' && <SpamProtection onEditingStateChange={onEditingStateChange} />}
        {group === 'experience' && (
          <div className="grid gap-6"><SiteAllowance onEditingStateChange={onEditingStateChange} /><SitePhoneCountry /></div>
        )}
        {group === 'connections' && (
          <Destinations
            destinationId={destinationId}
            onEditingStateChange={onEditingStateChange}
          />
        )}
        {group === 'data' && (
          <DataPrivacySettings onEditingStateChange={onEditingStateChange} />
        )}
      </div>
      <footer className="border-t border-border pt-4 text-note text-muted-foreground lg:col-span-2">{__('Settings apply to this WordPress site.', 'wconvert')}</footer>
    </div>
  );
}

/** Two editable privacy regions report one navigation state to the page shell. */
function DataPrivacySettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const [guidanceEditing, setGuidanceEditing] = useState<EditingState>({ dirty: false, busy: false });
  const [retentionEditing, setRetentionEditing] = useState<EditingState>({ dirty: false, busy: false });

  useEffect(() => {
    onEditingStateChange?.({
      dirty: guidanceEditing.dirty || retentionEditing.dirty,
      busy: guidanceEditing.busy || retentionEditing.busy,
    });
    return () => onEditingStateChange?.({ dirty: false, busy: false });
  }, [guidanceEditing, retentionEditing, onEditingStateChange]);

  return (
    <div className="flex flex-col gap-4">
      <PrivacyGuidanceSettings onEditingStateChange={setGuidanceEditing} />
      <LeadRetention onEditingStateChange={setRetentionEditing} />
      <PrivacyDataMap />
      <Region>
        <RegionHeader
          title={__('Export and personal data', 'wconvert')}
        />
        <RegionBody className="flex flex-col gap-4">
          <div>
            <h3 className="m-0 text-body font-medium">
              {__('Export submissions', 'wconvert')}
            </h3>
            <p className="my-1 text-note text-muted-foreground">
              {__(
                'Choose the relevant records and dates in Leads.',
                'wconvert',
              )}
            </p>
            <a
              className="text-note underline underline-offset-2"
              href="#leads"
            >
              {__('Go to Leads', 'wconvert')}
            </a>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="m-0 text-body font-medium">
              {__('Personal data requests', 'wconvert')}
            </h3>
            <p className="my-1 text-note text-muted-foreground">
              {__(
                'Use WordPress’s existing tools for email requests. For a verified phone-only request, find the exact phone in Leads, export it if needed, then permanently delete every matching submission. Copies at other services are managed there.',
                'wconvert',
              )}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-note">
              <a
                className="underline underline-offset-2"
                href="export-personal-data.php"
              >
                {__('Export personal data', 'wconvert')}
              </a>
              <a
                className="underline underline-offset-2"
                href="erase-personal-data.php"
              >
                {__('Erase personal data', 'wconvert')}
              </a>
            </div>
          </div>
        </RegionBody>
      </Region>
    </div>
  );
}
