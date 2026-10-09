import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { chooseResult, type Answers } from '../../../loader/src/journey-rules';
import type { TemplateTree } from '@renderer/types';
import { submissionScreen } from './structure/journey';
import { journeyTraceEdges } from './structure/journeyTraceEdges';
import { journeySamplePath, sampleQuestions, type SampleActions } from './structure/journeySamplePath';
import { conditionText } from './structure/conditionText';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

/** Predict only the part of a route for which the merchant supplied choices. */
export function JourneySample({ tree, onTrace, onSelect, onClose, onShowPath }: {
  onShowPath?(screens: readonly number[], edges: readonly string[]): void;
  tree: TemplateTree; onTrace(indices: readonly number[]): void; onSelect(index: number): void; onClose(): void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [unanswered, setUnanswered] = useState<readonly string[]>([]);
  const [actions, setActions] = useState<SampleActions>({});
  const path = useMemo(() => journeySamplePath(tree, answers, unanswered, actions), [tree, answers, unanswered, actions]);
  useEffect(() => onTrace(path.indices), [onTrace, path]);
  const questions = path.indices.flatMap(index => sampleQuestions(tree, index));
  const setAnswer = (id: string, value: string | string[] | undefined) => {
    const next = { ...answers };
    if (value === undefined || value === '' || Array.isArray(value) && !value.length) delete next[id];
    else next[id] = value;
    const skipped = value === undefined ? [...unanswered, id] : unanswered.filter(key => key !== id);
    const nextPath = journeySamplePath(tree, next, skipped, actions);
    // Changing an earlier answer discards hypothetical choices beyond the new boundary.
    setAnswers(nextPath.answers);
    const active = new Set(nextPath.indices.flatMap(index => sampleQuestions(tree, index).map(q => q.id)));
    setUnanswered(skipped.filter(key => active.has(key)));
    setActions(Object.fromEntries(Object.entries(actions).filter(([key]) => nextPath.indices.includes(submissionScreen(tree, key)))));
  };
  const submitted = tree.submissions.filter(sub => path.indices.includes(submissionScreen(tree, sub.id)) && actions[sub.id] === 'submit');
  const result = path.indices.map(index => tree.steps[index]).find(screen => screen.kind === 'result');
  const selectedResult = result ? chooseResult(result.results ?? [], path.answers) : undefined;
  const bypassed = tree.steps.map((screen, index) => ({ screen, index })).filter(({ index }) => ['hidden', 'bypassed'].includes(path.progress.states[index]));
  const skippedReason = (index: number) => {
    if ('skips' in path.trace) {
      const skip = path.trace.skips.find(item => item.index === index);
      if (skip?.reason === 'route' && skip.from !== undefined && skip.to !== undefined) return sprintf(
        __('%1$s went directly to %2$s on a different path.', 'wconvert'), tree.steps[skip.from].name, tree.steps[skip.to].name);
    }
    const screen = tree.steps[index];
    return path.progress.states[index] === 'hidden' && screen.when
      ? sprintf(__('Its show condition did not match: %s.', 'wconvert'), conditionText(tree, screen.when))
      : __('A different path was chosen.', 'wconvert');
  };
  return <aside className="wconvert-journey-sample wconvert-journey-sample--explorer" aria-label={__('Sample visitor', 'wconvert')}>
    <div className="wconvert-journey-sample__choices">
      <span className="wconvert-preview-test__eyebrow">{__('Hypothetical answers', 'wconvert')}</span>
      <h3>{__('Which path would they take?', 'wconvert')}</h3>
      <p>{__('Choose answers to reveal the next steps. This predicts a route; it does not run the form or test delivery.', 'wconvert')}</p>
      <Button variant="ghost" size="sm" onClick={() => { setAnswers({}); setUnanswered([]); setActions({}); }}><RotateCcw aria-hidden="true" />{__('Reset sample answers', 'wconvert')}</Button>
      {questions.map(question => <fieldset key={question.id}><legend>{question.label}</legend>
        {question.answer_type === 'text' ? <Input aria-label={question.label} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''}
          onChange={event => setAnswer(question.id, event.target.value)} />
          : question.options?.map(option => <label className="wconvert-journey-sample__choice" key={option.value}><input type={question.answer_type === 'multi' ? 'checkbox' : 'radio'}
            name={`sample-${question.id}`} checked={question.answer_type === 'multi' ? Array.isArray(answers[question.id]) && answers[question.id].includes(option.value) : answers[question.id] === option.value}
            onChange={() => {
              if (question.answer_type === 'multi') {
                const chosen = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                setAnswer(question.id, chosen.includes(option.value) ? chosen.filter(value => value !== option.value) : [...chosen, option.value]);
              } else setAnswer(question.id, option.value);
            }} />{option.label}</label>)}
        {question.required !== true && <Button variant="ghost" size="sm" aria-pressed={unanswered.includes(question.id)} onClick={() => setAnswer(question.id, undefined)}>{__('Leave unanswered', 'wconvert')}</Button>}
      </fieldset>)}
      {tree.submissions.filter(sub => path.indices.includes(submissionScreen(tree, sub.id))).map(sub => <label className="wconvert-journey-sample__action" key={sub.id}>
        {tree.steps[submissionScreen(tree, sub.id)].name}
        <select value={actions[sub.id] ?? ''} onChange={event => {
          const next = { ...actions };
          if (event.target.value) next[sub.id] = event.target.value as 'submit' | 'skip'; else delete next[sub.id];
          const prediction = journeySamplePath(tree, answers, unanswered, next);
          setActions(Object.fromEntries(Object.entries(next).filter(([key]) => prediction.indices.includes(submissionScreen(tree, key)))));
          setAnswers(prediction.answers);
        }}><option value="">{__('Choose an action…', 'wconvert')}</option><option value="submit">{__('Submit details', 'wconvert')}</option>{!sub.required && <option value="skip">{__('No thanks', 'wconvert')}</option>}</select>
      </label>)}
    </div>
    <div className="wconvert-journey-sample__prediction">
      <h3>{__('Predicted path', 'wconvert')}</h3>
      <ol className="wconvert-journey-test__timeline">{path.indices.map((index, order) => <li key={tree.steps[index].id}>
        <span className="wconvert-journey-test__number" aria-hidden="true">{order + 1}</span><div><button type="button" onClick={() => onSelect(index)}>{tree.steps[index].name}<ArrowRight aria-hidden="true" size={13} /></button>
        {path.waiting === index && <small>{__('Waiting for your choice', 'wconvert')}</small>}</div>
      </li>)}</ol>
      {bypassed.length > 0 && <details className="wconvert-journey-sample__skipped"><summary>{__('Skipped for these answers', 'wconvert')}</summary>
        {bypassed.map(({ screen, index }) => <p key={screen.id}><strong>{screen.name}</strong><small>{skippedReason(index)}</small></p>)}
      </details>}
      {path.decisions.flatMap(decision => {
        if ('edge' in decision) {
          if (!tree.graph || !tree.graph.edges.some(edge => edge.from === decision.from && edge.kind === 'answer')) return [];
          return [<p className="wconvert-journey-sample__decision" key={decision.edge}>{sprintf(__('%1$s: %2$s path wins; later matches are ignored.', 'wconvert'), tree.steps.find(screen => screen.id === decision.from)?.name ?? decision.from, decision.kind === 'default' ? __('Everyone else', 'wconvert') : String((decision.priority ?? 0) + 1))}</p>];
        }
        const screen = tree.steps[decision.from];
        if (decision.kind !== 'route' || !screen.paths || screen.paths.length < 2) return [];
        return [<p className="wconvert-journey-sample__decision" key={screen.id}>{sprintf(__('%1$s: %2$s path wins; later matches are ignored.', 'wconvert'), screen.name, decision.priority === screen.paths.length - 1 ? __('Everyone else', 'wconvert') : String((decision.priority ?? 0) + 1))}</p>];
      })}
      {selectedResult && <p className="wconvert-journey-sample__result">{sprintf(__('Result shown: %s', 'wconvert'), selectedResult.heading)}</p>}
      <p className="wconvert-journey-sample__boundary">{path.waiting === undefined ? __('Prediction complete. Try the form to check validation and the visitor experience.', 'wconvert') : __('The prediction stops where an answer or action is needed.', 'wconvert')}</p>
      {submitted.length > 0 && <p>{sprintf(_n('%d submission would be made with these choices.', '%d submissions would be made with these choices.', submitted.length, 'wconvert'), submitted.length)}</p>}
      {onShowPath && <Button variant="outline" size="sm" onClick={() => onShowPath(path.indices, journeyTraceEdges(tree, path.decisions))}>{__('Show sample path on the map', 'wconvert')}<ArrowRight aria-hidden="true" /></Button>}
      <Button variant="ghost" size="sm" onClick={onClose}>{onShowPath ? __('Switch to visitor test', 'wconvert') : __('Close', 'wconvert')}</Button>
      <small>{__('Predictions do not count as completed tests. No Leads or destination requests are created.', 'wconvert')}</small>
    </div>
  </aside>;
}
