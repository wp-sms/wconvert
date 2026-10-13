import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The webhook's account setup, variant B of the approved prototype
 * (claude.ai/artifact/KJWnB3Hym1VBiL2MpVbgh4, ADR 0148): pick the tool, then a
 * form made for it. Every tool is the same webhook underneath, so what each
 * one stores is the assertion that matters.
 */
const api = vi.hoisted(() => ({ saveConnection: vi.fn(), regenerateConnection: vi.fn() }));
vi.mock('@/destinations/api', () => api);

const { WebhookConnectionForm, credentialsFor } = await import('../../modules/destinations/admin/WebhookConnectionForm');
const { registerProviderMarks, toolOfHost, toolMarks } = await import('../../modules/destinations/admin/marks');
const { connectionSetup } = await import('@/destinations/connectionSetup');
const { AdminDialog, AdminDialogContent } = await import('@/components/ui/admin-dialog');

const SECRET = 'whsec_rH3Ymw8NA4FiOXzaj7bQrk9Sl3guOjN1QiCfZUxNYy0=';
const WEBHOOK = {
  id: 'webhook', label: 'Webhook', icon: 'webhook', tier: 'pro' as const, requires: null, requires_label: null,
  availability: 'ready' as const, needs_connection: true, forwards_submission: true, settings_schema: {},
  connection_schema: {
    url: { type: 'url', label: 'Webhook URL' },
    signing_secret: { type: 'secret', label: 'Signing secret', prefix: 'whsec_', guide: 'https://wconvert.io/docs/webhooks/#verify-the-signature' },
    headers: { type: 'headers', label: 'Custom headers', optional: true, max: 5, reserved: ['webhook-signature', 'content-type'] },
    setup_site_url: { type: 'site_url', label: '' },
  },
};
const ACCOUNT = { id: 'account-1', type: 'webhook', label: 'Make — new leads', account_identity: 'hook.eu1.make.com',
  credentials: { url: true, signing_secret: true, headers: ['x-make-apikey'], setup_site_url: true } };

const draw = (props: Partial<Parameters<typeof WebhookConnectionForm>[0]> = {}) => {
  const onSaved = vi.fn();
  const onDirtyChange = vi.fn();
  render(<AdminDialog open><AdminDialogContent size="sm">
    <WebhookConnectionForm type={WEBHOOK} title="Connect Webhook" onSaved={onSaved} onCancel={vi.fn()} onDirtyChange={onDirtyChange} {...props} />
  </AdminDialogContent></AdminDialog>);
  return { onSaved, onDirtyChange };
};

