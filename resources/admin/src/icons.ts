import { Mail, Plug, Send, Users, type LucideIcon } from 'lucide-react';

/**
 * The lucide icon a name from PHP resolves to.
 *
 * **Icons come from lucide, not dashicons** (ADR 0036) — dashicons is
 * WordPress chrome and ADR 0035 stopped rendering it. The one dashicon that
 * stays is the menu icon in WordPress's own sidebar, which is WordPress's
 * surface and not ours.
 *
 * The registry in PHP names an icon; this is where the name becomes a
 * component, because lucide is a front-end dependency and
 * {@see \WConvert\Destination\DestinationType::icon()} is not a place to hold
 * one. It is a map rather than a dynamic lookup into lucide's whole export so
 * the icons that ship are the icons that are named — the alternative pulls
 * every glyph lucide has into the bundle to serve four of them.
 *
 * **An unknown name draws the fallback rather than nothing.** A [[Destination]]
 * registered by [[Pro]] against a lucide release this admin predates still
 * gets a row a merchant can read.
 */
const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  plug: Plug,
  send: Send,
  users: Users,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Plug;
}
