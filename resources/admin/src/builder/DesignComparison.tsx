import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { PickerDialogBody, PickerDialogFooter } from '../discovery/PickerDialog';
import { ComparisonGrid } from '../discovery/ComparisonGrid';
import { PreviewControls } from '../discovery/PreviewControls';
import { PreviewFrame } from '../discovery/PreviewFrame';
import type { TemplateIndexEntry } from '../templates/api';
import type { Template } from '@renderer/types';
import { ArrowLeft } from 'lucide-react';
import { displayTypeLabel } from '../displayTypes';

export function DesignComparison({ entries, trees, onBack, onInspect, failed, onRetry }: {
  entries: TemplateIndexEntry[]; trees: ReadonlyMap<string, Template>; onBack:()=>void;
  onInspect:(id:string)=>void; failed?:ReadonlySet<string>; onRetry?:(id:string)=>void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[]);
  return <section className="wconvert-design-comparison">
    <PickerDialogBody>
      <h3 ref={heading} tabIndex={-1} className="m-0 text-heading font-semibold">{__('Compare designs','wconvert')}</h3>
      <p className="text-note text-muted-foreground">{__('Compare sample layouts here. Review your content before applying a design to this draft.','wconvert')}</p>
      <ComparisonGrid>{entries.map(entry=><DesignColumn key={entry.id} entry={entry} template={trees.get(entry.id)} failed={failed?.has(entry.id)} onRetry={onRetry} onInspect={onInspect} />)}</ComparisonGrid>
    </PickerDialogBody>
    <PickerDialogFooter>
    <Button className="wconvert-picker__back" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to designs','wconvert')}</Button>
    <span className="text-note text-muted-foreground">{__('Review one design before applying it to this draft.', 'wconvert')}</span>
    </PickerDialogFooter>
  </section>;
}
function DesignColumn({entry,template,onInspect,failed,onRetry}:{entry:TemplateIndexEntry;template?:Template;onInspect:(id:string)=>void;failed?:boolean;onRetry?:(id:string)=>void;}) {
  const [mobile,setMobile]=useState(()=>window.innerWidth<640); const [step,setStep]=useState(0); const [resultId,setResultId]=useState('');
  const screen=template?.tree.steps[step];const result=screen?.results?.find(item=>item.id===resultId)??screen?.results?.[0];
  return <section>
    <h4 className="m-0 text-heading font-semibold">{entry.name}</h4><p className="text-note">{displayTypeLabel(entry.display_type)}</p>
    <PreviewControls template={template} mobile={mobile} onMobile={setMobile} step={step} onStep={value=>{setStep(value);setResultId('');}} />
    {screen?.results && screen.results.length > 0 && <label className="text-note">{__('Result to inspect','wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event=>setResultId(event.target.value)}>{screen.results.map(item=><option key={item.id} value={item.id}>{item.heading||item.id}</option>)}</select></label>}
    <PreviewFrame fitHeight template={template} displayType={entry.display_type} mobile={mobile} step={step} result={result}>
      {failed ? <div><p role="alert">{__('This design preview could not be loaded.','wconvert')}</p>{onRetry && <Button variant="outline" onClick={()=>onRetry(entry.id)}>{__('Retry preview','wconvert')}</Button>}</div> : <p role="status">{__('Loading design preview…','wconvert')}</p>}
    </PreviewFrame>
    <Button variant="outline" aria-label={sprintf(__('Review design: %s','wconvert'),entry.name)} onClick={()=>onInspect(entry.id)}>{__('Review this design','wconvert')}</Button>
  </section>;
}
