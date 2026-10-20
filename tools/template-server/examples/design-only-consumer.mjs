/**
 * Website-owned controls. Pass a validated build-time design from either public
 * array. reviewedSnapshotUrl must come from the website's reviewed snapshot
 * manifest, matched to this design revision; never derive it from a remote URL.
 * serviceAvailable is decided by a same-origin website health/fetch layer.
 */
export function mountDesignPreview(container, design, { serviceAvailable = false, reviewedSnapshotUrl } = {}) {
  const doc = container.ownerDocument;
  let screen = design.screens[0]?.id, device = 'desktop';
  const heading = doc.createElement('h2'); heading.textContent = design.name;
  const disclosure = doc.createElement('p');
  disclosure.textContent = 'Read-only sample. Review your offer, destinations and campaign dates before publishing.';
  const label = doc.createElement('label'); label.textContent = 'Screen ';
  const select = doc.createElement('select');
  for (const item of design.screens) {
    const option = doc.createElement('option'); option.value = item.id; option.textContent = item.label; select.append(option);
  }
  label.append(select);
  const desktop = doc.createElement('button'), mobile = doc.createElement('button');
  desktop.type = mobile.type = 'button'; desktop.textContent = 'Desktop'; mobile.textContent = 'Mobile';
  const frame = doc.createElement('iframe');
  frame.title = 'Preview: ' + design.name;
  frame.setAttribute('sandbox', 'allow-scripts'); frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'width:100%;height:min(75vh,900px);border:0;display:block;background:transparent';
  const message = doc.createElement('p'); message.setAttribute('role', 'status');
  container.replaceChildren(heading, disclosure, label, desktop, mobile, message, frame);
  function render() {
    desktop.setAttribute('aria-pressed', String(device === 'desktop'));
    mobile.setAttribute('aria-pressed', String(device === 'mobile'));
    const selected = design.screens.find(item => item.id === screen);
    const capable = design.preview_status === 'available' && design.design_only_embed?.version === 1 && selected?.design_only_embed_url;
    const supplied = serviceAvailable && capable ? selected.design_only_embed_url : reviewedSnapshotUrl;
    select.disabled = desktop.disabled = mobile.disabled = !(serviceAvailable && capable);
    frame.hidden = !supplied; message.hidden = Boolean(supplied);
    message.textContent = supplied ? '' : 'This design’s preview is being prepared.';
    if (!supplied) { frame.removeAttribute('src'); return; }
    const url = new URL(supplied, doc.baseURI);
    if (serviceAvailable && capable) {
      // Use the supplied per-screen URL; URLSearchParams preserves slash IDs.
      const params = new URLSearchParams(url.hash.slice(1)); params.set('device', device); url.hash = params.toString();
      frame.src = url.href;
    } else {
      // Snapshots have their own reviewed presentation contract. Do not assume
      // the service's fragment protocol applies to a website snapshot.
      frame.src = url.href;
    }
  }
  select.addEventListener('change', () => { screen = select.value; render(); });
  desktop.addEventListener('click', () => { device = 'desktop'; render(); });
  mobile.addEventListener('click', () => { device = 'mobile'; render(); });
  render();
  return { setServiceAvailable(available) { serviceAvailable = available; render(); } };
}
