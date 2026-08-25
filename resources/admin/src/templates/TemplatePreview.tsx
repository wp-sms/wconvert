import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import { listTemplates, type TemplateEntry } from './api';

/**
 * The shipped gallery, rendered through the renderer the loader imports.
 *
 * **This is the whole point of the renderer being dependency-free.** Two
 * consumers, two bundles: React inside it would drag the admin's dependencies
 * into the loader's byte budget, and a static thumbnail would be a second
 * artefact to produce and to let go stale. What the merchant sees here is the
 * template, drawn by the code that will draw it on the site (ADR 0010).
 *
 * It mounts `inline` rather than as a `popup`, because a gallery card is a
 * card: it wants the closed shadow root that wins the CSS fight against
 * wp-admin's own stylesheet, and none of the top layer.
 *
 * The gallery proper — filtering, selection, the settings panel beside it —
 * arrives in its own ticket. This is the seam it will build on.
 */
export function TemplatePreview() {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  if (error !== null) {
    return <p className="notice notice-error">{error}</p>;
  }

  return (
    <section className="wconvert-gallery">
      <h2>{__('Templates', 'wconvert')}</h2>
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </section>
  );
}

function TemplateCard({ template }: { template: TemplateEntry }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const mounted = mount({ displayType: 'inline', template, anchor: anchor.current });

    mounted.show();
    mounted.showStep(step);

    return () => mounted.close();
  }, [template, step]);

  return (
    <figure className="wconvert-card">
      <figcaption>{template.name}</figcaption>
      <div ref={anchor} />
      {template.tree.steps.map((_, index) => (
        <button key={index} type="button" onClick={() => setStep(index)} aria-pressed={index === step}>
          {/* A submit-metered template has two steps, the success state being the terminal one. */}
          {index === 0 ? __('Form', 'wconvert') : __('Success', 'wconvert')}
        </button>
      ))}
    </figure>
  );
}
