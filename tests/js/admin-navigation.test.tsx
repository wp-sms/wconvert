import { beforeEach, describe, expect, it } from 'vitest';
import { useEffect, useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAdminNavigation, type EditingState } from '../../resources/admin/src/hooks/useAdminNavigation';
import { editorHref, leadsHref, reportHref } from '../../resources/admin/src/nav';

const REPORT = reportHref({ days: 7, goal: 'grow_email_list', optinId: 'OPTIN1' });
const LEADS = leadsHref({ optinId: 'OPTIN1', identifier: 'sarah+offers@example.com', from: '2026-09-01', to: '2026-09-10' });
const EDITOR = editorHref('OPTIN1', REPORT);

function Editor({ onState, onClose }: {
  onState: (state: EditingState) => void;
  onClose: () => void;
}) {
  const [headline, setHeadline] = useState('Saved headline');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onState({ dirty: headline !== 'Saved headline', busy });
  }, [headline, busy, onState]);

  return (
    <section aria-label="Editor">
      <label>Headline<input value={headline} onChange={(event) => setHeadline(event.target.value)} /></label>
      <label>Saving<input type="checkbox" checked={busy} onChange={(event) => setBusy(event.target.checked)} /></label>
      <button onClick={onClose}>Return to source</button>
    </section>
  );
}

function Harness() {
  const navigation = useAdminNavigation();
  return (
    <>
      <nav aria-label="Admin">
        <a href={REPORT}>Report</a>
        <a href={LEADS}>Leads</a>
        <a href="#destinations">Destinations</a>
        <a href={editorHref('OPTIN1', navigation.hash)}>Edit Optin</a>
      </nav>
      <output aria-label="Accepted route">{navigation.hash}</output>
      {navigation.route.editId !== undefined ? (
        <Editor
          key={navigation.route.editId}
          onState={navigation.onEditingStateChange}
          onClose={() => navigation.navigate(navigation.route.returnTo)}
        />
      ) : <h1>{navigation.route.section}</h1>}
      {navigation.pending && (
        <section role="dialog" aria-label="Unsaved changes">
          <button onClick={navigation.stay}>Keep editing</button>
          <button onClick={navigation.discard}>Discard changes</button>
        </section>
      )}
    </>
  );
}

function start(hash = REPORT) {
  window.history.replaceState({}, '', `/wp-admin/admin.php?page=wconvert${hash}`);
  render(<Harness />);
}

async function accepted(hash: string) {
  await waitFor(() => expect(screen.getByLabelText('Accepted route').textContent).toBe(hash));
  expect(window.location.hash).toBe(hash);
}

/** Actual jsdom history traversal and its hashchange, without mocking history.go. */
async function travel(direction: 'back' | 'forward') {
  await act(async () => {
    const changed = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    window.history[direction]();
    await changed;
  });
}

async function editFromReport() {
  await userEvent.click(screen.getByRole('link', { name: 'Edit Optin' }));
  await accepted(EDITOR);
}

describe('admin navigation with an editor draft', () => {
  beforeEach(() => {
    // Replace only the current entry. Each case makes and traverses its own
    // real entries, so it never depends on earlier tests' history length.
    window.history.replaceState({}, '', '/wp-admin/admin.php?page=wconvert');
  });

  it('opens a bookmarked editor and returns to its exact report query', async () => {
    start(EDITOR);
    expect(screen.getByRole('region', { name: 'Editor' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Return to source' }));
    await accepted(REPORT);
    expect(screen.getByRole('heading', { name: 'analytics' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/wp-admin/admin.php');
    expect(window.location.search).toBe('?page=wconvert');
    await travel('back');
    await accepted(EDITOR);
  });

  it('preserves lead filters when entering and returning from an editor', async () => {
    start(LEADS);
    await userEvent.click(screen.getByRole('link', { name: 'Edit Optin' }));
    await accepted(editorHref('OPTIN1', LEADS));
    await userEvent.click(screen.getByRole('button', { name: 'Return to source' }));
    await accepted(LEADS);
    expect(screen.getByRole('heading', { name: 'leads' })).toBeInTheDocument();
  });

  it('accepts real browser Back and Forward when the editor is clean', async () => {
    start();
    await editFromReport();
    await travel('back');
    await accepted(REPORT);
    expect(screen.queryByRole('region', { name: 'Editor' })).toBeNull();
    await travel('forward');
    await accepted(EDITOR);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a dirty editor mounted, restores its history entry on Keep editing, and allows Back again', async () => {
    start();
    await editFromReport();
    await userEvent.type(screen.getByRole('textbox', { name: 'Headline' }), ' edited');
    await travel('back');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.getByLabelText('Accepted route').textContent).toBe(EDITOR);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline edited');
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline edited');

    await travel('back');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await accepted(REPORT);
    expect(screen.queryByRole('region', { name: 'Editor' })).toBeNull();
    await travel('forward');
    await accepted(EDITOR);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline');
  });

  it('restores the original entry after cancelling a dirty hash-link navigation', async () => {
    start();
    await editFromReport();
    await userEvent.type(screen.getByRole('textbox', { name: 'Headline' }), ' edited');
    await userEvent.click(screen.getByRole('link', { name: 'Destinations' }));
    await screen.findByRole('dialog', { name: 'Unsaved changes' });
    expect(window.location.hash).toBe('#destinations');
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline edited');
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    await travel('back');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await accepted(REPORT);
  });

  it('discards a dirty draft only when the requested hash-link route is accepted', async () => {
    start(EDITOR);
    await userEvent.type(screen.getByRole('textbox', { name: 'Headline' }), ' edited');
    await userEvent.click(screen.getByRole('link', { name: 'Leads' }));
    await screen.findByRole('dialog', { name: 'Unsaved changes' });
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline edited');
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await accepted(LEADS);
    expect(screen.queryByRole('region', { name: 'Editor' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await travel('back');
    await accepted(EDITOR);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline');
  });

  it('restores Back navigation while saving without offering to discard the pending operation', async () => {
    start();
    await editFromReport();
    await userEvent.type(screen.getByRole('textbox', { name: 'Headline' }), ' edited');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Saving' }));
    await travel('back');
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Saving' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Saved headline edited');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Saving' }));
    await travel('back');
    expect(window.location.hash).toBe(REPORT);
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(window.location.hash).toBe(EDITOR));
  });
});
