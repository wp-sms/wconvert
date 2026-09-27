import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, TemplateTree } from '@renderer/types';
import { ArrowRight, Check, CircleHelp, Flag, LayoutTemplate, Send } from 'lucide-react';
import { walkNodes } from './structure/journey';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { DialogDescription, DialogTitle } from '../components/ui/dialog';
import { graphInsertionLocations, insertionUnavailable, type GraphScreenKind } from './structure/graphInsertion';
import { canAddGraphConnection, canTargetGraphScreen, graphChoiceSources } from './structure/graphConnections';

export function GraphScreenInsert({ tree, source, kind: initialKind, initialLocation, initialIntent, onInsert, onExisting, onCapture, onEditCapture, onCancel }: {
  tree: TemplateTree; source: string; kind: GraphScreenKind; initialLocation?: string; initialIntent?: 'branch';
  onInsert(location: string, kind: GraphScreenKind, name: string, when?: QuestionCondition, includeSharedHidden?: boolean, branch?: boolean): void;
  onExisting?(target: string, when?: QuestionCondition, edgeId?: string): void;
  onCapture?(): void; onEditCapture?(screenId: string): void; onCancel(): void;
}) {
  const id = useId();
  const [kind, setKind] = useState(initialKind === 'followup' ? 'input' : initialKind);
  const [intent, setIntent] = useState<'continue' | 'followup' | 'branch'>(initialIntent ?? (initialKind === 'followup' ? 'followup' : 'continue'));
  const [existing, setExisting] = useState(false);
  const [target, setTarget] = useState('');
  const [name, setName] = useState('');
  const [changeLocation, setChangeLocation] = useState(false);
  const [capture, setCapture] = useState(false);
  const effectiveKind: GraphScreenKind = intent === 'followup' && kind === 'input' ? 'followup' : kind as GraphScreenKind;
  const locations = graphInsertionLocations(tree);
  const fallback = tree.graph?.edges.find(edge => edge.from === source && edge.kind === 'default');
  const preferred = locations.find(item => item.id === initialLocation)
    ?? locations.find(item => item.id === `edge:${fallback?.id}`)
    ?? locations.find(item => item.target === source && !insertionUnavailable(item, initialKind));
  const [locationId, setLocationId] = useState(preferred?.id ?? '');
  const [questionId, setQuestionId] = useState('');
  const [answer, setAnswer] = useState('');
  const [includeHidden, setIncludeHidden] = useState(initialKind === 'followup');
  const location = locations.find(item => item.id === (intent === 'branch' ? `edge:${fallback?.id}` : locationId));
  const choices = intent === 'branch' ? graphChoiceSources(tree, source) : location?.choices ?? [];
  const question = choices.find(item => item.id === questionId) ?? choices[0];
  const unavailable = location ? insertionUnavailable(location, effectiveKind) : __('Choose a location to continue.', 'wconvert');
  const needsCondition = intent !== 'continue';
  const conditionReady = !needsCondition || !!question?.options?.some(option => option.value === answer);
  const validTargets = tree.steps.filter(screen => intent === 'branch' ? canAddGraphConnection(tree, source, screen.id)
    : location?.source && screen.id !== location.target && canTargetGraphScreen(tree, location.source, screen.id));
  const canInsert = !capture && conditionReady && (existing ? validTargets.some(screen => screen.id === target) : !unavailable);
  const when = (): QuestionCondition | undefined => needsCondition && question ? { match: 'all', clauses: [{ question: question.id,
    operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [answer] }] } : undefined;
  const captures = tree.steps.filter(screen => (validTargets.includes(screen) || screen.id === location?.target) && walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  return <>
    <DialogTitle>{__('What happens next?', 'wconvert')}</DialogTitle>
    <DialogDescription>{__('Choose what visitors see next, then review where it connects.', 'wconvert')}</DialogDescription>
    <div className="wconvert-graph-insert__body">
      {location && <div className="wconvert-graph-insert__context"><div><small>{intent === 'branch' ? __('BRANCH FROM', 'wconvert') : __('CURRENT CONNECTION', 'wconvert')}</small><span><strong>{tree.steps.find(screen => screen.id === location.source)?.name ?? __('Start', 'wconvert')}</strong><ArrowRight aria-hidden="true" size={14}/><strong>{intent === 'branch' ? existing ? tree.steps.find(screen => screen.id === target)?.name || __('Choose a screen', 'wconvert') : name.trim() || __('New screen', 'wconvert') : tree.steps.find(screen => screen.id === location.target)?.name}</strong></span>{intent !== 'branch' && <small>{location.detail}</small>}</div>{intent !== 'branch' && <button type="button" onClick={() => setChangeLocation(value => !value)} aria-expanded={changeLocation}>{__('Change location', 'wconvert')}</button>}</div>}
      <div className="wconvert-journey-pane__tabs" role="group" aria-label={__('Screen source', 'wconvert')}>
        <button type="button" aria-pressed={!existing} onClick={() => { setExisting(false); setCapture(false); }}>{__('New screen', 'wconvert')}</button>
        {onExisting && <button type="button" aria-pressed={existing} onClick={() => { setExisting(true); setCapture(false); if (intent === 'followup') setIntent('continue'); }}>{__('Existing screen', 'wconvert')}</button>}
      </div>
      {!initialLocation && <fieldset className="wconvert-graph-insert__intents"><legend>{__('How should this screen connect?', 'wconvert')}</legend>
        {([
          ['continue', __('Continue this path', 'wconvert'), __('Everyone taking this connection continues here.', 'wconvert')],
          ['followup', __('Ask a relevant follow-up', 'wconvert'), __('Show only when its rule matches. Other relevant follow-ups can still appear.', 'wconvert')],
          ['branch', __('Take a different path', 'wconvert'), __('Choose one next screen. The first matching branch wins; everyone else keeps the current path.', 'wconvert')],
        ] as const).map(([value, label, detail]) => <label key={value} aria-label={label} htmlFor={`${id}-intent-${value}`}><input id={`${id}-intent-${value}`} type="radio" name={`${id}-intent`} checked={intent === value}
          disabled={value === 'followup' && existing || value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length)} onChange={() => { setIntent(value); setCapture(false); if (value === 'followup' && kind === 'ending') setKind('input'); setQuestionId(''); setAnswer(''); setTarget(''); setIncludeHidden(value === 'followup'); }} /><span><strong>{label}</strong><small hidden={intent !== value && !(value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length) || value === 'followup' && existing)}>{value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length) ? __('Choose a screen with a next connection and an earlier choice question to add a branch.', 'wconvert') : value === 'followup' && existing ? __('For an existing screen, edit its Screen visibility rule in screen settings.', 'wconvert') : detail}</small></span></label>)}
      </fieldset>}
      {intent !== 'branch' && (changeLocation || !location) ? <><label htmlFor={`${id}-location`}>{existing ? __('Replace connection', 'wconvert') : __('Insert at', 'wconvert')}</label>
        <select id={`${id}-location`} value={locationId} onChange={event => { setLocationId(event.target.value); setQuestionId(''); setAnswer(''); setTarget(''); }}>
          <option value="" disabled>{__('Choose a location…', 'wconvert')}</option>
          {locations.map(item => <option key={item.id} value={item.id} disabled={existing ? item.id === 'entry' : !!insertionUnavailable(item, effectiveKind)}>{item.label}{!existing && insertionUnavailable(item, effectiveKind) ? ` — ${insertionUnavailable(item, effectiveKind)}` : ''}</option>)}
        </select></> : null}
      {needsCondition && <>
        <label htmlFor={`${id}-question`}>{intent === 'branch' ? __('Take this path when the answer to', 'wconvert') : __('Show when the answer to', 'wconvert')}</label>
        <select id={`${id}-question`} value={question?.id ?? ''} disabled={!choices.length} onChange={event => { setQuestionId(event.target.value); setAnswer(''); }}>
          {!choices.length && <option value="">{__('Choose a location after a choice question', 'wconvert')}</option>}
          {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <label htmlFor={`${id}-answer`}>{question?.answer_type === 'multi' ? __('Includes this choice', 'wconvert') : __('Is this choice', 'wconvert')}</label>
        <select id={`${id}-answer`} value={answer} disabled={!question} onChange={event => setAnswer(event.target.value)}><option value="" disabled>{__('Choose an answer…', 'wconvert')}</option>{question?.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      </>}
      {existing ? <><label htmlFor={`${id}-target`}>{__('Connect to', 'wconvert')}</label><select id={`${id}-target`} value={target} onChange={event => setTarget(event.target.value)}><option value="">{__('Choose a screen…', 'wconvert')}</option>{validTargets.map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select><p>{!validTargets.length ? __('No other screen can be reached from this connection without making a loop. Add a new screen instead.', 'wconvert') : __('Connections that would create a loop are excluded. You will review any screens or saves this change bypasses before applying it.', 'wconvert')}</p></> : <>
        <div className="wconvert-graph-insert__types" role="group" aria-label={__('Screen type', 'wconvert')}>
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
        </div>
        {capture ? <div className="wconvert-graph-insert__summary"><strong>{__('Contact collection', 'wconvert')}</strong>
          <p>{captures.length ? __('Use an existing contact screen to keep one combined submission. You will review any follow-ups this connection bypasses.', 'wconvert') : __('Contact fields need a save point and consent settings. They cannot be added as an ordinary question.', 'wconvert')}</p>
          {captures.map(screen => <button type="button" key={screen.id} onClick={() => { if (screen.id === location?.target) { onEditCapture?.(screen.id); return; } setCapture(false); setExisting(true); setTarget(screen.id); }} disabled={screen.id === location?.target && !onEditCapture}>{sprintf(screen.id === location?.target ? __('Edit existing %s', 'wconvert') : __('Use %s', 'wconvert'), screen.name)}<ArrowRight aria-hidden="true" size={14}/></button>)}
          {onCapture && <Button type="button" variant="outline" onClick={onCapture}>{__('Set up optional signup', 'wconvert')}</Button>}
          {!captures.length && !onCapture && <p>{__('Select your existing contact screen to edit its fields, or choose a signup starting point for a new campaign.', 'wconvert')}</p>}
        </div> : <>
        <label htmlFor={`${id}-name`}>{__('Screen name', 'wconvert')}</label><Input id={`${id}-name`} maxLength={120} value={name} placeholder={intent === 'followup' ? __('Relevant follow-up', 'wconvert') : kind === 'content' ? __('A helpful message', 'wconvert') : kind === 'ending' ? __('All done', 'wconvert') : __('A follow-up question', 'wconvert')} onChange={event => setName(event.target.value)} />
        {location?.sharedHidden && intent !== 'branch' && <label className="wconvert-graph-insert__check"><input type="checkbox" checked={includeHidden} onChange={event => setIncludeHidden(event.target.checked)} />{sprintf(__('Also check this screen when “%s” is skipped', 'wconvert'), tree.steps.find(item => item.id === location.source)?.name ?? '')}</label>}
        {kind === 'ending' && intent !== 'followup' && <p>{__('This is a closing screen. It does not save details. Any bypassed screens or required saves are shown for review.', 'wconvert')}</p>}
        {unavailable && <p role="status">{unavailable}</p>}
        </>}
      </>}
    {location && !capture && <div className="wconvert-graph-insert__outcome" aria-label={__('Resulting journey', 'wconvert')}>
      <span>{existing ? __('After connecting', 'wconvert') : __('After adding', 'wconvert')}</span>
      <div><span>{tree.steps.find(screen => screen.id === location.source)?.name ?? __('Start', 'wconvert')}</span><ArrowRight aria-hidden="true" size={14}/>
        <strong>{existing ? tree.steps.find(screen => screen.id === target)?.name || __('Choose a screen', 'wconvert') : name.trim() || (kind === 'ending' ? __('Ending', 'wconvert') : kind === 'content' ? __('New message', 'wconvert') : __('New question', 'wconvert'))}</strong>
        {!existing && kind !== 'ending' && <><ArrowRight aria-hidden="true" size={14}/><span>{tree.steps.find(screen => screen.id === location.target)?.name}</span></>}
      </div>
      {intent === 'followup' && <small>{__('Visitors who do not match skip the new screen. Every other matching follow-up can still appear.', 'wconvert')}</small>}
      {intent === 'branch' && <small>{sprintf(__('Checked after existing branches. Everyone else still goes to %s.', 'wconvert'), tree.steps.find(screen => screen.id === location.target)?.name ?? '')}</small>}
    </div>}
    </div>
    <div className="wconvert-graph-insert__actions"><Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert')}</Button><Button type="button" disabled={!canInsert} onClick={() => {
      if (existing) onExisting?.(target, when(), intent === 'continue' ? locationId.slice(5) : undefined);
      else onInsert(locationId, effectiveKind, name.trim(), when(), !!location?.sharedHidden && includeHidden, intent === 'branch');
    }}>{existing ? __('Connect screen', 'wconvert') : __('Add screen here', 'wconvert')}</Button></div>
  </>;
}
