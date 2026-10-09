import { adminSettings } from '../settings';
import type { TemplateNode, TemplateTree } from '@renderer/types';

/**
 * The site's privacy policy, resolved into a tree **at the moment it is
 * drawn** and never on the way to storage.
 *
 * ============================================================================
 * EVERY CAPTURE DESIGN IN THIS ADMIN READ "See our." (#77).
 * ============================================================================
 * `PolicyLink::into()` has two call sites and neither is on an admin path — the
 * published payload and the capture path. So nothing the admin renders ever
 * resolved the link, `link.href` was always absent, and the renderer did the
 * right thing for an unresolved link: it drew no anchor at all, never a dead
 * `#` (ADR 0032). What is left of the sentence is *"See our."*
 *
 * That is one stale card on three. It is forty on the picker this ships with,
 * and the builder's `SettingsPanel` labels the href field *"leave empty for
 * your privacy policy"* — so the preview beside the label contradicts it.
 *
 * ============================================================================
 * IT RESOLVES WHERE IT DRAWS, WHICH IS THE ONLY PLACE IT CAN.
 * ============================================================================
 * The obvious fix is to resolve it server-side on the routes the admin reads,
 * the way the two existing call sites do. **It is the wrong fix, and it would
 * be a data bug rather than a display one.** `GET /optins/{id}` hands the
 * builder a `config` it edits and PATCHes straight back, and
 * `/playbooks/prefill` hands the creation flow a config it POSTs; `href` is a
 * content key the vocabulary keeps, so an href baked in on the way out is an
 * href STORED on the way back. ADR 0032 is explicit that this is resolved per
 * request and never frozen at publish, precisely so a merchant who moves their
 * policy page does not keep serving last month's URL.
 *
 * So the admin does what ADR 0032 already says the renderer does: **owns the
 * link at the render**. This is called immediately before `mount()` and its
 * result is thrown away with the render — nothing that reaches a save has ever
 * been through it.
 *
 * A second spelling of a PHP rule, which this project refuses by default
 * (ADR 0019) — and takes here for the same reason `convertingActOf` mirrors
 * `ConvertingAct::offeredIn()`: the two runtimes cannot defer to each other,
 * the rule is four lines, and `tests/js/policy-link-parity.test.ts` reads the
 * same fixture `PolicyLinkTest` does so they cannot drift.
 */

/**
 * The site's policy URL, or undefined where none is configured.
 *
 * It arrives beside the bundle rather than through a route, because it is one
 * site-wide string every screen in this admin wants and `get_privacy_policy_url()`
 * is identical for every reader of the page (`AdminMenu`). A route for it would
 * be a request per screen for a value that cannot change while the page is
 * open.
 */
export const policyUrl = (): string | undefined => {
  const url = adminSettings()?.policyUrl;

  return typeof url === 'string' && url !== '' ? url : undefined;
};

/**
 * One tree, with every link the SITE has to complete filled in.
 *
 * The rule is `PolicyLink::resolve()`'s, exactly: **in consent wording or fine
 * print, a link with a label and no href** is asking for the one destination
 * only the site can name, and a link that names its own was written by the
 * merchant. A hrefless link anywhere else is unfinished, and stays so
 * ({@link asksForPolicy}, ADR 0133).
 *
 * Returns the tree UNCHANGED — by identity — where there is nothing to do, so a
 * `Preview` that remounts on `template` identity does not remount because this
 * ran.
 */
export function withPolicyLink(tree: TemplateTree, url: string | undefined): TemplateTree {
  if (url === undefined) {
    return tree;
  }

  const steps = tree.steps.map((step) => ({ ...step, content: resolve(step.content, url) }));

  return steps.every((step, index) => step === tree.steps[index]) ? tree : { ...tree, steps };
}

/** Every key a node may keep children under. `split` is the one with two. */
const CHILD_KEYS = ['children', 'start', 'end'] as const;

function resolve(node: TemplateNode, url: string): TemplateNode {
  const asked = node as { link?: { label?: string; href?: string } };
  const link = asked.link;
  const wants =
    asksForPolicy(node) &&
    link !== undefined &&
    typeof link.label === 'string' &&
    link.label !== '' &&
    typeof link.href !== 'string';

  let next = wants ? { ...node, link: { ...link, href: url } } : node;

  for (const key of CHILD_KEYS) {
    const children = (next as Record<string, unknown>)[key];

    if (!Array.isArray(children)) {
      continue;
    }

    const resolved = (children as TemplateNode[]).map((child) => resolve(child, url));

    if (resolved.some((child, index) => child !== children[index])) {
      next = { ...next, [key]: resolved };
    }
  }

  return next;
}

/**
 * Whether this node is one of the two sentences a policy link belongs in:
 * consent wording, or text whose Role is fine print. `PolicyLink::asksForPolicy()`
 * is the other spelling.
 */
export function asksForPolicy(node: TemplateNode): boolean {
  return node.type === 'consent' || (node.type === 'text' && (node as { role?: string }).role === 'fine_print');
}
