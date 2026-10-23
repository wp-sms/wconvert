import { useId, useState } from 'react';
import { CheckRow } from '@/shell/CheckRow';
import { __, sprintf } from '@wordpress/i18n';
import type { QuestionCondition, QuestionNode, TemplateTree } from '@renderer/types';
import { ArrowRight, CircleHelp, Flag, LayoutTemplate, Send } from 'lucide-react';
import { followupGroups, followupGroupSource } from '@/builder/structure/followupGroups';
import { conditionText } from '@/builder/structure/conditionText';
import { walkNodes } from '@/builder/structure/journey';
import { gatesOf } from '@/builder/structure/gateEndings';
import { graphReaches } from '@/builder/structure/graph';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AdminDialogBody, AdminDialogFooter, AdminDialogHeader } from '@/components/ui/admin-dialog';
import { graphInsertionLocations, insertionUnavailable, type GraphScreenKind } from './structure/graphInsertion';
import { canAddGraphConnection, canTargetGraphScreen, graphChoiceSources } from '@/builder/structure/graphConnections';

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
  const [answers, setAnswers] = useState<readonly string[]>(initialAnswer ? [initialAnswer.value] : []);
  const [includeHidden, setIncludeHidden] = useState(initialKind === 'followup');
  const location = locations.find(item => item.id === (intent === 'branch' ? `edge:${fallback?.id}` : locationId));
  const locationEdge = tree.graph?.edges.find(edge => `edge:${edge.id}` === location?.id);
  const hasBranches = tree.graph?.edges.some(edge => edge.from === location?.source && edge.kind === 'answer');
  const pathName = locationEdge?.kind === 'answer' && locationEdge.when ? conditionText(tree, locationEdge.when)
    : locationEdge?.kind === 'hidden' ? __('If skipped', 'wconvert-pro')
    : hasBranches ? __('All other answers', 'wconvert-pro') : __('Everyone on this line', 'wconvert-pro');
  const choices = intent === 'branch' ? graphChoiceSources(tree, source) : location?.choices ?? [];
  const question = questionId ? choices.find(item => item.id === questionId) : choices[0];
  const unavailable = location ? insertionUnavailable(location, effectiveKind) : __('Choose a location to continue.', 'wconvert-pro');
  const needsCondition = intent !== 'continue';
  const conditionReady = !needsCondition || answers.length > 0 && answers.every(value => question?.options?.some(option => option.value === value));
  const validTargets = tree.steps.filter(screen => intent === 'branch' ? canAddGraphConnection(tree, source, screen.id)
    : location?.source && screen.id !== location.target && canTargetGraphScreen(tree, location.source, screen.id));
  const canInsert = !capture && (!initialAnswer || existing || !!name.trim()) && conditionReady && (existing ? validTargets.some(screen => screen.id === target) : !unavailable);
  const when = (): QuestionCondition | undefined => needsCondition && question ? { match: 'all', clauses: [{ question: question.id,
    operator: question.answer_type === 'multi' ? 'includes_any' : 'is', values: [...answers] }] } : undefined;
  const group = intent === 'followup' ? followupGroups(tree).find(item => item.screens.some(at => tree.steps[at].id === location?.source || tree.steps[at].id === location?.target)) : undefined;
  const groupSource = group ? followupGroupSource(tree, group) : undefined;
  const suggested = unavailable && intent === 'continue' && kind === 'input' ? locations.find(item => item.target === source && !insertionUnavailable(item, 'input')) ?? locations.find(item => !insertionUnavailable(item, 'input')) : undefined;
  // An ending added where the required form hasn't been passed is an early ending (ADR 0142).
  const form = gatesOf(tree).details;
  const skipsForm = !!form && !!tree.graph && !!location?.source && location.source !== form && !graphReaches(tree.graph, form, location.source);
  const captures = tree.steps.filter(screen => (validTargets.includes(screen) || screen.id === location?.target) && walkNodes(screen.content).some(node => node.type === 'button' && 'action' in node && node.action === 'submit'));
  // Why the primary is refused, said beside it (§9); `null` when it can run.
  const refusal = canInsert ? null
    : capture ? __('Choose how to collect details above.', 'wconvert-pro')
    : !conditionReady ? __('Choose the answer that shows this screen.', 'wconvert-pro')
    : existing ? __('Choose a screen to connect to.', 'wconvert-pro')
    : unavailable ? unavailable
    : __('Write the question first.', 'wconvert-pro');
  return <>
    <AdminDialogHeader title={initialAnswer ? __('Add a follow-up question', 'wconvert-pro') : __('Add a screen', 'wconvert-pro')}
      meta={initialAnswer ? __('Write the question. Its answer is already set.', 'wconvert-pro') : __('Choose what visitors see on this line.', 'wconvert-pro')} />
    <AdminDialogBody className="wconvert-graph-insert__body">
    {location && !capture && <div className="wconvert-graph-insert__outcome" aria-label={__('Where it goes', 'wconvert-pro')}>
      <div className="wconvert-graph-insert__outcome-heading"><strong>{intent === 'branch' ? __('New answer line', 'wconvert-pro') : location.id === 'entry' ? __('Before the first screen', 'wconvert-pro') : pathName}</strong>{intent !== 'branch' && <button type="button" aria-expanded={changeLocation} onClick={() => setChangeLocation(value => !value)}>{__('Change', 'wconvert-pro')}</button>}</div>
      <div><span>{(groupSource !== undefined ? tree.steps[groupSource].name : tree.steps.find(screen => screen.id === location.source)?.name) ?? __('Start', 'wconvert-pro')}</span><ArrowRight aria-hidden="true" size={14} className="rtl:-scale-x-100"/>
        <strong>{existing ? tree.steps.find(screen => screen.id === target)?.name || __('Choose a screen', 'wconvert-pro') : name.trim() || (kind === 'ending' ? __('Ending', 'wconvert-pro') : kind === 'content' ? __('New message', 'wconvert-pro') : __('New question', 'wconvert-pro'))}</strong>
        {!existing && kind !== 'ending' && <><ArrowRight aria-hidden="true" size={14} className="rtl:-scale-x-100"/><span>{group ? __('Other matching follow-ups', 'wconvert-pro') : tree.steps.find(screen => screen.id === location.target)?.name}</span></>}
      </div>
      {!existing && intent === 'continue' && location.id !== 'entry' && <small>{locationEdge?.kind === 'answer' && locationEdge.when ? sprintf(/* translators: %s: the line's answer, e.g. “Interests includes Growing”. */ __('Only visitors on the “%s” line see it.', 'wconvert-pro'), pathName) : locationEdge?.kind === 'hidden' ? __('Only visitors who skip that screen see it.', 'wconvert-pro') : __('Everyone on this line sees it.', 'wconvert-pro')}</small>}
      {group && <small>{sprintf(__('Follow-up %1$d of %2$d in this group', 'wconvert-pro'), group.screens.findIndex(at => tree.steps[at].id === location?.target) < 0 ? group.screens.length + 1 : group.screens.findIndex(at => tree.steps[at].id === location?.target) + 1, group.screens.length + 1)}</small>}
      {intent === 'followup' && <small>{group ? sprintf(/* translators: %s: a screen's name. */ __('Then → %s. Only matching questions are asked.', 'wconvert-pro'), tree.steps.find(screen => screen.id === group.next)?.name ?? '') : __('Other matching follow-ups are still asked.', 'wconvert-pro')}</small>}
      {intent === 'branch' && <small>{sprintf(/* translators: %s: a screen's name. */ __('Checked after the existing lines. All other answers still go to %s.', 'wconvert-pro'), tree.steps.find(screen => screen.id === location.target)?.name ?? '')}</small>}
    </div>}
      {(!initialAnswer || advanced) && <fieldset className="wconvert-graph-insert__intents wconvert-radio-cards"><legend>{__('Who sees it', 'wconvert-pro')}</legend>
        {([
          ['continue', __('Everyone on this line', 'wconvert-pro'), __('Every visitor on this line sees the new screen.', 'wconvert-pro')],
          ['followup', __('Only if…', 'wconvert-pro'), __('Only visitors whose answer matches see it. Other follow-ups are still asked.', 'wconvert-pro')],
          ['branch', __('Send some answers to a different screen', 'wconvert-pro'), __('First match wins, top to bottom. All other answers stay on this line.', 'wconvert-pro')],
        ] as const).map(([value, label, detail]) => {
          const off = value === 'followup' && existing || value === 'branch' && (!fallback || !graphChoiceSources(tree, source).length);
          return <label key={value} className="wconvert-radio-card" htmlFor={`${id}-intent-${value}`}><input id={`${id}-intent-${value}`} aria-labelledby={`${id}-intent-${value}-name`} aria-describedby={`${id}-intent-${value}-hint`} type="radio" name={`${id}-intent`} checked={intent === value}
            disabled={off} onChange={() => { setIntent(value); setCapture(false); if (value === 'followup' && kind === 'ending') setKind('input'); setQuestionId(''); setAnswers([]); setTarget(''); setIncludeHidden(value === 'followup'); }} /><span><strong id={`${id}-intent-${value}-name`}>{label}</strong><small id={`${id}-intent-${value}-hint`}>{value === 'branch' && off ? __('Needs a choice question before this screen.', 'wconvert-pro') : value === 'followup' && off ? __('For an existing screen, set “Only if…” in its panel.', 'wconvert-pro') : detail}</small></span></label>;
        })}
      </fieldset>}
      {intent !== 'branch' && (changeLocation || !location) ? <><label htmlFor={`${id}-location`}>{existing ? __('Line to change', 'wconvert-pro') : __('Where', 'wconvert-pro')}</label>
        <select id={`${id}-location`} value={locationId} onChange={event => { setLocationId(event.target.value); setQuestionId(initialAnswer?.question ?? ''); setAnswers(initialAnswer ? [initialAnswer.value] : []); setTarget(''); }}>
          <option value="" disabled>{__('Choose a location…', 'wconvert-pro')}</option>
          {locations.map(item => <option key={item.id} value={item.id} disabled={existing ? item.id === 'entry' : !!insertionUnavailable(item, effectiveKind)}>{item.label}{!existing && insertionUnavailable(item, effectiveKind) ? ` — ${insertionUnavailable(item, effectiveKind)}` : ''}</option>)}
        </select></> : null}
      {initialAnswer && !location && <p>{__('This answer is on more than one line. Choose where this follow-up belongs.', 'wconvert-pro')}</p>}
      {initialAnswer && location && !question && <p role="status">{__('This answer is not available here. Choose a location after its question, or change the condition.', 'wconvert-pro')} <button type="button" onClick={() => setAdvanced(true)}>{__('Change condition', 'wconvert-pro')}</button></p>}
      {initialAnswer && question && !advanced && <div className="wconvert-insert-condition"><strong>{sprintf(/* translators: 1: a question. 2: “is” or “includes”. 3: an answer. */ __('Only if “%1$s” %2$s “%3$s”', 'wconvert-pro'), question.label, question?.answer_type === 'multi' ? __('includes', 'wconvert-pro') : __('is', 'wconvert-pro'), answers.map(value => question?.options?.find(option => option.value === value)?.label ?? value).join(` ${__('or', 'wconvert-pro')} `))}</strong><button type="button" onClick={() => setAdvanced(true)}>{__('Change condition', 'wconvert-pro')}</button></div>}
      {needsCondition && (!initialAnswer || advanced) && <>
        <label htmlFor={`${id}-question`}>{intent === 'branch' ? __('Send them when the answer to', 'wconvert-pro') : __('Only if the answer to', 'wconvert-pro')}</label>
        <select id={`${id}-question`} value={question?.id ?? ''} disabled={!choices.length} onChange={event => { setQuestionId(event.target.value); setAnswers([]); }}>
          {!choices.length && <option value="">{__('Choose a location after a choice question', 'wconvert-pro')}</option>}
          {choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {/* Several answers make one line: "My home or My flat" (ADR 0142). */}
        <fieldset className="wconvert-journey-settings__answers" disabled={!question}><legend>{question?.answer_type === 'multi' ? __('Includes any of these', 'wconvert-pro') : __('Is any of these', 'wconvert-pro')}</legend>
          {question?.options?.map(option => <CheckRow key={option.value} className="wconvert-check" label={option.label} checked={answers.includes(option.value)}
            onChange={event => setAnswers(event.target.checked ? [...answers, option.value] : answers.filter(value => value !== option.value))} />)}
        </fieldset>
      </>}
      {existing ? <><label htmlFor={`${id}-target`}>{__('Connect to', 'wconvert-pro')}</label><select id={`${id}-target`} value={target} onChange={event => setTarget(event.target.value)}><option value="">{__('Choose a screen…', 'wconvert-pro')}</option>{validTargets.map(screen => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select><p>{!validTargets.length ? __('No other screen can follow this line without making a loop. Add a new screen instead.', 'wconvert-pro') : __('Screens that would make a loop aren’t listed. You’ll check any screens or forms this change skips before it applies.', 'wconvert-pro')}</p></> : <>
        {(!initialAnswer || advanced) && <div className="wconvert-graph-insert__types wconvert-radio-cards" role="group" aria-label={__('Screen type', 'wconvert-pro')}>
          {([
            ['input', CircleHelp, __('Ask a question', 'wconvert-pro'), __('Learn something before continuing', 'wconvert-pro')],
            ['content', LayoutTemplate, __('Show a message', 'wconvert-pro'), __('Explain an offer or the next step', 'wconvert-pro')],
            ['capture', Send, __('Form', 'wconvert-pro'), __('Save a request or signup', 'wconvert-pro')],
            ['ending', Flag, __('Finish this line', 'wconvert-pro'), __('Show a closing message', 'wconvert-pro')],
          ] as const).map(([value, Icon, title, description]) => {
            const refused = intent === 'followup' && (value === 'capture' || value === 'ending');
            return <label key={value} className="wconvert-radio-card">
              <input type="radio" name={`${id}-type`} value={value} disabled={refused} aria-labelledby={`${id}-type-${value}`} aria-describedby={`${id}-type-${value}-hint`}
                checked={value === 'capture' ? capture : !capture && kind === value}
                onChange={() => { setCapture(value === 'capture'); if (value !== 'capture') setKind(value); }} />
              <span><span id={`${id}-type-${value}`} className="flex items-center gap-2"><Icon aria-hidden="true" size={16}/>{title}</span>
                <span id={`${id}-type-${value}-hint`}>{refused ? __('Not available for a follow-up.', 'wconvert-pro') : description}</span></span>
            </label>;
          })}
        </div>}
        {capture ? <div className="wconvert-graph-insert__summary"><strong>{__('Contact collection', 'wconvert-pro')}</strong>
          <p>{captures.length ? __('Use an existing form to keep one combined submission. You’ll check any follow-ups this line skips.', 'wconvert-pro') : __('Contact fields need a form and consent settings. They cannot be added as an ordinary question.', 'wconvert-pro')}</p>
          {captures.map(screen => <button type="button" key={screen.id} onClick={() => { if (screen.id === location?.target) { onEditCapture?.(screen.id); return; } setCapture(false); setExisting(true); setTarget(screen.id); }} disabled={screen.id === location?.target && !onEditCapture}>{sprintf(screen.id === location?.target ? __('Edit existing %s', 'wconvert-pro') : __('Use %s', 'wconvert-pro'), screen.name)}<ArrowRight aria-hidden="true" size={14} className="rtl:-scale-x-100"/></button>)}
          {onCapture && <Button type="button" variant="outline" onClick={onCapture}>{__('Set up optional signup', 'wconvert-pro')}</Button>}
          {!captures.length && !onCapture && <p>{__('Select your existing contact screen to edit its fields, or choose a signup starting point for a new campaign.', 'wconvert-pro')}</p>}
        </div> : <>
        <label htmlFor={`${id}-name`}>{kind === 'input' ? __('Question', 'wconvert-pro') : __('Screen name', 'wconvert-pro')}</label><Input id={`${id}-name`} maxLength={120} value={name} placeholder={intent === 'followup' ? __('Relevant follow-up', 'wconvert-pro') : kind === 'content' ? __('A helpful message', 'wconvert-pro') : kind === 'ending' ? __('All done', 'wconvert-pro') : __('A follow-up question', 'wconvert-pro')} onChange={event => setName(event.target.value)} />
        {kind === 'input' && <label htmlFor={`${id}-answer-type`}>{__('Answer type', 'wconvert-pro')}<select id={`${id}-answer-type`} value={answerType} onChange={event => setAnswerType(event.target.value as QuestionNode['answer_type'])}><option value="single">{__('Choose one', 'wconvert-pro')}</option><option value="multi">{__('Choose several', 'wconvert-pro')}</option><option value="text">{__('Short answer', 'wconvert-pro')}</option></select></label>}
        {location?.sharedHidden && intent !== 'branch' && (!initialAnswer || advanced) && <CheckRow className="wconvert-check" checked={includeHidden} onChange={event => setIncludeHidden(event.target.checked)} label={sprintf(/* translators: %s: a screen's name. */ __('Also check this screen when “%s” is skipped', 'wconvert-pro'), tree.steps.find(item => item.id === location.source)?.name ?? '')} />}
        {kind === 'ending' && intent !== 'followup' && <p>{skipsForm ? __('Visitors who finish here don’t save their details. That’s fine for an early ending such as “Not a fit”: it reads “Ends without saving details”.', 'wconvert-pro') : __('This is a closing screen. It doesn’t save details.', 'wconvert-pro')}</p>}
        {unavailable && <div role="status"><p>{unavailable}</p>{suggested && <Button type="button" variant="outline" onClick={() => { setLocationId(suggested.id); setChangeLocation(false); }}>{sprintf(__('Add before %s', 'wconvert-pro'), tree.steps.find(screen => screen.id === suggested.target)?.name ?? '')}</Button>}</div>}
        </>}
      </>}
      {onExisting && (!initialAnswer || advanced) && <button type="button" className="wconvert-insert-existing" onClick={() => { setExisting(value => !value); setCapture(false); if (!existing && intent === 'followup') setIntent('continue'); }}>{existing ? __('Create a new screen instead', 'wconvert-pro') : __('Connect an existing screen instead…', 'wconvert-pro')}</button>}

    </AdminDialogBody>
    <AdminDialogFooter back={<Button type="button" variant="outline" onClick={onCancel}>{__('Cancel', 'wconvert-pro')}</Button>}
      note={refusal && <span id={`${id}-refusal`}>{refusal}</span>}>
      <Button type="button" aria-disabled={refusal !== null || undefined} aria-describedby={refusal ? `${id}-refusal` : undefined} onClick={() => {
        if (refusal !== null) return;
        if (existing) onExisting?.(target, when(), intent === 'continue' ? locationId.slice(5) : undefined);
        else onInsert(locationId, effectiveKind, name.trim(), when(), !!location?.sharedHidden && includeHidden, intent === 'branch', kind === 'input' ? answerType : undefined);
      }}>{existing ? __('Connect screen', 'wconvert-pro') : initialAnswer ? __('Add follow-up', 'wconvert-pro') : __('Add screen here', 'wconvert-pro')}</Button>
    </AdminDialogFooter>
  </>;
}
