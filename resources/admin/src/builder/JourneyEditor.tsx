import { __ } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import type { TemplateTree } from '@renderer/types';
import { duplicateScreen, freshScreen, referencedJourney, walkNodes } from './structure/journey';

export function JourneyEditor({ tree, step, primaryChannel, onChange, onSelect }: {
  primaryChannel?: string | null; tree: TemplateTree; step: number; onChange(tree: TemplateTree): void; onSelect(step: number): void;
}) {
  const current = tree.steps[step];
  if (!current || tree.submissions.length === 0) return null;
  const write = (next: TemplateTree, index: number) => { onChange(referencedJourney(next)); onSelect(index); };
  const move = (by: number) => {
    const steps = [...tree.steps]; [steps[step], steps[step + by]] = [steps[step + by], steps[step]];
    write({ ...tree, steps }, step + by);
  };
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
  const removeOptional = () => {
    const primary = tree.submissions[0].id;
    const end = tree.steps.findIndex(s => walkNodes(s.content).some(n => n.type === 'button' && 'action' in n && n.action === 'submit' && 'submission' in n && n.submission === primary));
    if (end < 0) return;
    write({ ...tree, submissions: tree.submissions.slice(0, 1), steps: [...tree.steps.slice(0, end + 1), tree.steps[tree.steps.length - 1]] }, end);
  };
  return <fieldset className="space-y-2 p-3 border rounded-md">
    <legend>{__('Journey screens', 'wconvert')}</legend>
    <label className="block">{__('Screen name', 'wconvert')}
      <input className="w-full" value={current.name} onChange={e => onChange({ ...tree, steps: tree.steps.map((s, i) => i === step ? { ...s, name: e.target.value } : s) })} />
    </label>
    {current.kind === 'input' && <label className="block">{__('On completion', 'wconvert')}
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
        <option value="next">{__('Continue without saving', 'wconvert')}</option>
        {tree.submissions.map((sub, i) => <option key={sub.id} value={sub.id}>{i === 0 ? __('Submit primary signup/request', 'wconvert') : __('Submit optional signup', 'wconvert')}</option>)}
      </select>
    </label>}
    {primaryChannel && <Button type="button" size="sm" variant="outline" disabled={tree.submissions.length === 1 && tree.steps.length >= 7} onClick={tree.submissions.length === 1 ? addOptional : removeOptional}>
      {tree.submissions.length === 1 ? __('Add optional signup', 'wconvert') : __('Remove optional signup screens', 'wconvert')}
    </Button>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={tree.steps.length >= 7} onClick={() => add('content')}>{__('Add offer screen', 'wconvert')}</Button>
      <Button type="button" size="sm" variant="outline" disabled={tree.steps.length >= 7} onClick={() => add('input')}>{__('Add question screen', 'wconvert')}</Button>
      <Button type="button" size="sm" variant="outline" disabled={current.kind === 'acknowledgement' || tree.steps.length >= 7} onClick={() => {
        const steps = [...tree.steps]; steps.splice(step, 0, duplicateScreen(tree, step)); write({ ...tree, steps }, step);
      }}>{__('Duplicate', 'wconvert')}</Button>
      <Button type="button" size="sm" variant="outline" disabled={step === 0 || current.kind === 'acknowledgement'} onClick={() => move(-1)}>{__('Move earlier', 'wconvert')}</Button>
      <Button type="button" size="sm" variant="outline" disabled={step >= tree.steps.length - 2} onClick={() => move(1)}>{__('Move later', 'wconvert')}</Button>
      <Button type="button" size="sm" variant="outline" disabled={current.kind === 'acknowledgement' || tree.steps.length <= 2} onClick={() => write({ ...tree, steps: tree.steps.filter((_, i) => i !== step) }, Math.max(0, step - 1))}>{__('Delete screen', 'wconvert')}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{__('Next keeps answers on this page. Submit saves the declared signup. Fix repeated fields or missing submission buttons before publishing.', 'wconvert')}</p>
  </fieldset>;
}
