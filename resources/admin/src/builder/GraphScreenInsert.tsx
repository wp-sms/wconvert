import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { ArrowRight, Check, CircleHelp, Flag, LayoutTemplate, Send } from 'lucide-react';
import { followupGroups, followupGroupSource } from './structure/followupGroups';
import { conditionText } from './structure/conditionText';
import { walkNodes } from './structure/journey';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { graphInsertionLocations, insertionUnavailable, type GraphScreenKind } from './structure/graphInsertion';
import { canAddGraphConnection, canTargetGraphScreen, graphChoiceSources } from './structure/graphConnections';

export function GraphScreenInsert({ tree, source, kind: initialKind, initialLocation, initialIntent, initialAnswer, onInsert, onExisting, onCapture, onEditCapture, onCancel }: {
  tree: TemplateTree; source: string; kind: GraphScreenKind; initialLocation?: string; initialIntent?: 'branch'; initialAnswer?: { question: string; value: string };
  onInsert(location: string, kind: GraphScreenKind, name: string, when?: QuestionCondition, includeSharedHidden?: boolean, branch?: boolean, answerType?: QuestionNode['answer_type']): void;
  onExisting?(target: string, when?: QuestionCondition, edgeId?: string): void;
  onCapture?(): void; onEditCapture?(screenId: string): void; onCancel(): void;
}) {
  const id = useId();
  const [intent, setIntent] = useState<'continue' | 'followup' | 'branch'>(initialIntent ?? (initialKind === 'followup' ? 'followup' : 'continue'));
  const [existing, setExisting] = useState(false);
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [answerType, setAnswerType] = useState<QuestionNode['answer_type']>('single');
  const [changeLocation, setChangeLocation] = useState(initialLocation === 'choose');
  const [advanced, setAdvanced] = useState(false);
  const [capture, setCapture] = useState(false);
  const locations = graphInsertionLocations(tree);
  const fallback = tree.graph?.edges.find(edge => edge.from === source && edge.kind === 'default');
  const preferred = initialLocation === 'choose' ? undefined : locations.find(item => item.id === initialLocation)
    ?? locations.find(item => item.id === `edge:${fallback?.id}`)
    ?? locations.find(item => item.target === source && !insertionUnavailable(item, initialKind));
  const [kind, setKind] = useState<GraphScreenKind>(() => initialKind === 'followup' ? 'input' : initialKind === 'input' && preferred && insertionUnavailable(preferred, 'input') && !insertionUnavailable(preferred, 'content') ? 'content' : initialKind);
  const effectiveKind: GraphScreenKind = intent === 'followup' && kind === 'input' ? 'followup' : kind;
  const [locationId, setLocationId] = useState(preferred?.id ?? '');
  const [questionId, setQuestionId] = useState(initialAnswer?.question ?? '');
  const [answer, setAnswer] = useState(initialAnswer?.value ?? '');
  const [includeHidden, setIncludeHidden] = useState(initialKind === 'followup');
  const location = locations.find(item => item.id === (intent === 'branch' ? `edge:${fallback?.id}` : locationId));
  const locationEdge = tree.graph?.edges.find(edge => `edge:${edge.id}` === location?.id);
  const hasBranches = tree.graph?.edges.some(edge => edge.from === location?.source && edge.kind === 'answer');
  const pathName = locationEdge?.kind === 'answer' && locationEdge.when ? conditionText(tree, locationEdge.when)
    : locationEdge?.kind === 'hidden' ? __('When the screen is skipped', 'wconvert')
    : hasBranches ? __('Everyone else path', 'wconvert') : __('Continue this path', 'wconvert');
  const choices = intent === 'branch' ? graphChoiceSources(tree, source) : location?.choices ?? [];
  const question = questionId ? choices.find(item => item.id === questionId) : choices[0];
  const unavailable = location ? insertionUnavailable(location, effectiveKind) : __('Choose a location to continue.', 'wconvert');
  const needsCondition = intent !== 'continue';
  const conditionReady = !needsCondition || !!question?.options?.some(option => option.value === answer);
  const validTargets = tree.steps.filter(screen => intent === 'branch' ? canAddGraphConnection(tree, source, screen.id)
    : location?.source && screen.id !== location.target && canTargetGraphScreen(tree, location.source, screen.id));
  const canInsert = !capture && (!initialAnswer || existing || !!name.trim()) && conditionReady && (existing ? validTargets.some(screen => screen.id === target) : !unavailable);
  const when = (): QuestionCondition | undefined => needsCondition && question ? { match: 'all', clauses: [{ question: question.id,
    operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [answer] }] } : undefined;
  const group = intent === 'followup' ? followupGroups(tree).find(item => item.screens.some(at => tree.steps[at].id === location?.source || tree.steps[at].id === location?.target)) : undefined;
  const groupSource = group ? followupGroupSource(tree, group) : undefined;
  const suggested = unavailable && intent === 'continue' && kind === 'input' ? locations.find(item => item.target === source && !insertionUnavailable(item, 'input')) ?? locations.find(item => !insertionUnavailable(item, 'input')) : undefined;
  const captures = tree.steps.filter(screen => (validTargets.includes(screen) || screen.id === location?.target) && walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  return <>
    <DialogTitle>{initialAnswer ? __('Add a follow-up question', 'wconvert') : __('Add a screen', 'wconvert')}</DialogTitle>
    <DialogDescription>{initialAnswer ? __('Write the question. Its answer condition is already set.', 'wconvert') : __('Choose what visitors see on this path.', 'wconvert')}</DialogDescription>
    <div className="wconvert-graph-insert__body">
    {location && !capture && <div className="wconvert-graph-insert__outcome" aria-label={__('Resulting journey', 'wconvert')}>
      <div className="wconvert-graph-insert__outcome-heading"><strong>{intent === 'branch' ? __('New answer path', 'wconvert') : location.id === 'entry' ? __('Before the first screen', 'wconvert') : pathName}</strong>{intent !== 'branch' && !changeLocation && <button type="button" onClick={() => setChangeLocation(true)}>{__('Change location', 'wconvert')}</button>}</div>
      <span>{existing ? __('After connecting', 'wconvert') : __('After adding', 'wconvert')}</span>
      <div><span>{(groupSource !== undefined ? tree.steps[groupSource].name : tree.steps.find(screen => screen.id === location.source)?.name) ?? __('Start', 'wconvert')}</span><ArrowRight aria-hidden="true" size={14}/>
        <strong>{existing ? tree.steps.find(screen => screen.id === target)?.name || __('Choose a screen', 'wconvert') : name.trim() || (kind === 'ending' ? __('Ending', 'wconvert') : kind === 'content' ? __('New message', 'wconvert') : __('New question', 'wconvert'))}</strong>
        {!existing && kind !== 'ending' && <><ArrowRight aria-hidden="true" size={14}/><span>{group ? __('Other matching follow-ups', 'wconvert') : tree.steps.find(screen => screen.id === location.target)?.name}</span></>}
      </div>
      {!existing && intent === 'continue' && location.id !== 'entry' && <small>{__('Only visitors taking this path will see the new screen.', 'wconvert')}</small>}
      {group && <small>{sprintf(__('Follow-up %1$d of %2$d in this group', 'wconvert'), group.screens.findIndex(at => tree.steps[at].id === location?.target) < 0 ? group.screens.length + 1 : group.screens.findIndex(at => tree.steps[at].id === location?.target) + 1, group.screens.length + 1)}</small>}
      {intent === 'followup' && <small>{group ? sprintf(__('Then: %s. Only matching questions are asked.', 'wconvert'), tree.steps.find(screen => screen.id === group.next)?.name ?? '') : __('Other matching follow-ups are still asked.', 'wconvert')}</small>}
      {intent === 'branch' && <small>{sprintf(__('Checked after existing branches. Everyone else still goes to %s.', 'wconvert'), tree.steps.find(screen => screen.id === location.target)?.name ?? '')}</small>}
    </div>}
      {location && (intent === 'branch' || changeLocation) && <div className="wconvert-graph-insert__context"><div><small>{intent === 'branch' ? __('BRANCH FROM', 'wconvert') : __('CURRENT CONNECTION', 'wconvert')}</small><span><strong>{tree.steps.find(screen => screen.id === location.source)?.name ?? __('Start', 'wconvert')}</strong><ArrowRight aria-hidden="true" size={14}/><strong>{intent === 'branch' ? existing ? tree.steps.find(screen => screen.id === target)?.name || __('Choose a screen', 'wconvert') : name.trim() || __('New screen', 'wconvert') : tree.steps.find(screen => screen.id === location.target)?.name}</strong></span>{intent !== 'branch' && <small>{location.detail}</small>}</div>{intent !== 'branch' && <button type="button" onClick={() => setChangeLocation(value => !value)} aria-expanded={changeLocation}>{__('Change location', 'wconvert')}</button>}</div>}
      {!initialLocation && (!initialAnswer || advanced) && <details className="wconvert-insert-routing"><summary>{intent === 'continue' ? __('Everyone on this path · Change behavior', 'wconvert') : intent === 'followup' ? __('Ask a relevant follow-up · Change behavior', 'wconvert') : __('Choose one path · Change behavior', 'wconvert')}</summary><fieldset className="wconvert-graph-insert__intents"><legend>{__('How should this screen connect?', 'wconvert')}</legend>
        {([
          ['continue', __('Continue this path', 'wconvert'), __('Everyone taking this connection continues here.', 'wconvert')],
          ['followup', __('Ask a relevant follow-up', 'wconvert'), __('Show only when its rule matches. Other relevant follow-ups can still appear.', 'wconvert')],
          ['branch', __('Take a different path', 'wconvert'), __('Choose one next screen. The first matching branch wins; everyone else keeps the current path.', 'wconvert')],
        ] as const).map(([value, label, detail]) => <label key={value} aria-label={label} htmlFor={`${id}-intent-${value}`}><input id={`${id}-intent-${value}`} type="radio" name={`${id}-intent`} checked={intent === value}
          disabled={value === 'followup' && existing || value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length)} onChange={() => { setIntent(value); setCapture(false); if (value === 'followup' && kind === 'ending') setKind('input'); setQuestionId(''); setAnswer(''); setTarget(''); setIncludeHidden(value === 'followup'); }} /><span><strong>{label}</strong><small hidden={intent !== value && !(value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length) || value === 'followup' && existing)}>{value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length) ? __('Choose a screen with a next connection and an earlier choice question to add a branch.', 'wconvert') : value === 'followup' && existing ? __('For an existing screen, edit its Screen visibility rule in screen settings.', 'wconvert') : detail}</small></span></label>)}
      </fieldset></details>}
      {intent !== 'branch' && (changeLocation || !location) ? <><label htmlFor={`${id}-location`}>{existing ? __('Replace connection', 'wconvert') : __('Insert at', 'wconvert')}</label>
        <select id={`${id}-location`} value={locationId} onChange={event => { setLocationId(event.target.value); setQuestionId(initialAnswer?.question ?? ''); setAnswer(initialAnswer?.value ?? ''); setTarget(''); }}>
          <option value="" disabled>{__('Choose a location…', 'wconvert')}</option>
          {locations.map(item => <option key={item.id} value={item.id} disabled={existing ? item.id === 'entry' : !!insertionUnavailable(item, effectiveKind)}>{item.label}{!existing && insertionUnavailable(item, effectiveKind) ? ` — ${insertionUnavailable(item, effectiveKind)}` : ''}</option>)}
        </select></> : null}
      {initialAnswer && !location && <p>{__('This answer can take more than one path. Choose where this follow-up belongs.', 'wconvert')}</p>}
      {initialAnswer && location && !question && <p role="status">{__('This answer is not available here. Choose a location after its question, or change the condition.', 'wconvert')} <button type="button" onClick={() => setAdvanced(true)}>{__('Change condition', 'wconvert')}</button></p>}
      {initialAnswer && question && !advanced && <div className="wconvert-insert-condition"><strong>{sprintf(__('Show when “%1$s” %2$s “%3$s”', 'wconvert'), question.label, question?.answer_type === 'multi' ? __('includes', 'wconvert') : __('is', 'wconvert'), question?.options?.find(option => option.value === answer)?.label ?? '')}</strong><button type="button" onClick={() => setAdvanced(true)}>{__('Change condition', 'wconvert')}</button></div>}
      {needsCondition && (!initialAnswer || advanced) && <>
        <label htmlFor={`${id}-question`}>{intent === 'branch' ? __('Take this path when the answer to', 'wconvert') : __('Show when the answer to', 'wconvert')}</label>
        <select id={`${id}-question`} value={question?.id ?? ''} disabled={!choices.length} onChange={event => { setQuestionId(event.target.value); setAnswer(''); }}>
          {!choices.length && <option value="">{__('Choose a location after a choice question', 'wconvert')}</option>}
          {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <label htmlFor={`${id}-answer`}>{question?.answer_type === 'multi' ? __('Includes this choice', 'wconvert') : __('Is this choice', 'wconvert')}</label>
        <select id={`${id}-answer`} value={answer} disabled={!question} onChange={event => setAnswer(event.target.value)}><option value="" disabled>{__('Choose an answer…', 'wconvert')}</option>{question?.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </>}
      {existing ? <><label htmlFor={`${id}-target`}>{__('Connect to', 'wconvert')}</label><select id={`${id}-target`} value={target} onChange={event => setTarget(event.target.value)}><option value="">{__('Choose a screen…', 'wconvert')}</option>{validTargets.map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select><p>{!validTargets.length ? __('No other screen can be reached from this connection without making a loop. Add a new screen instead.', 'wconvert') : __('Connections that would create a loop are excluded. You will review any screens or saves this change bypasses before applying it.', 'wconvert')}</p></> : <>
        {(!initialAnswer || advanced) && <div className="wconvert-graph-insert__types" role="group" aria-label={__('Screen type', 'wconvert')}>
          {([
            ['input', CircleHelp, __('Ask a question', 'wconvert'), __('Learn something before continuing', 'wconvert')],
            ['content', LayoutTemplate, __('Show a message', 'wconvert'), __('Explain an offer or the next step', 'wconvert')],
            ['capture', Send, __('Collect details', 'wconvert'), __('Save a request or signup', 'wconvert')],
            ['ending', Flag, __('Finish this path', 'wconvert'), __('Show a closing message', 'wconvert')],
          ] as const).map(([value, Icon, title, description]) => <button type="button" key={value}
            disabled={intent === 'followup' && ['capture', 'ending'].includes(value)}
            aria-pressed={value === 'capture' ? capture : !capture && kind === value}
            onClick={() => { setCapture(value === 'capture'); if (value !== 'capture') setKind(value); }}>
            <Icon aria-hidden="true" size={20}/><span><strong>{title}</strong><small>{description}</small></span>{(value === 'capture' ? capture : !capture && kind === value) && <Check aria-hidden="true" size={16}/>}
          </button>)}
        </div>}
        {capture ? <div className="wconvert-graph-insert__summary"><strong>{__('Contact collection', 'wconvert')}</strong>
          <p>{captures.length ? __('Use an existing contact screen to keep one combined submission. You will review any follow-ups this connection bypasses.', 'wconvert') : __('Contact fields need a save point and consent settings. They cannot be added as an ordinary question.', 'wconvert')}</p>
          {captures.map(screen => <button type="button" key={screen.id} onClick={() => { if (screen.id === location?.target) { onEditCapture?.(screen.id); return; } setCapture(false); setExisting(true); setTarget(screen.id); }} disabled={screen.id === location?.target && !onEditCapture}>{sprintf(screen.id === location?.target ? __('Edit existing %s', 'wconvert') : __('Use %s', 'wconvert'), screen.name)}<ArrowRight aria-hidden="true" size={14}/></button>)}
          {onCapture && <Button type="button" variant="outline" onClick={onCapture}>{__('Set up optional signup', 'wconvert')}</Button>}
          {!captures.length && !onCapture && <p>{__('Select your existing contact screen to edit its fields, or choose a signup starting point for a new campaign.', 'wconvert')}</p>}
        </div> : <>
        <label htmlFor={`${id}-name`}>{kind === 'input' ? __('Question', 'wconvert') : __('Screen name', 'wconvert')}</label><Input id={`${id}-name`} maxLength={120} value={name} placeholder={intent === 'followup' ? __('Relevant follow-up', 'wconvert') : kind === 'content' ? __('A helpful message', 'wconvert') : kind === 'ending' ? __('All done', 'wconvert') : __('A follow-up question', 'wconvert')} onChange={event => setName(event.target.value)} />
        {kind === 'input' && <label htmlFor={`${id}-answer-type`}>{__('Answer type', 'wconvert')}<select id={`${id}-answer-type`} value={answerType} onChange={event => setAnswerType(event.target.value as QuestionNode['answer_type'])}><option value="single">{__('Choose one', 'wconvert')}</option><option value="multi">{__('Choose several', 'wconvert')}</option><option value="text">{__('Short answer', 'wconvert')}</option></select></label>}
        {location?.sharedHidden && intent !== 'branch' && (!initialAnswer || advanced) && <label className="wconvert-graph-insert__check"><input type="checkbox" checked={includeHidden} onChange={event => setIncludeHidden(event.target.checked)} />{sprintf(__('Also check this screen when “%s” is skipped', 'wconvert'), tree.steps.find(item => item.id === location.source)?.name ?? '')}</label>}
        {kind === 'ending' && intent !== 'followup' && <p>{__('This is a closing screen. It does not save details. Any bypassed screens or required saves are shown for review.', 'wconvert')}</p>}
        {unavailable && <div role="status"><p>{unavailable}</p>{suggested && <Button type="button" variant="outline" onClick={() => { setLocationId(suggested.id); setChangeLocation(false); }}>{sprintf(__('Add before %s', 'wconvert'), tree.steps.find(screen => screen.id === suggested.target)?.name ?? '')}</Button>}</div>}
        </>}
      </>}
      {onExisting && (!initialAnswer || advanced) && <button type="button" className="wconvert-insert-existing" onClick={() => { setExisting(value => !value); setCapture(false); if (!existing && intent === 'followup') setIntent('continue'); }}>{existing ? __('Create a new screen instead', 'wconvert') : __('Connect an existing screen instead…', 'wconvert')}</button>}

    </div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button><Button type="button" disabled={!canInsert} onClick={() => {
      if (existing) onExisting?.(target, when(), intent === 'continue' ? locationId.slice(5) : undefined);
      else onInsert(locationId, effectiveKind, name.trim(), when(), !!location?.sharedHidden && includeHidden, intent === 'branch', kind === 'input' ? answerType : undefined);
    }}>{existing ? __('Connect screen', 'wconvert') : initialAnswer ? __('Add follow-up', 'wconvert') : __('Add screen here', 'wconvert')}</Button></div>
  </>;
}
