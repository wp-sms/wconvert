import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft } from 'lucide-react';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import { Disclosure } from '../shell/Disclosure';
import { formatCount, formatWhen, humanize, labelOf } from '../lib/format';
import { editorHref } from '../nav';
import { readLog, type Lead } from './api';

/**
 * A campaign's name as the log knows it: a string, `null` once the list has
 * loaded without it (the campaign was deleted), or `undefined` until the list
 * has loaded at all. Never its ID (ADR 0131).
 */
export type CampaignName = string | null | undefined;

export const submissionCount = (count: number) =>
  sprintf(_n('%s submission', '%s submissions', count, 'wconvert'), formatCount(count));

/** The email or phone a lead is found by: the email where there is one, as the log groups. */
export const contactOf = (lead: Lead): string | null => lead.email || lead.phone || null;

const nameOf = (lead: Lead): string | null => lead.fields.name?.trim() || null;

/** Person-first: the email, else the phone, else the name — and only then "Unnamed lead". */
export const titleOf = (lead: Lead): string => contactOf(lead) ?? nameOf(lead) ?? __('Unnamed lead', 'wconvert');

/**
 * A translated frame with one `%s`, filled with an isolated value, so an email
 * inside Persian copy stays readable. Contact details are `ltr`; a name keeps
 * its own direction.
 */
export function framed(frame: string, value: string, dir: 'ltr' | 'auto' = 'ltr'): ReactNode {
  const [before, after = ''] = frame.split('%s');
  // One span, so a flex parent (a button) does not add its gap around the name.
  return <span>{before}<bdi dir={dir}>{value}</bdi>{after}</span>;
}

/** A campaign link, or what is left of it when there is nothing to link to. */
export function CampaignLink({ id, name, returnTo }: { id: string; name: CampaignName; returnTo: string }) {
  if (name === undefined) return <span className="text-muted-foreground">—</span>;
  if (name === null) return <span className="text-muted-foreground">{__('Deleted campaign', 'wconvert')}</span>;
  return <a href={editorHref(id, returnTo)}>{name}</a>;
}

// Shown elsewhere, or never shown as a fact of their own.
const CONSENT_KEYS = ['consent_text', 'email_consent_text', 'sms_consent_text', 'email_accepted_at', 'sms_accepted_at'];
const PLACED_KEYS = new Set(['name', 'message', 'interest', 'interest_label', 'page_url', ...CONSENT_KEYS]);

/** Where a visit came from rather than what the visitor said: folded under "Other details". */
const trackingLabels = (): Record<string, string> => ({
  utm_source: __('UTM source', 'wconvert'),
  utm_medium: __('UTM medium', 'wconvert'),
  utm_campaign: __('UTM campaign', 'wconvert'),
  utm_term: __('UTM term', 'wconvert'),
  utm_content: __('UTM content', 'wconvert'),
  referrer: __('Referring page', 'wconvert'),
  gclid: __('Google Ads click', 'wconvert'),
  fbclid: __('Meta ads click', 'wconvert'),
});

type Fact = { key: string; label: string; value: ReactNode };

