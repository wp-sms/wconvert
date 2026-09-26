import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useStore, type EdgeProps } from '@xyflow/react';
import { useSmartEdgePath } from '@tisoap/react-flow-smart-edge';
import { Plus } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import { mapEdgeOptions } from './structure/mapRouting';

export function JourneyMapEdge(props: EdgeProps) {
  const { route } = useSmartEdgePath({ ...props, preset: 'smoothstep', options: mapEdgeOptions });
  const overview = useStore(state => state.transform[2] < .65);
  const [fallbackPath, fallbackX, fallbackY] = getSmoothStepPath(props);
  const x = route?.kind === 'routed' ? route.edgeCenterX : fallbackX;
  const y = route?.kind === 'routed' ? route.edgeCenterY : fallbackY;
  const insert = props.data?.insert as ((edgeId: string) => void) | undefined;
  return <><BaseEdge path={route?.kind === 'routed' ? route.svgPathString : fallbackPath} labelX={x} labelY={y} label={props.label} labelStyle={props.labelStyle} labelShowBg={props.labelShowBg} labelBgStyle={props.labelBgStyle} labelBgPadding={props.labelBgPadding} labelBgBorderRadius={props.labelBgBorderRadius} style={props.style} markerStart={props.markerStart} markerEnd={props.markerEnd} interactionWidth={props.interactionWidth} />{insert && !overview && <EdgeLabelRenderer>
    <button type="button" className="wconvert-journey-edge-insert nodrag nopan" data-selected={props.selected || undefined}
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      aria-label={sprintf(__('Insert screen before %s', 'wconvert'), String(props.data?.targetName ?? ''))}
      title={__('Insert a screen on this path', 'wconvert')} onClick={event => { event.stopPropagation(); insert(props.id); }}><Plus aria-hidden="true" /></button>
  </EdgeLabelRenderer>}</>;
}
