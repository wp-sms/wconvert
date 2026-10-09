import { AnalyticsIntegrationSettings } from '../analyticsIntegration';
import { isFreeInstall } from '../goals/availability';
import { MoreWithPro } from './MoreWithPro';
import { Fragment, useEffect, useId, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowRight, ChartColumn, Database, Eye, Plug, Search, Shield } from 'lucide-react';
import { Input } from '../components/ui/input';
import { NativeSelect } from '../components/ui/native-select';
import { clearRequestedSetting, focusSetting, matchSettings, requestedSetting, requestSetting, settingsIndex, type SettingEntry } from './settingsIndex';
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
import { Description } from '../shell/Description';

/**
 * A persistent category rail; the chosen category goes straight to its
 * controls. Below `lg` the rail is one native select beside the search, so a
 * phone reaches the form without scrolling past five cards first (ADR 0091:
 * the rail still sits above the forms there, only compact).
 */
export function Settings({
  group: asked,
  destinationId,
  onEditingStateChange,
}: {
  group: SettingsGroup;
  destinationId?: string;
  onEditingStateChange?: SettingsEditing;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  // Analytics integrations arrive with Pro; a free install has no such page
  // to open (ADR 0116), so a deep link lands on the default group.
  const free = isFreeInstall();
  const group = free && asked === 'integrations' ? 'connections' : asked;
  // Ordered as a first-time owner sets up: where leads go, what visitors see,
  // keeping bots out, then what is kept. Analytics is an add-on, so last.
  const categories = [
    { id: 'connections', label: __('Connections & destinations', 'wconvert'), description: __('Accounts and where leads go', 'wconvert'), icon: Plug },
    { id: 'experience', label: __('Visitor experience', 'wconvert'), description: __('Site-wide display and phone settings', 'wconvert'), icon: Eye },
    { id: 'protection', label: __('Spam protection', 'wconvert'), description: __('Bot verification and form filters', 'wconvert'), icon: Shield },
    { id: 'data', label: __('Data & privacy', 'wconvert'), description: __('Retention and personal data', 'wconvert'), icon: Database },
    { id: 'integrations', label: __('Analytics integrations', 'wconvert'), description: __('Google Analytics, GTM and Plausible', 'wconvert'), icon: ChartColumn },
  ].filter((category) => !(free && category.id === 'integrations')) as { id: SettingsGroup; label: string; description: string; icon: typeof Plug }[];
  const groupLabel = (of: SettingsGroup) => categories.find((category) => category.id === of)?.label ?? '';
  const index = settingsIndex().filter((entry) => !(free && entry.pro));
  const searching = search.trim() !== '';
  const results = matchSettings(index, search, groupLabel);

  // A setting chosen in another group was requested before this page
  // remounted at its address; focus it once its region draws it.
  useEffect(() => {
    const key = requestedSetting(group);
    const entry = key === null ? undefined : settingsIndex().find((each) => each.key === key);
    return entry ? focusSetting(entry, clearRequestedSetting) : undefined;
  }, [group]);

  const open = (entry: SettingEntry): boolean => {
    if (entry.group === group) {
      focusSetting(entry);
      return true;
    }
    requestSetting(entry);
    return false;
  };

  return (
    <div className="grid min-w-0 items-start gap-7 max-lg:gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label={__('Settings categories', 'wconvert')} className="min-w-0" data-settings-rail="">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row lg:flex-col">
          <NativeSelect
            className="w-full sm:w-auto sm:min-w-56 lg:hidden"
            aria-label={__('Settings category', 'wconvert')}
            value={group}
            onChange={(event) => { window.location.hash = settingsHref(event.target.value as SettingsGroup); }}
          >
            {categories.map(({ id: value, label }) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              className="ps-9"
              type="search"
              aria-label={__('Find a setting', 'wconvert')}
              aria-controls={searching ? `${id}-results` : undefined}
              placeholder={__('Find a setting…', 'wconvert')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter opens the first result, as a search box that lists
                // places is expected to.
                if (event.key !== 'Enter' || results.length === 0) return;
                event.preventDefault();
                if (!open(results[0])) window.location.hash = settingsHref(results[0].group);
              }}
            />
          </div>
        </div>
        {searching ? (
          results.length > 0 ? (
            <ul id={`${id}-results`} aria-label={__('Matching settings', 'wconvert')} className="m-0 grid list-none gap-0.5 p-0">
              {results.map((entry) => (
                <li key={entry.key}>
                  <a
                    href={settingsHref(entry.group)}
                    className="block rounded-sm px-3 py-2 text-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={(event) => { if (open(entry)) event.preventDefault(); }}
                  >
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-note text-muted-foreground"> · {groupLabel(entry.group)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-3 text-note text-muted-foreground">{__('No settings match. Try “retention” or “email”.', 'wconvert')}</p>
          )
        ) : categories.map(({ id: value, label, description, icon: Icon }) => (
          <a
            key={value}
            href={settingsHref(value)}
            aria-current={value === group ? 'page' : undefined}
            className={`my-[7px] flex gap-3 rounded-sm border px-3 py-[15px] focus-visible:outline-2 focus-visible:outline-ring max-lg:hidden ${value === group ? 'border-action bg-card text-action' : 'border-transparent text-foreground hover:bg-secondary'}`}
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
        {/* Reference, not navigation: on a phone it would sit between the select and the form. */}
        <div className="max-lg:hidden">
          <p className="mb-1 mt-5 border-t border-border px-3 pt-4 text-note text-muted-foreground">{__('Design, timing and audience are set in each campaign’s editor.', 'wconvert')} <a href="#optins" className="underline">{__('Go to campaigns', 'wconvert')}</a></p>
          {free && <MoreWithPro />}
        </div>
      </nav>
      <div className="min-w-0 max-w-[900px]">
        {group === 'connections' && (
          <Destinations
            destinationId={destinationId}
            onEditingStateChange={onEditingStateChange}
          />
        )}
        {group === 'experience' && <VisitorExperienceSettings onEditingStateChange={onEditingStateChange} />}
        {group === 'protection' && <SpamProtection onEditingStateChange={onEditingStateChange} />}
        {group === 'data' && (
          <DataPrivacySettings onEditingStateChange={onEditingStateChange} />
        )}
        {group === 'integrations' && <AnalyticsIntegrationSettings onEditingStateChange={onEditingStateChange} />}
      </div>
    </div>
  );
}

const IDLE: EditingState = { dirty: false, busy: false };

/**
 * Two editable regions on one page report ONE navigation state to the shell —
 * dirty or busy if either is — while each keeps its own Save.
 */
function usePairedEditing(report?: SettingsEditing): [SettingsEditing, SettingsEditing] {
  const [first, setFirst] = useState<EditingState>(IDLE);
  const [second, setSecond] = useState<EditingState>(IDLE);

  useEffect(() => {
    report?.({ dirty: first.dirty || second.dirty, busy: first.busy || second.busy });
    return () => report?.(IDLE);
  }, [first, second, report]);

  return [setFirst, setSecond];
}

function VisitorExperienceSettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const [allowance, phone] = usePairedEditing(onEditingStateChange);
  return (
    <div className="grid gap-6">
      <SiteAllowance onEditingStateChange={allowance} />
      <SitePhoneCountry onEditingStateChange={phone} />
    </div>
  );
}

/**
 * Ordered by use: the one real setting (how long submissions are kept), what
 * that means for visitor data, how to answer a request, and last the editor
 * toggle most sites set once.
 */
function DataPrivacySettings({ onEditingStateChange }: { onEditingStateChange?: SettingsEditing }) {
  const [retention, guidance] = usePairedEditing(onEditingStateChange);

  return (
    <div className="flex flex-col gap-4">
      <LeadRetention onEditingStateChange={retention} />
      <PrivacyDataMap />
      <Region>
        <RegionHeader title={__('Export and personal data', 'wconvert')} />
        <RegionBody className="flex flex-col gap-4">
          <p className="m-0">
            {/* One sentence for the translator, with the link where they put it. */}
            {/* translators: %s: a link to the Leads screen, reading “Leads”. */ __('Download submissions as CSV in %s', 'wconvert').split('%s').map((piece, at) => (
              <Fragment key={at}>
                {at > 0 && (
                  <a className="inline-flex items-center gap-1 underline underline-offset-2" href="#leads" data-setting="export-csv">
                    {__('Leads', 'wconvert')}<ArrowRight aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
                  </a>
                )}
                {piece}
              </Fragment>
            ))}
          </p>
          <div className="flex flex-col gap-1 border-t border-border pt-4">
            <h3 className="m-0 text-body font-semibold">
              {__('Personal data requests', 'wconvert')}
            </h3>
            <Description>
              {__(
                'Use the WordPress tools for an email request. For a verified phone-only request, find the phone in Leads, export it if needed, then delete every matching submission. Copies at other services are managed there.',
                'wconvert',
              )}
            </Description>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-note">
              <a className="underline underline-offset-2" href="export-personal-data.php" data-setting="export-personal-data">
                {__('Export personal data', 'wconvert')}
              </a>
              <a className="underline underline-offset-2" href="erase-personal-data.php" data-setting="erase-personal-data">
                {__('Erase personal data', 'wconvert')}
              </a>
            </div>
          </div>
        </RegionBody>
      </Region>
      <PrivacyGuidanceSettings onEditingStateChange={guidance} />
    </div>
  );
}
