// One approved Fieldwork direction. Throwaway UI; all edits stay in memory.
import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Eye, Image as ImageIcon, Layers, LayoutTemplate, Maximize2, Monitor, MousePointer2, PanelLeftClose, Redo2, RotateCcw, Smartphone, Type, Undo2, Upload, X, AlignLeft, AlignCenter, Mail, SquareMousePointer, SlidersHorizontal, Home, CheckSquare, FileText, Info } from 'lucide-react';
import fieldworkPhoto from './assets/fieldwork.jpg';
import './fonts.css';
import './style.css';

const seed = {
  template: 'Fieldwork', brand: 'fern & form', art: 'Room\nto grow.', eyebrow: 'A WELCOME FROM US',
  heading: 'A little green.\n10% less.', description: '10% off your first order of plants, pots and small joys for your home.',
  emailLabel: 'Email address', placeholder: 'you@example.com', consent: 'I’d also like monthly plant notes and offers. Unsubscribe at any time.',
  button: 'Send my code', fine: 'We’ll email your code. No newsletter unless you choose it.', terms: 'First order only. Excludes gift cards. One use per customer.',
  successArt: 'Make yourself\nat home.', successEyebrow: 'YOUR CODE IS READY', successHeading: 'A greener home\nstarts here.',
  successDescription: 'Take 10% off your first order. Your code is here, and a copy is on its way to your inbox.', code: 'HELLO10', successButton: 'Copy my code',
  photo: fieldworkPhoto, photoAlt: 'Sunlit green leaves', focal: 50, mobilePhoto: false, showConsent: true,
  palette: { paper: '#f5f5e9', ink: '#253c2b', soft: '#56634e', button: '#263f2c', buttonInk: '#ffffff', rule: '#b9c4a9' },
  radius: 5, padding: 28, headingFont: 'Instrument Serif', styles: {}, mobileStyles: {},
};
const defaults = {
  brand: { fontSize: 26, color: '#ffffff', marginBottom: 0 }, art: { fontSize: 36, color: '#ffffff', marginBottom: 0 },
  eyebrow: { fontSize: 9, marginBottom: 13 }, heading: { fontSize: 44, marginBottom: 15 }, description: { fontSize: 13, marginBottom: 20 },
  email: { fontSize: 14, marginBottom: 0 }, consent: { fontSize: 10, marginBottom: 0 }, button: { fontSize: 13, marginBottom: 0, textAlign: 'center' },
  fine: { fontSize: 10, marginBottom: 0 }, terms: { fontSize: 9, marginBottom: 0 }, code: { fontSize: 26, marginBottom: 16 },
};
const meta = {
  design: ['Design', LayoutTemplate], image: ['Image panel', ImageIcon], content: ['Content section', LayoutTemplate],
  brand: ['Brand name', Type], art: ['Image headline', Type], eyebrow: ['Eyebrow', Type], heading: ['Heading', Type],
  description: ['Description', FileText], email: ['Email field', Mail], consent: ['Optional consent', CheckSquare],
  button: ['Button', SquareMousePointer], fine: ['Privacy note', FileText], terms: ['Offer terms', FileText], code: ['Discount code', Copy],
};
function historyReducer(state, action) {
  if (action.type === 'undo') return state.past.length ? { past: state.past.slice(0, -1), present: state.past.at(-1), future: [state.present, ...state.future], group: null } : state;
  if (action.type === 'redo') return state.future.length ? { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1), group: null } : state;
  if (action.type === 'end') return { ...state, group: null };
  const next = action.update(state.present);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return { past: action.group && state.group === action.group ? state.past : [...state.past.slice(-79), state.present], present: next, future: [], group: action.group ?? null };
}
function IconButton({ icon: Icon, label, className = '', ...props }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}><Icon size={17} strokeWidth={1.7}/></button>;
}
function Field({ label, children, hint, className = '' }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}
function Range({ label, value, min, max, unit = 'px', onChange, onBlur }) {
  return <Field label={<><span>{label}</span><span className="value">{value}{unit}</span></>}><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} onBlur={onBlur}/></Field>;
}
function ColorField({ label, value, onChange, onBlur }) {
  return <label className="color-field"><span>{label}</span><span className="color-value"><input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}/><span>{value.toUpperCase()}</span></span></label>;
}
function Modal({ open, onOpenChange, title, description, children }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal"><div className="modal-title"><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><IconButton icon={X} label="Close dialog"/></Dialog.Close></div><Dialog.Description>{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function App() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: structuredClone(seed), future: [], group: null });
  const d = history.present;
  const [selected, setSelected] = useState('heading');
  const [tab, setTab] = useState('content');
  const [layers, setLayers] = useState(false);
  const [step, setStep] = useState('form');
  const [mobile, setMobile] = useState(false);
  const [mobileOnly, setMobileOnly] = useState(true);
  const [preview, setPreview] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [wp, setWp] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(JSON.stringify(seed));
  const [email, setEmail] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef(null);
  const stage = useRef(null);
  const [stageWidth, setStageWidth] = useState(1000);
  const [stageHeight, setStageHeight] = useState(600);
  const [zoom, setZoom] = useState('fit');
  const [popupHeight, setPopupHeight] = useState(520);
  const popupRef = useRef(null);
  const dirty = saved !== JSON.stringify(d);
  const title = meta[selected][0];
  const TitleIcon = meta[selected][1];
  const success = step === 'success';
  const textKey = id => success ? ({ art: 'successArt', eyebrow: 'successEyebrow', heading: 'successHeading', description: 'successDescription', button: 'successButton' }[id] ?? id) : id;
  const styleKey = id => success && ['art', 'eyebrow', 'heading', 'description', 'button'].includes(id) ? `success-${id}` : id;
  const effectiveStyle = id => ({ ...defaults[id], ...d.styles[styleKey(id)], ...(mobile ? d.mobileStyles[styleKey(id)] : {}) });
  const change = (update, group) => dispatch({ type: 'edit', update, group });
  const endEdit = () => dispatch({ type: 'end' });
  const patch = (key, value) => change(old => ({ ...old, [key]: value }), key);
  const palette = (key, value) => change(old => ({ ...old, palette: { ...old.palette, [key]: value } }), `palette-${key}`);
  const setStyle = (key, value) => {
    const bag = mobile && mobileOnly ? 'mobileStyles' : 'styles';
    const id = styleKey(selected);
    change(old => ({ ...old, [bag]: { ...old[bag], [id]: { ...old[bag][id], [key]: value } } }), `${bag}-${id}-${key}`);
  };
  const select = id => { setSelected(id); endEdit(); if (['design', 'image', 'content'].includes(id)) setTab('content'); };
  const notify = message => setToast(message);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { for (const entry of entries) { if (entry.target === stage.current) { setStageWidth(entry.contentRect.width); setStageHeight(entry.contentRect.height); } else setPopupHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height); } });
    if (stage.current) observer.observe(stage.current);
    if (popupRef.current) observer.observe(popupRef.current);
    return () => observer.disconnect();
  }, [dismissed]);
  useEffect(() => {
    const onKey = e => {
      const editing = e.target.matches('input,textarea,select,[contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !editing) { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); setSaved(JSON.stringify(d)); notify('Saved for this session'); }
      if (e.key === 'Escape' && !modal) { if (preview) { setPreview(false); setDismissed(false); } else if (!editing) select('design'); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [d, preview, modal]);
  const setScreen = next => { setStep(next); setDismissed(false); if (['email', 'consent', 'fine', 'code'].includes(selected)) setSelected('heading'); endEdit(); };
  const width = mobile ? 352 : 600;
  const scale = zoom === 'actual' ? 1 : Math.min(1, Math.max(0.3, (stageWidth - 64) / width), Math.max(0.45, stageHeight / popupHeight));
  const editProps = id => ({
    'data-element': id,
    className: `editable ${selected === id && !preview ? 'is-selected' : ''}`,
    onClick: preview ? undefined : e => { e.preventDefault(); e.stopPropagation(); select(id); },
    style: { ...effectiveStyle(id), ...(id === 'button' ? { justifyContent: effectiveStyle(id).textAlign === 'left' ? 'flex-start' : 'center' } : {}) },
  });
  const textInput = (label, key, multiline = false, hint) => <Field label={label} hint={hint}>{multiline ? <textarea rows={key.toLowerCase().includes('heading') ? 3 : 4} value={d[key]} onChange={e => patch(key, e.target.value)} onBlur={endEdit}/> : <input value={d[key]} onChange={e => patch(key, e.target.value)} onBlur={endEdit}/>}</Field>;
  const currentStyle = effectiveStyle(selected);
  const upload = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) { setUploadError('Choose a JPG, PNG, WebP, GIF or AVIF under 5 MB.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { change(old => ({ ...old, photo: reader.result })); notify('Image replaced. You can undo this.'); };
    reader.onerror = () => setUploadError('This image could not be read. Try another file.');
    reader.readAsDataURL(file); e.target.value = '';
  };
  const applyTemplate = () => {
    change(old => ({ ...old, template: old.template === 'Fieldwork' ? 'Fieldwork · centred' : 'Fieldwork' }));
    setModal(null); select('design'); notify('Layout changed. Review both screens; Undo is available.');
  };
  const centred = d.template !== 'Fieldwork';
  const leaf = !['design', 'image', 'content'].includes(selected);
  return <div className={`prototype ${wp ? 'with-wordpress' : ''}`}>
    {wp && <><div className="wp-top"><span className="wp-w">W</span><Home size={14}/> WConvert local <span className="wp-right">Howdy, navid</span></div><aside className="wp-sidebar"><span>Dashboard</span><span>Posts</span><span>Media</span><span>Pages</span><span>Comments</span><span>WooCommerce</span><span>Products</span><span className="wp-active">WConvert</span><span>Appearance</span><span>Plugins</span><span>Users</span><span>Tools</span><span>Settings</span></aside></>}
    <div className="editor">
      <header className="editor-header">
        <button className="back-button" onClick={() => setModal('leave')} aria-label="Back to Optins"><ArrowLeft size={18}/></button>
        <div className="optin-title"><span className="brand-label">WConvert <ChevronRight size={12}/></span><strong>Welcome discount</strong><span className="draft-badge">Draft</span></div>
        <div className="header-actions"><span className="save-status">{dirty ? <><span className="unsaved-dot"/>Unsaved changes</> : <><Check size={14}/>Saved in session</>}</span><IconButton icon={Undo2} label="Undo (⌘Z / Ctrl+Z)" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })}/><IconButton icon={Redo2} label="Redo (⇧⌘Z / Ctrl+Shift+Z)" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}/><span className="toolbar-rule"/><button className="button" onClick={() => { setPreview(!preview); setDismissed(false); }}><Eye size={16}/>{preview ? 'Back to editing' : 'Preview'}</button><button className="button primary" onClick={() => { setSaved(JSON.stringify(d)); endEdit(); notify('Saved for this session. Reload starts fresh.'); }} disabled={!dirty}>Save draft</button></div>
      </header>
      <div className="editor-toolbar">
        <div className="toolbar-left"><button className={`button quiet ${layers ? 'active' : ''}`} onClick={() => setLayers(!layers)} aria-label="Layers" aria-pressed={layers}><Layers size={16}/><span>Layers</span></button><button className={`button quiet ${selected === 'design' ? 'active' : ''}`} onClick={() => select('design')} aria-label="Design"><SlidersHorizontal size={16}/><span>Design</span></button></div>
        <div className="segmented screens" aria-label="Optin screen"><button aria-pressed={!success} onClick={() => setScreen('form')}>Form</button><button aria-pressed={success} onClick={() => setScreen('success')}><Check size={13}/>Success</button></div>
        <div className="toolbar-right"><div className="segmented devices" aria-label="Preview width"><button aria-label="Desktop preview" title="Desktop · 600px" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={17}/></button><button aria-label="Mobile preview" title="Mobile · 352px" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={17}/></button></div><span className="toolbar-rule"/><IconButton icon={wp ? Maximize2 : PanelLeftClose} label={wp ? 'Focus editor' : 'Show WordPress context'} onClick={() => setWp(!wp)}/></div>
      </div>
      <main className={`workspace ${layers && !preview ? 'has-layers' : ''} ${preview ? 'preview-mode' : ''}`}>
        {layers && !preview && <aside className="layers-panel" aria-label="Layers"><div className="panel-top"><strong>Layers</strong><IconButton icon={PanelLeftClose} label="Close Layers" onClick={() => setLayers(false)}/></div><p className="panel-caption">{success ? 'Success screen' : 'Form screen'}</p><div className="tree"><button className={selected === 'design' ? 'chosen' : ''} onClick={() => select('design')}><LayoutTemplate size={15}/>{d.template}</button>{!centred && <><button className={selected === 'image' ? 'chosen' : ''} onClick={() => select('image')}><ImageIcon size={15}/>Image panel{mobile && !d.mobilePhoto && <span className="hidden-note">Hidden</span>}</button>{['brand', 'art'].map(id => <button key={id} className={`depth ${selected === id ? 'chosen' : ''}`} onClick={() => select(id)}><Type size={14}/>{meta[id][0]}</button>)}</>}<button className={selected === 'content' ? 'chosen' : ''} onClick={() => select('content')}><LayoutTemplate size={15}/>Content section</button>{['eyebrow', 'heading', 'description', ...(success ? ['code', 'button', 'terms'] : ['email', ...(d.showConsent ? ['consent'] : []), 'button', 'fine', 'terms'])].map(id => { const Icon = meta[id][1]; return <button key={id} className={`depth ${selected === id ? 'chosen' : ''}`} onClick={() => select(id)}><Icon size={14}/>{meta[id][0]}</button>; })}</div><div className="layers-note">Select a section to adjust its layout. Select an element to edit it.</div></aside>}
        <section className="canvas" aria-label="Design canvas">
          <div className="canvas-topline"><span><span className="canvas-dot"/>{d.template}<ChevronRight size={12}/>{success ? 'Success' : 'Form'}</span><span className="canvas-sizing">{mobile ? 'Mobile' : 'Desktop'} · {width}px <select aria-label="Canvas zoom" value={zoom} onChange={e => setZoom(e.target.value)}><option value="fit">Fit · {Math.round(scale * 100)}%</option><option value="actual">100%</option></select></span></div>
          {preview && <div className="preview-note"><Eye size={14}/>Try the form as a visitor. No data is sent.<button onClick={() => { setPreview(false); setDismissed(false); }}>Exit preview <X size={13}/></button></div>}
          <div className="stage" ref={stage} onClick={() => !preview && select('design')}>
            {dismissed ? <div className="dismissed"><Check size={28}/><h2>Popup closed</h2><button className="button" onClick={() => setDismissed(false)}>Show again</button></div> : <div className="specimen-measure" style={{ width: width * scale, height: popupHeight * scale }}>
              <div ref={popupRef} className={`popup ${mobile ? 'narrow' : ''} ${centred ? 'centred' : ''} ${mobile && !d.mobilePhoto ? 'hide-mobile-art' : ''} ${preview ? 'interactive' : ''}`} style={{ width, transform: `scale(${scale})`, '--paper': d.palette.paper, '--ink': d.palette.ink, '--soft': d.palette.soft, '--rule': d.palette.rule, '--button': d.palette.button, '--button-ink': d.palette.buttonInk, '--heading-font': `'${d.headingFont}'`, '--body-padding': `${d.padding}px`, borderRadius: d.radius }}>
                <button className="popup-close" aria-label={preview ? 'Close popup' : 'Close button settings'} onClick={e => { e.stopPropagation(); preview ? setDismissed(true) : (select('design'), notify('The close button is always available to visitors.')); }}><X size={18}/></button>
                {!centred && <section {...editProps('image')} className={`${editProps('image').className} art-panel`} style={{ backgroundImage: `linear-gradient(180deg, #172e2a70 0%, #172e2a00 45%, #172e2abf 100%), url("${d.photo}")`, backgroundPosition: `${d.focal}% center` }} aria-label={d.photoAlt}><div {...editProps('brand')}>{d.brand}</div><div {...editProps('art')}>{d[textKey('art')]}</div></section>}
                <section {...editProps('content')} className={`${editProps('content').className} popup-body`}>
                  {centred && <div {...editProps('brand')} style={{ ...effectiveStyle('brand'), color: d.palette.ink, marginBottom: 24 }}>{d.brand}</div>}
                  <div {...editProps('eyebrow')} className={`${editProps('eyebrow').className} popup-eyebrow`}>{success && <Check size={12}/>} {d[textKey('eyebrow')]}</div>
                  <h1 {...editProps('heading')}>{d[textKey('heading')]}</h1>
                  <p {...editProps('description')}>{d[textKey('description')]}</p>
                  {success ? <><div {...editProps('code')} className={`${editProps('code').className} discount-code`}>{d.code}</div><button {...editProps('button')} className={`${editProps('button').className} popup-cta`} onClick={async e => { if (!preview) { e.stopPropagation(); select('button'); return; } try { await navigator.clipboard.writeText(d.code); notify('Code copied'); } catch { notify('Select the code and copy it with your keyboard.'); } }}><Copy size={15}/>{d.successButton}</button></> : <form onSubmit={e => { e.preventDefault(); if (preview) { setScreen('success'); notify('Demo complete. No email was sent.'); } }}>
                    <div {...editProps('email')} className={`${editProps('email').className} popup-field`}><label htmlFor="visitor-email">{d.emailLabel}</label><input id="visitor-email" type="email" placeholder={d.placeholder} value={email} onChange={e => setEmail(e.target.value)} required tabIndex={preview ? 0 : -1} readOnly={!preview}/></div>
                    {d.showConsent && <label {...editProps('consent')} className={`${editProps('consent').className} popup-consent`}><input type="checkbox" tabIndex={preview ? 0 : -1}/><span>{d.consent}</span></label>}
                    <button {...editProps('button')} className={`${editProps('button').className} popup-cta`} type={preview ? 'submit' : 'button'}>{d.button}<ArrowRight size={15}/></button>
                    <p {...editProps('fine')} className={`${editProps('fine').className} popup-fine`}>{d.fine} <span className="privacy-word">Privacy.</span></p>
                  </form>}
                  <p {...editProps('terms')} className={`${editProps('terms').className} popup-terms`}>{d.terms}</p>
                </section>
              </div>
            </div>}
          </div>
          {!preview && <div className="canvas-bottom"><MousePointer2 size={14}/><span>Click anything to edit it</span><span className="bottom-divider"/><button onClick={() => setModal('help')}>Keyboard shortcuts <CircleHelp size={13}/></button></div>}
        </section>
        {!preview && <aside className="inspector" aria-label="Element inspector">
          <div className="inspector-path"><button onClick={() => select('design')}>Design</button>{selected !== 'design' && <><ChevronRight size={12}/>{!['image', 'content'].includes(selected) && <><button onClick={() => select(['brand', 'art'].includes(selected) ? 'image' : 'content')}>{['brand', 'art'].includes(selected) ? 'Image' : 'Content'}</button><ChevronRight size={12}/></>}<span>{title}</span></>}</div>
          <div className="inspector-heading"><span className="element-icon"><TitleIcon size={19}/></span><div><h2>{title}</h2><span>{selected === 'design' ? 'Applies to both screens' : ['brand', 'image', 'terms'].includes(selected) ? 'Shared across both screens' : `${success ? 'Success' : 'Form'} screen`}</span></div></div>
          {leaf && <div className="inspector-tabs"><button aria-pressed={tab === 'content'} onClick={() => setTab('content')}>Content</button><button aria-pressed={tab === 'style'} onClick={() => setTab('style')}>Style</button></div>}
          <div className="inspector-scroll" key={`${selected}-${tab}-${step}`}>
            {selected === 'design' ? <>
              <div className="template-summary"><div className="template-mini"><img src={d.photo} alt=""/><span>A little green.<br/>10% less.<i/></span></div><div><strong>{d.template}</strong><span>Welcome discount · Popup</span></div></div><button className="button full" onClick={() => setModal('template')}><LayoutTemplate size={15}/>Change template</button>
              <div className="section-heading">Colors</div><ColorField label="Background" value={d.palette.paper} onChange={v => palette('paper', v)} onBlur={endEdit}/><ColorField label="Text" value={d.palette.ink} onChange={v => palette('ink', v)} onBlur={endEdit}/><ColorField label="Button" value={d.palette.button} onChange={v => palette('button', v)} onBlur={endEdit}/>
              <div className="section-heading">Typography</div><Field label="Heading font"><select value={d.headingFont} onChange={e => patch('headingFont', e.target.value)} onBlur={endEdit}><option>Instrument Serif</option><option>DM Sans</option><option>Georgia</option></select></Field>
              <details><summary>Layout & details <ChevronDown size={14}/></summary><Range label="Corner radius" value={d.radius} min={0} max={28} onChange={v => patch('radius', v)} onBlur={endEdit}/><Range label="Content padding" value={d.padding} min={16} max={48} onChange={v => patch('padding', v)} onBlur={endEdit}/><ColorField label="Secondary text" value={d.palette.soft} onChange={v => palette('soft', v)} onBlur={endEdit}/><ColorField label="Borders" value={d.palette.rule} onChange={v => palette('rule', v)} onBlur={endEdit}/></details>
            </> : selected === 'image' ? <>
              <div className="image-preview" style={{ backgroundImage: `url("${d.photo}")`, backgroundPosition: `${d.focal}% center` }}><span>Image panel</span></div><button className="button full" onClick={() => fileInput.current?.click()}><Upload size={15}/>Replace image</button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={upload}/>{uploadError && <p role="alert" className="error">{uploadError}</p>}<p className="hint">Choose an image from your computer. Up to 5 MB.</p>
              <Range label="Image position" value={d.focal} min={0} max={100} unit="%" onChange={v => patch('focal', v)} onBlur={endEdit}/>{textInput('Image description', 'photoAlt', false, 'Describe the image for people who cannot see it.')}
              <label className="toggle-row"><span>Show image on mobile<small>Hidden by default to keep the form short.</small></span><input type="checkbox" role="switch" checked={d.mobilePhoto} onChange={e => patch('mobilePhoto', e.target.checked)}/></label>
              <button className="text-button" onClick={() => { change(old => ({ ...old, photo: seed.photo, focal: 50 })); notify('Original image restored'); }}><RotateCcw size={13}/>Restore original image</button>
            </> : selected === 'content' ? <>
              <p className="inspector-intro">Space around your offer and form.</p><Range label="Padding" value={d.padding} min={16} max={48} onChange={v => patch('padding', v)} onBlur={endEdit}/><ColorField label="Background" value={d.palette.paper} onChange={v => palette('paper', v)} onBlur={endEdit}/>
              <div className="section-heading">Quick edit</div>{['heading', 'description', 'email', 'button'].filter(id => !success || id !== 'email').map(id => <button key={id} className="quick-edit" onClick={() => select(id)}><span>{meta[id][0]}</span><ChevronRight size={15}/></button>)}
              {!success && <label className="toggle-row"><span>Optional newsletter consent<small>Visitors choose whether to subscribe.</small></span><input type="checkbox" role="switch" checked={d.showConsent} onChange={e => patch('showConsent', e.target.checked)}/></label>}
            </> : tab === 'content' ? <>
              {selected === 'email' ? <>{textInput('Label', 'emailLabel')}{textInput('Placeholder', 'placeholder')}<div className="info-note"><Mail size={16}/><span>This field collects an email address and is required.</span></div></> : selected === 'code' ? <>{textInput('Discount code', 'code')}<p className="hint">Demo code for this prototype. Connect your real offer during implementation.</p></> : textInput(selected === 'button' ? 'Button text' : title, textKey(selected), !['brand', 'eyebrow', 'button'].includes(selected), selected === 'heading' ? 'Use a new line to control where the heading breaks.' : undefined)}
              {selected === 'button' && <div className="info-note"><ArrowRight size={16}/><span>{success ? 'Copies the discount code in visitor preview.' : 'Submits the form, then shows the success screen.'}</span></div>}
              {selected === 'consent' && <div className="info-note"><CheckSquare size={16}/><span>Optional and unchecked by default. Your welcome code is available either way.</span></div>}
              {selected === 'fine' && <p className="hint">The privacy link appears after this note. Its destination belongs in the Optin settings.</p>}
              {['heading', 'description', 'art', 'brand'].includes(selected) && <div className="section-heading appearance-shortcut"><span>Appearance</span><button onClick={() => setTab('style')}>Edit style <ArrowRight size={13}/></button></div>}
              {['heading', 'description', 'art', 'brand'].includes(selected) && <button className="style-summary" onClick={() => setTab('style')}><Type size={20}/><span><strong>{['heading', 'art', 'brand'].includes(selected) ? d.headingFont : 'DM Sans'}</strong><small>{currentStyle.fontSize}px · {currentStyle.textAlign === 'center' ? 'Centered' : 'Left aligned'}</small></span><ChevronRight size={15}/></button>}
              <details><summary>More options <ChevronDown size={14}/></summary><p className="hint">Find this element in the layout, or adjust the space around its section.</p><button className="button full" onClick={() => setLayers(true)}><Layers size={15}/>Show in Layers</button><button className="text-button" onClick={() => select(['brand', 'art'].includes(selected) ? 'image' : 'content')}>Edit parent section <ArrowRight size={13}/></button></details>
            </> : <>
              {mobile && <div className="responsive-note"><Smartphone size={16}/><div><strong>{mobileOnly ? 'Mobile appearance' : 'All screen sizes'}</strong><span>{mobileOnly ? 'Content stays shared. These styles affect mobile only.' : 'These styles also apply to desktop.'}</span><label><input type="checkbox" checked={mobileOnly} onChange={e => setMobileOnly(e.target.checked)}/>Only change mobile</label></div></div>}
              <Range label="Text size" value={currentStyle.fontSize} min={selected === 'heading' || selected === 'art' ? 24 : 9} max={selected === 'heading' || selected === 'art' ? 64 : 36} onChange={v => setStyle('fontSize', v)} onBlur={endEdit}/>
              <ColorField label="Text color" value={currentStyle.color ?? (selected === 'button' ? d.palette.buttonInk : ['fine', 'terms', 'consent'].includes(selected) ? d.palette.soft : d.palette.ink)} onChange={v => setStyle('color', v)} onBlur={endEdit}/>
              {selected === 'button' && <><ColorField label="Button color" value={d.palette.button} onChange={v => palette('button', v)} onBlur={endEdit}/><p className="hint">Button color is shared across screens and sizes.</p></>}
              <div className="field"><span className="field-label">Alignment</span><div className="segmented alignment"><button aria-label="Align left" aria-pressed={currentStyle.textAlign !== 'center'} onClick={() => setStyle('textAlign', 'left')}><AlignLeft size={17}/>Left</button><button aria-label="Align center" aria-pressed={currentStyle.textAlign === 'center'} onClick={() => setStyle('textAlign', 'center')}><AlignCenter size={17}/>Center</button></div></div>
              <div className="section-heading">Spacing</div><Range label="Space below" value={currentStyle.marginBottom ?? 0} min={0} max={48} onChange={v => setStyle('marginBottom', v)} onBlur={endEdit}/>
              <button className="text-button" onClick={() => { const bag = mobile && mobileOnly ? 'mobileStyles' : 'styles'; change(old => { const styles = { ...old[bag] }; delete styles[styleKey(selected)]; return { ...old, [bag]: styles }; }); notify(mobile && mobileOnly ? 'Mobile now follows the desktop styles' : 'Element styles reset'); }}><RotateCcw size={13}/>{mobile && mobileOnly ? 'Use desktop styles' : 'Reset element styles'}</button>
              <p className="hint">{mobile && mobileOnly ? 'Values start from the desktop design until you change them here.' : 'Colors and fonts start from your design. Override only what you need.'}</p>
            </>}
          </div>
          <div className="inspector-footer"><Info size={13}/><span>{mobile && tab === 'style' && mobileOnly ? 'Editing mobile styles' : 'Text changes apply to desktop and mobile'}</span></div>
        </aside>}
      </main>
      <footer className="prototype-footer"><span><span className="prototype-badge">PROTOTYPE</span>Changes stay in this session</span><div><button onClick={() => setWp(!wp)}>{wp ? 'Focus editor' : 'WordPress context'}</button><span>·</span><button onClick={() => setModal('reset')}>Reset demo</button></div></footer>
    </div>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status"><Check size={16}/>{toast}</div>
    <Modal open={modal === 'template'} onOpenChange={open => !open && setModal(null)} title="Change template" description="Try the same offer in a different layout."><div className="template-choice"><LayoutTemplate size={26}/><div><strong>{centred ? 'Fieldwork · split' : 'Fieldwork · centred'}</strong><p>{centred ? 'Image beside the offer and form.' : 'A simple, text-focused version of this design.'}</p></div></div><div className="warning-note"><Info size={18}/><span>Changing templates may move or hide content. Check the form and success screens afterwards. You can undo this change.</span></div><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Keep current template</button><button className="button primary" onClick={applyTemplate}>Apply to draft</button></div></Modal>
    <Modal open={modal === 'reset'} onOpenChange={open => !open && setModal(null)} title="Reset the demo?" description="Return to the original Fieldwork design and sample content. You can undo this."><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" onClick={() => { change(() => structuredClone(seed)); setModal(null); setScreen('form'); select('heading'); setEmail(''); notify('Demo reset. Undo is available.'); }}>Reset demo</button></div></Modal>
    <Modal open={modal === 'help'} onOpenChange={open => !open && setModal(null)} title="A few useful shortcuts" description="Use Layers to select any element with your keyboard."><div className="shortcut"><span>Undo / Redo</span><kbd>⌘ / Ctrl + Z / ⇧ Z</kbd></div><div className="shortcut"><span>Save for this session</span><kbd>⌘ / Ctrl + S</kbd></div><div className="shortcut"><span>Exit preview / select design</span><kbd>Esc</kbd></div><p className="hint">Inside a text field, Undo uses the browser’s text editing history.</p></Modal>
    <Modal open={modal === 'leave'} onOpenChange={open => !open && setModal(null)} title="You’re in the editor prototype" description="This demo is separate from your saved Optins. Open WordPress to return to the real editor."><div className="modal-actions"><button className="button" onClick={() => setModal(null)}>Keep exploring</button><a className="button primary" href="http://wconvert.local/wp-admin/admin.php?page=wconvert" target="_blank" rel="noreferrer">Open WordPress <ArrowRight size={15}/></a></div></Modal>
  </div>;
}

