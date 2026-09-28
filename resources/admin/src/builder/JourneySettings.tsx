import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { ChevronDown } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionClause, QuestionCondition, QuestionNode, ResultVariant, TemplateNode, TemplateTree } from '@renderer/types';
import { replaceAnswer, unreachableScreens, walkNodes } from './structure/journey';
import { followupGroups } from './structure/followupGroups';
import { questionTypeChange } from './structure/questionTypeChange';
import { retireAnswerPlan } from './structure/retireAnswer';
import { answerReferences } from './structure/answerReferences';
import { conditionText, resultsMayOverlap } from './structure/conditionText';
import type { JourneyRepair } from './structure/journeyReadiness';
import { graphEdgeId, graphReaches } from './structure/graph';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { InfoTip } from '../shell/InfoTip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

type ChoiceQuestion = QuestionNode & { id: string };
const questionsBefore = (tree: TemplateTree, at: number): ChoiceQuestion[] => tree.steps.filter((screen, index) => tree.graph
  ? index !== at && graphReaches(tree.graph, screen.id, tree.steps[at].id)
  : index < at)
  .flatMap(screen => walkNodes(screen.content))
  .filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string'
    && 'answer_type' in node && node.answer_type !== 'text') as ChoiceQuestion[];

function replaceNode(node: TemplateNode, id: string, update: (node: QuestionNode) => TemplateNode): TemplateNode {
  if (node.type === 'question' && 'id' in node && node.id === id) return update(node as QuestionNode);
  const copy = { ...node } as Record<string, unknown>;
  for (const key of ['children', 'start', 'end']) if (Array.isArray(copy[key])) copy[key] = (copy[key] as TemplateNode[]).map(child => replaceNode(child, id, update));
  return copy as TemplateNode;
}

