import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtraAnswerMapping } from '../../resources/admin/src/builder/ExtraAnswerMapping';
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
  steps: [{ content: { id: 'service-question', type: 'question', label: 'What service do you need?' } }],
  submissions: [{ id: 'signup', fields: ['service-question'] }],
} } as unknown as Template;

function Preview() {
  const [mapping, setMapping] = useState<Record<string, string>>({ 'service-question': 'SERVICE' });
  return <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 text-foreground">
    <header className="flex flex-col gap-2">
      <span className="self-start rounded-full border border-info/40 bg-info/10 px-3 py-1 text-note font-medium">Local sample-data preview</span>
      <h1 className="m-0 text-page-title font-semibold">Where field mapping appears</h1>
      <p className="m-0 text-body text-muted-foreground">This uses WConvert’s real campaign mapping control with sample Mailchimp fields. No account is connected and no contact can be sent.</p>
    </header>

    <section className="rounded-md border border-border bg-card p-5">
      <p className="m-0 text-note text-muted-foreground">Settings → Connections & destinations</p>
      <h2 className="mt-1 flex items-center gap-2 text-heading font-semibold"><ProviderMark type={type} />Mailchimp destination</h2>
      <p className="m-0 text-body">An account and audience are chosen here. Basic contact details are sent automatically. The question-to-field mapping belongs to each campaign.</p>
      <div className="mt-4 grid gap-2 text-note sm:grid-cols-2">
        <div className="rounded-md bg-muted/40 p-3"><span className="block text-muted-foreground">Sample account</span><strong>Demo Mailchimp account</strong></div>
        <div className="rounded-md bg-muted/40 p-3"><span className="block text-muted-foreground">Sample audience</span><strong>Newsletter audience</strong></div>
      </div>
    </section>

    <section className="rounded-md border border-border bg-card p-5">
      <p className="m-0 text-note text-muted-foreground">Campaign editor → Destinations → Send leads to</p>
      <h2 className="mt-1 text-heading font-semibold">Newsletter signups</h2>
      <p className="m-0 text-note text-muted-foreground">Mailchimp · Newsletter audience</p>
      <p className="mb-0 text-note text-muted-foreground">Sending email automatically to Newsletter audience.</p>
      <ExtraAnswerMapping destination={destination} submissionId="signup" template={template} value={mapping} onChange={setMapping} />
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
