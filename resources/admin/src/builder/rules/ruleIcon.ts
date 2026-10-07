import {
  ArrowDownToLine, ArrowUpToLine, Braces, CircleDot, Clock, FileText, Files, Hourglass, LayoutList, Link2, LogOut,
  MonitorSmartphone, MousePointerClick, ShieldOff, ShoppingCart, Signpost, Tag, Timer, UserCheck, Users, type LucideIcon,
} from 'lucide-react';

/** A small glyph per rule type, so a long picker scans by shape as well as by word. */
export function ruleIcon(type: string): LucideIcon {
  if (type.startsWith('cart_') || type === 'products_ready') return ShoppingCart;
  const icons: Record<string, LucideIcon> = {
    post: FileText, singular: Files, archive: LayoutList, term: Tag, url: Link2,
    logged_in: UserCheck, role: Users, device: MonitorSmartphone, time_of_day: Clock, referrer: Signpost,
    query_param: Braces, ad_blocking: ShieldOff, time_on_page: Timer, scroll_depth: ArrowDownToLine,
    inactivity: Hourglass, exit_intent: LogOut, scroll_up: ArrowUpToLine, click_element: MousePointerClick,
  };
  return icons[type] ?? CircleDot;
}
