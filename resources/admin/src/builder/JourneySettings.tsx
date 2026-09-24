import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import type { QuestionClause, QuestionCondition, QuestionNode, ResultVariant, TemplateNode, TemplateTree } from '@renderer/types';
import { walkNodes, usedBy } from './structure/journey';

type ChoiceQuestion = QuestionNode & { id: string };
const questionsBefore = (tree: TemplateTree, at: number): ChoiceQuestion[] => tree.steps.slice(0, at)
  .flatMap(screen => walkNodes(screen.content))
  .filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string'
    && 'answer_type' in node && node.answer_type !== 'text') as ChoiceQuestion[];

function replaceNode(node: TemplateNode, id: string, update: (node: QuestionNode) => TemplateNode): TemplateNode {
  if (node.type === 'question' && 'id' in node && node.id === id) return update(node as QuestionNode);
  const copy = { ...node } as Record<string, unknown>;
  for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(child => replaceNode(child, id, update));
  return copy as TemplateNode;
}

function ConditionSettings({ value, sources, onChange, required = false }: {
  value?: QuestionCondition; sources: ChoiceQuestion[]; onChange(value?: QuestionCondition): void; required?: boolean;
}) {
  const initial = (q: ChoiceQuestion): QuestionClause => ({ question: q.id, operator: q.answer_type === 'multi' ? 'includes_any' : 'is', values: [q.options?.[0]?.value ?? ''] });
  const patch = (index: number, clause: QuestionCondition['clauses'][number]) => onChange({ match: value?.match ?? 'all', clauses: (value?.clauses ?? []).map((old, at) => at === index ? clause : old) });
  return <div className="wconvert-journey-settings">
    {!required && <label>{__('Show when', 'wconvert')}
      <select value={value ? 'match' : 'always'} onChange={event => onChange(event.target.value === 'match' && sources[0] ? { match: 'all', clauses: [initial(sources[0])] } : undefined)}>
        <option value="always">{__('Always', 'wconvert')}</option>
        <option value="match" disabled={!sources.length}>{__('Answers match', 'wconvert')}</option>
      </select>
    </label>}
    {!sources.length && <p>{__('Add a choice question on an earlier screen to use conditions.', 'wconvert')}</p>}
    {value && <>
      {value.clauses.length > 1 && <label>{__('Match', 'wconvert')}<select value={value.match} onChange={event => onChange({ ...value, match: event.target.value as 'all' | 'any' })}>
        <option value="all">{__('All conditions', 'wconvert')}</option><option value="any">{__('Any condition', 'wconvert')}</option>
      </select></label>}
      {value.clauses.map((clause, index) => {
        const source = sources.find(q => q.id === clause.question) ?? sources[0];
        return <div key={index} className="wconvert-journey-settings__clause">
          <select aria-label={__('Question', 'wconvert')} value={clause.question} onChange={event => { const q = sources.find(item => item.id === event.target.value)!; patch(index, initial(q)); }}>
            {sources.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
          <select aria-label={__('Comparison', 'wconvert')} value={clause.operator} onChange={event => patch(index, { ...clause, operator: event.target.value as typeof clause.operator })}>
            {source?.answer_type === 'multi' ? <><option value="includes_any">{__('includes', 'wconvert')}</option><option value="includes_none">{__('does not include', 'wconvert')}</option></> : <><option value="is">{__('is', 'wconvert')}</option><option value="is_not">{__('is not', 'wconvert')}</option></>}
          </select>
          <select aria-label={__('Answer', 'wconvert')} value={clause.values[0] ?? ''} onChange={event => patch(index, { ...clause, values: [event.target.value] })}>
            {source?.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => { const clauses = value.clauses.filter((_, at) => at !== index); onChange(clauses.length ? { ...value, clauses } : undefined); }}>{__('Remove', 'wconvert')}</button>
        </div>;
      })}
      {value.clauses.length < 5 && <button type="button" onClick={() => onChange({ ...value, clauses: [...value.clauses, initial(sources[0])] })}>{__('Add condition', 'wconvert')}</button>}
      <p>{__('Visitors whose answers do not match continue to the next relevant screen. An unanswered question never matches, even with “is not.”', 'wconvert')}</p>
    </>}
  </div>;
}

export function ScreenConditionSettings({ tree, step, onChange, onSelect }: {
  tree: TemplateTree; step: number; onChange(next: TemplateTree): void; onSelect(step: number): void;
}) {
  const screen = tree.steps[step];
  if (step === 0 || ['result', 'acknowledgement'].includes(screen.kind)
    || walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')) return null;
  const sources = questionsBefore(tree, step);
  return <section className="wconvert-journey-settings"><h4>{__('Screen visibility', 'wconvert')}</h4>
    <ConditionSettings value={screen.when} sources={sources} onChange={when => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, when } : item) })} />
    {screen.when?.clauses.map(clause => { const source = questionsBefore(tree, step).find(q => q.id === clause.question);
      const sourceAt = tree.steps.findIndex(item => walkNodes(item.content).some(node => 'id' in node && node.id === clause.question));
      return source && sourceAt >= 0 ? <button key={clause.question} type="button" onClick={() => onSelect(sourceAt)}>{__('Edit source question:', 'wconvert')} {source.label}</button> : null;
    })}
  </section>;
}

