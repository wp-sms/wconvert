/**
 * WordPress marks WConvert → Campaigns as the current submenu entry on every
 * view of `admin.php?page=wconvert`, because every entry — Campaigns, Help,
 * Pro's License — is that one page. While a page reached by its hash is open,
 * its own entry is current instead; leaving it puts Campaigns back
 * (ADR 0143, decision 7).
 *
 * @param hash The page's hash without `#`, as its submenu link ends: `help`.
 * @returns The undo, for an effect's cleanup.
 */
export function markSubmenuCurrent(hash: string): () => void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#toplevel_page_wconvert .wp-submenu a'));
  const page = links.find((link) => link.getAttribute('href')?.endsWith(`#${hash}`));
  const campaigns = links.find((link) => link !== page && /[?&]page=wconvert$/.test(link.getAttribute('href') ?? ''));

  if (!page || !campaigns) return () => undefined;

  const set = (link: HTMLAnchorElement, on: boolean) => {
    link.classList.toggle('current', on);
    link.parentElement?.classList.toggle('current', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  };

  set(campaigns, false);
  set(page, true);

  return () => {
    set(page, false);
    set(campaigns, true);
  };
}
