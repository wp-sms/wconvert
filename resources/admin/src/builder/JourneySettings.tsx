import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, FilePlus2, GitBranch, ListPlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { QuestionClause, QuestionCondition, QuestionNode, ResultVariant, TemplateNode, TemplateTree } from '@renderer/types';
import { replaceAnswer, unreachableScreens, walkNodes } from './structure/journey';
import { followupGroups } from './structure/followupGroups';
import { questionTypeChange } from './structure/questionTypeChange';
import { retireAnswerPlan } from './structure/retireAnswer';
import { answerReferences } from './structure/answerReferences';
import { conditionText, resultsMayOverlap } from './structure/conditionText';
import type { JourneyRepair } from './structure/journeyReadiness';
import { graphReaches } from './structure/graph';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Dialog } from '../components/ui/dialog';
import { AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { Disclosure } from '../shell/Disclosure';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LinkField } from './LinkField';
import { ResultProductFilter } from './ResultProductFilter';
import { ProductPicker } from './ResultProductPicker';
import { commerceSupported } from '../settings';
import { tierProductName, unlessFree } from '../goals/availability';
import { InfoTip } from '../shell/InfoTip';
import { FieldHeading, PanelField, PanelHint, PanelSection } from './PanelSection';
import { CheckRow } from '../shell/CheckRow';
import { DropdownMenu, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { OptionItem, OptionMenuContent } from '../components/ui/option-menu';
import { AutoGrowTextarea } from './AutoGrowTextarea';

type ChoiceQuestion = QuestionNode & { id: string };

/** An answer type in the words the Answer type menu uses. */
export function answerTypeName(type: string): string {
  return type === 'multi' ? __('Choose several', 'wconvert') : type === 'text' ? __('Short answer', 'wconvert') : __('Choose one', 'wconvert');
}
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
    {!required && <label>{__('Show only if…', 'wconvert')}
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
            {source.options?.map(option => <CheckRow key={option.value} className="wconvert-check" label={option.label} checked={clause.values.includes(option.value)}
              onChange={event => patch(index, { ...clause, values: event.target.checked
                ? [...clause.values.filter(value => value !== ''), option.value]
                : clause.values.filter(value => value !== option.value && value !== '') })} />)}
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
  // The section around this names it and carries the explainer as an InfoTip (ADR 0136).
  return <div className="wconvert-journey-settings wconvert-journey-routes">
    {screen.when && screen.paths && <PanelHint>{__('Skipped visitors continue to the next screen without checking these paths.', 'wconvert')}</PanelHint>}
    {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Preserve list semantics in WebKit when list-style is none. */}
    <ol ref={list} className="wconvert-journey-routes__list" role="list">{paths.map((path, index) => <li key={`${index}-${path.to}`} data-path-priority={index}>
      <strong>{index === paths.length - 1 ? __('All other answers', 'wconvert') : sprintf(__('%d. If the answer matches', 'wconvert'), index + 1)}</strong>
      <label>{__('Go to', 'wconvert')}<select value={path.to} onChange={event => write(paths.map((item, at) => at === index ? { ...item, to: event.target.value } : item))}>
        {targets.map(target => <option key={target.id} value={target.id} disabled={paths.some((item, at) => at !== index && item.to === target.id)}>{target.name}</option>)}
      </select></label>
      {path.when && <ConditionSettings required purpose="route" value={path.when} sources={sources} onChange={when => {
        if (when) write(paths.map((item, at) => at === index ? { ...item, when } : item));
      }} />}
      {path.when?.clauses.some(clause => !clause.values.length || clause.values.some(value => !value)) && <p className="wconvert-journey-settings__warning" role="status">{__('Choose an answer for this path before publishing.', 'wconvert')}</p>}
      {onInsert && tree.steps.length < 7 && <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-journey-routes__insert">{__('Insert on this path', 'wconvert')}</button></DropdownMenuTrigger>
        <OptionMenuContent align="start" aria-label={__('Insert on this path', 'wconvert')}>
          <OptionItem icon={ListPlus} name={__('Ask a question', 'wconvert')} onSelect={() => onInsert(index, 'input')} />
          <OptionItem icon={FilePlus2} name={__('Show a message', 'wconvert')} onSelect={() => onInsert(index, 'content')} />
        </OptionMenuContent>
      </DropdownMenu>}
      {index < paths.length - 1 && <div className="wconvert-journey-routes__actions">
        <button type="button" disabled={index === 0} onClick={() => { const next = [...paths]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; write(next); }}>{__('Move up', 'wconvert')}</button>
        <button type="button" disabled={index >= paths.length - 2} onClick={() => { const next = [...paths]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; write(next); }}>{__('Move down', 'wconvert')}</button>
        <button type="button" data-destructive="true" onClick={() => write(paths.filter((_, at) => at !== index))}>{__('Remove path', 'wconvert')}</button>
      </div>}
    </li>)}</ol>
    {sources.length > 0 && unused && paths.length < 6 && <button type="button" className="wconvert-panel-link" onClick={add}>{__('Send some answers elsewhere', 'wconvert')}</button>}
    {!sources.length && targets.length > 1 && <PanelHint>{__('Add a choice question to send answers down different paths.', 'wconvert')}</PanelHint>}
    {unreachable.length > 0 && <p className="wconvert-panel-warn" role="status">{sprintf(/* translators: %s: screen names. */ __('No path reaches %s.', 'wconvert'), unreachable.join(', '))}</p>}
    <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title={__('Review this path change', 'wconvert')}
      description={pending ? sprintf(__('These screens would become unreachable: %s. They stay in the draft, but visitors cannot reach or submit from them. You can Undo after applying.', 'wconvert'), pending.disconnected.join(', ')) : ''}
      confirmLabel={__('Apply path change', 'wconvert')} onConfirm={() => { if (pending) onChange(pending.tree); setPending(null); }} />
  </div>;
}

export function ScreenConditionSettings({ tree, step, reveal, onChange, onSelect }: {
  tree: TemplateTree; step: number; reveal?: number; onChange(next: TemplateTree): void; onSelect(step: number): void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (reveal !== undefined) setOpen(true); }, [reveal]);
  const screen = tree.steps[step];
  if (screen.id === (tree.graph?.entry ?? tree.steps[0].id) || ['result', 'acknowledgement'].includes(screen.kind)
    || walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit')) return null;
  const sources = questionsBefore(tree, step);
  const groupedFollowup = followupGroups(tree).some(group => group.screens.includes(step));
  const skipTo = tree.graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'hidden')
    ?? tree.graph?.edges.find(edge => edge.from === screen.id && edge.kind === 'default');
  const hiddenDestination = tree.graph && tree.steps.find(item => item.id === skipTo?.to);
  return <Disclosure variant="inline" className="wconvert-journey-visibility" open={open} onToggle={setOpen}
    title={__('Shown if', 'wconvert')} summary={screen.when ? conditionText(tree, screen.when) : __('Everyone who reaches it', 'wconvert')}>
    <ConditionSettings value={screen.when} sources={sources} onChange={when => {
      const steps = tree.steps.map((item, at) => at === step ? { ...item, when } : item);
      if (!tree.graph) { onChange({ ...tree, steps }); return; }
      // A skipped screen falls through along its default edge (ADR 0135): a condition adds no
      // edge, and an override goes with the condition that needed it.
      const edges = when ? tree.graph.edges : tree.graph.edges.filter(edge => !(edge.from === screen.id && edge.kind === 'hidden'));
      onChange({ ...tree, steps, graph: { ...tree.graph, edges } });
    }} />
    {/* One line about the skip (ADR 0136): where a visitor this does not match goes. */}
    {screen.when && <PanelHint className="wconvert-journey-settings__skip">{groupedFollowup ? __('Skipped visitors check the next follow-up.', 'wconvert') : tree.graph
      ? hiddenDestination ? sprintf(/* translators: %s: a screen's name. */ __('Skipped visitors continue to %s.', 'wconvert'), hiddenDestination.name)
        : __('Choose where visitors continue after this screen.', 'wconvert')
      : sprintf(/* translators: %s: a screen's name. */ __('Skipped visitors continue to %s.', 'wconvert'), tree.steps[step + 1]?.name ?? __('the ending', 'wconvert'))}</PanelHint>}
    {screen.when?.clauses.map(clause => { const source = questionsBefore(tree, step).find(q => q.id === clause.question);
      const sourceAt = tree.steps.findIndex(item => walkNodes(item.content).some(node => 'id' in node && node.id === clause.question));
      return source && sourceAt >= 0 ? <button key={clause.question} type="button" className="wconvert-panel-link" onClick={() => onSelect(sourceAt)}>{sprintf(/* translators: %s: a question. */ __('Open “%s”', 'wconvert'), source.label)}</button> : null;
    })}
  </Disclosure>;
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
  return <PanelSection ref={reviewRoot} className="wconvert-journey-settings" title={questions.length > 1 ? __('Questions on this screen', 'wconvert') : undefined}>
    {questions.map(question => {
      const refs = answerReferences(tree, question.id);
      const openReference = (reference: typeof refs[number]) => onNavigate ? onNavigate(reference.repair, { questionId: question.id, choiceValue: repair?.question === question.id ? repair.value : undefined, replacement, retiring, answerType: typeReview?.question === question.id ? typeReview.type : undefined }) : onSelect(tree.steps.findIndex(item => item.id === reference.repair.screenId));
      const protectedValues = new Set([...tree.steps.flatMap(item => [item.when, ...(item.results?.map(result => result.when) ?? []), ...(item.paths?.map(path => path.when) ?? [])]),
        ...(tree.graph?.edges.map(edge => edge.when) ?? [])]
        .flatMap(condition => condition?.clauses ?? []).filter(clause => clause.question === question.id).flatMap(clause => clause.values));
      const retirement = repair?.question === question.id ? retireAnswerPlan(tree, question.id, repair.value) : null;
      const reviewRefs = repair?.question === question.id ? answerReferences(tree, question.id, repair.value) : [];
      return <div key={question.id} data-question-id={question.id} className="wconvert-journey-settings__question">
        <PanelField label={__('Question', 'wconvert')} htmlFor={`${question.id}-label`}><AutoGrowTextarea id={`${question.id}-label`} value={question.label} maxLength={200} onChange={event => change(question.id, node => ({ ...node, label: event.target.value }), 'label')} /></PanelField>

        <PanelField label={__('Answer type', 'wconvert')} htmlFor={`${question.id}-type`}
          tip={refs.length > 0 ? __('Changing it asks you to review the rules that use these answers. Renaming a choice keeps its paths.', 'wconvert') : undefined}>
          <select id={`${question.id}-type`} value={question.answer_type} onChange={event => {
          const type = event.target.value as QuestionNode['answer_type'];
          if (refs.length) { setTypeReview({ question: question.id, type }); return; }
          change(question.id, node => ({ ...node, answer_type: type, options: type === 'text' ? [] : node.options?.length ? node.options : [{ value: 'first', label: __('First option', 'wconvert') }, { value: 'second', label: __('Second option', 'wconvert') }] }));
        }}>
          {(['single', 'multi', 'text'] as const).map(type => <option key={type} value={type}>{answerTypeName(type)}</option>)}
        </select></PanelField>
        {typeReview?.question === question.id && <section tabIndex={-1} className="wconvert-journey-answer-repair" aria-label={__('Review answer type change', 'wconvert')}>
          <strong>{__('Review the affected conditions', 'wconvert')}</strong>
          <p>{typeReview.type === 'text' ? __('Short answers cannot keep rules based on selected choices. Edit the rules below first, then change the answer type.', 'wconvert')
            : questionTypeChange(tree, question.id, typeReview.type) ? __('Choice labels and paths will stay. Condition operators will be updated. Choosing several answers can match several rules; the top-to-bottom order still applies to exclusive paths and results. Test the journey after this change.', 'wconvert')
            : __('Some conditions compare several choices at once. Edit those conditions to use one choice each before switching to Choose one.', 'wconvert')}</p>
          {refs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}>{reference.label} · {reference.detail} <ArrowRight aria-hidden="true" className="inline size-3 rtl:-scale-x-100" /></button>)}
          <div className="wconvert-journey-answer-repair__actions"><button type="button" disabled={!questionTypeChange(tree, question.id, typeReview.type)} onClick={() => { const next = questionTypeChange(tree, question.id, typeReview.type); if (next) onChange(next); setTypeReview(null); }}>{__('Apply answer type change', 'wconvert')}</button><button type="button" onClick={() => setTypeReview(null)}>{__('Cancel', 'wconvert')}</button></div>
        </section>}
        {question.answer_type !== 'text' && <div className="wconvert-panel-field" role="group" aria-labelledby={`${question.id}-choices`}><FieldHeading as="span" label={__('Choices', 'wconvert')} labelId={`${question.id}-choices`} />
          {/*
            **One row per choice** (ADR 0136): number, words, and ⋯ for what
            acts on it — Add follow-up, Review uses, Remove. "Review uses" and
            "+ Follow-up" used to sit under every choice, twice the rows for
            two actions most choices never need. A follow-up a choice already
            has is shown, as a tag under its row.
          */}
          {question.options?.map((option, at) => {
            const followups = tree.steps.map((item, index) => ({ item, index })).filter(({ item }) => item.when?.clauses.some(clause => clause.question === question.id && clause.values.includes(option.value)));
            const uses = answerReferences(tree, question.id, option.value).length;
            const used = protectedValues.has(option.value);
            return <div key={option.value} className="wconvert-journey-settings__choice"><span aria-hidden="true">{at + 1}</span><input aria-label={`${__('Choice', 'wconvert')} ${at + 1}`} value={option.label} maxLength={120}
              onChange={event => change(question.id, node => ({ ...node, options: node.options?.map((old, i) => i === at ? { ...old, label: event.target.value } : old) }), `choice:${option.value}`)} />
              <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-choice-menu" aria-label={sprintf(/* translators: %s: a choice's words. */ __('More for “%s”', 'wconvert'), option.label)} title={sprintf(/* translators: %s: a choice's words. */ __('More for “%s”', 'wconvert'), option.label)}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
                <OptionMenuContent align="end" aria-label={sprintf(/* translators: %s: a choice's words. */ __('More for “%s”', 'wconvert'), option.label)}>
                  {onFollowup && <OptionItem icon={Plus} name={__('Add follow-up', 'wconvert')} label={sprintf(__('Add follow-up for %s', 'wconvert'), option.label)} onSelect={() => onFollowup(question.id, option.value)} />}
                  {used && <OptionItem icon={GitBranch} name={__('Review uses', 'wconvert')} trail={uses > 0 ? uses : undefined}
                    onSelect={() => { setRepair({ question: question.id, value: option.value }); setReplacement(''); setRetiring(false); }} />}
                  {!used && <OptionItem icon={Trash2} destructive name={__('Remove', 'wconvert')}
                    refused={(question.options?.length ?? 0) <= 2 ? { short: __('Keeps two choices', 'wconvert'), reason: __('A choice question keeps at least two choices.', 'wconvert') } : null}
                    onSelect={() => change(question.id, node => ({ ...node, options: node.options?.filter((_, i) => i !== at) }))} />}
                </OptionMenuContent>
              </DropdownMenu>
              {followups.length > 0 && <span className="wconvert-journey-settings__choice-followups">{__('Follow-up:', 'wconvert')} {followups.map(({ item, index }) => <button key={item.id} type="button" className="wconvert-tag" onClick={() => onSelect(index)}>{item.name}</button>)}</span>}
            </div>;
          })}
          {repair?.question === question.id && <div tabIndex={-1} className="wconvert-journey-answer-repair" role="region" aria-label={__('Review answer uses', 'wconvert')}>
            <strong>{sprintf(reviewRefs.length ? __('“%s” is used in journey rules', 'wconvert') : __('No rules use “%s” now', 'wconvert'), question.options?.find(option => option.value === repair.value)?.label ?? __('This answer', 'wconvert'))}</strong>
            <p>{reviewRefs.length ? __('Review the rules below. Replace this answer with another choice, or stop offering it and review what will be removed.', 'wconvert') : __('Your rule changes are kept. You can now remove this choice without changing other behavior.', 'wconvert')}</p>
            <div>{reviewRefs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}><strong>{reference.label}</strong>{' '}<small>{reference.detail} <ArrowRight aria-hidden="true" className="inline size-3 rtl:-scale-x-100" /></small></button>)}</div>
            {retirement && (question.options?.length ?? 0) > 2 && <Disclosure variant="inline" className="wconvert-answer-retirement" open={retiring} onToggle={setRetiring} title={__('Stop offering this answer…', 'wconvert')}>
              <p>{__('Review the matching behavior that will be removed with this choice. Other choices and saved leads stay unchanged.', 'wconvert')}</p>
              {retirement.reason ? <p role="status">{retirement.reason}</p> : <>{retirement.removed.length > 0 && <><strong>{__('Also remove', 'wconvert')}</strong><ul>{retirement.removed.map((name, index) => <li key={index}>{name}</li>)}</ul></>}<Button type="button" variant="destructive" onClick={() => { if (retirement.next) { onChange(retirement.next); setRepair(null); onAction?.(__('Choice and listed behavior removed. Test the remaining answers.', 'wconvert')); } }}>{retirement.removed.length ? __('Remove choice and listed behavior', 'wconvert') : __('Remove choice', 'wconvert')}</Button></>}
            </Disclosure>}
            {reviewRefs.length > 0 && <label>{__('Replace its uses with', 'wconvert')}<select value={question.options?.some(option => option.value === replacement && option.value !== repair.value) ? replacement : ''} onChange={event => setReplacement(event.target.value)}>
              <option value="">{__('Choose an existing answer…', 'wconvert')}</option>
              {question.options?.filter(option => option.value !== repair.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>}
            <div className="wconvert-journey-answer-repair__actions">{reviewRefs.length > 0 && <button type="button" disabled={!question.options?.some(option => option.value === replacement && option.value !== repair.value) || (question.options?.length ?? 0) <= 2} onClick={() => { onChange(replaceAnswer(tree, question.id, repair.value, replacement)); setRepair(null); }}>
              {__('Replace uses & remove', 'wconvert')}</button>}<button type="button" onClick={() => setRepair(null)}>{__('Cancel', 'wconvert')}</button></div>
            {(question.options?.length ?? 0) <= 2 && <p>{__('Keep at least two choices. Add another choice before removing this one.', 'wconvert')}</p>}
            <small>{__('One draft change. Undo restores the answer and its references.', 'wconvert')}</small>
          </div>}
          {(question.options?.length ?? 0) < 12 && <button type="button" className="wconvert-panel-link" onClick={() => change(question.id, node => {
            const taken = new Set(node.options?.map(item => item.value)); let at = 1; while (taken.has(`choice_${at}`)) at++;
            return { ...node, options: [...(node.options ?? []), { value: `choice_${at}`, label: __('New choice', 'wconvert') }] };
          })}>{__('Add choice', 'wconvert')}</button>}
        </div>}
        <CheckRow className="wconvert-check" label={__('Answer required', 'wconvert')} checked={question.required === true} onChange={event => change(question.id, node => ({ ...node, required: event.target.checked }))} />
        <PanelField label={__('Help text', 'wconvert')} htmlFor={`${question.id}-help`}
          hint={question.answer_type === 'multi' ? __('Visitors can choose several answers and see every relevant follow-up.', 'wconvert') : undefined}>
          <input id={`${question.id}-help`} value={question.help ?? ''} maxLength={300} placeholder={__('Optional', 'wconvert')} onChange={event => change(question.id, node => ({ ...node, help: event.target.value }), 'help')} />
        </PanelField>
        {refs.length > 0 && <Disclosure variant="inline" className="wconvert-journey-used-by" title={__('Used by', 'wconvert')} summary={sprintf(/* translators: %d: how many rules use these answers. */ _n('%d rule', '%d rules', refs.length, 'wconvert'), refs.length)}>
          {refs.map(reference => <button type="button" key={reference.key} onClick={() => openReference(reference)}><strong>{reference.label}</strong>{' '}<small>{reference.detail} <ArrowRight aria-hidden="true" className="inline size-3 rtl:-scale-x-100" /></small></button>)}
        </Disclosure>}
      </div>;
    })}
  </PanelSection>;
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
  const productsSummary = (variant: ResultVariant) => variant.product_filter ? __('By category', 'wconvert')
    : variant.product_ids?.length ? sprintf(/* translators: %d: how many products are chosen. */ _n('%d chosen', '%d chosen', variant.product_ids.length, 'wconvert'), variant.product_ids.length) : __('None', 'wconvert');
  /*
    Results in the panel grammar (ADR 0136): the order rule is the InfoTip's,
    a result's row is its heading and its rule, and what acts on one result —
    move, remove — is one ⋯ rather than three links along its foot.
  */
  return <PanelSection ref={settingsRoot} className="wconvert-journey-settings" title={__('Results', 'wconvert')}
    tipLabel={__('How results are chosen', 'wconvert')} tip={__('Visitors see the first result that matches, top to bottom. Everyone else sees the last one. Move results to change the order.', 'wconvert')}
    action={variants.length < 6 && sources.length > 0 ? <button type="button" onClick={() => setDraftResult({ heading: '', when: { match: 'all', clauses: [{ question: '', operator: 'is', values: [] }] } })}>{__('Add result', 'wconvert')}</button> : undefined}>
    {overlap && <p className="wconvert-panel-warn" role="status">{sprintf(__('“%1$s” and “%2$s” may match the same answers. The one listed first wins.', 'wconvert'), overlap[0].heading, overlap[1].heading)}</p>}
    <div className="wconvert-journey-results" role="group" aria-label={__('Possible results', 'wconvert')}>
      {variants.map((variant, at) => <div className="wconvert-journey-result-card" key={variant.id}><button className="wconvert-journey-result-summary" type="button" id={`${tabsId}-result-${at}`} aria-controls={`${tabsId}-panel-${at}`}
        aria-expanded={selected?.id === variant.id} onClick={() => setSelectedId(selected?.id === variant.id ? null : variant.id)}>
        <strong>{at === variants.length - 1 ? __('All other answers', 'wconvert') : variant.heading || sprintf(__('Result %d', 'wconvert'), at + 1)}</strong>
        <span>{at === variants.length - 1 ? __('When no other result matches', 'wconvert')
          : variant.when ? sprintf(__('If %s', 'wconvert'), conditionText(tree, variant.when)) : __('Set a condition', 'wconvert')}</span><ChevronDown aria-hidden="true" className="wconvert-journey-result-chevron" />
      </button>
    {selected?.id === variant.id && <div className="wconvert-journey-settings__result" role="region" id={`${tabsId}-panel-${at}`} aria-labelledby={`${tabsId}-result-${at}`}>

      <PanelField label={__('Heading', 'wconvert')} htmlFor={`${tabsId}-heading`}><input id={`${tabsId}-heading`} ref={headingInput} value={selected.heading} maxLength={200} onChange={event => edit(selectedAt, { heading: event.target.value }, 'heading')} /></PanelField>
      <PanelField label={__('Message', 'wconvert')} htmlFor={`${tabsId}-body`}><AutoGrowTextarea id={`${tabsId}-body`} value={selected.body ?? ''} maxLength={500} onChange={event => edit(selectedAt, { body: event.target.value }, 'body')} /></PanelField>
      {/* Optional (ADR 0133): with no address the result shows no button, which is a choice rather than a fault. */}
      <PanelField label={__('Link', 'wconvert')} htmlFor={`${tabsId}-href`} hint={!selected.href?.trim() ? __('Without a link, this result shows no button.', 'wconvert') : undefined}>
        <LinkField id={`${tabsId}-href`} ref={linkInput} value={selected.href ?? ''} onChange={href => edit(selectedAt, { href }, 'href')} />
      </PanelField>
      <PanelField label={__('Button text', 'wconvert')} htmlFor={`${tabsId}-link-label`}><input id={`${tabsId}-link-label`} value={selected.link_label ?? ''} maxLength={120} onChange={event => edit(selectedAt, { link_label: event.target.value }, 'link_label')} /></PanelField>
      <Disclosure variant="inline" className="wconvert-result-products" open={!!selected.product_ids?.length || !!selected.product_filter || screen.products_required || undefined} title={__('Products', 'wconvert')} summary={productsSummary(selected)}>
        <PanelField label={__('Choose products by', 'wconvert')} htmlFor={`${tabsId}-source`}><select id={`${tabsId}-source`} value={selected.product_filter ? 'category' : 'selected'} onChange={event => edit(selectedAt, { product_filter: event.target.value === 'category' ? { category_id: 0, attributes: [] } : undefined })}>
          <option value="selected">{__('Hand-picked products', 'wconvert')}</option><option value="category">{__('Category and attributes', 'wconvert')}</option>
        </select></PanelField>
        {selected.product_filter ? <ResultProductFilter key={selected.id} value={selected.product_filter} onChange={product_filter => edit(selectedAt, { product_filter })} />
          : <ProductPicker ids={selected.product_ids ?? []} onChange={product_ids => edit(selectedAt, { product_ids })} />}
        <PanelField label={__('Product button', 'wconvert')} htmlFor={`${tabsId}-action`} hint={!commerceSupported() ? unlessFree(sprintf(
          /* translators: %s: the product that includes cart buttons, e.g. “WConvert Pro”. */
          __('Cart buttons are included with %s and need WooCommerce on this site.', 'wconvert'), tierProductName('pro'))) : selected.product_action === 'add_to_cart' ? __('Products with options open their product page.', 'wconvert') : undefined}>
          <select id={`${tabsId}-action`} value={selected.product_action ?? 'link'} onChange={event => edit(selectedAt, { product_action: event.target.value as 'link' | 'add_to_cart' })}>
            <option value="link">{__('Open the product page', 'wconvert')}</option>
            <option value="add_to_cart" disabled={!commerceSupported()}>{__('Add to cart', 'wconvert')}</option>
          </select>
        </PanelField>
      </Disclosure>
      {selectedAt < variants.length - 1 && <ConditionSettings required value={selected.when} sources={sources} onChange={when => { if (when) edit(selectedAt, { when }); }} />}
      {selectedAt < variants.length - 1 && <div className="wconvert-journey-result-actions">
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="wconvert-choice-menu" aria-label={sprintf(/* translators: %s: a result's heading. */ __('More for “%s”', 'wconvert'), selected.heading || sprintf(__('Result %d', 'wconvert'), selectedAt + 1))}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
          <OptionMenuContent align="end" aria-label={sprintf(/* translators: %s: a result's heading. */ __('More for “%s”', 'wconvert'), selected.heading || sprintf(__('Result %d', 'wconvert'), selectedAt + 1))}>
            {variants.length > 2 && <OptionItem icon={ArrowUp} name={__('Move earlier', 'wconvert')} onSelect={() => move(selectedAt, selectedAt - 1)}
              refused={selectedAt === 0 ? { short: __('Already first', 'wconvert'), reason: __('Already first', 'wconvert') } : null} />}
            {variants.length > 2 && <OptionItem icon={ArrowDown} name={__('Move later', 'wconvert')} onSelect={() => move(selectedAt, selectedAt + 1)}
              refused={selectedAt >= variants.length - 2 ? { short: __('The fallback stays last', 'wconvert'), reason: __('The result for all other answers stays last.', 'wconvert') } : null} />}
            <OptionItem icon={Trash2} destructive name={__('Remove result', 'wconvert')} onSelect={() => { setSelectedId(null); setVariants(variants.filter((_, index) => index !== selectedAt)); }} />
          </OptionMenuContent>
        </DropdownMenu>
      </div>}
    </div>}</div>)}
    </div>
    <Disclosure variant="inline" className="wconvert-result-products" open={screen.products_required || repairRequest?.focus === 'products-required' || undefined} title={__('Product availability', 'wconvert')}
      summary={screen.products_required ? __('Required', 'wconvert') : __('Not required', 'wconvert')}>
      <CheckRow ref={productsRequired} className="wconvert-check" label={__('Require live products before publishing', 'wconvert')} checked={screen.products_required === true} onChange={event => onChange({ ...tree, steps: tree.steps.map((item, at) => at === step ? { ...item, products_required: event.target.checked } : item) })} />
    </Disclosure>
    <Dialog open={draftResult !== null} onOpenChange={open => { if (!open) setDraftResult(null); }}><AdminDialogContent size="sm" className="wconvert-graph-insert" dirty={!!draftResult?.heading.trim()}>
      <AdminDialogHeader title={__('Add matching result', 'wconvert')} meta={__('Choose who sees this result. Nothing changes until you add it.', 'wconvert')} />
      {draftResult && <><AdminDialogBody className="wconvert-graph-insert__body"><label>{__('Result heading', 'wconvert')}<Input value={draftResult.heading} maxLength={200} onChange={event => setDraftResult({ ...draftResult, heading: event.target.value })} /></label>
        <ConditionSettings deliberate required purpose="result" value={draftResult.when} sources={sources} onChange={when => setDraftResult({ ...draftResult, when: when ?? { match: 'all', clauses: [] } })} />
        <p>{__('Checked after your existing results, before all other answers. You can move it afterward.', 'wconvert')}</p>
        {variants.slice(0, -1).filter(result => resultReady && resultsMayOverlap(tree, result, { ...draftResult, id: 'new-result' })).map(result => <p key={result.id} role="status">{sprintf(__('“%s” may match the same answers and is checked first.', 'wconvert'), result.heading)}</p>)}
      </AdminDialogBody><AdminDialogFooter back={<Button type="button" variant="outline" onClick={() => setDraftResult(null)}>{__('Cancel', 'wconvert')}</Button>}
        note={!resultReady && <span id={`${tabsId}-add-reason`}>{__('Choose the answers that show this result.', 'wconvert')}</span>}>
        <Button type="button" aria-disabled={!resultReady || undefined} aria-describedby={!resultReady ? `${tabsId}-add-reason` : undefined} onClick={() => { if (resultReady) addResult(); }}>{__('Add result', 'wconvert')}</Button>
      </AdminDialogFooter></>}
    </AdminDialogContent></Dialog>
  </PanelSection>;
}
