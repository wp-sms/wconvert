import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Template } from '../../resources/renderer/src/types';

/**
 * The webhook's setup, as far as free draws it (ADR 0148). Free names no
 * receiver: it draws the generic connection field kinds, the secret a save
 * generated — once, with Copy — a copy of the site as a badge on the row, a
 * receiver's status and time under a test's sentence, and a campaign's own
 * questions in a forwarding type's test. Pro's tailored form fills a slot.
 */
const api = vi.hoisted(() => ({
  readDestinations: vi.fn(),
  saveDestination: vi.fn(),
  deleteDestination: vi.fn(),
  rePush: vi.fn(),
  testConnection: vi.fn(),
  testSend: vi.fn(),
  draftSend: vi.fn(),
  readSelectedSchema: vi.fn(async () => ({ settings_schema: {} })),
  readRecentAttempts: vi.fn(),
  checkConnection: vi.fn(),
  deleteConnection: vi.fn(),
  saveConnection: vi.fn(),
  regenerateConnection: vi.fn(),
}));
vi.mock('../../resources/admin/src/destinations/api', () => api);
const leadsApi = vi.hoisted(() => ({ readLog: vi.fn() }));
vi.mock('../../resources/admin/src/leads/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/leads/api')>()), ...leadsApi }));
const optinsApi = vi.hoisted(() => ({ listOptins: vi.fn() }));
vi.mock('../../resources/admin/src/optins/api', async (original) => ({ ...(await original<typeof import('../../resources/admin/src/optins/api')>()), ...optinsApi }));

const { ConnectionForm } = await import('../../resources/admin/src/destinations/ConnectionForm');
const { connectionSetup } = await import('../../resources/admin/src/destinations/connectionSetup');
const { AccountEditor } = await import('../../resources/admin/src/destinations/AccountEditor');
const { SendTestDialog } = await import('../../resources/admin/src/destinations/SendTestDialog');
const { TestReportAlert } = await import('../../resources/admin/src/destinations/status');
const { Destinations } = await import('../../resources/admin/src/destinations/Destinations');
const { sampleQuestions } = await import('../../resources/admin/src/builder/answerSources');
const { AdminDialog, AdminDialogContent } = await import('../../resources/admin/src/components/ui/admin-dialog');

const SECRET = 'whsec_rH3Ymw8NA4FiOXzaj7bQrk9Sl3guOjN1QiCfZUxNYy0=';

const WEBHOOK = {
  id: 'webhook', label: 'Webhook', icon: 'webhook', tier: 'pro' as const, requires: null, requires_label: null,
  availability: 'ready' as const, needs_connection: true, forwards_submission: true, settings_schema: {},
  connection_schema: {
    url: { type: 'url', label: 'Webhook URL' },
    signing_secret: { type: 'secret', label: 'Signing secret', prefix: 'whsec_', description: 'Receivers that ignore it are fine.', guide: 'https://wconvert.io/docs/webhooks/#verify-the-signature' },
    headers: { type: 'headers', label: 'Custom headers', optional: true, max: 5, reserved: ['webhook-signature', 'content-type'] },
    setup_site_url: { type: 'site_url', label: '' },
  },
};

const ACCOUNT = { id: 'account-1', type: 'webhook', label: 'Leads hook', credentials: { url: true, signing_secret: true, headers: [], setup_site_url: true },
  account_identity: 'hooks.example', checked_at: null, check_outcome: null, site_changed: false };

const ROUTE = {
  id: '01J0000000WWWWWWWWWWWWWWWW', type: 'webhook', label: 'Leads hook', connection: ACCOUNT.id, settings: {}, target: null, availability: 'ready' as const,
  health: { last_success_at: '2026-10-04 10:00:00', last_error: null, last_error_at: null, consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null },
};

/** A dialog to draw a form in, as both of its callers do. */
const inDialog = (node: React.ReactNode) => <AdminDialog open><AdminDialogContent size="sm">{node}</AdminDialogContent></AdminDialog>;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(connectionSetup.connectionForms)) delete connectionSetup.connectionForms[key];
  delete connectionSetup.connectionMark;
});
afterEach(cleanup);