const pick = async (tool: string) => {
  await userEvent.click(screen.getByRole('radio', { name: tool }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  api.saveConnection.mockResolvedValue({ connection: ACCOUNT, revealed: { signing_secret: SECRET } });
});
afterEach(cleanup);

describe('step 1', () => {
  it('asks where signups go, as four radio cards, on step 1 of 2', () => {
    draw();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Step 1 of 2');
    const group = screen.getByRole('group', { name: 'Where should signups go?' });
    expect(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['zapier', 'make', 'n8n', 'code']);
    expect(within(group).getByRole('radio', { name: 'Zapier' })).toHaveAccessibleDescription('Paste a Catch Hook URL.');
    expect(within(group).getByRole('radio', { name: 'Zapier' })).toBeChecked();
  });
});

describe('each tool stores the same webhook', () => {
  it('Zapier: a URL, no headers, named after the tool', async () => {
    const { onSaved } = draw();
    await pick('Zapier');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Step 2 of 2 · Webhook');
    expect(screen.getByRole('heading', { name: 'Connect Zapier' })).toBeVisible();
    expect(screen.getByLabelText('Webhook URL')).toHaveAccessibleDescription('Webhooks by Zapier → Catch Hook. Copy the URL it shows.');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://hooks.zapier.com/hooks/catch/1/abc/');
    expect(screen.getByText('Creates a signing secret')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(api.saveConnection).toHaveBeenCalledExactlyOnceWith({ id: undefined, type: 'webhook', label: 'Zapier',
      credentials: { url: 'https://hooks.zapier.com/hooks/catch/1/abc/', headers: [] } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ACCOUNT, { signing_secret: SECRET }));
  });

  it('Make: its optional API key is the x-make-apikey header', async () => {
    draw();
    await pick('Make');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://hook.eu1.make.com/abc');
    await userEvent.type(screen.getByLabelText(/API key/), 'key-1');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(api.saveConnection).toHaveBeenCalledWith(expect.objectContaining({ label: 'Make',
      credentials: { url: 'https://hook.eu1.make.com/abc', headers: [{ name: 'x-make-apikey', value: 'key-1' }] } }));
  });

  it('n8n: Header Auth is one header, and needs its value', async () => {
    draw();
    await pick('n8n');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://flows.example/webhook/abc');
    await userEvent.type(screen.getByLabelText(/Header Auth name/), 'X-N8N-Auth');
    expect(screen.getByRole('button', { name: 'Check and save account' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Header Auth value'), 'v-1');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(api.saveConnection).toHaveBeenCalledWith(expect.objectContaining({
      credentials: { url: 'https://flows.example/webhook/abc', headers: [{ name: 'X-N8N-Auth', value: 'v-1' }] } }));
  });

  it('your own code: any headers, a guide to verifying, and the type’s name', async () => {
    draw();
    await pick('Your own code');
    expect(screen.getByRole('link', { name: /How to verify/ })).toHaveAttribute('href', WEBHOOK.connection_schema.signing_secret.guide);
    expect(screen.getByLabelText('Account name')).toHaveValue('Webhook');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://example.com/hook');
    await userEvent.click(screen.getByRole('button', { name: 'Add header' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Header name' }), 'Authorization');
    await userEvent.type(screen.getByLabelText('Header value'), 'Bearer t');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(api.saveConnection).toHaveBeenCalledWith(expect.objectContaining({ label: 'Webhook',
      credentials: { url: 'https://example.com/hook', headers: [{ name: 'Authorization', value: 'Bearer t' }] } }));
  });

  it('keeps the tool’s header and the other headers in one list', () => {
    expect(credentialsFor('make', { makeKey: ' k ', authName: 'ignored', authValue: '', extra: [{ name: 'X-Extra', value: 'e' }, { name: '', value: '' }] }))
      .toEqual([{ name: 'x-make-apikey', value: 'k' }, { name: 'X-Extra', value: 'e' }]);
    expect(credentialsFor('zapier', { makeKey: 'k', authName: 'A', authValue: 'b', extra: [] })).toEqual([]);
  });

  it('warns that http:// sends a header and every lead readable', async () => {
    draw();
    await pick('Make');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'http://hook.eu1.make.com/abc');
    expect(screen.queryByText(/isn’t encrypted/)).toBeNull();
    await userEvent.type(screen.getByLabelText(/API key/), 'key-1');
    expect(screen.getByText('http:// isn’t encrypted, so your header and every lead travel readable. Use https://.')).toBeVisible();
  });

  it('reports a typed field as a change worth asking about, and Back keeps it', async () => {
    const { onDirtyChange } = draw();
    await pick('Zapier');
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://hooks.zapier.com/x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Webhook URL')).toHaveValue('https://hooks.zapier.com/x');
  });
});

describe('editing an account', () => {
  it('skips the picker, keeps the stored URL and header values blank, and sends only what changed', async () => {
    draw({ account: ACCOUNT, title: 'Make — new leads', meta: 'Webhook · hook.eu1.make.com' });
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText('Webhook URL')).toHaveValue('');
    expect(screen.getByLabelText('Webhook URL')).toHaveAttribute('placeholder', 'Stored; enter a replacement');
    expect(screen.getByLabelText('Webhook URL')).toHaveAccessibleDescription(/Webhooks → Custom webhook/);
    expect(screen.getByRole('textbox', { name: 'Header name' })).toHaveValue('x-make-apikey');
    expect(screen.getByLabelText('Header value')).toHaveAttribute('placeholder', 'Stored; enter a replacement');
    expect(screen.queryByText('Creates a signing secret')).toBeNull();
    await userEvent.clear(screen.getByLabelText('Account name'));
    await userEvent.type(screen.getByLabelText('Account name'), 'Make');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));
    expect(api.saveConnection).toHaveBeenCalledExactlyOnceWith({ id: ACCOUNT.id, type: 'webhook', label: 'Make',
      credentials: { headers: [{ name: 'x-make-apikey', value: '' }] } });
  });

  it('asks before regenerating in the footer, never a second dialog, then shows the new secret once', async () => {
    api.regenerateConnection.mockResolvedValue({ connection: ACCOUNT, revealed: { signing_secret: SECRET } });
    draw({ account: ACCOUNT, title: 'Make — new leads' });
    expect(screen.getByText('Stored. Shown only when it is made.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText(/^Regenerate now\? The next request is signed with the new secret/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Check and save account' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(api.regenerateConnection).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate secret' }));
    expect(api.regenerateConnection).toHaveBeenCalledExactlyOnceWith(ACCOUNT.id);
    expect(await screen.findByLabelText('Signing secret')).toHaveValue(SECRET);
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });
});

describe('an account’s mark', () => {
  afterEach(() => { delete connectionSetup.connectionMark; });

  it('is the tool’s only on the tool’s own host', () => {
    expect(toolOfHost('hooks.zapier.com')).toBe('zapier');
    expect(toolOfHost('hook.eu1.make.com')).toBe('make');
    expect(toolOfHost('make.com')).toBe('make');
    expect(toolOfHost('acme.app.n8n.cloud')).toBe('n8n');
    expect(toolOfHost('n8n.my-company.example')).toBeNull();
    expect(toolOfHost('zapier.com.evil.example')).toBeNull();
    expect(toolOfHost('notmake.com')).toBeNull();
    expect(toolOfHost(null)).toBeNull();
  });

  it('is registered with the provider marks, and only for webhooks', () => {
    registerProviderMarks();
    expect(connectionSetup.connectionMark?.({ type: 'webhook', account_identity: 'hooks.zapier.com' })).toBe(toolMarks.zapier);
    expect(connectionSetup.connectionMark?.({ type: 'webhook', account_identity: 'example.com' })).toBeUndefined();
    expect(connectionSetup.connectionMark?.({ type: 'mailchimp', account_identity: 'hooks.zapier.com' })).toBeUndefined();
    expect(new Set(Object.values(toolMarks)).size).toBe(3);
  });
});