function Facts({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="m-0 flex flex-col gap-3">
      {facts.map((fact) => (
        <div key={fact.key} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-note text-muted-foreground">{fact.label}</dt>
          <dd dir="auto" className="m-0 break-words whitespace-pre-wrap">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-body font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** How many retained submissions share this email or phone. The meta line simply goes without it on failure. */
function useSubmissionsFrom(contact: string | null): number | null {
  const [count, setCount] = useState<{ contact: string; count: number } | null>(null);
  useEffect(() => {
    if (contact === null) return;
    let active = true;
    readLog({ identifier: contact }).then((log) => {
      if (active) setCount({ contact, count: log.submissions });
    }).catch(() => { /* A missing count is not a fact worth an error. */ });
    return () => { active = false; };
  }, [contact]);
  return count !== null && count.contact === contact ? count.count : null;
}

/**
 * **One submission, read person-first** (ADR 0131): the dialog is titled by
 * the email or phone, its meta line says who else the lead is, and the facts
 * are grouped as the merchant asks them — what they answered, where they came
 * from, what they agreed to. Tracking fields fold away under "Other details".
 *
 * It renders the inside of an `AdminDialogContent`, so the same view serves
 * the log's own dialog and the in-place step of a lead's history.
 */
export function LeadDetail({
  lead,
  campaign,
  goal,
  returnTo,
  backLabel,
  onBack,
  backRef,
  onSeeAll,
}: {
  lead: Lead;
  campaign: CampaignName;
  goal?: string;
  returnTo: string;
  backLabel: string;
  onBack: () => void;
  backRef?: Ref<HTMLButtonElement>;
  onSeeAll?: (contact: string) => void;
}) {
  const contact = contactOf(lead);
  const name = nameOf(lead);
  const title = titleOf(lead);
  const count = useSubmissionsFrom(contact);
  const { fields } = lead;

  const meta: ReactNode[] = [];
  if (name !== null && name !== title) meta.push(<span key="name" dir="auto">{name}</span>);
  if (lead.phone && lead.phone !== title) meta.push(<bdi key="phone" dir="ltr">{lead.phone}</bdi>);
  if (count !== null) meta.push(<span key="count">{submissionCount(count)}</span>);

  const answers: Fact[] = [];
  if (fields.message) answers.push({ key: 'message', label: __('Message', 'wconvert'), value: fields.message });
  if (fields.interest) answers.push({ key: 'interest', label: __('Interest', 'wconvert'), value: fields.interest_label || humanize(fields.interest) });
  for (const answer of lead.question_answers ?? []) {
    answers.push({ key: `q:${answer.id}`, label: answer.question, value: (answer.labels.length ? answer.labels : answer.values).join(', ') });
  }
  const tracking = trackingLabels();
  const other: Fact[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (PLACED_KEYS.has(key) || value === '') continue;
    // A key nobody mapped is a field the merchant named, so it is an answer.
    if (Object.hasOwn(tracking, key) || key.startsWith('utm_')) other.push({ key, label: labelOf(key, tracking, humanize(key)), value });
    else answers.push({ key, label: humanize(key), value });
  }

  const cameFrom: Fact[] = [
    { key: 'campaign', label: __('Campaign', 'wconvert'), value: <CampaignLink id={lead.optin_id} name={campaign} returnTo={returnTo} /> },
    ...(goal ? [{ key: 'goal', label: __('Goal', 'wconvert'), value: goal }] : []),
    ...(fields.page_url ? [{ key: 'page', label: __('Page', 'wconvert'), value: <bdi dir="ltr" className="break-all">{fields.page_url}</bdi> }] : []),
    { key: 'when', label: __('When', 'wconvert'), value: <time dateTime={lead.created_at.replace(' ', 'T')}>{formatWhen(lead.created_at, 'detail')}</time> },
  ];

  const channels = (['email', 'sms'] as const).filter((channel) => fields[`${channel}_consent_text`] || fields[`${channel}_accepted_at`]);
  const consent: Fact[] = channels.length > 0
    ? channels.map((channel) => ({
      key: channel,
      label: channel === 'email' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert'),
      value: <>
        {fields[`${channel}_consent_text`] || __('No wording was recorded.', 'wconvert')}
        {fields[`${channel}_accepted_at`] && <span className="mt-1 block text-note text-muted-foreground">
          {sprintf(__('Agreed %s', 'wconvert'), formatWhen(fields[`${channel}_accepted_at`], 'detail'))}
        </span>}
      </>,
    }))
    : fields.consent_text ? [{ key: 'consent', label: __('Agreed to', 'wconvert'), value: fields.consent_text }] : [];

  return (
    <>
      <AdminDialogHeader
        title={contact !== null ? <bdi dir="ltr" title={contact}>{contact}</bdi> : title}
        meta={meta.length > 0 ? meta.flatMap((part, index) => index === 0 ? [part] : [' · ', part]) : undefined}
      />
      <AdminDialogBody className="flex flex-col gap-6">
        {answers.length > 0 && <Group title={__('Answers', 'wconvert')}><Facts facts={answers} /></Group>}
        <Group title={__('Came from', 'wconvert')}><Facts facts={cameFrom} /></Group>
        <Group title={__('Consent', 'wconvert')}>
          {consent.length > 0 ? <>
            <Facts facts={consent} />
            <p className="m-0 text-note text-muted-foreground">{__('The wording they agreed to, not a current subscription.', 'wconvert')}</p>
          </> : <p className="m-0">{__('Not asked', 'wconvert')}</p>}
        </Group>
        {other.length > 0 && (
          <Disclosure variant="inline" title={__('Other details', 'wconvert')}>
            <Facts facts={other} />
          </Disclosure>
        )}
      </AdminDialogBody>
      <AdminDialogFooter
        back={<Button ref={backRef} variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{backLabel}</Button>}
      >
        {contact !== null && onSeeAll && (
          <Button onClick={() => onSeeAll(contact)}>
            {framed(__('See all from %s', 'wconvert'), name ?? contact, name === null ? 'ltr' : 'auto')}
          </Button>
        )}
      </AdminDialogFooter>
    </>
  );
}