describe('the account form', () => {
  it('uses a type’s own form where one is registered, with the same props', () => {
    const Own = vi.fn(() => <p>Tailored form</p>);
    connectionSetup.connectionForms.webhook = Own;
    render(inDialog(<ConnectionForm type={WEBHOOK} title="Connect Webhook" onSaved={vi.fn()} onCancel={vi.fn()} />));
    expect(screen.getByText('Tailored form')).toBeVisible();
    expect(Own).toHaveBeenCalledWith(expect.objectContaining({ type: WEBHOOK, title: 'Connect Webhook' }), undefined);
  });

  it('draws no field for a generated secret or the site, needs no optional headers, and hands back what was revealed', async () => {
    api.saveConnection.mockResolvedValue({ connection: ACCOUNT, revealed: { signing_secret: SECRET } });
    const onSaved = vi.fn();
    render(inDialog(<ConnectionForm type={WEBHOOK} title="Connect Webhook" onSaved={onSaved} onCancel={vi.fn()} />));
    expect(screen.queryByLabelText('Signing secret')).toBeNull();
    expect(screen.getByRole('group', { name: /Custom headers/ })).toBeVisible();
    const save = screen.getByRole('button', { name: 'Check and save account' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://hooks.example/abc');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(api.saveConnection).toHaveBeenCalledWith({ id: undefined, type: 'webhook', label: 'Webhook', credentials: { url: 'https://hooks.example/abc', headers: [] } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ACCOUNT, { signing_secret: SECRET }));
  });

  it('refuses a header WConvert sets itself, beside the row', async () => {
    render(inDialog(<ConnectionForm type={WEBHOOK} title="Connect Webhook" onSaved={vi.fn()} onCancel={vi.fn()} />));
    await userEvent.type(screen.getByLabelText('Webhook URL'), 'https://hooks.example/abc');
    await userEvent.click(screen.getByRole('button', { name: 'Add header' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Header name' }), 'Content-Type');
    expect(screen.getByText('WConvert sets this header itself.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check and save account' })).toBeDisabled();
  });
});

describe('a connected webhook account', () => {
  it('shows its secret once, with Copy and the guide, and never holds Done back', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    api.saveConnection.mockResolvedValue({ connection: ACCOUNT, revealed: { signing_secret: SECRET } });
    render(<AccountEditor types={[WEBHOOK]} connections={[]} usage={{}} onChange={vi.fn(async () => undefined)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect an account' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Webhook' }));
    await userEvent.type(await screen.findByLabelText('Webhook URL'), 'https://hooks.example/abc');
    await userEvent.click(screen.getByRole('button', { name: 'Check and save account' }));

    const dialog = await screen.findByRole('dialog', { name: 'Leads hook' });
    expect(dialog).toHaveAccessibleDescription('Webhook · hooks.example');
    const secret = within(dialog).getByLabelText('Signing secret');
    expect(secret).toHaveValue(SECRET);
    expect(secret).toHaveAttribute('readonly');
    expect(dialog).toHaveTextContent('Connected. Add a destination, then turn it on in a campaign and send a test there.');
    expect(dialog).toHaveTextContent('This is the only time it is shown.');
    expect(dialog).toHaveTextContent('Receivers that ignore it are fine.');
    expect(within(dialog).getByRole('link', { name: /How to verify/ })).toHaveAttribute('href', WEBHOOK.connection_schema.signing_secret.guide);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(within(dialog).getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('says on its row when it was set up on another copy of the site, and shows its tool’s mark', () => {
    connectionSetup.connectionMark = (connection) => connection.account_identity === 'hooks.example' ? 'tool.svg' : undefined;
    render(<AccountEditor types={[WEBHOOK]} connections={[{ ...ACCOUNT, site_changed: true, set_up_on: 'shop.example' }]} usage={{}} onChange={vi.fn(async () => undefined)} />);
    const row = screen.getByText('Leads hook', { selector: 'bdi' }).closest('li')!;
    expect(within(row).getByText('Webhook · hooks.example')).toBeVisible();
    expect(within(row).getByText('On a copy of the site')).toBeVisible();
    expect(row).toHaveTextContent('Set up on shop.example. Signups on this site still reach it, marked staging.');
    expect(row.querySelector('img')).toHaveAttribute('src', 'tool.svg');
    // A badge on the row, not a banner.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a test of a type that forwards the whole submission', () => {
  const QUESTIONS = [
    { id: 'budget', label: 'Your budget?', answer_type: 'single' as const, options: ['1k–5k', '5k+'] },
    { id: 'topics', label: 'Topics?', answer_type: 'multi' as const, options: ['Garden', 'Home', 'Tools'] },
    { id: 'note', label: 'Anything else?', answer_type: 'text' as const, options: [] },
  ];

  it('sends the campaign’s own questions with editable samples, and names the saved campaign', async () => {
    api.draftSend.mockResolvedValue({ outcome: 'success', message: 'The test reached Leads hook.', status: 200, ms: 412 });
    render(<SendTestDialog destination={ROUTE} type={WEBHOOK} initialEmail="you@shop.example" settingsDirty={false}
      returnFocusTo={{ current: null }} onClose={vi.fn()} onSent={vi.fn()}
      campaign={{ optinId: '01J0000000OOOOOOOOOOOOOOOO', questions: QUESTIONS }} />);
    const samples = screen.getByRole('group', { name: 'Sample answers' });
    expect(within(samples).getByLabelText('Your budget?')).toHaveValue('1k–5k');
    expect(within(samples).getByLabelText('Topics?')).toHaveValue('Garden, Home');
    expect(within(samples).getByLabelText('Anything else?')).toHaveValue('Sample answer');
    await userEvent.clear(within(samples).getByLabelText('Your budget?'));
    await userEvent.type(within(samples).getByLabelText('Your budget?'), '5k+');
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));
    expect(api.draftSend).toHaveBeenCalledExactlyOnceWith(ROUTE.id, {
      email: 'you@shop.example',
      answers: [
        { id: 'budget', question: 'Your budget?', answer: '5k+' },
        { id: 'topics', question: 'Topics?', answer: ['Garden', 'Home'] },
        { id: 'note', question: 'Anything else?', answer: 'Sample answer' },
      ],
      optin: '01J0000000OOOOOOOOOOOOOOOO',
    });
    expect(api.testSend).not.toHaveBeenCalled();
    expect(await screen.findByText('Answered 200 in 0.4 s.')).toBeVisible();
  });

  it('sends the plain sample from Settings, where there is no campaign', async () => {
    api.testSend.mockResolvedValue({ outcome: 'success', message: 'The test reached Leads hook.' });
    render(<SendTestDialog destination={ROUTE} type={WEBHOOK} initialEmail="you@shop.example" settingsDirty={false}
      returnFocusTo={{ current: null }} onClose={vi.fn()} onSent={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Sample answers' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Send test' }));
    expect(api.testSend).toHaveBeenCalledExactlyOnceWith(ROUTE.id, 'you@shop.example');
    expect(api.draftSend).not.toHaveBeenCalled();
  });

  it('takes only a save point’s real questions, never mapping sources', () => {
    const template = { tree: {
      submissions: [{ id: 'primary', fields: ['email'] }],
      steps: [{ content: { type: 'stack', children: [
        { type: 'question', id: 'budget', label: 'Your budget?', answer_type: 'single', options: [{ value: 'a', label: '1k–5k' }] },
        { type: 'question', id: 'topics', label: 'Topics?', answer_type: 'multi', options: [{ value: 'g', label: 'Garden' }] },
        { type: 'question', id: 'secret', label: 'Hidden?', answer_type: 'text', hidden: true },
        { type: 'field', name: 'interest', id: 'interest' },
        { type: 'field', name: 'email', id: 'email' },
      ] } }],
    } } as unknown as Template;
    expect(sampleQuestions(template, 'primary')).toEqual([
      { id: 'budget', label: 'Your budget?', answer_type: 'single', options: ['1k–5k'] },
      { id: 'topics', label: 'Topics?', answer_type: 'multi', options: ['Garden'] },
    ]);
  });
});

describe('what a test answered', () => {
  it('says the receiver’s status and time under the sentence, and nothing more where there is none', () => {
    const { rerender } = render(<TestReportAlert report={{ outcome: 'success', message: 'The test reached Leads hook.', status: 204, ms: 1234 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('The test reached Leads hook.Answered 204 in 1.2 s.');
    rerender(<TestReportAlert report={{ outcome: 'success', message: 'The test reached Mailchimp.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^The test reached Mailchimp\.$/);
  });
});

describe('sending stored submissions to a receiver again', () => {
  it('warns that each one runs the automation again, and that a receiver can skip by id', async () => {
    api.readDestinations.mockResolvedValue({ types: [WEBHOOK], destinations: [ROUTE], connections: [{ ...ACCOUNT, label: 'Zap account' }], failures: [] });
    render(<Destinations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for Leads hook' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Send stored submissions again' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Send stored submissions again?' });
    expect(confirm).toHaveTextContent('Each one is posted to the receiver again, which may run your automation and use its tasks.');
    expect(confirm).toHaveTextContent('Those that already arrived keep their id, so a receiver that checks it can skip them.');
  });
});
