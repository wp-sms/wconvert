import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, FileArchive, Image, Link, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '../components/ui/button';
import { Dialog, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { PickerDialogContent, PickerDialogHeader, PickerDialogBody, PickerDialogFooter } from '../discovery/PickerDialog';
import { PreviewControls } from '../discovery/PreviewControls';
import { PreviewFrame } from '../discovery/PreviewFrame';
import { messageOf } from '../shell/loadable';
import {
  transferStatus, uploadDesign, prepareImport, applyImport, cancelImport, downloadDesign, importImage, withPreviewImages,
  type TransferDesign, type TransferStatus, type TransferPreview, type Config,
} from '../templates/transfer';

export default function TemplateTransferDialog({ action, design, config, optin, onClose, onApply }: {
  action: 'import' | 'export'; design: TransferDesign; config: Config; optin: string;
  onClose: () => void; onApply: (patch: Config) => void;
}) {
  const contentId = useId();
  const [status, setStatus] = useState<TransferStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [mode, setMode] = useState<'file' | 'keep'>('file');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [fitHeight, setFitHeight] = useState(true);
  const [fileName, setFileName] = useState('');
  const [importName, setImportName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const session = useRef<string | null>(null);
  const committedLinks = useRef<Record<string, string>>({});
  const urls = useRef<Record<string, string>>({});
  const alive = useRef(true);
  const title = action === 'export' ? __('Export design', 'wconvert') : __('Import design', 'wconvert');
  useEffect(() => {
    alive.current = true;
    transferStatus().then(value => { if (alive.current) setStatus(value); }).catch(reason => { if (alive.current) setError(messageOf(reason)); });
    return () => {
      alive.current = false;
      if (session.current) void cancelImport(session.current).catch(() => undefined);
      Object.values(urls.current).forEach(URL.revokeObjectURL);
    };
  }, []);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await work(); }
    catch (reason) {
      if (!alive.current) return;
      setError(messageOf(reason));
      const detail = reason as { data?: { problems?: Record<string, string> } };
      if (detail.data?.problems) setProblems(detail.data.problems);
    } finally { if (alive.current) setBusy(false); }
  };
  const prepare = async (id: string, nextMode = mode, resetLinks = false) => {
    setPreview(null); setReviewed(false);
    const replacements: Record<string, string> = {};
    if (!resetLinks) {
      Object.entries(committedLinks.current).forEach(([source, value]) => { replacements[source] = links[value] ?? value; });
      Object.entries(links).forEach(([source, value]) => { if (!Object.values(committedLinks.current).includes(source)) replacements[source] = value; });
    }
    const next = await prepareImport(id, optin, config, nextMode, replacements);
    const loaded: Record<string, string> = {};
    try {
      const outcomes = await Promise.allSettled(next.assets.map(async asset => {
        loaded[asset.id] = urls.current[asset.id] ?? await importImage(id, asset.id);
      }));
      const failed = outcomes.find(outcome => outcome.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    } catch (reason) {
      Object.entries(loaded).forEach(([id, url]) => { if (!urls.current[id]) URL.revokeObjectURL(url); });
      throw reason;
    }
    if (!alive.current) { Object.values(loaded).forEach(URL.revokeObjectURL); return; }
    Object.entries(urls.current).forEach(([id, url]) => { if (!(id in loaded)) URL.revokeObjectURL(url); });
    urls.current = loaded; setImages(loaded);
    committedLinks.current = replacements;
    setPreview(next); setLinks({}); setStep(0); setResult(0);
  };
  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      if (status && file.size > status.max_bytes) throw new Error(__('This file exceeds your site’s upload limit.', 'wconvert'));
      if (session.current) await cancelImport(session.current);
      session.current = null; setFileName(''); setImportName('');
      Object.values(urls.current).forEach(URL.revokeObjectURL); urls.current = {}; setImages({}); setPreview(null);
      const uploaded = await uploadDesign(file);
      session.current = uploaded.id;
      setFileName(file.name); setImportName(uploaded.name);
      if (!alive.current) { await cancelImport(uploaded.id); return; }
      await prepare(uploaded.id, mode, true);
    });
  };
  const changingLinks = Object.keys(links).length > 0;
  const rendered = action === 'export' ? design : preview ? withPreviewImages(preview.patch.template, images) : undefined;
  const results = rendered?.tree.steps[step]?.results ?? [];
  const notices = preview ? [...new Set(preview.notes)] : [];
  const close = () => { if (!busy) onClose(); };

  const hasReview = !!preview && (preview.links.length > 0 || notices.length > 0);
  const hasProblems = Object.keys(problems).length > 0;
  const showWorkspace = action === 'export' || !!session.current;
  const busyLabel = action === 'export' ? __('Creating your file…', 'wconvert') : preview ? __('Adding design to draft…', 'wconvert') : __('Preparing your preview…', 'wconvert');

  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <PickerDialogContent className={`wconvert-transfer-dialog ${showWorkspace ? 'wconvert-transfer-dialog--workspace' : ''}`} showCloseButton={!busy}
      onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <PickerDialogHeader className="wconvert-transfer__header flex-row">
        <span className="wconvert-transfer__icon" aria-hidden="true">{action === 'export' ? <ArrowDownToLine /> : <ArrowUpFromLine />}</span>
        <div><DialogTitle>{title}</DialogTitle>
          <DialogDescription>{action === 'export'
            ? __('Take this design to another WConvert site.', 'wconvert')
            : __('Bring a design from another WConvert site into this campaign.', 'wconvert')}</DialogDescription></div>
      </PickerDialogHeader>
      <PickerDialogBody className="wconvert-transfer" aria-busy={busy}>
        {error && <div role="alert" className="wconvert-transfer__alert"><TriangleAlert aria-hidden="true" /><div>{error}</div></div>}
        {!status && !error && <p role="status" className="wconvert-transfer__loading"><LoaderCircle className="animate-spin" aria-hidden="true" />{__('Checking file support…', 'wconvert')}</p>}
        {status && !status.zip && <p className="wconvert-transfer__alert">{__('This feature needs PHP ZIP support. Ask your host to enable it.', 'wconvert')}</p>}
        {action === 'import' && status?.zip && <input ref={fileInput} className="sr-only" type="file" tabIndex={-1} aria-label={__('Choose a WConvert design file', 'wconvert')} accept=".zip,application/zip" disabled={busy}
          onClick={event => { event.currentTarget.value = ''; }} onChange={event => upload(event.target.files?.[0])} />}
        {action === 'import' && status?.zip && !showWorkspace && <div className="wconvert-transfer__start">
          <div className="wconvert-transfer__dropzone" data-dragging={dragging || undefined}
            onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) upload(event.dataTransfer.files[0]); }}>
            <span className="wconvert-transfer__file-icon" aria-hidden="true"><FileArchive /></span>
            <h3>{__('Drop your design file here', 'wconvert')}</h3>
            <p>{__('A .wconvert.zip file exported from WConvert', 'wconvert')}</p>
            <Button disabled={busy} onClick={() => fileInput.current?.click()}><ArrowUpFromLine aria-hidden="true" />{__('Choose file', 'wconvert')}</Button>
            <small>{sprintf(__('Up to %s MB · Images included in the file travel with it', 'wconvert'), String(Math.floor(status.max_bytes / 1048576)))}</small>
          </div>
          <div className="wconvert-transfer__assurance"><ShieldCheck aria-hidden="true" /><p>{__('You’ll preview the design and review its links before applying. Your live campaign stays unchanged until you publish.', 'wconvert')}</p></div>
        </div>}
        {showWorkspace && <div className="wconvert-transfer__workspace">
          <section className="wconvert-transfer__preview" aria-label={__('Design preview', 'wconvert')}>
            <div className="wconvert-transfer__preview-heading"><span>{__('Design preview', 'wconvert')}</span><span className="wconvert-transfer__badge">{action === 'export' ? __('Current draft', 'wconvert') : __('Before you apply', 'wconvert')}</span></div>
            {rendered ? <>
              <PreviewControls mobile={mobile} onMobile={setMobile} template={rendered} step={step} onStep={value => { setStep(value); setResult(0); }} fitHeight={fitHeight} onFitHeight={setFitHeight} disabled={busy} />
              {results.length > 0 && <label className="wconvert-transfer__result">{__('Result to preview', 'wconvert')}<select className="wconvert-picker__select" value={result} onChange={event => setResult(Number(event.target.value))}>{results.map((item, index) => <option key={item.id} value={index}>{item.heading || item.id}</option>)}</select></label>}
              <PreviewFrame template={rendered} displayType={action === 'export' ? design.display_type : preview!.patch.display_type} mobile={mobile} step={step} result={results[result]} fitHeight={fitHeight} />
            </> : <div className="wconvert-transfer__placeholder">{busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" /><p>{__('Preparing your preview…', 'wconvert')}</p></> : <><FileArchive aria-hidden="true" /><p>{__('Your preview will appear here.', 'wconvert')}</p><Button variant="outline" onClick={() => void run(() => prepare(session.current!))}>{__('Retry preview', 'wconvert')}</Button></>}</div>}
          </section>
          <div className="wconvert-transfer__settings">
            <div className="wconvert-transfer__identity"><FileArchive aria-hidden="true" /><div><h3>{action === 'export' ? design.name : importName}</h3><p>{action === 'export' ? __('WConvert design file · .zip', 'wconvert') : fileName}</p></div>
              {action === 'import' && <Button variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()}>{__('Change file', 'wconvert')}</Button>}
            </div>
            {action === 'export' ? <>
              <section className="wconvert-transfer__section"><h3>{__('Included in your file', 'wconvert')}</h3>
                <ul className="wconvert-transfer__included">
                  <li><Check aria-hidden="true" /><div><strong>{__('Design & content', 'wconvert')}</strong><p>{__('Layout, styles, text, buttons, and screens', 'wconvert')}</p></div></li>
                  <li><Image aria-hidden="true" /><div><strong>{__('Supported images', 'wconvert')}</strong><p>{__('Packed into the file for use on another site', 'wconvert')}</p></div></li>
                  <li><Check aria-hidden="true" /><div><strong>{__('Your latest edits', 'wconvert')}</strong><p>{__('Includes changes you haven’t saved yet', 'wconvert')}</p></div></li>
                </ul>
              </section>
              <div className="wconvert-transfer__note"><h3>{__('Design only', 'wconvert')}</h3><p>{__('Campaign settings, connections, and leads stay on this site. Paid features still need a matching plan on the receiving site.', 'wconvert')}</p></div>
              {hasProblems && <section className="wconvert-transfer__warning"><h3><TriangleAlert aria-hidden="true" />{__('Some images can’t be included', 'wconvert')}</h3><ul>{Object.entries(problems).map(([slot, message]) => <li key={slot}>{message}</li>)}</ul><p>{__('Continue without these images, or cancel and replace them in the editor.', 'wconvert')}</p></section>}
            </> : <>
              <fieldset className="wconvert-transfer__section wconvert-transfer__content" disabled={busy}><legend>{__('Content to use', 'wconvert')}</legend>
                {(['file', 'keep'] as const).map(value => <label className="wconvert-transfer__choice" key={value} aria-label={value === 'file' ? __('Use file content', 'wconvert') : __('Keep my current content', 'wconvert')}>
                  <input type="radio" name={contentId} aria-describedby={`${contentId}-${value}`} value={value} checked={mode === value} onChange={() => { setMode(value); if (session.current) void run(() => prepare(session.current!, value, true)); }} />
                  <span><strong>{value === 'file' ? __('Use file content', 'wconvert') : __('Keep my current content', 'wconvert')}</strong><small id={`${contentId}-${value}`}>{value === 'file' ? __('Start with the text and images in this file.', 'wconvert') : __('Fit your existing content into the new design.', 'wconvert')}</small></span>
                </label>)}
              </fieldset>
              {preview && <>
                {notices.length > 0 && <section className="wconvert-transfer__warning"><h3><TriangleAlert aria-hidden="true" />{__('Needs review', 'wconvert')}</h3><ul>{notices.map(note => <li key={note}>{note}</li>)}</ul></section>}
                {preview.links.length > 0 && <section className="wconvert-transfer__section"><h3><Link aria-hidden="true" />{__('Review links', 'wconvert')}<span className="wconvert-transfer__badge">{preview.links.length}</span></h3><p>{__('Keep these addresses or update them for this site.', 'wconvert')}</p>
                  {preview.links.map((link, index) => <label className="wconvert-transfer__link" key={link.url}><span><strong>{sprintf(__('Link %s', 'wconvert'), String(index + 1))}</strong><small>{sprintf(__('Used in %s place(s)', 'wconvert'), String(link.uses))}</small></span>
                    <input type="text" value={links[link.url] ?? link.url} disabled={busy} aria-label={sprintf(__('Link: %s', 'wconvert'), link.url)} onChange={event => { setLinks(current => ({ ...current, [link.url]: event.target.value })); setReviewed(false); }} />
                  </label>)}
                  <p className="wconvert-transfer__hint">{__('Linked files are not included.', 'wconvert')}</p>
                </section>}
                {changingLinks ? <div className="wconvert-transfer__update"><p>{__('Update the preview to review your changed links.', 'wconvert')}</p><Button variant="outline" disabled={busy} onClick={() => { if (session.current) void run(() => prepare(session.current!)); }}>{__('Update preview', 'wconvert')}</Button></div>
                  : hasReview && <label className="wconvert-transfer__review"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} /><span>{preview.links.length > 0 ? __('Keep these links and apply the reviewed changes', 'wconvert') : __('Apply the reviewed changes', 'wconvert')}</span></label>}
                <>{preview.assets.length > 0 && <p className="wconvert-transfer__hint">{__('Included images are added to your Media Library when you apply.', 'wconvert')}</p>}</>
              </>}
            </>}
          </div>
        </div>}
        {action === 'import' && status && !status.upload_images && <p className="wconvert-transfer__note">{__('Your account can import text-only designs. Image files require upload permission.', 'wconvert')}</p>}
      </PickerDialogBody>
      <PickerDialogFooter className="wconvert-transfer__footer">
        <p className="wconvert-transfer__footer-note" role="status">{busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" />{busyLabel}</> : action === 'export' ? <><FileArchive aria-hidden="true" />{__('One file, ready to reuse.', 'wconvert')}</> : <><ShieldCheck aria-hidden="true" />{__('Applies to your draft. You can undo it.', 'wconvert')}</>}</p>
        <div className="wconvert-transfer__actions"><Button variant="outline" disabled={busy} onClick={close}>{__('Cancel', 'wconvert')}</Button>
          {action === 'export' ? <Button disabled={busy || !status?.zip} onClick={() => void run(async () => { await downloadDesign(design, Object.keys(problems)); if (alive.current) onClose(); })}>
            <ArrowDownToLine aria-hidden="true" />{hasProblems ? __('Export without these images', 'wconvert') : __('Download design', 'wconvert')}
          </Button> : showWorkspace && <Button disabled={busy || !preview || (hasReview && !reviewed) || changingLinks} onClick={() => void run(async () => {
            if (!preview || !session.current) return;
            const result = await applyImport(session.current, preview.digest);
            if (alive.current) onApply(result.patch);
          })}>{__('Apply to draft', 'wconvert')}</Button>}
        </div>
      </PickerDialogFooter>
    </PickerDialogContent>
  </Dialog>;
}
