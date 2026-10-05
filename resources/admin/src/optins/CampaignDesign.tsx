import { useEffect, useRef } from 'react';
import { mount } from '@renderer/mount';
import type { Template } from '@renderer/types';
import { policyUrl, withPolicyLink } from '../builder/policy';

/** Lazy, inert rendering of the actual saved design. No loader, capture, or tracking. */
export default function CampaignDesign({ template }: { template: Template }) {
  const frame = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!anchor.current || !frame.current) return;
    const element = anchor.current,
      container = frame.current;
    const mounted = mount({
      displayType: 'inline',
      template: { ...template, tree: withPolicyLink(template.tree, policyUrl()) },
      anchor: element,
    });
    mounted.show();
    const design = mounted.root;
    if (design) design.style.maxBlockSize = 'none';
    const fit = () => {
      const width = element.offsetWidth,
        height = element.offsetHeight;
      if (width && height)
        element.style.transform = `scale(${Math.min((container.clientWidth - 12) / width, (container.clientHeight - 12) / height, 1)})`;
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(container);
    observer?.observe(element);
    fit();
    return () => {
      observer?.disconnect();
      mounted.close();
    };
  }, [template]);
  return (
    <div className="wconvert-design-frame" ref={frame} inert aria-hidden="true">
      <div
        className="wconvert-design-anchor"
        ref={anchor}
        style={{
          inlineSize: /^(?:\d*\.)?\d+(?:px|rem)$/.test(template.tokens.width ?? '')
            ? template.tokens.width
            : '420px',
        }}
      />
    </div>
  );
}