export function ConditionSettings({ value, sources, onChange, required = false, purpose = 'screen', deliberate = false }: {
  value?: QuestionCondition; sources: ChoiceQuestion[]; onChange(value?: QuestionCondition): void; required?: boolean;
  purpose?: 'screen' | 'route' | 'result'; deliberate?: boolean;
}) {
  const initial = (q: ChoiceQuestion): QuestionClause => ({ question: q.id, operator: q.answer_type === 'multi' ? 'includes_any' : 'is', values: deliberate ? [] : [q.options?.[0]?.value ?? ''] });
  const patch = (index: number, clause: QuestionCondition['clauses'][number]) => onChange({ match: value?.match ?? 'all', clauses: (value?.clauses ?? []).map((old, at) => at === index ? clause : old) });
  return <div className="wconvert-journey-settings wconvert-condition-settings">
    {!required && <label>{__('Show this screen', 'wconvert')}
      <select value={value ? 'match' : 'always'} onChange={event => onChange(event.target.value === 'match' && sources[0] ? { match: 'all', clauses: [initial(sources[0])] } : undefined)}>
        <option value="always">{__('For everyone', 'wconvert')}</option>
        <option value="match" disabled={!sources.length}>{__('Only if an answer matches', 'wconvert')}</option>
      </select>
    </label>}
    {!sources.length && <p>{__('Add a choice question on an earlier screen to use conditions.', 'wconvert')}</p>}
    {required && !value && <button type="button" disabled={!sources.length} onClick={() => {
      if (sources[0]) onChange({ match: 'all', clauses: [initial(sources[0])] });
    }}>{__('Add condition', 'wconvert')}</button>}
    {value && <>
      {value.clauses.length > 1 && <label>{__('Match', 'wconvert')}<select value={value.match} onChange={event => onChange({ ...value, match: event.target.value as 'all' | 'any' })}>
        <option value="all">{__('All conditions', 'wconvert')}</option><option value="any">{__('Any condition', 'wconvert')}</option>
      </select></label>}
      {value.clauses.map((clause, index) => {
        const source = sources.find(q => q.id === clause.question);
        const operators = source?.answer_type === 'multi' ? ['includes_any', 'includes_none'] : ['is', 'is_not'];
        const unavailable = source ? clause.values.filter(answer => answer && !source.options?.some(option => option.value === answer)) : [];
        return <div key={index} className="wconvert-journey-settings__clause">
          <span>{index === 0 ? __('If', 'wconvert') : value.match === 'all' ? __('And', 'wconvert') : __('Or', 'wconvert')}</span>
          <select aria-label={__('Question', 'wconvert')} value={clause.question} onChange={event => { const q = sources.find(item => item.id === event.target.value)!; patch(index, initial(q)); }}>
            {!source && <option value={clause.question} disabled>{clause.question ? __('Question unavailable on this path — choose another', 'wconvert') : __('Choose a question…', 'wconvert')}</option>}
            {sources.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
          <select aria-label={__('Comparison', 'wconvert')} value={clause.operator} disabled={!source} onChange={event => patch(index, { ...clause, operator: event.target.value as typeof clause.operator })}>
            {!operators.includes(clause.operator) && <option value={clause.operator} disabled>{__('Choose comparison…', 'wconvert')}</option>}
            {source?.answer_type === 'multi' ? <><option value="includes_any">{__('includes', 'wconvert')}</option><option value="includes_none">{__('does not include', 'wconvert')}</option></> : <><option value="is">{__('is', 'wconvert')}</option><option value="is_not">{__('is not', 'wconvert')}</option></>}
          </select>
          {source?.answer_type === 'multi' ? <fieldset className="wconvert-journey-settings__answers">
            <legend>{clause.operator === 'includes_none' ? __('None of these answers', 'wconvert') : __('Any of these answers', 'wconvert')}</legend>
            {source.options?.map(option => <label key={option.value} className="wconvert-journey-settings__check"><input type="checkbox" checked={clause.values.includes(option.value)}
              onChange={event => patch(index, { ...clause, values: event.target.checked
                ? [...clause.values.filter(value => value !== ''), option.value]
                : clause.values.filter(value => value !== option.value && value !== '') })} />{option.label}</label>)}
            {unavailable.length > 0 && <div role="status"><small>{__('This rule contains an answer that is no longer available.', 'wconvert')}</small>
              <button type="button" data-destructive="true" onClick={() => patch(index, { ...clause, values: clause.values.filter(answer => !unavailable.includes(answer)) })}>{__('Remove unavailable answers', 'wconvert')}</button></div>}
            {!clause.values.some(value => value !== '') && <small>{__('Choose at least one answer.', 'wconvert')}</small>}
          </fieldset> : <select aria-label={__('Answer', 'wconvert')} disabled={!source} value={clause.values[0] ?? ''} onChange={event => patch(index, { ...clause, values: [event.target.value] })}>
            {!clause.values[0] && <option value="">{__('Choose answer…', 'wconvert')}</option>}
            {clause.values[0] && (!source || unavailable.length > 0) && <option value={clause.values[0]} disabled>{__('Answer unavailable — choose another', 'wconvert')}</option>}
            {source?.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>}
          <button type="button" data-destructive="true" onClick={() => { const clauses = value.clauses.filter((_, at) => at !== index); onChange(clauses.length || required ? { ...value, clauses } : undefined); }}>{__('Remove', 'wconvert')}</button>
        </div>;
      })}
      {value.clauses.length < 5 && <button type="button" disabled={!sources.length} onClick={() => { if (sources[0]) onChange({ ...value, clauses: [...value.clauses, initial(sources[0])] }); }}>{value.clauses.length ? __('Add another condition', 'wconvert') : __('Add condition', 'wconvert')}</button>}
      <div className="wconvert-editor-help"><p>{purpose === 'route'
        ? __('Otherwise, check the next path.', 'wconvert')
        : required
          ? __('Otherwise, check the next result.', 'wconvert')
          : __('Otherwise, skip this screen.', 'wconvert')}</p>
        <InfoTip label={__('How answer conditions work', 'wconvert')}>
          {__('A skipped or unanswered question never matches, including “is not” and “does not include”. Only answered questions are compared.', 'wconvert')}
        </InfoTip>
      </div>
    </>}
  </div>;
}

/** Routes are ordered alternatives. The last route is always the fallback. */
export function RouteSettings({ tree, step, focusPath = null, onChange, onInsert }: {
  tree: TemplateTree; step: number; focusPath?: number | null; onChange(next: TemplateTree): void; onInsert?(priority: number, kind: 'content' | 'input'): void;
}) {
  const [pending, setPending] = useState<{ tree: TemplateTree; disconnected: readonly string[] } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (focusPath === null) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-path-priority="${focusPath}"]`);
    row?.scrollIntoView?.({ block: 'nearest' });
    row?.querySelector<HTMLElement>('select')?.focus();
  }, [focusPath, step]);
  const screen = tree.steps[step];
  if (!screen || step === tree.steps.length - 1) return null;
  const boundary = tree.steps.findIndex((item, index) => index > step && (['result', 'acknowledgement'].includes(item.kind)
    || walkNodes(item.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')));
  const last = boundary < 0 ? tree.steps.length - 1 : boundary;
  const targets = tree.steps.slice(step + 1, last + 1);
  const sources = tree.steps.slice(0, step + 1).flatMap(item => walkNodes(item.content))
    .filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string'
      && 'answer_type' in node && node.answer_type !== 'text') as ChoiceQuestion[];
  const paths = screen.paths ?? [{ to: tree.steps[step + 1].id }];
  const write = (next: typeof paths) => {
    const changed = { ...tree, steps: tree.steps.map((item, index) => index === step
      ? { ...item, paths: next.length === 1 && !next[0].when && next[0].to === tree.steps[step + 1].id ? undefined : next } : item) };
    const already = new Set(unreachableScreens(tree));
    const disconnected = unreachableScreens(changed).filter(name => !already.has(name));
    if (disconnected.length) setPending({ tree: changed, disconnected });
    else onChange(changed);
  };
  const unused = targets.find(target => !paths.some(path => path.to === target.id));
  const unreachable = unreachableScreens(tree);
  const add = () => {
    if (!sources.length || !unused || paths.length >= 6) return;
    const question = sources[0];
    const used = new Set(paths.flatMap(path => path.when?.clauses.filter(clause => clause.question === question.id).flatMap(clause => clause.values) ?? []));
    const suggested = question.options?.find(option => !used.has(option.value))?.value ?? '';
    write([{ to: unused.id, when: { match: 'all', clauses: [{ question: question.id,
      operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [suggested] }] } }, ...paths]);
  };
  return <section className="wconvert-journey-settings wconvert-journey-routes"><h4>{__('Next paths', 'wconvert')}</h4>
    <p>{paths.length > 1 ? __('Visitors take the first matching path. If none match, they take Everyone else.', 'wconvert')
      : __('After this screen, visitors continue to the next relevant screen.', 'wconvert')}</p>
    {screen.when && screen.paths && <p>{__('If this screen is hidden, visitors continue to the next screen without checking these paths.', 'wconvert')}</p>}
    {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Preserve list semantics in WebKit when list-style is none. */}
    <ol ref={list} className="wconvert-journey-routes__list" role="list">{paths.map((path, index) => <li key={`${index}-${path.to}`} data-path-priority={index}>
      <strong>{index === paths.length - 1 ? __('Everyone else', 'wconvert') : sprintf(__('%d. If the answer matches', 'wconvert'), index + 1)}</strong>
      <label>{__('Go to', 'wconvert')}<select value={path.to} onChange={event => write(paths.map((item, at) => at === index ? { ...item, to: event.target.value } : item))}>
        {targets.map(target => <option key={target.id} value={target.id} disabled={paths.some((item, at) => at !== index && item.to === target.id)}>{target.name}</option>)}
      </select></label>
      {path.when && <ConditionSettings required purpose="route" value={path.when} sources={sources} onChange={when => {
        if (when) write(paths.map((item, at) => at === index ? { ...item, when } : item));
      }} />}
      {path.when?.clauses.some(clause => !clause.values.length || clause.values.some(value => !value)) && <p className="wconvert-journey-settings__warning" role="status">{__('Choose an answer for this path before publishing.', 'wconvert')}</p>}
      {onInsert && tree.steps.length < 7 && <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-journey-routes__insert">{__('Insert on this path', 'wconvert')}</button></DropdownMenuTrigger>
        <DropdownMenuContent align="start"><DropdownMenuItem onSelect={() => onInsert(index, 'input')}>{__('Ask a question', 'wconvert')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onInsert(index, 'content')}>{__('Show a message', 'wconvert')}</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>}
      {index < paths.length - 1 && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={index === 0} onClick={() => { const next = [...paths]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; write(next); }}>{__('Higher priority', 'wconvert')}</button>
        <button type="button" disabled={index >= paths.length - 2} onClick={() => { const next = [...paths]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; write(next); }}>{__('Lower priority', 'wconvert')}</button>
        <button type="button" data-destructive="true" onClick={() => write(paths.filter((_, at) => at !== index))}>{__('Remove path', 'wconvert')}</button>
      </div>}
    </li>)}</ol>
    {sources.length > 0 && unused && paths.length < 6 && <button type="button" onClick={add}>{__('Add answer path', 'wconvert')}</button>}
    {!sources.length && targets.length > 1 && <p>{__('Add a choice question here or earlier to branch by answer.', 'wconvert')}</p>}
    {unreachable.length > 0 && <p className="wconvert-journey-settings__warning" role="status">{sprintf(__('No path reaches: %s. Connect or remove these screens before publishing.', 'wconvert'), unreachable.join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Review this path change', 'wconvert')}
      description={pending ? sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach or submit from them. You can Undo after applying.', 'wconvert'), pending.disconnected.join(', ')) : ''}
      confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </section>;
}

export function ScreenConditionSettings({ tree, step, reveal, onChange, onSelect }: {
  tree: TemplateTree; step: number; reveal?: number; onChange(next: TemplateTree): void; onSelect(step: number): void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (reveal !== undefined && disclosure.current) disclosure.current.open = true; }, [reveal]);
  const screen = tree.steps[step];
  if (screen.id === (tree.graph?.entry ?? tree.steps[0].id) || ['result', 'acknowledgement'].includes(screen.kind)
    || walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')) return null;
  const sources = questionsBefore(tree, step);
  const groupedFollowup = followupGroups(tree).some(group => group.screens.includes(step));
  const hiddenDestination = tree.graph && tree.steps.find(item => item.id === tree.graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'hidden')?.to);
  return <details ref={disclosure} className="wconvert-journey-settings wconvert-journey-visibility"><summary><strong>{__('Show this screen when…', 'wconvert')}</strong><span>{screen.when ? conditionText(tree, screen.when) : __('Everyone on this path', 'wconvert')}</span></summary>
    <ConditionSettings value={screen.when} sources={sources} onChange={when => {
      const steps = tree.steps.map((item, at) => at === step ? { ...item, when } : item);
      if (!tree.graph) { onChange({ ...tree, steps }); return; }
      const edges = tree.graph.edges.filter(edge => !(edge.from === screen.id && edge.kind === 'hidden'));
      const fallback = edges.find(edge => edge.from === screen.id && edge.kind === 'default');
      const hidden = tree.graph.edges.find(edge => edge.from === screen.id && edge.kind === 'hidden');
      if (when && (hidden || fallback)) edges.push({ id: hidden?.id ?? graphEdgeId(tree.graph),
        from: screen.id, to: (hidden ?? fallback)!.to, kind: 'hidden' });
      onChange({ ...tree, steps, graph: { ...tree.graph, edges } });
    }} />
    {screen.when && <p className="wconvert-journey-settings__skip">{groupedFollowup ? __('If this does not match, skip this question and check the remaining follow-ups. All matching questions share one continuation.', 'wconvert') : tree.graph
      ? hiddenDestination ? sprintf(__('If this does not match, skip “%1$s” and continue at “%2$s”. Change that destination under Next screen.', 'wconvert'), screen.name, hiddenDestination.name)
        : __('Choose where visitors continue when this screen is hidden under Next screen.', 'wconvert')
      : sprintf(__('If this does not match, skip “%1$s” and check “%2$s” next. Other relevant follow-ups can still appear.', 'wconvert'), screen.name, tree.steps[step + 1]?.name ?? __('the ending', 'wconvert'))}</p>}
    {screen.when?.clauses.map(clause => { const source = questionsBefore(tree, step).find(q => q.id === clause.question);
      const sourceAt = tree.steps.findIndex(item => walkNodes(item.content).some(node => 'id' in node && node.id === clause.question));
      return source && sourceAt >= 0 ? <button key={clause.question} type="button" onClick={() => onSelect(sourceAt)}>{__('Edit source question:', 'wconvert')} {source.label}</button> : null;
    })}
  </details>;
}

export interface QuestionReviewContext {
  questionId: string;
  choiceValue?: string;
  replacement: string;
  retiring: boolean;
  answerType?: QuestionNode['answer_type'];
}

export function QuestionSettings({ tree, step, onChange, onSelect, onNavigate, onFollowup, onAction, resumeReview }: {
  tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void; onSelect(step: number): void; onNavigate?(repair: JourneyRepair, review: QuestionReviewContext): void; resumeReview?: QuestionReviewContext & { serial: number }; onFollowup?(question: string, value: string): void; onAction?(message: string): void;
}) {
  const [repair, setRepair] = useState<{ question: string; value: string } | null>(null);
  const [replacement, setReplacement] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [typeReview, setTypeReview] = useState<{ question: string; type: QuestionNode['answer_type'] } | null>(null);
  const reviewRoot = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!resumeReview) return;
    // Restore the review before paint so focus cannot race its state update.
    setRepair(resumeReview.choiceValue ? { question: resumeReview.questionId, value: resumeReview.choiceValue } : null);
    setReplacement(resumeReview.replacement);
    setRetiring(resumeReview.retiring);
    setTypeReview(resumeReview.answerType ? { question: resumeReview.questionId, type: resumeReview.answerType } : null);
    const frame = requestAnimationFrame(() => {
      const section = [...(reviewRoot.current?.querySelectorAll<HTMLElement>('[data-question-id]') ?? [])].find(item => item.dataset.questionId === resumeReview.questionId);
      const target = section?.querySelector<HTMLElement>('.wconvert-journey-answer-repair') ?? section?.querySelector<HTMLElement>('textarea');
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [resumeReview]);
  const screen = tree.steps[step];
  const questions = walkNodes(screen.content).filter((node): node is ChoiceQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string') as ChoiceQuestion[];
  if (!questions.length) return null;
  const change = (id: string, update: (node: QuestionNode) => TemplateNode, field?: string) => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, content: replaceNode(item.content, id, update) } : item) }, field ? `journey:${screen.id}:${id}:${field}` : undefined);
  return <section ref={reviewRoot} className="wconvert-journey-settings">{questions.length > 1 && <h4>{__('Questions on this screen', 'wconvert')}</h4>}
    {questions.map(question => {
      const refs = answerReferences(tree, question.id);
      const openReference = (reference: typeof refs[number]) => onNavigate ? onNavigate(reference.repair, { questionId: question.id, choiceValue: repair?.question === question.id ? repair.value : undefined, replacement, retiring, answerType: typeReview?.question === question.id ? typeReview.type : undefined }) : onSelect(tree.steps.findIndex(item => item.id === reference.repair.screenId));
      const protectedValues = new Set([...tree.steps.flatMap(item => [item.when, ...(item.results?.map(result => result.when) ?? []), ...(item.paths?.map(path => path.when) ?? [])]),
        ...(tree.graph?.edges.map(edge => edge.when) ?? [])]
        .flatMap(condition => condition?.clauses ?? []).filter(clause => clause.question === question.id).flatMap(clause => clause.values));
      const retirement = repair?.question === question.id ? retireAnswerPlan(tree, question.id, repair.value) : null;
      const reviewRefs = repair?.question === question.id ? answerReferences(tree, question.id, repair.value) : [];
      return <div key={question.id} data-question-id={question.id} className="wconvert-journey-settings__question">
        <label>{__('Question', 'wconvert')}<textarea rows={2} value={question.label} maxLength={200} onChange={event => change(question.id, node => ({ ...node, label: event.target.value }), 'label')} /></label>

        <label>{__('Answer type', 'wconvert')}<select value={question.answer_type} onChange={event => {
          const type = event.target.value as QuestionNode['answer_type'];
          if (refs.length) { setTypeReview({ question: question.id, type }); return; }
          change(question.id, node => ({ ...node, answer_type: type, options: type === 'text' ? [] : node.options?.length ? node.options : [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }] }));
        }}>
          <option value="single">{__('Choose one', 'wconvert')}</option><option value="multi">{__('Choose several', 'wconvert')}</option><option value="text">{__('Short answer', 'wconvert')}</option>
        </select></label>
        {typeReview?.question === question.id && <section tabIndex={-1} className="wconvert-journey-answer-repair" aria-label={__('Review answer type change', 'wconvert')}>
          <strong>{__('Review the affected conditions', 'wconvert')}</strong>
          <p>{typeReview.type === 'text' ? __('Short answers cannot keep rules based on selected choices. Edit the rules below first, then change the answer type.', 'wconvert')
            : questionTypeChange(tree, question.id, typeReview.type) ? __('Choice labels and connections will stay. Condition operators will be updated. Choosing several answers can match several rules; first-match priority still applies to exclusive paths and results. Test the journey after this change.', 'wconvert')
            : __('Some conditions compare several choices at once. Edit those conditions to use one choice each before switching to Choose one.', 'wconvert')}</p>
          {refs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}>{reference.label} · {reference.detail} →</button>)}
          <div className="wconvert-journey-answer-repair__actions"><button type="button" disabled={!questionTypeChange(tree, question.id, typeReview.type)} onClick={() => { const next = questionTypeChange(tree, question.id, typeReview.type); if (next) onChange(next); setTypeReview(null); }}>{__('Apply answer type change', 'wconvert')}</button><button type="button" onClick={() => setTypeReview(null)}>{__('Cancel', 'wconvert')}</button></div>
        </section>}
        {question.answer_type !== 'text' && <div><strong>{__('Choices', 'wconvert')}</strong>
          {question.options?.map((option, at) => <div key={option.value} className="wconvert-journey-settings__choice"><span aria-hidden="true">{at + 1}</span><input aria-label={`${__('Choice', 'wconvert')} ${at + 1}`} value={option.label} maxLength={120}
            onChange={event => change(question.id, node => ({ ...node, options: node.options?.map((old, i) => i === at ? { ...old, label: event.target.value } : old) }), `choice:${option.value}`)} />
            <button type="button" data-destructive={!protectedValues.has(option.value) || undefined} disabled={(question.options?.length ?? 0) <= 2 && !protectedValues.has(option.value)} onClick={() => {
              if (protectedValues.has(option.value)) { setRepair({ question: question.id, value: option.value }); setReplacement(''); setRetiring(false); }
              else change(question.id, node => ({ ...node, options: node.options?.filter((_, i) => i !== at) }));
            }}>{protectedValues.has(option.value) ? __('Review uses', 'wconvert') : __('Remove', 'wconvert')}</button>
            {onFollowup && <button type="button" className="wconvert-answer-followup" aria-label={sprintf(__('Add follow-up for %s', 'wconvert'), option.label)} onClick={() => onFollowup(question.id, option.value)}>{__('+ Follow-up', 'wconvert')}</button>}</div>)}
          {repair?.question === question.id && <div tabIndex={-1} className="wconvert-journey-answer-repair" role="region" aria-label={__('Review answer uses', 'wconvert')}>
            <strong>{sprintf(reviewRefs.length ? __('“%s” is used in journey rules', 'wconvert') : __('No rules use “%s” now', 'wconvert'), question.options?.find(option => option.value === repair.value)?.label ?? repair.value)}</strong>
            <p>{reviewRefs.length ? __('Review the rules below. Replace this answer with another choice, or stop offering it and review what will be removed.', 'wconvert') : __('Your rule changes are kept. You can now remove this choice without changing other behavior.', 'wconvert')}</p>
            <div>{reviewRefs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}><strong>{reference.label}</strong>{' '}<small>{reference.detail} →</small></button>)}</div>
            {retirement && (question.options?.length ?? 0) > 2 && <details className="wconvert-answer-retirement" open={retiring} onToggle={event => setRetiring(event.currentTarget.open)}><summary>{__('Stop offering this answer…', 'wconvert')}</summary>
              <p>{__('Review the matching behavior that will be removed with this choice. Other choices and previously saved Leads stay unchanged.', 'wconvert')}</p>
              {retirement.reason ? <p role="status">{retirement.reason}</p> : <>{retirement.removed.length > 0 && <><strong>{__('Also remove', 'wconvert')}</strong><ul>{retirement.removed.map((name, index) => <li key={index}>{name}</li>)}</ul></>}<Button type="button" variant="destructive" onClick={() => { if (retirement.next) { onChange(retirement.next); setRepair(null); onAction?.(__('Choice and listed behavior removed. Test the remaining answers.', 'wconvert')); } }}>{retirement.removed.length ? __('Remove choice and listed behavior', 'wconvert') : __('Remove choice', 'wconvert')}</Button></>}
            </details>}
            {reviewRefs.length > 0 && <label>{__('Replace its uses with', 'wconvert')}<select value={question.options?.some(option => option.value === replacement && option.value !== repair.value) ? replacement : ''} onChange={event => setReplacement(event.target.value)}>
              <option value="">{__('Choose an existing answer…', 'wconvert')}</option>
              {question.options?.filter(option => option.value !== repair.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>}
            <div className="wconvert-journey-answer-repair__actions">{reviewRefs.length > 0 && <button type="button" disabled={!question.options?.some(option => option.value === replacement && option.value !== repair.value) || (question.options?.length ?? 0) <= 2} onClick={() => { onChange(replaceAnswer(tree, question.id, repair.value, replacement)); setRepair(null); }}>
              {__('Replace uses & remove', 'wconvert')}</button>}<button type="button" onClick={() => setRepair(null)}>{__('Cancel', 'wconvert')}</button></div>
            {(question.options?.length ?? 0) <= 2 && <p>{__('Keep at least two choices. Add another choice before removing this one.', 'wconvert')}</p>}
            <small>{__('One draft change. Undo restores the answer and its references.', 'wconvert')}</small>
          </div>}
          {(question.options?.length ?? 0) < 12 && <button type="button" onClick={() => change(question.id, node => {
            const taken = new Set(node.options?.map(item => item.value)); let at = 1; while (taken.has(`choice_${at}`)) at++;
            return { ...node, options: [...(node.options ?? []), { value: `choice_${at}`, label: __('New choice', 'wconvert') }] };
          })}>{__('Add choice', 'wconvert')}</button>}
        </div>}
        <label className="wconvert-journey-settings__check"><input type="checkbox" checked={question.required === true} onChange={event => change(question.id, node => ({ ...node, required: event.target.checked }))} />{__('Answer required', 'wconvert')}</label>
        <label>{__('Help text (optional)', 'wconvert')}<input value={question.help ?? ''} maxLength={300} onChange={event => change(question.id, node => ({ ...node, help: event.target.value }), 'help')} /></label>

        {question.answer_type === 'multi' && <p>{__('Visitors can choose several answers and see every relevant follow-up.', 'wconvert')}</p>}
        {refs.length > 0 && <div className="wconvert-journey-used-by"><strong>{__('Used by', 'wconvert')}</strong> {refs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}><strong>{reference.label}</strong>{' '}<small>{reference.detail} →</small></button>)}
          <p>{__('Changing answer type requires reviewing these rules. Editing choice labels keeps their connections.', 'wconvert')}</p></div>}
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
      <button type="button" data-destructive="true" onClick={() => onChange(ids.filter(item => item !== id))}>{__('Remove', 'wconvert')}</button></li>)}</ol>}
    {!!found.length && <ul>{found.map(product => <li key={product.id}>
      {product.images?.[0]?.thumbnail && <img alt="" src={product.images[0].thumbnail} width="36" height="36" />}
      <span>{product.name} {product.is_in_stock === false ? __('Out of stock', 'wconvert') : ''} {productPrice(product)}</span>
      <button type="button" disabled={ids.includes(product.id) || ids.length >= 6 || product.is_in_stock === false} onClick={() => onChange([...ids, product.id])}>{__('Add', 'wconvert')}</button>
    </li>)}</ul>}
  </div>;
}

export function ResultSettings({ tree, step, onChange, repairRequest, onResultSelect }: { onResultSelect?(id: string | undefined): void; tree: TemplateTree; step: number; onChange(next: TemplateTree, coalesce?: string): void;
  repairRequest?: JourneyRepair & { readonly serial: number } }) {
  const tabsId = useId();
  const [draftResult, setDraftResult] = useState<{ heading: string; when: QuestionCondition } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const linkInput = useRef<HTMLInputElement>(null);
  const headingInput = useRef<HTMLInputElement>(null);
  const productsRequired = useRef<HTMLInputElement>(null);
  const settingsRoot = useRef<HTMLElement>(null);
  const handledRepair = useRef(0);
  useLayoutEffect(() => {
    if (!repairRequest || handledRepair.current === repairRequest.serial) return;
    if (repairRequest.focus === 'products-required') {
      productsRequired.current?.focus(); handledRepair.current = repairRequest.serial; return;
    }
    if (!repairRequest.resultId) return;
    // Focus only after the requested result's inputs have committed. Focusing the
    // previous result before switching tabs loses focus when that input unmounts.
    if (selectedId !== repairRequest.resultId) { setSelectedId(repairRequest.resultId); return; }
    const target = repairRequest.focus === 'result-link' ? linkInput.current
      : repairRequest.focus === 'result-heading' ? headingInput.current
      : settingsRoot.current?.querySelector<HTMLElement>('.wconvert-journey-settings__result .wconvert-journey-settings__clause select, .wconvert-journey-settings__result .wconvert-journey-settings button');
    (target ?? linkInput.current)?.focus();
    handledRepair.current = repairRequest.serial;
  }, [repairRequest, selectedId]);
  const screen = tree.steps[step];
  const variants = screen.results ?? [];
  const previewResult = variants.find(variant => variant.id === selectedId) ?? variants[0];
  useEffect(() => { onResultSelect?.(previewResult?.id); }, [previewResult?.id, onResultSelect]);
  if (screen.kind !== 'result') return null;
  const sources = questionsBefore(tree, step);
  const selected = selectedId === null ? undefined : variants.find(variant => variant.id === selectedId) ?? variants[0];
  const selectedAt = variants.findIndex(variant => variant.id === selected?.id);
  let overlap: [ResultVariant, ResultVariant] | undefined;
  for (let at = 0; at < variants.length - 1 && !overlap; at++) {
    for (let next = at + 1; next < variants.length - 1; next++) {
      if (resultsMayOverlap(tree, variants[at], variants[next])) { overlap = [variants[at], variants[next]]; break; }
    }
  }
  const setVariants = (results: readonly ResultVariant[], coalesce?: string) => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, results } : item) }, coalesce);
  const edit = (at: number, update: Partial<ResultVariant>, field?: string) => setVariants(variants.map((item, index) => index === at ? { ...item, ...update } : item), field ? `journey:${screen.id}:${variants[at].id}:${field}` : undefined);
  const move = (from: number, to: number) => {
    const next = [...variants];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setVariants(next);
    setSelectedId(item.id);
  };
  const resultReady = draftResult && draftResult.heading.trim() && draftResult.when.clauses.length > 0 && draftResult.when.clauses.every(clause => {
    const source = sources.find(question => question.id === clause.question);
    return source && clause.values.length > 0 && clause.values.every(value => source.options?.some(option => option.value === value));
  });
  const addResult = () => {
    if (!draftResult || !resultReady) return;
    let i = 1; while (variants.some(item => item.id === `result_${i}`)) i++;
    const id = `result_${i}`;
    setVariants([...variants.slice(0, -1), { id, heading: draftResult.heading.trim(), body: '', product_ids: [], when: draftResult.when }, ...variants.slice(-1)]);
    setSelectedId(id); setDraftResult(null);
  };
  return <section ref={settingsRoot} className="wconvert-journey-settings"><div className="wconvert-journey-settings__result-heading"><h4>{__('Results', 'wconvert')}</h4>
    {variants.length < 6 && sources.length > 0 && <button type="button" onClick={() => setDraftResult({ heading: '', when: { match: 'all', clauses: [{ question: '', operator: 'is', values: [] }] } })}>{__('Add matching result', 'wconvert')}</button>}
  </div>
    <div className="wconvert-editor-help"><p>{__('First matching result wins.', 'wconvert')}</p><InfoTip label={__('How results are chosen', 'wconvert')}>{__('Results are checked from top to bottom. Visitors see the first match, or Everyone else if none match. Move results to change their priority.', 'wconvert')}</InfoTip></div>
    {overlap && <p className="wconvert-journey-settings__warning" role="status">{sprintf(__('“%1$s” and “%2$s” may match the same answers. The result listed first wins; test both paths.', 'wconvert'), overlap[0].heading, overlap[1].heading)}</p>}
    <div className="wconvert-journey-results" role="group" aria-label={__('Possible results', 'wconvert')}>
      {variants.map((variant, at) => <div className="wconvert-journey-result-card" key={variant.id}><button className="wconvert-journey-result-summary" type="button" id={`${tabsId}-result-${at}`} aria-controls={`${tabsId}-panel-${at}`}
        aria-expanded={selected?.id === variant.id} onClick={() => setSelectedId(selected?.id === variant.id ? null : variant.id)}>
        <strong>{at === variants.length - 1 ? __('Everyone else', 'wconvert') : sprintf(__('%1$d. %2$s', 'wconvert'), at + 1, variant.heading || sprintf(__('Result %d', 'wconvert'), at + 1))}</strong>
        <span>{at === variants.length - 1 ? __('Default when no other result matches', 'wconvert')
          : variant.when ? sprintf(__('If %s', 'wconvert'), conditionText(tree, variant.when)) : __('Set a condition', 'wconvert')}</span><ChevronDown aria-hidden="true" className="wconvert-journey-result-chevron" />
      </button>
    {selected?.id === variant.id && <div className="wconvert-journey-settings__result" role="region" id={`${tabsId}-panel-${at}`} aria-labelledby={`${tabsId}-result-${at}`}>

      <label>{__('Heading', 'wconvert')}<input ref={headingInput} value={selected.heading} maxLength={200} onChange={event => edit(selectedAt, { heading: event.target.value }, 'heading')} /></label>
      <label>{__('Message', 'wconvert')}<textarea value={selected.body ?? ''} maxLength={500} onChange={event => edit(selectedAt, { body: event.target.value }, 'body')} /></label>
      <label>{__('Fallback shop or guide link', 'wconvert')}<input ref={linkInput} type="text" inputMode="url" placeholder="/shop/" value={selected.href ?? ''} onChange={event => edit(selectedAt, { href: event.target.value }, 'href')} /></label>
      <label>{__('Link label', 'wconvert')}<input value={selected.link_label ?? ''} maxLength={120} onChange={event => edit(selectedAt, { link_label: event.target.value }, 'link_label')} /></label>
      <details className="wconvert-result-products" open={!!selected.product_ids?.length || screen.products_required || undefined}><summary>{__('Recommend products (optional)', 'wconvert')}</summary><ProductPicker ids={selected.product_ids ?? []} onChange={product_ids => edit(selectedAt, { product_ids })} /></details>
      {selectedAt < variants.length - 1 && <ConditionSettings required value={selected.when} sources={sources} onChange={when => { if (when) edit(selectedAt, { when }); }} />}
      {selectedAt < variants.length - 1 && <div className="wconvert-journey-result-actions">
      {variants.length > 2 && <div className="wconvert-journey-settings__result-order">
        <button type="button" disabled={selectedAt === 0} onClick={() => move(selectedAt, selectedAt - 1)}>{__('Move earlier', 'wconvert')}</button>
        <button type="button" disabled={selectedAt >= variants.length - 2} onClick={() => move(selectedAt, selectedAt + 1)}>{__('Move later', 'wconvert')}</button>
      </div>}
      <button type="button" data-destructive="true" onClick={() => { setSelectedId(null); setVariants(variants.filter((_, index) => index !== selectedAt)); }}>{__('Remove result', 'wconvert')}</button>
      </div>}
    </div>}</div>)}
    </div>
    <details className="wconvert-result-products" open={screen.products_required || repairRequest?.focus === 'products-required' || undefined}><summary>{__('Product availability requirements', 'wconvert')}</summary><label className="wconvert-journey-settings__check"><input ref={productsRequired} type="checkbox" checked={screen.products_required === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, products_required: event.target.checked } : item) })} />{__('Require live products before publishing', 'wconvert')}</label></details>
    <Dialog open={draftResult !== null} onOpenChange={open => { if (!open) setDraftResult(null); }}><DialogContent className="wconvert-graph-insert">
      <DialogTitle>{__('Add matching result', 'wconvert')}</DialogTitle><DialogDescription>{__('Choose who sees this result. Nothing changes until you add it.', 'wconvert')}</DialogDescription>
      {draftResult && <><div className="wconvert-graph-insert__body"><label>{__('Result heading', 'wconvert')}<Input value={draftResult.heading} maxLength={200} onChange={event => setDraftResult({ ...draftResult, heading: event.target.value })} /></label>
        <ConditionSettings deliberate required purpose="result" value={draftResult.when} sources={sources} onChange={when => setDraftResult({ ...draftResult, when: when ?? { match: 'all', clauses: [] } })} />
        <p>{__('Checked after your existing results, before Everyone else. You can change its priority afterward.', 'wconvert')}</p>
        {variants.slice(0, -1).filter(result => resultReady && resultsMayOverlap(tree, result, { ...draftResult, id: 'new-result' })).map(result => <p key={result.id} role="status">{sprintf(__('“%s” may match the same answers and is checked first.', 'wconvert'), result.heading)}</p>)}
      </div><div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={() => setDraftResult(null)}>{__('Cancel', 'wconvert')}</Button><Button type="button" disabled={!resultReady} onClick={addResult}>{__('Add result', 'wconvert')}</Button></div></>}
    </DialogContent></Dialog>
  </section>;
}
