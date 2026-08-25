import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { mount } from '@renderer/mount';
import { listTemplates, type TemplateEntry } from './api';

/**
 * The shipped Templates, drawn by the renderer the loader imports.
 *
 * **This exists to make one property real rather than aspirational**: the
 * renderer is dependency-free precisely so two bundles can share it, and the
 * admin is the second one. React inside that module would drag the admin's
 * dependencies into the loader's byte budget, and a static thumbnail would be
 * a second artefact to produce and to let go stale (ADR 0010).
 *
 * **It is not the gallery.** Filtering by Goal, selection, the settings panel
 * beside it and the step-by-step preview are the builder's, and building them
 * here would be writing that ticket's shape before its subject. What is here
 * is one card per shipped entry, showing the design as it will actually
 * render.
 *
 * It mounts `inline`, because a card is a card: it wants the closed shadow
 * root that wins the CSS fight against wp-admin's own stylesheet, and none of
 * the top layer.
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
    <section className="wconvert-templates">
      <h2>{__('Templates', 'wconvert')}</h2>
      {templates.map((template) => (
        <figure key={template.id} className="wconvert-template">
          <figcaption>{template.name}</figcaption>
          <TemplateCard template={template} />
        </figure>
      ))}
    </section>
  );
}

function TemplateCard({ template }: { template: TemplateEntry }) {
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mounted = mount({ displayType: 'inline', template, anchor: anchor.current });

    mounted.show();

    return () => mounted.close();
  }, [template]);

  return <div ref={anchor} />;
}
