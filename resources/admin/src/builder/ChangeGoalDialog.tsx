import { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ChoiceGrid, ChoiceSkeleton } from '../shell/ChoiceGrid';
import { EmptyState } from '../shell/EmptyState';
import { GoalCard, offerableGoals } from '../goals/GoalCard';
import type { GoalEntry } from '../goals/api';
import type { Loadable } from '../shell/loadable';

export interface ChangeGoalDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly goals: Loadable<GoalEntry[]>;
  readonly current: string;
  readonly duplicate?: boolean;
  readonly onChange: (goal: string) => void;
}

/** Draft Goals can change; published history stays with the original Optin. */
export function ChangeGoalDialog({ open, onOpenChange, goals, current, duplicate = false, onChange }: ChangeGoalDialogProps) {
  const [picked, setPicked] = useState<GoalEntry | null>(null);
  const saveNoteId = useId();
  const close = (next: boolean) => { if (!next) setPicked(null); onOpenChange(next); };
  const shown = goals.status === 'ready' ? offerableGoals(goals.data, 'creation_flow', current) : [];

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-2xl">
      {picked === null ? <>
        <DialogHeader>
          <DialogTitle>{duplicate ? __('Duplicate for another goal', 'wconvert') : __('Change this Optin’s goal', 'wconvert')}</DialogTitle>
          <DialogDescription>{duplicate
            ? __('Choose a Goal for a new draft. The original keeps its published version and all its results.', 'wconvert')
            : __('Choose what this draft should achieve. You can adjust its design before publishing to meet the new Goal.', 'wconvert')}</DialogDescription>
        </DialogHeader>
        {goals.status === 'loading' ? <ChoiceSkeleton /> : shown.length === 0
          ? <EmptyState icon={Sparkles} title={__('No goals available', 'wconvert')}>{__('Reload to check the Goals available on this site.', 'wconvert')}</EmptyState>
          : <ChoiceGrid>{shown.map((goal) => <GoalCard key={goal.id} goal={goal} surface="creation_flow"
              choose={__('Use this goal', 'wconvert')} current={goal.id === current} refused={null} onChoose={setPicked} />)}</ChoiceGrid>}
      </> : <>
        <DialogHeader>
          <DialogTitle>{sprintf(duplicate ? __('Create a copy for “%s”?', 'wconvert') : __('Move this draft to “%s”?', 'wconvert'), picked.label)}</DialogTitle>
          <DialogDescription>{duplicate
            ? __('The copy starts with your current name and draft edits, including design, display rules and destinations. Its results start at zero. Nothing is published automatically.', 'wconvert')
            : __('You can change the Goal until first publish. After that, duplicate for another Goal to keep reporting history stable. Undo cannot reverse this saved change.', 'wconvert')}</DialogDescription>
        </DialogHeader>
        <p className="text-note">{picked.outcome.requirement}</p>
        <p id={saveNoteId} className="text-note text-muted-foreground">{duplicate
          ? __('The original is unchanged. Review the copied draft before publishing it, especially its fields and destinations.', 'wconvert')
          : __('This also saves the current name and all draft edits, including design, display rules and destinations. It does not publish the draft. Saving a new goal clears the current Undo and Redo history.', 'wconvert')}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPicked(null)}>{__('Pick a different goal', 'wconvert')}</Button>
          <Button aria-describedby={saveNoteId} onClick={() => { const chosen = picked.id; setPicked(null); onOpenChange(false); onChange(chosen); }}>
            {duplicate ? __('Create copied draft', 'wconvert') : __('Save draft and change goal', 'wconvert')}
          </Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
