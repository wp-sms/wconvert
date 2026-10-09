/** A visitor-facing explanation shared by the live journey and the admin test. */
export function journeyNotice(root: HTMLElement, message: string): void {
  const notice = document.createElement('p');
  notice.className = 'wc-text';
  notice.textContent = message;
  const heading = root.querySelector('h1,h2,h3');
  if (heading) heading.after(notice); else root.prepend(notice);
}
