import { useLayoutEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import { useSmartEdgePath } from '@tisoap/react-flow-smart-edge';
import { Plus } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import { mapEdgeOptions, mapLabelPlacement, structuredMapRoute, type RoutingBox } from './structure/mapRouting';

export function JourneyMapEdge(props: EdgeProps) {
  const { route } = useSmartEdgePath({ ...props, preset: 'smoothstep', options: mapEdgeOptions });
  const overview = useStore(state => state.transform[2] < .65);
  const boxes = (props.data?.boxes ?? []) as RoutingBox[];
  const structured = structuredMapRoute({ ...props, corridorOffset: Number(props.data?.corridorOffset ?? 0) }, boxes);
  const [fallbackPath, fallbackX, fallbackY] = getSmoothStepPath({ ...props, ...structured, borderRadius: 6 });
  const points = structured?.points ?? (route?.kind === 'routed' ? route.points : [[fallbackX, fallbackY], [fallbackX + 1, fallbackY]]);
  const path = structured ? fallbackPath : route?.kind === 'routed' ? route.svgPathString : fallbackPath;
  const tools = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 216, height: 108 });
  const place = mapLabelPlacement(points, boxes, size.width, size.height);
  useLayoutEffect(() => {
    const element = tools.current;
    if (!element) return;
    const measure = () => setSize(old => old.width === element.offsetWidth && old.height === element.offsetHeight ? old : { width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [overview, props.label]);
  const insert = props.data?.insert as ((edgeId: string) => void) | undefined;
  return <><BaseEdge path={path} label={undefined} labelStyle={props.labelStyle} labelShowBg={props.labelShowBg} labelBgStyle={props.labelBgStyle} labelBgPadding={props.labelBgPadding} labelBgBorderRadius={props.labelBgBorderRadius} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={props.interactionWidth} />{!overview && (insert || props.label) && <EdgeLabelRenderer>
    <div ref={tools} className="wconvert-journey-edge-tools nodrag nopan" data-selected={props.selected || undefined} style={{ visibility: place ? undefined : 'hidden', transform: `translate(-50%, -50%) translate(${place?.x ?? 0}px, ${place?.y ?? 0}px)` }}>
      {props.label && <button type="button" className="wconvert-journey-edge-label nodrag nopan" aria-label={sprintf(__('Edit path: %s', 'wconvert'), String(props.label))}
        onClick={event => { event.stopPropagation(); (props.data?.edit as (() => void) | undefined)?.(); }}><span>{props.label}</span></button>}
    {insert && <button type="button" className="wconvert-journey-edge-insert nodrag nopan" data-selected={props.selected || undefined}
      aria-label={sprintf(__('Add screen here, before %s', 'wconvert'), String(props.data?.targetName ?? ''))}
      title={sprintf(__('Add between “%1$s” and “%2$s”', 'wconvert'), String(props.data?.sourceName ?? ''), String(props.data?.targetName ?? ''))} onClick={event => { event.stopPropagation(); insert(props.id); }}><Plus aria-hidden="true" /><span>{__('Add screen here', 'wconvert')}</span></button>}</div>
  </EdgeLabelRenderer>}</>;
}
