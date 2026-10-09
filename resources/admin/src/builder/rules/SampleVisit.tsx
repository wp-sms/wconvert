import { useId, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Check as CheckIcon, CheckCircle2, CircleAlert, Dot, LoaderCircle, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { audienceRules, type Answer } from '../../../../loader/src/display-rules';
import { phraseOf } from './sentence';
import type { Rule, RuleVocabulary } from '../api';
import { questions, type DisplayRulesValue } from './summaries';
import type { SectionId } from './picks';
import type { ConvertingAct } from '../structure/catalogue';
import type { Template, ProductsNode } from '@renderer/types';
import { nodesOf, nodeAt } from '../structure/tree';
import { adminSettings, commerceSupported } from '../../settings';
import { unlessFree } from '../../goals/availability';
import { wallKey, wallNow } from '../../lib/wallTime';
import { everyType } from './plan';
import { SampleBasket, emptyBasket, useBasketPreview } from './SampleBasket';
import { checkVisit, DATED, HISTORIES, historyLabel, isScheduled, pageChoices, type BasketCheck, type Check, type History, type Visitor } from './visit';

/** Rule types the visitor form asks about in its own words; any other audience rule is a plain yes or no. */
const NATURAL = ['device', 'logged_in', 'role', 'referrer', 'query_param', 'time_of_day', 'ad_blocking'];
const SOURCES = ['search', 'social', 'direct'];

/**
 * Test a visit: describe one visitor, read whether this campaign shows to them
 * and when (ADR 0129). Hypothetical facts only — this module has no storage,
 * listeners, beacons or capture imports, and nothing opens on the site.
 */
export default function SampleVisit({ value, vocabulary, onClose, onOpenSection, template, cartRequired = false, act = 'submit' }: {
  value: DisplayRulesValue; vocabulary: RuleVocabulary; onClose: () => void; onOpenSection?: (section: SectionId) => void;
  template?: Template; cartRequired?: boolean; act?: ConvertingAct;
}) {
  const plan = value.display_rules;
  const audience = plan ? audienceRules(plan) : [];
  const has = (type: string) => audience.some(rule => rule.type === type);
  const pages = pageChoices(value, vocabulary);
  const roleParam = vocabulary.targeting.find(type => type.type === 'role')?.params.value;
  const roleValues = [...new Set([...(roleParam?.options.map(option => option.value) ?? []),
    ...audience.filter(rule => rule.type === 'role').flatMap(rule => Array.isArray(rule.value) ? rule.value.map(String) : []), ...(value.targeting.roles ?? [])])];
  const domains = [...new Set(audience.filter(rule => rule.type === 'referrer').flatMap(rule => Array.isArray(rule.in) ? rule.in.map(String) : []))]
    .filter(source => !SOURCES.includes(source));
  const scheduled = isScheduled(value.schedule);
  const timezone = adminSettings()?.timezone;

  const fresh = (): Visitor => ({
    page: (pages.find(choice => choice.admitted) ?? pages[0]).value, device: 'desktop', signedIn: false, role: roleValues[0],
    source: 'search', query: '', clock: wallNow(timezone).slice(11), adBlocking: 'no', history: 'new', daysAgo: value.frequency.cooldownDays ?? 7,
  });
  const [visitor, setVisitor] = useState(fresh);
  const [basket, setBasket] = useState(emptyBasket);
  const set = (patch: Partial<Visitor>) => setVisitor(previous => ({ ...previous, ...patch }));
  const reset = () => { setVisitor(fresh()); setBasket(emptyBasket()); };

  const productPath = template ? nodesOf(template.tree).find(node => node.type === 'products' && !(nodeAt(template.tree, node.path) as { hidden?: boolean })?.hidden)?.path : undefined;
  const products = productPath && template ? nodeAt(template.tree, productPath) as ProductsNode : undefined;
  const cartRules = audience.filter(rule => rule.type.startsWith('cart_'));
  let requiredCartId = 'sample-required-cart';
  while (cartRules.some(rule => rule.id === requiredCartId)) requiredCartId += '-';
  if (cartRequired) cartRules.push({ id: requiredCartId, type: 'cart_has_items' });
  const usesBasket = cartRules.length > 0 || !!products;
  const basketEnabled = usesBasket && commerceSupported();
  const preview = useBasketPreview(basketEnabled, basket, cartRules, products);
  const basketCheck: BasketCheck = !usesBasket ? { status: 'unused' }
    : !basketEnabled ? { status: 'fail', reason: unlessFree(__('Cart testing requires WConvert Pro and WooCommerce.', 'wconvert')) }
      : preview.error ? { status: 'fail', reason: __('The sample basket could not be checked.', 'wconvert') }
        : !preview.result ? { status: 'checking' }
          : !preview.result.eligible || (cartRequired && preview.result.rules[requiredCartId] !== true)
            ? { status: 'fail', reason: __('This basket does not meet the campaign’s cart requirements or has no eligible recommendations.', 'wconvert') }
            : { status: 'pass', answers: Object.fromEntries(cartRules.map(rule => [String(rule.id),
              preview.result!.state === 'blocked' ? 'blocked' : preview.result!.rules[String(rule.id)] ?? false] as [string, Answer])) };
  const result = checkVisit(value, vocabulary, visitor, basketCheck, act);

  const all = everyType(vocabulary);
  const others = audience.filter(rule => !NATURAL.includes(rule.type) && !rule.type.startsWith('cart_'));
  const asksAccount = has('logged_in') || has('role') || value.targeting.logged_in !== undefined || value.targeting.roles !== undefined;
  const asksRole = has('role') || value.targeting.roles !== undefined;
  const roleLabel = (role: string) => roleParam?.options.find(option => option.value === role)?.label ?? role;
  const asked = questions();
  const checking = result.checking === true;
  const Headline = checking ? LoaderCircle : result.opens ? CheckCircle2 : CircleAlert;

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="wconvert-sample-dialog sm:max-w-4xl flex flex-col gap-0 p-0 overflow-hidden max-h-[calc(100dvh-2rem)]">
      <DialogHeader className="wconvert-sample-header text-start">
        <DialogTitle>{__('Test a visit', 'wconvert')}</DialogTitle>
        <DialogDescription>{__('Describe one visitor. You’ll see whether this campaign shows to them, and when. Nothing opens on your site.', 'wconvert')}</DialogDescription>
      </DialogHeader>
      <div className="wconvert-sample-body">
        <aside className="wconvert-sample-verdict" aria-label={__('Result', 'wconvert')}>
          <div className="wconvert-sample-result" data-opens={checking ? undefined : result.opens} role="status" aria-live="polite" aria-atomic="true">
            <Headline aria-hidden="true" className={checking ? 'animate-spin motion-reduce:animate-none' : undefined} />
            <div><strong>{result.headline}</strong>{result.reason && <p>{result.reason}</p>}</div>
          </div>
          <ul className="wconvert-sample-checks">
            {result.checks.map(row => <CheckRow key={row.section} row={row} question={asked[row.section]}
              onChange={onOpenSection && (() => onOpenSection(row.section))} />)}
          </ul>
        </aside>

        <section className="wconvert-sample-visitor" aria-labelledby="wconvert-sample-visitor">
          <h3 id="wconvert-sample-visitor">{__('The visitor', 'wconvert')}</h3>
          <div className="wconvert-sample-fields">
            {pages.length > 1 && <Field label={__('Page they’re on', 'wconvert')}>{id =>
              <select id={id} value={visitor.page} onChange={event => set({ page: event.target.value })}>
                {pages.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>}</Field>}
            <Field label={__('Device', 'wconvert')}>{id =>
              <select id={id} value={visitor.device} onChange={event => set({ device: event.target.value as Visitor['device'] })}>
                <option value="mobile">{__('Phone', 'wconvert')}</option>
                <option value="tablet">{__('Tablet', 'wconvert')}</option>
                <option value="desktop">{__('Computer', 'wconvert')}</option>
              </select>}</Field>
            {asksAccount && <Field label={__('Signed in', 'wconvert')}>{id =>
              <select id={id} value={visitor.signedIn ? 'yes' : 'no'} onChange={event => set({ signedIn: event.target.value === 'yes' })}>
                <option value="no">{__('No', 'wconvert')}</option>
                <option value="yes">{__('Yes', 'wconvert')}</option>
              </select>}</Field>}
            {asksRole && visitor.signedIn && roleValues.length > 0 && <Field label={__('Role', 'wconvert')}>{id =>
              <select id={id} value={visitor.role} onChange={event => set({ role: event.target.value })}>
                {roleValues.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>}</Field>}
            {has('referrer') && <Field label={__('Came from', 'wconvert')}>{id =>
              <select id={id} value={visitor.source} onChange={event => set({ source: event.target.value })}>
                <option value="search">{__('A search engine', 'wconvert')}</option>
                <option value="social">{__('Social media', 'wconvert')}</option>
                <option value="direct">{__('Typed the address (direct)', 'wconvert')}</option>
                {domains.map(domain => <option key={domain} value={domain}>{domain}</option>)}
                <option value="elsewhere">{__('Another site', 'wconvert')}</option>
              </select>}</Field>}
            {has('query_param') && <Field label={__('Page address', 'wconvert')}>{id =>
              <input id={id} type="text" placeholder="?utm_source=newsletter" value={visitor.query} onChange={event => set({ query: event.target.value })} />}</Field>}
            {has('time_of_day') && <Field label={__('Time on your site’s clock', 'wconvert')}>{id =>
              <input id={id} type="time" value={visitor.clock} onChange={event => set({ clock: event.target.value })} />}</Field>}
            {has('ad_blocking') && <Field label={__('Ad blocker', 'wconvert')}>{id =>
              <select id={id} value={visitor.adBlocking} onChange={event => set({ adBlocking: event.target.value as Visitor['adBlocking'] })}>
                <option value="no">{__('No', 'wconvert')}</option>
                <option value="yes">{__('Yes', 'wconvert')}</option>
                <option value="unknown">{__('Can’t tell', 'wconvert')}</option>
              </select>}</Field>}
            {others.map(rule => <Field key={String(rule.id)} label={sprintf(
              /* translators: %s: a rule, e.g. “their cart is not empty”. */
              __('Does this visitor match: %s?', 'wconvert'), phraseOf(rule as Rule, all).text)}>{id =>
              <select id={id} value={visitor.answers?.[String(rule.id)] ? 'yes' : 'no'}
                onChange={event => set({ answers: { ...visitor.answers, [String(rule.id)]: event.target.value === 'yes' } })}>
                <option value="no">{__('No', 'wconvert')}</option>
                <option value="yes">{__('Yes', 'wconvert')}</option>
              </select>}</Field>)}
            <Field label={__('Before this visit', 'wconvert')}>{id =>
              <select id={id} value={visitor.history} onChange={event => set({ history: event.target.value as History })}>
                {HISTORIES.map(history =>
                  <option key={history} value={history}>{history === 'days-ago' ? __('Saw it on an earlier day', 'wconvert') : historyLabel(history, undefined, act)}</option>)}
              </select>}</Field>
            {DATED.includes(visitor.history) && <Field label={__('How many days ago', 'wconvert')}>{id =>
              <input id={id} type="number" min={1} max={3650} value={visitor.daysAgo} onChange={event => set({ daysAgo: Math.max(1, Math.floor(Number(event.target.value)) || 1) })} />}</Field>}
            {scheduled && <Field label={__('Visit date', 'wconvert')}>{id =>
              <select id={id} value={visitor.date === undefined ? 'today' : 'pick'}
                onChange={event => set({ date: event.target.value === 'today' ? undefined : wallKey(value.schedule.starts_at) ?? wallNow(timezone) })}>
                <option value="today">{__('Today', 'wconvert')}</option>
                <option value="pick">{__('Pick a date and time', 'wconvert')}</option>
              </select>}</Field>}
            {scheduled && visitor.date !== undefined && <Field label={__('Date and time', 'wconvert')}>{id =>
              <input id={id} type="datetime-local" value={visitor.date?.replace(' ', 'T')}
                onChange={event => { const date = wallKey(event.target.value); if (date) set({ date }); }} />}</Field>}
          </div>
          {basketEnabled && <SampleBasket value={basket} onChange={setBasket} result={preview.result} error={preview.error} products={products}
            legacyTotal={cartRules.some(rule => rule.type === 'cart_value_min')} />}
        </section>
      </div>
      <div className="wconvert-sample-footer">
        <p>{__('Uses your unsaved draft.', 'wconvert')}</p>
        <Button variant="outline" onClick={reset}>{__('Reset', 'wconvert')}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return <div className="wconvert-sample-field"><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

function CheckRow({ row, question, onChange }: { row: Check; question: string; onChange?: () => void }) {
  const Mark = row.status === 'pass' ? CheckIcon : row.status === 'fail' ? X : Dot;
  const said = row.status === 'pass' ? __('Passes', 'wconvert') : row.status === 'fail' ? __('Stops it', 'wconvert') : __('Describes only', 'wconvert');
  return <li data-status={row.status}>
    <Mark className="wconvert-sample-mark" aria-hidden="true" />
    <span className="sr-only">{said}: </span>
    <span className="wconvert-sample-question">{question}</span>
    <span className="wconvert-sample-answer">{row.text}</span>
    {onChange && <button type="button" className="wconvert-sample-change" onClick={onChange}
      aria-label={sprintf(
        /* translators: %s: a display question, e.g. “Who sees it?”. */
        __('Change: %s', 'wconvert'), question)}>{__('Change', 'wconvert')}</button>}
  </li>;
}
