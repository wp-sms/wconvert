import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Preview } from '../builder/Preview';
import type { PlaybookEntry } from '../goals/api';
import { startingPointDisplayType } from '../goals/StartingPointFacts';

const JourneyTest = lazy(() => import('../builder/JourneyTest').then(module => ({ default: module.JourneyTest })));

/** Production renderer, every screen, no provider submissions. */
export function SetupPreview({ entry }: { entry: PlaybookEntry }) {
  const [mobile, setMobile] = useState(false); const [step, setStep] = useState(0);
  const [journey, setJourney] = useState(false); const [resultId, setResultId] = useState('');
  const [available, setAvailable] = useState(600); const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = stage.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([value]) => { if (value) setAvailable(value.contentRect.width); });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const width = mobile ? 320 : 720; const scale = Math.min(1, available / width);
  const screen = entry.template?.tree.steps[step];
  const result = screen?.results?.find(item => item.id === resultId) ?? screen?.results?.[0];
  return <section className="wconvert-setup-preview" aria-label={__('Design preview', 'wconvert')}>
    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" aria-pressed={!mobile} onClick={() => setMobile(false)}>{__('Desktop', 'wconvert')}</Button>
      <Button variant="outline" size="sm" aria-pressed={mobile} onClick={() => setMobile(true)}>{__('Mobile', 'wconvert')}</Button>
      {entry.template && entry.template.tree.steps.map((screen, index) => <Button key={screen.id ?? index} variant="ghost" size="sm" aria-pressed={!journey && step === index} onClick={() => { setJourney(false); setStep(index); setResultId(''); }}>{sprintf(__('%1$s: %2$s', 'wconvert'), String(index + 1), screen.name || __('Screen', 'wconvert'))}</Button>)}
      {entry.template && <Button variant="outline" size="sm" aria-pressed={journey} onClick={() => setJourney(!journey)}>{journey ? __('Return to screens', 'wconvert') : __('Try visitor journey', 'wconvert')}</Button>}
    </div>
    {!journey && screen?.results && screen.results.length > 0 && <label className="flex flex-col gap-2 text-note">{__('Result to inspect', 'wconvert')}<select className="wconvert-picker__select" value={result?.id} onChange={event => setResultId(event.target.value)}>{screen.results.map(item => <option key={item.id} value={item.id}>{item.heading || item.id}</option>)}</select></label>}
    <div ref={stage} className="wconvert-setup-preview__stage">
      {journey && entry.template ? <Suspense fallback={<p role="status">{__('Loading journey test…', 'wconvert')}</p>}><JourneyTest template={entry.template} onEdit={index => { setJourney(false); setStep(index); }} /></Suspense> : entry.template ? <div className="wconvert-setup-preview__fit" style={{ width, zoom: scale }}><Preview template={entry.template} displayType={startingPointDisplayType(entry)} step={step} result={result} interactive /></div>
        : <p role="status">{__('Loading the actual setup preview…', 'wconvert')}</p>}
    </div>
    <p className="text-note text-muted-foreground">{__('Preview only. Journey tests use simulated answers and saves; no messages are sent. Review your copy, links and dates in the editor before publishing.', 'wconvert')}</p>
  </section>;
}
