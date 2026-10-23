/** Serialized into the inert public document; no renderer, editable tree or network API. */
export function previewController(screens, designOnly = false) {
  const sample = document.getElementById('sample');
  const root = sample.attachShadow({ mode: 'closed' });
  const select = document.getElementById('screen');
  const frame = document.getElementById('frame');
  const error = document.getElementById('error');
  const formats = { popup: 'Popup', inline: 'Inside the page', floating_bar: 'Notification bar', bar: 'Notification bar', slide_in: 'Slide-in', fullscreen: 'Full screen' };
  const setDevice = device => {
    frame.classList.toggle('phone', device === 'mobile');
    for (const id of ['desktop', 'mobile']) document.getElementById(id)?.setAttribute('aria-pressed', String(id === device));
  };
  const selectLocation = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    const design = params.get('design'), screen = params.get('screen'), device = params.get('device');
    const valid = [...params.keys()].every(key => ['design', 'screen', 'device'].includes(key))
      && [...new Set(params.keys())].every(key => params.getAll(key).length === 1)
      && [...params.values()].every(value => value.length > 0)
      && (!device || ['desktop', 'mobile'].includes(device));
    const index = screens.findIndex(item => (!design || item.design === design) && (!screen || item.screen === screen));
    const invalid = !valid || index < 0;
    error.hidden = !invalid;
    error.textContent = invalid ? 'This design or screen is unavailable. Open the original preview link to start again.' : '';
    sample.hidden = invalid;
    if (invalid) { root.replaceChildren(); return; }
    if (select) select.value = String(index);
    frame.dataset.display = screens[index].type;
    sample.dataset.screen = screens[index].screen;
    sample.dataset.device = device || 'desktop';
    setDevice(device || 'desktop');
    frame.style.maxWidth = 'min(' + screens[index].width + ', 100%)';
    root.replaceChildren(document.getElementById('view-' + index).content.cloneNode(true));
    if (!designOnly) document.getElementById('format').textContent = 'Format: ' + (formats[screens[index].type] || screens[index].type);
  };
  const navigate = device => {
    const item = screens[Number(select.value)];
    location.hash = new URLSearchParams({ design: item.design, screen: item.screen, device }).toString();
    selectLocation();
  };
  select?.addEventListener('change', () => navigate(frame.classList.contains('phone') ? 'mobile' : 'desktop'));
  for (const id of ['desktop', 'mobile']) document.getElementById(id)?.addEventListener('click', () => navigate(id));
  document.getElementById('direction')?.addEventListener('click', event => {
    const rtl = sample.dir !== 'rtl';
    sample.dir = rtl ? 'rtl' : 'ltr';
    event.currentTarget.setAttribute('aria-pressed', String(rtl));
  });
  window.addEventListener('hashchange', selectLocation);
  selectLocation();
}
