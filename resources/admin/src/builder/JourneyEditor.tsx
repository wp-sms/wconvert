import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Copy, FilePlus2, ListPlus, Plus, Trash2, Workflow, X } from 'lucide-react';
import { ConfirmDialog } from '../shell/ConfirmDialog';
import { Input } from '../components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog';
import { JourneyScreenCard } from './JourneyScreenCard';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { TemplateTree, Tokens } from '@renderer/types';
import { duplicateScreen, freshScreen, referencedJourney, walkNodes, submissionScreen, movedScreen, screenRemoval, removedScreen } from './structure/journey';

export function JourneyEditor({ tree, tokens = {}, step, primaryChannel, onChange, onSelect }: {
  tokens?: Tokens; primaryChannel?: string | null; tree: TemplateTree; step: number; onChange(tree: TemplateTree): void; onSelect(step: number): void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const current = tree.steps[step];
  if (!current || tree.submissions.length === 0) return null;
  const write = (next: TemplateTree, index: number) => { onChange(referencedJourney(next)); onSelect(index); };
  const move = (from: number, to: number) => {
    const next = movedScreen(tree, from, to);
    if (next === tree) { setSaid(__('Keep the main signup before the optional signup, and the thank-you screen last.', 'wconvert')); return; }
    write(next, to);
    setSaid(sprintf(__('%1$s moved to screen %2$d.', 'wconvert'), tree.steps[from].name, to + 1));
  };
  const saving = (index: number) => tree.submissions.find(sub => submissionScreen(tree, sub.id) === index);
  const saveLabel = (id: string) => {
    const optional = id !== tree.submissions[0].id;
    if (!primaryChannel) return __('Save request', 'wconvert');
    const email = optional ? primaryChannel === 'sms' : primaryChannel === 'email';
    return optional
      ? email ? __('Save optional email signup', 'wconvert') : __('Save optional SMS signup', 'wconvert')
      : email ? __('Save email signup', 'wconvert') : __('Save SMS signup', 'wconvert');
  };
  const screenLabel = (index: number) => tree.steps[index].kind === 'acknowledgement' ? __('Journey complete', 'wconvert')
    : saving(index) ? saveLabel(saving(index)!.id) : __('Continue only', 'wconvert');
  const add = (kind: 'content' | 'input') => {
    const steps = [...tree.steps]; const at = Math.min(step, steps.length - 1);
    let screen = freshScreen(tree, kind);
    const optional = tree.submissions[1];
    const primaryEnd = steps.findIndex(s => walkNodes(s.content).some(n => 'submission' in n && n.submission === tree.submissions[0].id && 'action' in n && n.action === 'submit'));
    if (optional && at > primaryEnd && 'children' in screen.content) {
      screen = { ...screen, content: { ...screen.content, children: [...(screen.content.children ?? []),
        { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'skip', submission: optional.id, role: 'skip_label' }] } };
    }
    steps.splice(at, 0, screen); write({ ...tree, steps }, at);
  };
  const addOptional = () => {
    const channel = primaryChannel === 'sms' ? 'email' : 'phone';
    const id = channel === 'email' ? 'email-signup' : 'sms-signup';
    const screen = { ...freshScreen(tree, 'input'), name: channel === 'email' ? __('Optional email signup', 'wconvert') : __('Optional SMS signup', 'wconvert'), content: { type: 'stack', children: [
      { type: 'heading', text: __('Your signup was received', 'wconvert'), role: 'headline' },
      { type: 'text', text: channel === 'email' ? __('Would you also like email updates?', 'wconvert') : __('Would you also like text updates?', 'wconvert'), role: 'body' },
      { type: 'field', name: channel, required: true, label: channel === 'email' ? __('Email address', 'wconvert') : __('Phone number', 'wconvert') },
      { type: 'consent', text: channel === 'email' ? __('Send me email updates. %s', 'wconvert') : __('Send me text updates. %s', 'wconvert'), link: { label: __('Privacy Policy', 'wconvert') }, hidden: false, role: 'consent_text' },
      { type: 'button', label: channel === 'email' ? __('Sign up for email', 'wconvert') : __('Sign up for SMS', 'wconvert'), action: 'submit', submission: id },
      { type: 'button', label: __('No thanks', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'skip', submission: id },
      { type: 'button', label: __('Back', 'wconvert'), tokens: { accent: 'transparent', 'accent-fg': '#475569' }, action: 'back' },
    ] } } as const;
    const steps = [...tree.steps]; steps.splice(steps.length - 1, 0, screen);
    write({ ...tree, steps, submissions: [...tree.submissions, { id, required: false, fields: [], consents: [] }] }, steps.length - 2);
  };
  const removal = screenRemoval(tree, step);
  const remove = () => {
    const next = removedScreen(tree, step);
    write(next, Math.min(step, next.steps.length - 1));
    setSaid(__('Screen removed. Undo brings it back.', 'wconvert'));
  };
  const submission = saving(step);
  return <TooltipProvider delayDuration={300}>
    <Dialog open={open} onOpenChange={value => { setOpen(value); setSaid(''); }}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Workflow aria-hidden="true" />{__('Manage screens', 'wconvert')}</Button></DialogTrigger>
      <DialogContent className="wconvert-journey-dialog" showCloseButton={false}>
        <div className="wconvert-journey-dialog__header">
          <div><DialogTitle>{__('Manage screens', 'wconvert')}</DialogTitle>
            <DialogDescription>{__('Visitors see these screens in order. Drag to rearrange, or select a screen to make changes.', 'wconvert')}</DialogDescription></div>
          <div className="wconvert-journey-dialog__header-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline"><Plus aria-hidden="true" />{__('Add screen', 'wconvert')}<ChevronDown aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={tree.steps.length >= 7} onSelect={() => add('content')}><FilePlus2 aria-hidden="true" />{__('Add offer screen', 'wconvert')}</DropdownMenuItem>
                <DropdownMenuItem disabled={tree.steps.length >= 7} onSelect={() => add('input')}><ListPlus aria-hidden="true" />{__('Add question screen', 'wconvert')}</DropdownMenuItem>
                {primaryChannel && tree.submissions.length === 1 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={tree.steps.length >= 7} onSelect={addOptional}><Plus aria-hidden="true" />{__('Add optional signup', 'wconvert')}</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogClose asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={__('Close screen manager', 'wconvert')}><X aria-hidden="true" /></Button></DialogClose>
          </div>
        </div>
        <ol className="wconvert-journey-dialog__screens" aria-label={__('Screens in visitor order', 'wconvert')}>
          {tree.steps.map((screen, index) => <JourneyScreenCard key={screen.id} template={{ tree, tokens }} index={index} selected={index === step}
            scope={id} label={screenLabel(index)} onSelect={() => onSelect(index)}
            onMove={(from, to) => move(tree.steps.findIndex(s => s.id === from), Math.min(tree.steps.findIndex(s => s.id === to), tree.steps.length - 2))} />)}
        </ol>
        <div className="wconvert-journey-dialog__details">
          <div className="wconvert-journey-dialog__selected"><span>{step + 1}</span><h3>{current.name}</h3></div>
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
          <div className="wconvert-journey-dialog__behavior"><strong>{screenLabel(step)}</strong><p>{current.kind === 'acknowledgement'
            ? __('The journey ends here. This screen always stays last.', 'wconvert')
            : submission?.required === false
              ? __('Adds details to the same Lead. Visitors can skip this signup; their earlier signup stays saved.', 'wconvert')
              : submission
                ? __('Saves the signup or request here, even if the visitor leaves a later screen.', 'wconvert')
                : __('New answers stay on this page until the visitor submits. Going to the next screen does not save new details.', 'wconvert')}</p></div>
          <div className="wconvert-journey-dialog__actions-row">
            <div className="wconvert-journey__actions" role="group" aria-label={__('Screen actions', 'wconvert')}>
              <ScreenAction label={__('Duplicate', 'wconvert')} icon={Copy} disabled={current.kind === 'acknowledgement' || tree.steps.length >= 7} onClick={() => {
                const steps = [...tree.steps]; steps.splice(step, 0, duplicateScreen(tree, step)); write({ ...tree, steps }, step);
              }} />
              <ScreenAction label={__('Move earlier', 'wconvert')} icon={ArrowLeft} directional disabled={movedScreen(tree, step, step - 1) === tree} onClick={() => move(step, step - 1)} />
              <ScreenAction label={__('Move later', 'wconvert')} icon={ArrowRight} directional disabled={movedScreen(tree, step, step + 1) === tree} onClick={() => move(step, step + 1)} />
              <ScreenAction label={__('Delete screen', 'wconvert')} icon={Trash2} destructive buttonRef={deleteButton} disabled={removal.screens.length === 0} onClick={() => removal.screens.length > 1 ? setConfirmRemoval(true) : remove()} />
            </div>
            <Button type="button" onClick={() => setOpen(false)}>{__('Edit this screen’s design', 'wconvert')}<ArrowRight aria-hidden="true" className="rtl:rotate-180" /></Button>
          </div>
        </div>
        <div className="wconvert-journey-dialog__footer"><p role="status">{said || __('Changes are part of your campaign draft. Save the draft to keep them.', 'wconvert')}</p><DialogClose asChild><Button variant="outline">{__('Done', 'wconvert')}</Button></DialogClose></div>
        <ConfirmDialog open={confirmRemoval} onOpenChange={setConfirmRemoval} title={__('Remove this optional signup?', 'wconvert')}
          description={sprintf(__('These screens collect details for the same signup and will be removed: %s. Other screens stay. Undo brings them back.', 'wconvert'), tree.steps.filter(s => removal.screens.includes(s.id)).map(s => s.name).join(', '))}
          confirmLabel={__('Remove signup screens', 'wconvert')} onConfirm={remove} returnFocusTo={deleteButton} />
      </DialogContent>
    </Dialog>
  </TooltipProvider>;
}
/** Refused actions stay focusable so their labels are available by keyboard. */
function ScreenAction({ label, icon: Icon, disabled, directional, destructive, onClick, buttonRef }: {
  label: string; icon: typeof Copy; disabled: boolean; directional?: boolean; destructive?: boolean; onClick(): void; buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button ref={buttonRef} type="button" size="icon-sm" variant="ghost" aria-label={label} aria-disabled={disabled}
        className={destructive ? 'wconvert-journey__delete' : undefined}
        onClick={() => { if (!disabled) onClick(); }}>
        <Icon aria-hidden="true" className={directional ? 'rtl:rotate-180' : undefined} />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>{label}</TooltipContent>
  </Tooltip>;
}
