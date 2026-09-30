import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Preview } from '../builder/Preview';
import { A_DESIGNS_OWN_WIDTH } from '@renderer/css';
import type { Template, ResultVariant } from '@renderer/types';

/** Measure original design dimensions once, fit without changing its layout. */
export function PreviewFrame({ template, displayType, mobile, step, result, interactive = false, children }: {
  template?: Template; displayType: string; mobile: boolean; step: number;
  result?: ResultVariant; interactive?: boolean; children?: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null); const paper = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, available: 0 });
  const width = mobile ? '320px' : template?.tokens.width?.includes('%') ? '64rem' : template?.tokens.width ?? A_DESIGNS_OWN_WIDTH;
  useEffect(() => {
    const area = stage.current; const node = paper.current;
    if (!area || !node) return;
    const measure = () => {
      const style = getComputedStyle(area);
      const available = area.clientWidth - (parseFloat(style.paddingInlineStart) || 0) - (parseFloat(style.paddingInlineEnd) || 0);
      if (!node.offsetWidth || available <= 0) return;
      const next = { width: node.offsetWidth, height: node.offsetHeight, available };
      setSize(previous => previous.width === next.width && previous.height === next.height && previous.available === next.available ? previous : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(area); observer.observe(node);
    return () => observer.disconnect();
  }, [template, width, step, result]);
  const scale = size.width > 0 ? Math.min(1, size.available / size.width) : 1;
  return <div ref={stage} className="wconvert-preview-frame" data-device={mobile ? 'mobile' : 'desktop'}>
    {template ? <div className="wconvert-preview-frame__measure" style={{inlineSize:size.width ? size.width * scale : width,blockSize:size.height ? size.height * scale : undefined}}>
      <div ref={paper} className="wconvert-preview-frame__paper" data-step={step} inert={!interactive || undefined} aria-hidden={!interactive || undefined}
        style={{inlineSize:width,transform:`scale(${scale})`}}>
        <Preview template={template} displayType={displayType} step={step} result={result} interactive={interactive} />
      </div>
    </div> : children}
  </div>;
}
