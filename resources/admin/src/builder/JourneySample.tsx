import { useEffect, useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { activeAnswers, chooseResult, journeyTrace, type Answers } from '../../../loader/src/journey-rules';
import { graphTrace } from '../../../loader/src/journey-graph';
import type { QuestionNode, TemplateTree } from '@renderer/types';
import { submissionScreen, walkNodes } from './structure/journey';

type IdentifiedQuestion = QuestionNode & { id: string };

/** A route explanation backed by the same evaluator used by visitors. No capture occurs here. */
export function JourneySample({ tree, onTrace, onSelect, onClose }: {
  tree: TemplateTree; onTrace(indices: readonly number[]): void; onSelect(index: number): void; onClose(): void;
}) {
  const [answers, setAnswers] = useState<Answers>(() => Object.fromEntries(tree.steps.flatMap(screen => walkNodes(screen.content))
    .filter((node): node is IdentifiedQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string' && node.answer_type !== 'text')
    .map(question => [question.id, question.answer_type === 'multi' ? [question.options?.[0]?.value].filter((value): value is string => !!value) : question.options?.[0]?.value ?? ''])));
  const [skippedSignups, setSkippedSignups] = useState<readonly string[]>([]);
  const path = useMemo(() => tree.graph ? graphTrace(tree.steps, tree.graph, answers) : journeyTrace(tree.steps, answers), [tree.steps, tree.graph, answers]);
  useEffect(() => onTrace(path.indices), [onTrace, path]);
  const questions = path.indices.flatMap(index => walkNodes(tree.steps[index].content))
    .filter((node): node is IdentifiedQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string');
  const allQuestions = tree.steps.flatMap((screen, index) => walkNodes(screen.content)
    .filter((node): node is IdentifiedQuestion => node.type === 'question' && 'id' in node && typeof node.id === 'string')
    .map(question => ({ question, index })));
  const skippedReason = (index: number): string => {
    if ('hidden' in path) return path.hidden.includes(tree.steps[index].id)
      ? __('Its show condition did not match.', 'wconvert')
      : __('A different path was chosen.', 'wconvert');
    if (!('skips' in path)) return __('A different path was chosen.', 'wconvert');
    const skip = path.skips.find(item => item.index === index);
    if (skip?.reason === 'route' && skip.from !== undefined && skip.to !== undefined) return sprintf(
      __('%1$s went directly to %2$s on a different path.', 'wconvert'), tree.steps[skip.from].name, tree.steps[skip.to].name);
    const missing = skip?.missingQuestions?.[0];
    if (missing) {
      const source = allQuestions.find(item => item.question.id === missing);
      if (source) return path.indices.includes(source.index)
        ? sprintf(__('No answer was given to “%s”.', 'wconvert'), source.question.label)
        : sprintf(__('“%s” was not asked on this path.', 'wconvert'), source.question.label);
    }
    return __('Its show condition did not match.', 'wconvert');
  };
  const submitted = tree.submissions.filter(sub => path.indices.includes(submissionScreen(tree, sub.id)) && !skippedSignups.includes(sub.id));
  const result = path.indices.map(index => tree.steps[index]).find(screen => screen.kind === 'result');
  const selectedResult = result ? chooseResult(result.results ?? [], path.answers) : undefined;
  const setAnswer = (id: string, value: string | string[] | undefined) => {
    const next = { ...answers };
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) delete next[id];
    else next[id] = value;
    setAnswers(tree.graph ? graphTrace(tree.steps, tree.graph, next).answers : activeAnswers(tree.steps, next));
  };
  return <aside className="wconvert-journey-sample" aria-label={__('Sample visitor', 'wconvert')}>
    <div className="wconvert-journey-sample__header"><div><h3>{__('Try a visitor’s answers', 'wconvert')}</h3><p>{__('Change sample answers to see which screens appear. Nothing is saved or sent.', 'wconvert')}</p></div>
      <button type="button" onClick={onClose}>{__('Close', 'wconvert')}</button></div>
    <div className="wconvert-journey-sample__body">
      {questions.map(question => <fieldset key={question.id}><legend>{question.label}</legend>
        {question.answer_type === 'text' ? <input type="text" value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''}
          onChange={event => setAnswer(question.id, event.target.value)} />
          : question.options?.map(option => <label key={option.value}><input type={question.answer_type === 'multi' ? 'checkbox' : 'radio'}
            name={`sample-${question.id}`} checked={question.answer_type === 'multi' ? Array.isArray(answers[question.id]) && answers[question.id].includes(option.value) : answers[question.id] === option.value}
            onChange={() => {
              if (question.answer_type === 'multi') {
                const chosen = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                setAnswer(question.id, chosen.includes(option.value) ? chosen.filter(value => value !== option.value) : [...chosen, option.value]);
              } else setAnswer(question.id, option.value);
            }} />{option.label}</label>)}
        {question.required !== true && <button type="button" onClick={() => setAnswer(question.id, undefined)}>{__('Leave unanswered', 'wconvert')}</button>}
      </fieldset>)}
      <h4>{__('This visitor’s path', 'wconvert')}</h4>
      <ol>{path.indices.map((index, order) => {
        const screen = tree.steps[index];
        const submission = tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
        return <li key={screen.id}><button type="button" onClick={() => onSelect(index)}><span>{order + 1}</span>{screen.name}</button>
          {submission?.required === false && <label>{__('Sample action', 'wconvert')}<select value={skippedSignups.includes(submission.id) ? 'skip' : 'submit'}
            onChange={event => setSkippedSignups(old => event.target.value === 'skip' ? [...old, submission.id] : old.filter(id => id !== submission.id))}>
            <option value="submit">{__('Submit details', 'wconvert')}</option><option value="skip">{__('No thanks', 'wconvert')}</option>
          </select></label>}</li>;
      })}</ol>
      {tree.steps.some((_, index) => !path.indices.includes(index)) && <div className="wconvert-journey-sample__skipped"><h4>{__('Skipped for these answers', 'wconvert')}</h4>
        {tree.steps.map((screen, index) => !path.indices.includes(index) ? <p key={screen.id}><strong>{screen.name}</strong><small>{skippedReason(index)}</small></p> : null)}
      </div>}
      {path.decisions.flatMap(decision => {
        if (tree.graph) {
          if (!('edge' in decision)) return [];
          const routes = tree.graph.edges.filter(edge => edge.from === decision.from && edge.kind === 'answer');
          if (!routes.length) return [];
          const name = tree.steps.find(screen => screen.id === decision.from)?.name ?? decision.from;
          return [<p className="wconvert-journey-sample__decision" key={decision.edge}>{sprintf(
            __('%1$s: %2$s path wins; later matches are ignored.', 'wconvert'), name,
            decision.kind === 'default' ? __('Everyone else', 'wconvert') : String((decision.priority ?? 0) + 1))}</p>];
        }
        if (!('priority' in decision) || typeof decision.from !== 'number') return [];
        const screen = tree.steps[decision.from];
        if (decision.kind !== 'route' || !screen.paths || screen.paths.length < 2) return [];
        return [<p className="wconvert-journey-sample__decision" key={screen.id}>
          {sprintf(__('%1$s: %2$s path wins; later matches are ignored.', 'wconvert'), screen.name,
            decision.priority === screen.paths.length - 1 ? __('Everyone else', 'wconvert') : String((decision.priority ?? 0) + 1))}</p>];
      })}
      {selectedResult && <p className="wconvert-journey-sample__result">{sprintf(__('Result shown: %s', 'wconvert'), selectedResult.heading)}</p>}
      <div className="wconvert-journey-sample__outcome"><strong>{sprintf(_n('%d simulated submission', '%d simulated submissions', submitted.length, 'wconvert'), submitted.length)}</strong>
        <p>{submitted.length === 0 ? __('This path does not submit contact details. A result can still be shown without a Lead.', 'wconvert')
          : submitted.length === 1 ? __('One saved request contains answers from the questions this visitor saw before submitting.', 'wconvert')
            : __('Each explicit submission saves only the details accepted at that point.', 'wconvert')}</p>
        <small>{__('Use Test journey to try the full visitor screen. No Leads or destination requests are created here.', 'wconvert')}</small>
      </div>
    </div>
  </aside>;
}
