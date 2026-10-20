/** Renderer-owned geometry; never takes template markup or remote assets. */
export function strokeIcon(pathData: string, className: string): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // An icon is never the only thing that says something, so it is hidden from
  // assistive technology rather than given a name the merchant did not write.
  // A tick beside "Free shipping" read out as "check, Free shipping" is noise.
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  path.setAttribute('d', pathData);
  svg.append(path);

  return svg;
}

/** Shared controls do not inherit font metrics or accept merchant icon paths. */
export function controlIcon(name: 'close' | 'chevron'): SVGElement {
  return strokeIcon(name === 'close' ? 'm6 6 12 12M18 6 6 18' : 'm6 9 6 6 6-6', 'wc-control-icon');
}
