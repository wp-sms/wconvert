import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoTip } from '../../resources/admin/src/shell/InfoTip';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../resources/admin/src/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../resources/admin/src/components/ui/alert-dialog';

it('opens shared help from the keyboard and returns focus on Escape', async () => {
  const user = userEvent.setup();
  render(<InfoTip label="About these results"><p>Complete days only.</p></InfoTip>);
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('dialog', { name: 'About these results' })).toHaveTextContent('Complete days only.');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'About these results' })).toHaveFocus();
});

// Portals live outside the app canvas: the primitive owns a white surface,
// without requiring each submission, settings or confirmation caller to fix it.
it('gives ordinary dialogs the shared card surface by default', () => {
  render(<Dialog open><DialogContent><DialogTitle>Submission details</DialogTitle><DialogDescription>Captured answers</DialogDescription></DialogContent></Dialog>);
  expect(screen.getByRole('dialog')).toHaveClass('bg-card');
  expect(screen.getByRole('dialog')).not.toHaveClass('bg-background');
});
it('gives confirmation dialogs the same surface by default', () => {
  render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>Confirm</AlertDialogTitle><AlertDialogDescription>Check your choice.</AlertDialogDescription></AlertDialogContent></AlertDialog>);
  expect(screen.getByRole('alertdialog')).toHaveClass('bg-card');
});
