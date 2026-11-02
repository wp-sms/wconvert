import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ArrowLeft, CalendarDays, Globe, Megaphone, ShieldCheck, Target, Trash2 } from 'lucide-react';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Button } from '../components/ui/button';
import { Disclosure } from '../shell/Disclosure';
import { FactList, type Fact as IconFact } from '../shell/FactList';
import { InfoTip } from '../shell/InfoTip';
import { formatCount, formatWhen, humanize, labelOf } from '../lib/format';
import { editorHref, sendingIssuesHref } from '../nav';
import { readLog, type Lead } from './api';
import type { NotSent } from './notSent';

/**
 * A campaign's name as the log knows it: a string, `null` once the list has
 * loaded without it (the campaign was deleted), or `undefined` until the list
 * has loaded at all. Never its ID (ADR 0131).
 */
export type CampaignName = string | null | undefined;

export const submissionCount = (count: number) =>
  sprintf(/* translators: %s: how many form submissions, e.g. “3”. */ _n('%s submission', '%s submissions', count, 'wconvert'), formatCount(count));

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

/**
 * A translated sentence with numbered `%1$s`, `%2$s` slots, each filled with an
 * isolated value — {@see framed} for more than one.
 */
function sentence(frame: string, values: readonly ReactNode[]): ReactNode {
  return frame.split(/(%\d\$s)/).map((part, index) => {
    const slot = /^%(\d)\$s$/.exec(part);
    return slot ? <bdi key={index} dir="auto">{values[Number(slot[1]) - 1]}</bdi> : part;
  });
}

/**
 * Where this submission did not go, from the failure ring (ADR 0008, amended by
 * 0132 through 0071). It is drawn only when there is something to say: the
 * ring holds failures and nothing else, so no line here ever reads "Sent".
 */
