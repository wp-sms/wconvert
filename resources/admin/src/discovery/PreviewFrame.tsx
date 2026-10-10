import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Preview } from '../builder/Preview';
import { A_DESIGNS_OWN_WIDTH } from '@renderer/css';
import type { Template, ResultVariant } from '@renderer/types';

/** Measure original design dimensions once, fit without changing its layout. */
export function PreviewFrame({ template, displayType, mobile, step, result, interactive = false, fitHeight = false, children }: {
  template?: Template; displayType: string; mobile: boolean; step: number;
  result?: ResultVariant; interactive?: boolean; fitHeight?: boolean; children?: ReactNode;
}) {
  const hintId = useId();
  const stage = useRef<HTMLDivElement>(null); const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, available: 0, availableHeight: 0 });
  const width = mobile ? '320px' : template?.tokens.width?.includes('%') ? '64rem' : template?.tokens.width ?? A_DESIGNS_OWN_WIDTH;
  useEffect(() => {
    const area = stage.current; const node = paper.current;
    if (!area || !node) return;
    const measure = () => {
      const style = getComputedStyle(area);
      const available = area.clientWidth - (parseFloat(style.paddingInlineStart) || 0) - (parseFloat(style.paddingInlineEnd) || 0);
      if (!node.offsetWidth || available <= 0) return;
      const availableHeight = area.clientHeight - (parseFloat(style.paddingBlockStart) || 0) - (parseFloat(style.paddingBlockEnd) || 0);
      const next = { width: node.offsetWidth, height: node.offsetHeight, available, availableHeight };
      setSize(previous => previous.width === next.width && previous.height === next.height && previous.available === next.available && previous.availableHeight === next.availableHeight ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(area); observer.observe(node);
    return () => observer.disconnect();
  }, [template, width, step, result, fitHeight]);
  useEffect(() => { stage.current?.scrollTo?.({ top: 0, left: 0 }); }, [step, mobile, result, fitHeight]);
  const scale = size.width > 0 ? Math.min(1, size.available / size.width, fitHeight && size.height > 0 && size.availableHeight > 0 ? size.availableHeight / size.height : 1) : 1;
  const overflows = !fitHeight && size.height * scale > size.availableHeight + 1;
  return <><div ref={stage} tabIndex={overflows ? 0 : undefined} role={overflows ? 'region' : undefined} aria-label={overflows ? __('Scrollable design preview', 'wconvert') : undefined} aria-describedby={overflows ? hintId : undefined} className="wconvert-preview-frame" data-device={mobile ? 'mobile' : 'desktop'} data-fit={fitHeight ? 'whole' : 'width'}>
    {template ? <div className="wconvert-preview-frame__measure" style={{inlineSize:size.width ? size.width * scale : width,blockSize:size.height ? size.height * scale : undefined}}>
      <div ref={paper} className="wconvert-preview-frame__paper" data-step={step} inert={!interactive || undefined} aria-hidden={!interactive || undefined}
        style={{inlineSize:width,transform:`scale(${scale})`}}>
        <Preview template={template} displayType={displayType} step={step} result={result} interactive={interactive} />
      </div>
    </div> : children}
  </div>{overflows && <p id={hintId} className="wconvert-preview-frame__hint">{__('Scroll inside the preview to see the rest, or choose Fit whole design.', 'wconvert')}</p>}</>;
}
