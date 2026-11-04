import { useId, useState, type RefObject } from 'react';
import { __ } from '@wordpress/i18n';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../components/ui/admin-dialog';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { EmptyState } from '../shell/EmptyState';
import { RegionErrorState } from '../shell/Region';
import { GoalCard, offerableGoals } from '../goals/GoalCard';
import type { GoalEntry } from '../goals/api';
import { messageOf, type Loadable } from '../shell/loadable';

export interface ChangeGoalDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly goals: Loadable<GoalEntry[]>;
  readonly current: string;
  readonly duplicate?: boolean;
  /** Resolves once the change is saved (or the copy exists); a rejection stays in this dialog. */
  readonly onChange: (goal: string) => Promise<void>;
  /** Reads the goals again after a failed read. */
  readonly onRetry?: () => void;
  /**
   * Where focus goes when it closes. This dialog has no trigger of its own,
   * so Radix would otherwise put focus on `<body>` after the caller set it.
   */
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
}

/**
 * Draft goals can change; published history stays with the original campaign.
 *
 * The save runs **inside** the dialog (ADR 0131, §9): it used to close first
 * and report a refusal on the page behind it, so a refused change or an
 * unconfirmed copy surfaced somewhere the merchant was no longer looking.
 *
 * Large while it is a picker, Small once it is a confirm. The picker's title
 * stays the action: nothing has been chosen yet to name.
 */
export function ChangeGoalDialog({ open, onOpenChange, goals, current, duplicate = false, onChange, onRetry, returnFocusTo }: ChangeGoalDialogProps) {
  const [picked, setPicked] = useState<GoalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveNoteId = useId();
  const close = (next: boolean) => {
    if (saving) return;
    if (!next) { setPicked(null); setError(null); }
    onOpenChange(next);
  };
  const shown = goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow', current) : [];
  const confirm = (chosen: GoalEntry) => {
    setSaving(true);
    setError(null);
    onChange(chosen.id)
      .then(() => { setSaving(false); setPicked(null); onOpenChange(false); })
      .catch((cause: unknown) => { setSaving(false); setError(messageOf(cause)); });
  };

  return <AdminDialog open={open} onOpenChange={close}>
    <AdminDialogContent size={picked === null ? 'lg' : 'sm'} showCloseButton={!saving} onCloseAutoFocus={returnFocusTo ? event => { event.preventDefault(); returnFocusTo.current?.focus(); } : undefined}>
      {picked === null ? <>
        <AdminDialogHeader
          title={duplicate ? __('Duplicate for another goal', 'wconvert') : __('Change goal', 'wconvert')}
          meta={duplicate ? __('The original keeps its published version and all its results.', 'wconvert') : undefined} />
        <AdminDialogBody>
          {goals.status === 'loading' ? <ChoiceSkeleton status={__('Loading goals…', 'wconvert')} />
            : goals.status === 'failed' ? <RegionErrorState message={__('The goals could not be loaded.', 'wconvert')} onRetry={onRetry} />
            : shown.length === 0
              ? <EmptyState icon={Sparkles} title={__('No other goals available', 'wconvert')}>{__('This site has no other goal this campaign can use.', 'wconvert')}</EmptyState>
              : <ChoiceGrid>{shown.map((goal) => <GoalCard key={goal.id} goal={goal} surface="creation_flow"
                  choose={__('Use this goal', 'wconvert')} current={goal.id === current} refused={null} onChoose={(entry) => { setError(null); setPicked(entry); }} />)}</ChoiceGrid>}
        </AdminDialogBody>
      </> : <>
        <AdminDialogHeader
          title={picked.label}
          meta={duplicate ? __('A new draft copy for this goal', 'wconvert') : __('The new goal for this draft', 'wconvert')} />
        <AdminDialogBody className="grid gap-3">
          <p id={saveNoteId} className="m-0 text-body">{duplicate
            ? __('Copies your draft edits. Results start at zero. The original stays unchanged.', 'wconvert')
            : __('Doesn’t publish. Undo can’t reverse this. It clears Undo and Redo history.', 'wconvert')}</p>
          <p className="m-0 text-note">{picked.outcome.requirement}</p>
          <p className="m-0 text-note text-muted-foreground">{duplicate
            ? __('Review the copied draft before publishing it, especially its fields and destinations.', 'wconvert')
            : __('After first publish, the goal is fixed; duplicate for another goal.', 'wconvert')}</p>
        </AdminDialogBody>
        <AdminDialogFooter
          back={<Button type="button" variant="outline" disabled={saving} onClick={() => { setError(null); setPicked(null); }}>
            <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to goals', 'wconvert')}
          </Button>}
          error={error}
        >
          <Button type="button" aria-describedby={saveNoteId} disabled={saving} onClick={() => confirm(picked)}>
            {saving
              ? duplicate ? __('Creating copy…', 'wconvert') : __('Saving…', 'wconvert')
              : duplicate ? __('Create copied draft', 'wconvert') : __('Save draft and change goal', 'wconvert')}
          </Button>
        </AdminDialogFooter>
      </>}
    </AdminDialogContent>
  </AdminDialog>;
}
