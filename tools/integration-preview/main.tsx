import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtraAnswerMapping, UnsupportedAnswerMapping } from '../../resources/admin/src/builder/ExtraAnswerMapping';
import { ProviderMark } from '../../resources/admin/src/destinations/ProviderMark';
import type { Destination, DestinationType } from '../../resources/admin/src/destinations/api';
import type { Template } from '../../resources/renderer/src/types';
import '../../resources/admin/src/index.css';

const type: DestinationType = {
  id: 'mailchimp', label: 'Mailchimp', icon: 'mail', tier: 'pro', requires: null,
  requires_label: null, availability: 'ready', needs_connection: true, supports_mapping: true,
  settings_schema: {},
};
const destination: Destination = {
  id: 'sample-destination', type: 'mailchimp', label: 'Newsletter signups',
  connection: 'sample-account', target: 'Newsletter audience', availability: 'ready',
  settings: { existing_contact: 'update', audiences: ['sample-audience'] },
  health: { last_success_at: null, last_error: null, last_error_at: null,
    consecutive_failures: 0, skipped_captures: 0, last_skipped_at: null },
  requirements: { capture_any_of: ['email'], fields: ['email', 'name'], settings: {}, mapped_fields: {} },
};
const template = { tree: {
  steps: [{ content: { type: 'stack', children: [
    { id: 'service-question', type: 'question', label: 'What service do you need?' },
    { id: 'project-question', type: 'question', label: 'What kind of project are you planning?' },
    { id: 'message-question', type: 'question', label: 'Is there anything else we should know before contacting you?' },
  ] } }],
  submissions: [{ id: 'signup', fields: ['service-question'] }],
} } as unknown as Template;

function Preview() {
  const [scenario, setScenario] = useState('ready');
  const service = scenario === 'unsupported' ? { ...type, id: 'example', label: 'Example contact service' } : type;
  const target = scenario === 'unsupported' ? 'Contact list' : 'Newsletter audience';
  return <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 text-foreground">
    <header className="flex flex-col gap-2">
      <span className="self-start rounded-full border border-info/40 bg-info/10 px-3 py-1 text-note font-medium">Local sample-data preview</span>
      <h1 className="m-0 text-title font-semibold">Field mapping</h1>
      <p className="m-0 text-body text-muted-foreground">This uses WConvert’s real campaign mapping control with sample Mailchimp fields. No account is connected and no contact can be sent.</p>
    </header>

    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="scenario" className="text-note font-medium">Preview scenario</label>
      <select id="scenario" value={scenario} onChange={(event) => setScenario(event.target.value)} className="h-(--control-height) min-w-0 max-w-full rounded-md border border-input bg-card ps-3 pe-9 py-0 text-body">
        <option value="ready">Some answers mapped</option>
        <option value="unmapped">No answers mapped yet</option>
        <option value="missing">A mapped service field was deleted</option>
        <option value="empty">No compatible service fields</option>
        <option value="error">Fields failed to load — try Retry</option>
        <option value="unsupported">Service does not support extra answers</option>
      </select>
    </div>
    <section className="rounded-md border border-border bg-card p-5">
      <p className="m-0 text-note text-muted-foreground">Settings → Connections & destinations</p>
      <h2 className="mt-1 flex items-center gap-2 text-heading font-semibold"><ProviderMark type={service} />{service.label} destination</h2>
      <p className="m-0 text-body">An account and audience are chosen here. Basic contact details are sent automatically. The question-to-field mapping belongs to each campaign.</p>
      <div className="mt-4 grid gap-2 text-note sm:grid-cols-2">
        <div className="rounded-md bg-muted p-3"><span className="block text-muted-foreground">Sample account</span><strong>Demo {service.label} account</strong></div>
        <div className="rounded-md bg-muted p-3"><span className="block text-muted-foreground">Sample audience</span><strong>{target}</strong></div>
      </div>
    </section>

    <section className="rounded-md border border-border bg-card p-5">
      <p className="m-0 text-note text-muted-foreground">Campaign editor → Destinations → Send leads to</p>
      <div className="mt-3 flex items-start gap-3">
        <ProviderMark type={service} />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-body font-medium">{scenario === 'unsupported' ? 'Contact signups' : 'Newsletter signups'}</h2>
          <p className="m-0 text-note text-muted-foreground">{service.label} · {target}</p>
          <p className="m-0 text-note text-muted-foreground">Sending email automatically.</p>
        </div>
      </div>
      <Scenario key={scenario} scenario={scenario} />
    </section>
  </main>;
}

function Scenario({ scenario }: { scenario: string }) {
  const [mapping, setMapping] = useState<Record<string, string>>(
    scenario === 'unmapped' || scenario === 'empty' ? {} : { 'service-question': scenario === 'missing' ? 'REMOVED' : 'SERVICE' },
  );
  if (scenario === 'unsupported') return <UnsupportedAnswerMapping />;
  return <ExtraAnswerMapping providerLabel="Mailchimp" destination={{ ...destination, id: scenario }} submissionId="signup" template={template} value={mapping} onChange={setMapping} />;
}

createRoot(document.getElementById('wconvert-admin')!).render(<Preview />);
