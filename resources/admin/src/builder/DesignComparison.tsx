import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { AdminDialogFooter } from '../components/ui/admin-dialog';
import { PickerDialogBody } from '../discovery/PickerDialog';
import { ComparisonGrid } from '../discovery/ComparisonGrid';
import { PreviewControls } from '../discovery/PreviewControls';
import { PreviewFrame } from '../discovery/PreviewFrame';
import { TryAgain } from '../shell/Region';
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
      <p className="text-note text-muted-foreground">{__('Sample content. Review a design to see it with yours.','wconvert')}</p>
      <ComparisonGrid>{entries.map(entry=><DesignColumn key={entry.id} entry={entry} template={trees.get(entry.id)} failed={failed?.has(entry.id)} onRetry={onRetry} onInspect={onInspect} />)}</ComparisonGrid>
    </PickerDialogBody>
    <AdminDialogFooter back={<Button className="wconvert-picker__back" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />{__('Back to designs','wconvert')}</Button>} />
  </section>;
}
function DesignColumn({entry,template,onInspect,failed,onRetry}:{entry:TemplateIndexEntry;template?:Template;onInspect:(id:string)=>void;failed?:boolean;onRetry?:(id:string)=>void;}) {
  const [mobile,setMobile]=useState(()=>window.innerWidth<640); const [step,setStep]=useState(0); const [resultId,setResultId]=useState('');
  const screen=template?.tree.steps[step];const result=screen?.results?.find(item=>item.id===resultId)??screen?.results?.[0];
  return <section>
    <h4 className="m-0 text-heading font-semibold"><bdi>{entry.name}</bdi></h4><p className="text-note">{displayTypeLabel(entry.display_type)}</p>
    <PreviewControls template={template} mobile={mobile} onMobile={setMobile} step={step} onStep={value=>{setStep(value);setResultId('');}} />
    {screen?.results && screen.results.length > 0 && <label className="text-note">{__('Result to inspect','wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event=>setResultId(event.target.value)}>{screen.results.map((item,index)=><option key={item.id} value={item.id}>{item.heading||sprintf(/* translators: %d: the result's position. */ __('Result %d','wconvert'),index+1)}</option>)}</select></label>}
    <PreviewFrame fitHeight template={template} displayType={entry.display_type} mobile={mobile} step={step} result={result}>
      {failed ? <div className="wconvert-design-detail__error"><p role="alert">{__('This design preview could not be loaded.','wconvert')}</p>{onRetry && <TryAgain onClick={()=>onRetry(entry.id)} />}</div> : <p role="status">{__('Loading design preview…','wconvert')}</p>}
    </PreviewFrame>
    <Button variant="outline" aria-label={sprintf(__('Review design: %s','wconvert'),entry.name)} onClick={()=>onInspect(entry.id)}>{__('Review this design','wconvert')}</Button>
  </section>;
}