export function QuestionSettings({ tree, step, onChange, onSelect }: {
  tree: TemplateTree; step: number; onChange(next: TemplateTree): void; onSelect(step: number): void;
}) {
  const screen = tree.steps[step];
  const questions = walkNodes(screen.content).filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string') as ChoiceQuestion[];
  if (!questions.length) return null;
  const change = (id: string, update: (node: QuestionNode) => TemplateNode) => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, content: replaceNode(item.content, id, update) } : item) });
  return <section className="wconvert-journey-settings"><h4>{__('Questions on this screen', 'wconvert')}</h4>
    {questions.map(question => {
      const refs = usedBy(tree, question.id);
      const protectedValues = new Set(tree.steps.flatMap(item => [item.when, ...(item.results?.map(result => result.when) ?? [])])
        .flatMap(condition => condition?.clauses ?? []).filter(clause => clause.question === question.id).flatMap(clause => clause.values));
      return <div key={question.id} className="wconvert-journey-settings__question">
        <label>{__('Question', 'wconvert')}<input value={question.label} maxLength={200} onChange={event => change(question.id, node => ({ ...node, label: event.target.value }))} /></label>
        <label>{__('Help text (optional)', 'wconvert')}<input value={question.help ?? ''} maxLength={300} onChange={event => change(question.id, node => ({ ...node, help: event.target.value }))} /></label>
        <label>{__('Answer type', 'wconvert')}<select value={question.answer_type} disabled={refs.length > 0} onChange={event => change(question.id, node => ({ ...node, answer_type: event.target.value as QuestionNode['answer_type'], options: event.target.value === 'text' ? [] : [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }] }))}>
          <option value="single">{__('Choose one', 'wconvert')}</option><option value="multi">{__('Choose several', 'wconvert')}</option><option value="text">{__('Short answer', 'wconvert')}</option>
        </select></label>
        {question.answer_type !== 'text' && <div><strong>{__('Choices', 'wconvert')}</strong>
          {question.options?.map((option, at) => <div key={option.value} className="wconvert-journey-settings__choice"><input aria-label={`${__('Choice', 'wconvert')} ${at + 1}`} value={option.label} maxLength={120}
            onChange={event => change(question.id, node => ({ ...node, options: node.options?.map((old, i) => i === at ? { ...old, label: event.target.value } : old) }))} />
            <button type="button" disabled={!!protectedValues.has(option.value) || (question.options?.length ?? 0) <= 2} onClick={() => change(question.id, node => ({ ...node, options: node.options?.filter((_, i) => i !== at) }))}>{__('Remove', 'wconvert')}</button></div>)}
          {(question.options?.length ?? 0) < 12 && <button type="button" onClick={() => change(question.id, node => {
            const taken = new Set(node.options?.map(item => item.value)); let at = 1; while (taken.has(`choice_${at}`)) at++;
            return { ...node, options: [...(node.options ?? []), { value: `choice_${at}`, label: __('New choice', 'wconvert') }] };
          })}>{__('Add choice', 'wconvert')}</button>}
        </div>}
        <label className="wconvert-journey-settings__check"><input type="checkbox" checked={question.required === true} onChange={event => change(question.id, node => ({ ...node, required: event.target.checked }))} />{__('Answer required', 'wconvert')}</label>
        {refs.length > 0 && <div><strong>{__('Used by', 'wconvert')}</strong> {refs.map(id => <button type="button" key={id} onClick={() => onSelect(tree.steps.findIndex(item => item.id === id))}>{tree.steps.find(item => item.id === id)?.name}</button>)}
          <p>{__('Remove its conditions before changing the answer type or deleting a referenced choice.', 'wconvert')}</p></div>}
      </div>;
    })}
  </section>;
}

