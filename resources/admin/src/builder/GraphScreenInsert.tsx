import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { graphInsertionLocations, insertionUnavailable, type GraphScreenKind } from './structure/graphInsertion';

/** A deliberate location choice, including when the selected card is an ending. */
export function GraphScreenInsert({ tree, source, kind, onInsert, onCancel }: {
  tree: TemplateTree; source: string; kind: GraphScreenKind;
  onInsert(location: string, when?: QuestionCondition, includeSharedHidden?: boolean): void; onCancel(): void;
}) {
  const id = useId();
  const locations = graphInsertionLocations(tree);
  const preferred = locations.find(item => item.source === source && item.id === `edge:${tree.graph?.edges.find(edge => edge.from === source && edge.kind === 'default')?.id}` && !insertionUnavailable(item, kind))
    ?? locations.find(item => item.target === source && !insertionUnavailable(item, kind));
  const [locationId, setLocationId] = useState(preferred?.id ?? '');
  const [questionId, setQuestionId] = useState('');
  const [answer, setAnswer] = useState('');
  const [includeHidden, setIncludeHidden] = useState(kind === 'followup');
  const location = locations.find(item => item.id === locationId);
  const question = location?.choices.find(item => item.id === questionId) ?? location?.choices[0];
  const unavailable = location ? insertionUnavailable(location, kind) : locations.some(item => !insertionUnavailable(item, kind))
    ? __('Choose a location to continue.', 'wconvert') : __('Add a choice question before adding a relevant follow-up.', 'wconvert');
  const canInsert = !unavailable && (kind !== 'followup' || !!question?.options?.some(option => option.value === answer));
  return <>
    <DialogTitle>{kind === 'content' ? __('Add offer screen', 'wconvert') : kind === 'followup' ? __('Add relevant follow-up', 'wconvert') : __('Add question screen', 'wconvert')}</DialogTitle>
    <DialogDescription>{__('Choose where visitors will see this screen. Existing path conditions and priorities stay the same.', 'wconvert')}</DialogDescription>
    <div className="wconvert-graph-insert__body">
      <label htmlFor={`${id}-location`}>{__('Insert at', 'wconvert')}</label>
      <select id={`${id}-location`} value={locationId} onChange={event => { setLocationId(event.target.value); setQuestionId(''); setAnswer(''); setIncludeHidden(kind === 'followup'); }}>
        {!preferred && <option value="">{__('Choose a location…', 'wconvert')}</option>}
        {locations.map(item => <option key={item.id} value={item.id} disabled={!!insertionUnavailable(item, kind)}>
          {item.label}{insertionUnavailable(item, kind) ? ` — ${insertionUnavailable(item, kind)}` : ''}
        </option>)}
      </select>
      {location && <div className="wconvert-graph-insert__summary"><strong>{location.label}</strong><p>{location.detail}</p></div>}
      {location?.sharedHidden && <label className="wconvert-graph-insert__check"><input type="checkbox" checked={includeHidden} onChange={event => setIncludeHidden(event.target.checked)} />
        {sprintf(kind === 'followup' ? __('Also check this follow-up when “%s” is skipped', 'wconvert')
          : __('Also show this screen when “%s” is skipped', 'wconvert'), tree.steps.find(item => item.id === location.source)?.name ?? '')}</label>}
      {kind !== 'content' && tree.submissions.length > 0 && !tree.steps.some(item => item.kind === 'result') && <p>{__('Questions go before a save so their answers can be included.', 'wconvert')}</p>}
      {kind === 'followup' && <>
        <label htmlFor={`${id}-question`}>{__('Show when the answer to', 'wconvert')}</label>
        <select id={`${id}-question`} value={question?.id ?? ''} disabled={!location?.choices.length} onChange={event => { setQuestionId(event.target.value); setAnswer(''); }}>
          {!location?.choices.length && <option value="">{__('Choose a location after a choice question', 'wconvert')}</option>}
          {location?.choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <label htmlFor={`${id}-answer`}>{question?.answer_type === 'multi' ? __('Includes this choice', 'wconvert') : __('Is this choice', 'wconvert')}</label>
        <select id={`${id}-answer`} value={answer} disabled={!question} onChange={event => setAnswer(event.target.value)}>
          <option value="" disabled>{__('Choose an answer…', 'wconvert')}</option>
          {question?.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p>{__('Other visitors skip this follow-up and continue to the same next screen. You can edit more conditions after adding it.', 'wconvert')}</p>
      </>}
      {unavailable && <p role="status">{unavailable}</p>}
    </div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button>
      <Button type="button" disabled={!canInsert} onClick={() => onInsert(locationId, kind === 'followup' && question ? { match: 'all', clauses: [{
        question: question.id, operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [answer],
      }] } : undefined, !!location?.sharedHidden && includeHidden)}>{__('Add screen here', 'wconvert')}</Button></div>
  </>;
}
