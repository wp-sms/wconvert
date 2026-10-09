import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AdminDialog, AdminDialogBody, AdminDialogContent, AdminDialogFooter, AdminDialogHeader } from '../../resources/admin/src/components/ui/admin-dialog';
import { Disclosure } from '../../resources/admin/src/shell/Disclosure';
import { SaveStatus } from '../../resources/admin/src/shell/SaveStatus';

function Harness({ dirty }: { dirty: boolean }) {
  const [open, setOpen] = useState(true);
  return <>
    <p>{open ? 'open' : 'closed'}</p>
    <AdminDialog open={open} onOpenChange={setOpen}>
      <AdminDialogContent size="sm" dirty={dirty}>
        <AdminDialogHeader title="jane@example.com" meta="Jane · 3 submissions" />
        <AdminDialogBody>Body</AdminDialogBody>
        <AdminDialogFooter error="Couldn’t save.">
          <button type="button">Save</button>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialog>
  </>;
}

describe('the one modal', () => {
  it('names the subject and describes it with the meta line', () => {
    render(<Harness dirty={false} />);
    const dialog = screen.getByRole('dialog', { name: 'jane@example.com' });
    expect(dialog).toHaveAccessibleDescription('Jane · 3 submissions');
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save.');
  });

  it('closes on Escape when nothing was typed', async () => {
    render(<Harness dirty={false} />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('asks before discarding typed input, inside the dialog', async () => {
    render(<Harness dirty />);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('group', { name: 'Discard changes?' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('closed')).toBeInTheDocument();
  });
});

describe('the one collapsible and save line', () => {
  it('is a native disclosure whose summary carries the current value', async () => {
    render(<Disclosure title="Other details" summary="2 fields">UTM source</Disclosure>);
    const summary = screen.getByText('Other details').closest('summary')!;
    expect(summary).toHaveTextContent('2 fields');
    await userEvent.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
  });

  it('says “Saved just now” only while it is true', () => {
    const view = render(<SaveStatus saved={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
    view.rerender(<SaveStatus saved />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved just now');
  });
});