interface Product { id: number; name: string; is_in_stock?: boolean; images?: { thumbnail?: string }[]; prices?: { price?: string; currency_code?: string; currency_minor_unit?: number } }
function productPrice(product: Product): string {
  const price = product.prices;
  if (!price?.price || !price.currency_code || !Number.isInteger(price.currency_minor_unit)) return '';
  const amount = Number(price.price) / Math.pow(10, price.currency_minor_unit!);
  if (!Number.isFinite(amount)) return '';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency_code }).format(amount); }
  catch { return `${amount} ${price.currency_code}`; }
}
function ProductPicker({ ids, onChange }: { ids: readonly number[]; onChange(ids: number[]): void }) {
  const [query, setQuery] = useState(''); const [found, setFound] = useState<Product[]>([]); const [selected, setSelected] = useState<Product[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const selectedKey = ids.join(',');
  useEffect(() => {
    if (!selectedKey) { setSelected([]); return; }
    let current = true;
    void apiFetch<Product[]>({ path: `/wc/store/v1/products?${selectedKey.split(',').map(id => `include%5B%5D=${id}`).join('&')}&per_page=6&catalog_visibility=visible` })
      .then(products => { if (current) setSelected(products); })
      .catch(() => { if (current) setSelected([]); });
    return () => { current = false; };
  }, [selectedKey]);
  const productName = (id: number) => [...found, ...selected].find(product => product.id === id)?.name ?? `#${id}`;
  const move = (index: number, direction: -1 | 1) => { const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); };
  const search = async () => {
    setBusy(true); setError('');
    try {
      const products = await apiFetch<Product[]>({ path: `/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=12&catalog_visibility=visible` });
      setFound(products);
    } catch { setError(__('WooCommerce products could not load. Check that WooCommerce is active, then retry.', 'wconvert')); }
    finally { setBusy(false); }
  };
  return <div className="wconvert-journey-settings__products">
    <label>{__('Find products', 'wconvert')}<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    <button type="button" onClick={() => void search()} disabled={busy || !query.trim()}>{busy ? __('Searching…', 'wconvert') : __('Search catalog', 'wconvert')}</button>
    {error && <p role="alert">{error}</p>}
    <p>{__('Select up to six products in priority order. Up to three currently available products appear to visitors.', 'wconvert')}</p>
    {!!ids.length && <ol>{ids.map((id, index) => <li key={id}>{productName(id)}
      <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${__('Move earlier', 'wconvert')}: ${productName(id)}`}>{__('Earlier', 'wconvert')}</button>
      <button type="button" disabled={index === ids.length - 1} onClick={() => move(index, 1)} aria-label={`${__('Move later', 'wconvert')}: ${productName(id)}`}>{__('Later', 'wconvert')}</button>
      <button type="button" onClick={() => onChange(ids.filter(item => item !== id))}>{__('Remove', 'wconvert')}</button></li>)}</ol>}
    {!!found.length && <ul>{found.map(product => <li key={product.id}>
      {product.images?.[0]?.thumbnail && <img alt="" src={product.images[0].thumbnail} width="36" height="36" />}
      <span>{product.name} {product.is_in_stock === false ? __('Out of stock', 'wconvert') : ''} {productPrice(product)}</span>
      <button type="button" disabled={ids.includes(product.id) || ids.length >= 6 || product.is_in_stock === false} onClick={() => onChange([...ids, product.id])}>{__('Add', 'wconvert')}</button>
    </li>)}</ul>}
  </div>;
}

export function ResultSettings({ tree, step, onChange }: { tree: TemplateTree; step: number; onChange(next: TemplateTree): void }) {
  const screen = tree.steps[step];
  if (screen.kind !== 'result') return null;
  const variants = screen.results ?? [];
  const sources = questionsBefore(tree, step);
  const setVariants = (results: readonly ResultVariant[]) => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, results } : item) });
  const edit = (at: number, update: Partial<ResultVariant>) => setVariants(variants.map((item, index) => index === at ? { ...item, ...update } : item));
  return <section className="wconvert-journey-settings"><h4>{__('Results', 'wconvert')}</h4>
    <p>{__('The first matching result wins. Everyone else always gets the final fallback.', 'wconvert')}</p>
    <label className="wconvert-journey-settings__check"><input type="checkbox" checked={screen.products_required === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, products_required: event.target.checked } : item) })} />{__('Require live products before publishing', 'wconvert')}</label>
    {variants.map((variant, at) => <div key={variant.id} className="wconvert-journey-settings__result">
      <h5>{at === variants.length - 1 ? __('Everyone else', 'wconvert') : `${__('Result', 'wconvert')} ${at + 1}`}</h5>
      {at < variants.length - 1 && <ConditionSettings required value={variant.when} sources={sources} onChange={when => { if (when) edit(at, { when }); }} />}
      <label>{__('Heading', 'wconvert')}<input value={variant.heading} maxLength={200} onChange={event => edit(at, { heading: event.target.value })} /></label>
      <label>{__('Message and product fallback', 'wconvert')}<textarea value={variant.body ?? ''} maxLength={500} onChange={event => edit(at, { body: event.target.value })} /></label>
      <label>{__('Fallback shop or guide link', 'wconvert')}<input type="text" inputMode="url" placeholder="/shop/" value={variant.href ?? ''} onChange={event => edit(at, { href: event.target.value })} /></label>
      <label>{__('Link label', 'wconvert')}<input value={variant.link_label ?? ''} maxLength={120} onChange={event => edit(at, { link_label: event.target.value })} /></label>
      <ProductPicker ids={variant.product_ids ?? []} onChange={product_ids => edit(at, { product_ids })} />
      {at < variants.length - 1 && <button type="button" onClick={() => setVariants(variants.filter((_, index) => index !== at))}>{__('Remove result', 'wconvert')}</button>}
    </div>)}
    {variants.length < 6 && sources.length > 0 && <button type="button" onClick={() => {
      const q = sources[0]; let i = 1; while (variants.some(item => item.id === `result_${i}`)) i++;
      setVariants([...variants.slice(0, -1), { id: `result_${i}`, heading: __('Your result', 'wconvert'), body: __('Here is a good place to start.', 'wconvert'), product_ids: [], when: { match: 'all', clauses: [{ question: q.id, operator: q.answer_type === 'multi' ? 'includes_any' : 'is', values: [q.options?.[0]?.value ?? ''] }] } }, ...variants.slice(-1)]);
    }}>{__('Add matching result', 'wconvert')}</button>}
  </section>;
}
