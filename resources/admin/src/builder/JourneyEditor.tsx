import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Copy, FilePlus2, ListPlus, Plus, Trash2, Workflow, X } from 'lucide-react';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Input } from '../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog';
import { JourneyScreenCard } from './JourneyScreenCard';
import { QuestionSettings, ResultSettings, RouteSettings, ScreenConditionSettings } from './JourneySettings';
import { JourneyTest } from './JourneyTest';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { TemplateTree, TemplateNode, QuestionNode, Tokens } from '@renderer/types';
import { duplicateScreen, freshScreen, referencedJourney, walkNodes, submissionScreen, movedScreen, screenRemoval, removedScreen, resultAccess } from './structure/journey';
import { conditionText } from './structure/conditionText';

const JourneyMap = lazy(() => import('./JourneyMap').then(module => ({ default: module.JourneyMap })));

export function JourneyEditor({ tree, tokens = {}, step, primaryChannel, onChange, onSelect, displaySummary, destinationSummary, onGoToRules, onGoToDestinations, openRequest }: {
  tokens?: Tokens; primaryChannel?: string | null; tree: TemplateTree; step: number; onChange(tree: TemplateTree): void; onSelect(step: number): void;
  displaySummary?: string; destinationSummary?: string; onGoToRules?(): void; onGoToDestinations?(): void; openRequest?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [view, setView] = useState<'flow' | 'screens'>('flow');
  useEffect(() => { if (openRequest) setOpen(true); }, [openRequest]);
  const [said, setSaid] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const screenList = useRef<HTMLOListElement>(null);
  const selectedId = useRef(tree.steps[step]?.id);
  const previousTree = useRef(tree);
  const select = (index: number) => { selectedId.current = tree.steps[index]?.id; onSelect(index); };
  useEffect(() => {
    if (previousTree.current !== tree) {
      const index = tree.steps.findIndex(screen => screen.id === selectedId.current);
      if (index >= 0 && index !== step) onSelect(index);
      else selectedId.current = tree.steps[step]?.id;
      previousTree.current = tree;
    } else selectedId.current = tree.steps[step]?.id;
  }, [tree, step, onSelect]);
  useEffect(() => { screenList.current?.querySelector('[data-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [step]);
  const current = tree.steps[step];
  if (!current || (tree.submissions.length === 0 && !tree.steps.some(screen => screen.kind === 'result'))) return null;
  const write = (next: TemplateTree, index: number) => { selectedId.current = next.steps[index]?.id; onChange(referencedJourney(next)); onSelect(index); };
  const move = (from: number, to: number) => {
    const next = movedScreen(tree, from, to);
    if (next === tree) { setSaid(__('Keep the main signup before the optional signup, and the thank-you screen last.', 'wconvert')); return; }
    write(next, to);
    setSaid(sprintf(__('%1$s moved to screen %2$d.', 'wconvert'), tree.steps[from].name, to + 1));
  };
  const saving = (index: number) => tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
  const saveLabel = (id: string) => {
    const optional = tree.submissions.find(sub => sub.id === id)?.required === false;
    if (!primaryChannel) return __('Save request', 'wconvert');
    const email = optional ? primaryChannel === 'sms' : primaryChannel === 'email';
    return optional
      ? email ? __('Save optional email signup', 'wconvert') : __('Save optional SMS signup', 'wconvert')
      : email ? __('Save email signup', 'wconvert') : __('Save SMS signup', 'wconvert');
  };
  const screenLabel = (index: number) => tree.steps[index].kind === 'result' ? __('Shows a selected result', 'wconvert')
    : tree.steps[index].kind === 'acknowledgement' ? __('Journey complete', 'wconvert')
    : saving(index) ? saveLabel(saving(index)!.id) : __('Continue only', 'wconvert');
  const add = (kind: 'content' | 'input') => {
    const steps = [...tree.steps]; const boundary = steps.findIndex(s => s.kind === 'result' || walkNodes(s.content).some(n => 'action' in n && n.action === 'submit'));
    const at = Math.min(step + 1, boundary < 0 ? steps.length - 1 : boundary);
    let screen = freshScreen(tree, kind);
    const optional = tree.submissions[1];
    const primaryEnd = steps.findIndex(s => walkNodes(s.content).some(n => 'submission' in n && n.submission === tree.submissions[0]?.id && 'action' in n && n.action === 'submit'));
    if (optional && at > primaryEnd && 'children' in screen.content) {
      screen = { ...screen, content: { ...screen.content, children: [...(screen.content.children ?? []),
        { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'skip', submission: optional.id, role: 'skip_label' }] } };
    }
    if (at === step + 1 && steps[step].paths?.length) {
      const paths = [...steps[step].paths!];
      const fallback = paths[paths.length - 1];
      screen = { ...screen, paths: [{ to: fallback.to }] };
      paths[paths.length - 1] = { to: screen.id };
      steps[step] = { ...steps[step], paths };
    } else if (at <= step && steps[at]) {
      const boundaryId = steps[at].id;
      screen = { ...screen, paths: [{ to: boundaryId }] };
      for (let index = 0; index < at; index++) if (steps[index].paths) {
        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === boundaryId ? { ...path, to: screen.id } : path) };
      }
    }
    steps.splice(at, 0, screen); write({ ...tree, steps }, at);
  };
  const addOptional = () => {
    const channel = primaryChannel === 'sms' || tree.submissions.length === 0 ? 'email' : 'phone';
    const id = channel === 'email' ? 'email-signup' : 'sms-signup';
    // Keep an earned reward visible before asking for an optional channel.
    // Leave the original in acknowledgement so removing SMS cannot remove it.
    const rewards = walkNodes(tree.steps[tree.steps.length - 1].content, false)
      .filter(node => ['code', 'followup'].includes(node.type) && !('hidden' in node && node.hidden))
      .map(node => { const copy = { ...node } as Record<string, unknown>; delete copy.id; return copy as unknown as TemplateNode; });
    const screen = { ...freshScreen(tree, 'input'), name: channel === 'email' ? __('Optional email signup', 'wconvert') : __('Optional SMS signup', 'wconvert'), content: { type: 'stack', children: [
      { type: 'heading', text: __('Your signup was received', 'wconvert'), role: 'headline' },
      ...rewards,
      { type: 'text', text: channel === 'email' ? __('Would you also like email updates?', 'wconvert') : __('Would you also like text updates?', 'wconvert'), role: 'body' },
      { type: 'field', name: channel, required: true, label: channel === 'email' ? __('Email address', 'wconvert') : __('Phone number', 'wconvert') },
      { type: 'consent', text: channel === 'email' ? __('Send me email updates. %s', 'wconvert') : __('Send me text updates. %s', 'wconvert'), link: { label: __('Privacy Policy', 'wconvert') }, hidden: false, role: 'consent_text' },
      { type: 'button', label: channel === 'email' ? __('Sign up for email', 'wconvert') : __('Sign up for SMS', 'wconvert'), action: 'submit', submission: id },
      { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'skip', submission: id },
      { type: 'button', label: __('Back', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'back' },
    ] } } as const;
    const steps = [...tree.steps];
    if (tree.submissions.length === 0 && steps[steps.length - 1].kind === 'result') {
      const result = steps[steps.length - 1];
      steps[steps.length - 1] = { ...result, content: { type: 'stack', children: [result.content,
        { type: 'button', label: __('Optional email updates', 'wconvert'), action: 'next' }] } };
      steps.push(screen, { id: 'received', name: __('Thanks', 'wconvert'), kind: 'acknowledgement', content: { type: 'stack', children: [
        { type: 'heading', text: __('You can return to your result', 'wconvert') },
        { type: 'button', label: __('Back', 'wconvert'), action: 'back' },
      ] } });
      write({ ...tree, steps, submissions: [{ id, required: false, fields: [], consents: [] }] }, steps.length - 2);
    } else {
      const previous = steps[steps.length - 2];
      const end = steps[steps.length - 1];
      if (previous.paths?.length) {
        steps[steps.length - 2] = { ...previous, paths: previous.paths.map(path => path.to === end.id ? { ...path, to: screen.id } : path) };
      }
      steps.splice(steps.length - 1, 0, screen);
      if (previous.paths?.length) steps[steps.length - 2] = { ...steps[steps.length - 2], paths: [{ to: end.id }] };
      write({ ...tree, steps, submissions: [...tree.submissions, { id, required: false, fields: [], consents: [] }] }, steps.length - 2);
    }
  };
  const removal = screenRemoval(tree, step);
  const remove = () => {
    const next = removedScreen(tree, step);
    write(next, Math.min(step, next.steps.length - 1));
    setSaid(__('Screen removed. Undo brings it back.', 'wconvert'));
  };
  const submission = saving(step);
  const connect = (source: string, target: string) => {
    const from = tree.steps.findIndex(screen => screen.id === source);
    if (from < 0) return;
    const screen = tree.steps[from];
    const fallback = { to: tree.steps[from + 1]?.id ?? target };
    const paths = screen.paths ?? [fallback];
    if (paths.some(path => path.to === target)) { select(from); return; }
    const question = tree.steps.slice(0, from + 1).flatMap(item => walkNodes(item.content)).find(node => node.type === 'question'
      && 'id' in node && typeof node.id === 'string' && 'answer_type' in node && node.answer_type !== 'text') as (QuestionNode & { id: string }) | undefined;
    if (!question) {
      if (!screen.paths) onChange({ ...tree, steps: tree.steps.map((item, index) => index === from ? { ...item, paths: [{ to: target }] } : item) });
      else setSaid(__('Add a choice question here or earlier before drawing another branch.', 'wconvert'));
      select(from); return;
    }
    const when = { match: 'all' as const, clauses: [{ question: question.id, operator: question.answer_type === 'multi' ? 'includes_any' as const : 'is' as const, values: [''] }] };
    onChange({ ...tree, steps: tree.steps.map((item, index) => index === from ? { ...item, paths: [{ to: target, when }, ...paths] } : item) });
    select(from); setSaid(__('Path added. Choose its answer in the right panel before publishing.', 'wconvert'));
  };
  return <>
    <Dialog open={open} onOpenChange={value => { setOpen(value); setSaid(''); }}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Workflow aria-hidden="true" />{__('Manage screens', 'wconvert')}</Button></DialogTrigger>
      <DialogContent className="wconvert-journey-dialog" showCloseButton={false}>
        <div className="wconvert-journey-dialog__header">
          <div><DialogTitle>{__('Manage screens', 'wconvert')}</DialogTitle>
            <DialogDescription>{__('Plan the visitor journey, then select a screen to edit its questions and paths.', 'wconvert')}</DialogDescription></div>
          <div className="wconvert-journey-dialog__header-actions">
            <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); setTestOpen(true); }}>{__('Test journey', 'wconvert')}</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline"><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}<ChevronDown aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={tree.steps.length >= 7} onSelect={() => add('content')}><FilePlus2 aria-hidden="true" />{__('Add offer screen', 'wconvert')}</DropdownMenuItem>
                <DropdownMenuItem disabled={tree.steps.length >= 7} onSelect={() => add('input')}><ListPlus aria-hidden="true" />{__('Add question screen', 'wconvert')}</DropdownMenuItem>
                {(primaryChannel && tree.submissions.length === 1 || tree.submissions.length === 0 && tree.steps.some(s => s.kind === 'result')) && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={tree.steps.length >= (tree.submissions.length === 0 ? 6 : 7)} onSelect={addOptional}><Plus aria-hidden="true" />{__('Add optional signup', 'wconvert')}</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogClose asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={__('Close screen manager', 'wconvert')}><X aria-hidden="true" /></Button></DialogClose>
          </div>
        </div>
        <div className="wconvert-journey-view" role="group" aria-label={__('Journey view', 'wconvert')}>
          <button type="button" aria-pressed={view === 'flow'} onClick={() => setView('flow')}>{__('Flow', 'wconvert')}</button>
          <button type="button" aria-pressed={view === 'screens'} onClick={() => setView('screens')}>{__('Screens', 'wconvert')}</button>
        </div>
        {(displaySummary || destinationSummary) && <div className="wconvert-journey-context">
          {displaySummary && <div><small>{__('When this appears', 'wconvert')}</small><strong>{displaySummary}</strong>
            {onGoToRules && <button type="button" onClick={() => { setOpen(false); onGoToRules(); }}>{__('Edit display rules', 'wconvert')}</button>}</div>}
          {destinationSummary && <div><small>{__('After a visitor submits', 'wconvert')}</small><strong>{destinationSummary}</strong>
            {onGoToDestinations && <button type="button" onClick={() => { setOpen(false); onGoToDestinations(); }}>{__('Edit destinations', 'wconvert')}</button>}</div>}
        </div>}
        <div className="wconvert-journey-side">
          <div className="wconvert-journey-mobile-picker"><label>{__('Screen', 'wconvert')}<select value={step} onChange={event => select(Number(event.target.value))}>{tree.steps.map((screen, index) => <option key={screen.id} value={index}>{index + 1}. {screen.name}</option>)}</select></label></div>
          {view === 'flow' && <Suspense fallback={<div className="wconvert-journey-map">{__('Loading journey map…', 'wconvert')}</div>}>
            <JourneyMap tree={tree} selected={step} onSelect={select} onConnect={connect} />
          </Suspense>}
          {view === 'screens' && <aside className="wconvert-journey-rail" aria-label={__('Journey screens', 'wconvert')}>
            <div className="wconvert-journey-rail__heading"><strong>{__('Screens', 'wconvert')}</strong><span>{tree.steps.length} / 7</span><small>{__('In visitor order · some may be skipped', 'wconvert')}</small></div>
            <ol ref={screenList} className="wconvert-journey-dialog__screens" aria-label={__('Screens in visitor order', 'wconvert')}>
              {tree.steps.map((screen, index) => <JourneyScreenCard key={screen.id} template={{ tree, tokens }} index={index} selected={index === step}
                scope={id} label={screenLabel(index)} condition={screen.when ? sprintf(__('Show if %s', 'wconvert'), conditionText(tree, screen.when))
                  : screen.kind === 'result' && (screen.results?.length ?? 0) > 1 ? sprintf(__('%d possible results', 'wconvert'), screen.results?.length ?? 0) : undefined}
                onSelect={() => select(index)}
                onMove={(from, to) => move(tree.steps.findIndex(s => s.id === from), Math.min(tree.steps.findIndex(s => s.id === to), tree.steps.length - 2))} />)}
            </ol>
          </aside>}
          <section className="wconvert-journey-pane" aria-label={__('Selected screen settings', 'wconvert')}>
            <div className="wconvert-journey-pane__heading"><div className="wconvert-journey-dialog__selected"><span>{step + 1}</span><div><h3>{current.name}</h3><small>{sprintf(__('Screen %1$d of %2$d', 'wconvert'), step + 1, tree.steps.length)}</small></div></div></div>
            <div className="wconvert-journey-dialog__details">
          <div className="wconvert-journey-dialog__fields">

            <label className="wconvert-journey__field">{__('Screen name', 'wconvert')}
              <Input type="text" value={current.name} onChange={e => onChange({ ...tree, steps: tree.steps.map((s, i) => i === step ? { ...s, name: e.target.value } : s) })} />
            </label>
            {current.kind === 'input' && <label className="wconvert-journey__field">{__('When this screen is completed', 'wconvert')}
              <select value={tree.submissions.find(sub => walkNodes(current.content).some(n => 'submission' in n && n.submission === sub.id && 'action' in n && n.action === 'submit'))?.id ?? 'next'}
                onChange={event => {
                  const chosen = event.target.value;
                  const rewrite = (node: import('@renderer/types').TemplateNode, at: number): import('@renderer/types').TemplateNode => {
                    const n = { ...node } as Record<string, unknown>;
                    if (n.type === 'button' && n.action === 'submit' && (at === step || n.submission === chosen)) { n.action = 'next'; delete n.submission; }
                    for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as import('@renderer/types').TemplateNode[]).map(c => rewrite(c, at));
                    return n as unknown as import('@renderer/types').TemplateNode;
                  };
                  const steps = tree.steps.map((s, at) => ({ ...s, content: rewrite(s.content, at) }));
                  if (chosen !== 'next') {
                    let replaced = false;
                    const submit = (node: import('@renderer/types').TemplateNode): import('@renderer/types').TemplateNode => {
                      const n = { ...node } as Record<string, unknown>;
                      if (!replaced && n.type === 'button' && n.action === 'next') { replaced = true; n.action = 'submit'; n.submission = chosen; n.label = __('Submit', 'wconvert'); }
                      for (const key of ['children', 'start', 'end']) if (Array.isArray(n[key])) n[key] = (n[key] as import('@renderer/types').TemplateNode[]).map(submit);
                      return n as unknown as import('@renderer/types').TemplateNode;
                    };
                    steps[step] = { ...steps[step], content: submit(steps[step].content) };
                  }
                  write({ ...tree, steps }, step);
                }}>
                <option value="next">{__('Go to the next screen', 'wconvert')}</option>
                {tree.submissions.map(sub => <option key={sub.id} value={sub.id}>{saveLabel(sub.id)}</option>)}
              </select>
            </label>}
          </div>
          <ScreenConditionSettings tree={tree} step={step} onChange={onChange} onSelect={select} />
          <QuestionSettings tree={tree} step={step} onChange={onChange} onSelect={select} />
          <RouteSettings tree={tree} step={step} onChange={onChange} />
          {current.kind === 'result' && <fieldset className="wconvert-journey-settings__group">
            <legend>{__('When visitors see their result', 'wconvert')}</legend>
            <label><input type="radio" name={`${id}-result-access`} disabled={tree.steps.some(screen => screen.paths?.length)} checked={tree.submissions.length === 0 || step < submissionScreen(tree, tree.submissions[0]?.id)}
              onChange={() => { if (tree.submissions.length) { const next = resultAccess(tree, false); write(next, next.steps.findIndex(s => s.id === current.id)); } }} />{__('Immediately after the questions', 'wconvert')}</label>
            <label><input type="radio" name={`${id}-result-access`} disabled={tree.submissions.length !== 1 || tree.steps.some(screen => screen.paths?.length)}
              checked={tree.submissions.length === 1 && step > submissionScreen(tree, tree.submissions[0].id)}
              onChange={() => { const next = resultAccess(tree, true); write(next, next.steps.findIndex(s => s.id === current.id)); }} />{__('After required contact details', 'wconvert')}</label>
            {tree.steps.some(screen => screen.paths?.length) && <p>{__('Remove answer paths before changing when results appear.', 'wconvert')}</p>}
            {tree.submissions.length === 0 && <p>{__('Add a signup screen first to make contact details required.', 'wconvert')} <button type="button" onClick={addOptional}>{__('Add signup', 'wconvert')}</button></p>}
            {tree.submissions.length > 0 && <p>{__('Tell visitors about any contact requirement on the first screen. Changing this choice is one undoable draft edit.', 'wconvert')}</p>}
          </fieldset>}
          <ResultSettings tree={tree} step={step} onChange={onChange} />
          <div className="wconvert-journey-dialog__behavior"><strong>{screenLabel(step)}</strong><p>{current.kind === 'acknowledgement'
            ? __('The journey ends here. This screen always stays last.', 'wconvert')
            : submission?.required === false
              ? __('Adds details to the same Lead. Visitors can skip this signup; their earlier signup stays saved.', 'wconvert')
              : submission
                ? __('Saves the signup or request here, even if the visitor leaves a later screen.', 'wconvert')
                : __('New answers stay on this page until the visitor submits. Going to the next screen does not save new details.', 'wconvert')}</p></div>
            </div>
            <div className="wconvert-journey-dialog__actions-row">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline">{__('Screen actions', 'wconvert')}<ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem disabled={current.kind === 'acknowledgement' || current.kind === 'result' || tree.steps.length >= 7} onSelect={() => {
                    const steps = [...tree.steps];
                    let copy = duplicateScreen(tree, step);
                    if (steps.slice(0, step).some(screen => screen.paths?.some(path => path.to === current.id))) {
                      for (let index = 0; index < step; index++) if (steps[index].paths?.some(path => path.to === current.id)) {
                        steps[index] = { ...steps[index], paths: steps[index].paths!.map(path => path.to === current.id ? { ...path, to: copy.id } : path) };
                      }
                      copy = { ...copy, paths: [{ to: current.id }] };
                    }
                    steps.splice(step, 0, copy); write({ ...tree, steps }, step);
                  }}><Copy aria-hidden="true" />{__('Duplicate', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={movedScreen(tree, step, step - 1) === tree} onSelect={() => move(step, step - 1)}><ArrowLeft aria-hidden="true" />{__('Move earlier', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={movedScreen(tree, step, step + 1) === tree} onSelect={() => move(step, step + 1)}><ArrowRight aria-hidden="true" />{__('Move later', 'wconvert')}</DropdownMenuItem>
                  <DropdownMenuItem disabled={removal.screens.length === 0} onSelect={() => removal.screens.length > 1 ? setConfirmRemoval(true) : remove()}><Trash2 aria-hidden="true" />{__('Delete screen', 'wconvert')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>{__('Edit design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:rotate-180" /></Button>
            </div>
          </section>
        </div>
        <div className="wconvert-journey-dialog__footer"><p role="status">{said || __('Changes are part of your campaign draft. Save the draft to keep them.', 'wconvert')}</p><DialogClose asChild><Button variant="outline">{__('Done', 'wconvert')}</Button></DialogClose></div>
        <ConfirmDialog open={confirmRemoval} onOpenChange={setConfirmRemoval} title={__('Remove this optional signup?', 'wconvert')}
          description={sprintf(__('These screens collect details for the same signup and will be removed: %s. Other screens stay. Undo brings them back.', 'wconvert'), tree.steps.filter(s => removal.screens.includes(s.id)).map(s => s.name).join(', '))}
          confirmLabel={__('Remove signup screens', 'wconvert')} onConfirm={remove} />
      </DialogContent>
    </Dialog>
    <Dialog open={testOpen} onOpenChange={value => { setTestOpen(value); if (!value) setOpen(true); }}>
      <DialogContent className="wconvert-journey-test-dialog">
        <DialogTitle>{__('Test journey', 'wconvert')}</DialogTitle>
        <DialogDescription>{__('Try answers and inspect the included and skipped screens. Nothing is submitted.', 'wconvert')}</DialogDescription>
        <JourneyTest template={{ tree, tokens }} onEdit={index => { select(index); setTestOpen(false); setOpen(true); }} />
      </DialogContent>
    </Dialog>
  </>;
}