function Sending({ notSent }: { notSent: readonly NotSent[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {notSent.map((entry, index) => (
        <li key={index} className="m-0 [overflow-wrap:anywhere]">
          {sentence(/* translators: 1: a destination's name, e.g. “Mailchimp”, 2: why it was not sent, the error from that service. */ __('Not sent to %1$s: %2$s', 'wconvert'), [
            entry.destination === null ? __('Removed destination', 'wconvert') : entry.destination || __('Unnamed destination', 'wconvert'),
            entry.error,
          ])}
          {' · '}
          <a className="underline underline-offset-2" href={sendingIssuesHref()}>{__('Review destination', 'wconvert')}</a>
        </li>
      ))}
    </ul>
  );
}

function Group({ title, tip, children }: { title: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="wconvert-lead-group__head flex items-center gap-1">
        <h3 className="m-0 text-body font-semibold">{title}</h3>
        {tip}
      </div>
      {children}
    </section>
  );
}

/** A value's own direction and line breaks, inside the shared icon list. */
const said = (value: ReactNode): ReactNode => <bdi dir="auto" className="break-words whitespace-pre-wrap">{value}</bdi>;

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
 * Where they came from and what they agreed to are the shared icon list (ADR
 * 0183). What they answered is not: its labels are the visitor's own questions,
 * which no icon can stand for and which need the width.
 *
 * It renders the inside of an `AdminDialogContent`, so the same view serves
 * the log's own dialog and the in-place step of a lead's history. Opened from
 * the log it is the top level, so its footer's first button closes and says
 * Done, since Close is the ✕'s name; inside a history it steps Back.
 *
 * **"See all" only when there is more than this one** — a history holding the
 * same single row is a click that shows nothing new — and it says how many.
 * Delete sits beside it, because a "delete my data" email is answered from
 * the person's submission, not from an exact search somebody has to know to
 * type. It hands the email or phone to the caller, which closes this dialog
 * before its confirm opens: never stacked (ADR 0131).
 */
export function LeadDetail({
  lead,
  campaign,
  goal,
  returnTo,
  closes = false,
  onBack,
  backRef,
  onSeeAll,
  onErase,
  notSent = [],
}: {
  lead: Lead;
  campaign: CampaignName;
  goal?: string;
  returnTo: string;
  /** The footer's first button closes the dialog rather than stepping back. */
  closes?: boolean;
  onBack: () => void;
  backRef?: Ref<HTMLButtonElement>;
  onSeeAll?: (contact: string) => void;
  onErase?: (contact: string) => void;
  notSent?: readonly NotSent[];
}) {
  const contact = contactOf(lead);
  const name = nameOf(lead);
  const title = titleOf(lead);
  const count = useSubmissionsFrom(contact);
  const { fields } = lead;

  const meta: ReactNode[] = [];
  if (name !== null && name !== title) meta.push(<span key="name" dir="auto">{name}</span>);
  if (lead.phone && lead.phone !== title) meta.push(<bdi key="phone" dir="ltr">{lead.phone}</bdi>);
  // One is the submission on screen, so it is only news once there are more.
  if (count !== null && count > 1) meta.push(<span key="count">{submissionCount(count)}</span>);

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

  const submitted = formatWhen(lead.created_at, 'detail');
  const cameFrom: IconFact[] = [
    { icon: Megaphone, label: __('Campaign', 'wconvert'), text: said(<CampaignLink id={lead.optin_id} name={campaign} returnTo={returnTo} />) },
    ...(goal ? [{ icon: Target, label: __('Goal', 'wconvert'), text: said(goal) }] : []),
    ...(fields.page_url ? [{ icon: Globe, label: __('Page', 'wconvert'), text: <bdi dir="ltr" className="break-all">{fields.page_url}</bdi> }] : []),
    { icon: CalendarDays, label: __('When', 'wconvert'), text: <time dateTime={lead.created_at.replace(' ', 'T')}>{submitted}</time> },
  ];

  const channels = (['email', 'sms'] as const).filter((channel) => fields[`${channel}_consent_text`] || fields[`${channel}_accepted_at`]);
  // Agreeing as they submitted is When, above; only another moment is news.
  const agreedAt = (channel: 'email' | 'sms'): string | null => {
    const accepted = fields[`${channel}_accepted_at`];
    if (!accepted) return null;
    const agreed = formatWhen(accepted, 'detail');
    return agreed === submitted ? null : agreed;
  };
  const consent: IconFact[] = channels.length > 0
    ? channels.map((channel) => {
      const agreed = agreedAt(channel);
      return {
        icon: ShieldCheck,
        label: channel === 'email' ? __('Email signup', 'wconvert') : __('SMS signup', 'wconvert'),
        text: <>
          <span className="block">{said(fields[`${channel}_consent_text`] || __('No wording was recorded.', 'wconvert'))}</span>
          {agreed && <span className="mt-1 block text-note text-muted-foreground">
            {sprintf(/* translators: %s: the date and time they agreed, e.g. “Oct 9, 2026, 2:22 PM”. */ __('Agreed %s', 'wconvert'), agreed)}
          </span>}
        </>,
      };
    })
    : fields.consent_text ? [{ icon: ShieldCheck, label: __('Agreed to', 'wconvert'), text: said(fields.consent_text) }] : [];

  return (
    <>
      <AdminDialogHeader
        title={contact !== null ? <bdi dir="ltr" title={contact}>{contact}</bdi> : title}
        meta={meta.length > 0 ? meta.flatMap((part, index) => index === 0 ? [part] : [' · ', part]) : undefined}
      />
      <AdminDialogBody className="flex flex-col gap-6">
        {notSent.length > 0 && <Group title={__('Sending', 'wconvert')}><Sending notSent={notSent} /></Group>}
        {answers.length > 0 && <Group title={__('Answers', 'wconvert')}><Facts facts={answers} /></Group>}
        <Group title={__('Came from', 'wconvert')}><FactList className="wconvert-lead-facts" facts={cameFrom} /></Group>
        <Group
          title={__('Consent', 'wconvert')}
          tip={consent.length > 0 && <InfoTip label={__('About this consent record', 'wconvert')}>{__('The wording they agreed to, not a current subscription.', 'wconvert')}</InfoTip>}
        >
          {consent.length > 0
            ? <FactList className="wconvert-lead-facts" facts={consent} />
            : <p className="m-0">{__('Not asked', 'wconvert')}</p>}
        </Group>
        {other.length > 0 && (
          <Disclosure variant="inline" title={__('Other details', 'wconvert')}>
            <Facts facts={other} />
          </Disclosure>
        )}
      </AdminDialogBody>
      <AdminDialogFooter
        back={<Button ref={backRef} variant="outline" onClick={onBack}>
          {closes ? __('Done', 'wconvert') : <><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back', 'wconvert')}</>}
        </Button>}
      >
        {contact !== null && onErase && (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onErase(contact)}>
            <Trash2 aria-hidden="true" />
            {lead.email ? __('Delete all from this email', 'wconvert') : __('Delete all from this phone', 'wconvert')}
          </Button>
        )}
        {contact !== null && onSeeAll && count !== null && count > 1 && (
          <Button onClick={() => onSeeAll(contact)}>
            {framed(
              /* translators: 1: how many submissions, 2: a name, email or phone. */
              sprintf(_n('See all %1$s from %2$s', 'See all %1$s from %2$s', count, 'wconvert'), formatCount(count), '%s'),
              name ?? contact,
              name === null ? 'ltr' : 'auto',
            )}
          </Button>
        )}
      </AdminDialogFooter>
    </>
  );
}
