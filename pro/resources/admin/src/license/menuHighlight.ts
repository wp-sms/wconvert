/**
 * WordPress marks WConvert → Campaigns as the current submenu entry on every
 * view of `admin.php?page=wconvert`, because both entries are that one page.
 * While the License page is open, License is current instead; leaving it puts
 * Campaigns back (ADR 0143, decision 7).
 *
 * @returns The undo, for an effect's cleanup.
 */
export function markLicenseCurrent(): () => void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#toplevel_page_wconvert .wp-submenu a'));
  const license = links.find((link) => link.getAttribute('href')?.endsWith('#license'));
  const campaigns = links.find((link) => link !== license && /[?&]page=wconvert$/.test(link.getAttribute('href') ?? ''));

  if (!license || !campaigns) return () => undefined;

  const set = (link: HTMLAnchorElement, on: boolean) => {
    link.classList.toggle('current', on);
    link.parentElement?.classList.toggle('current', on);
    if (on) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  };

  set(campaigns, false);
  set(license, true);

  return () => {
    set(license, false);
    set(campaigns, true);
  };
}
