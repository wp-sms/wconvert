import { __ } from '@wordpress/i18n';
import {
  CircleHelp, Columns2, Columns3, Heading, Image, LayoutPanelLeft, Link, Mail, Minus, Package, PanelTop, Phone,
  RectangleHorizontal, Rows3, Sparkles, Square, SquareCheck, Star, Tag, Text, TextCursorInput, Ticket, Timer, Type, User,
  type LucideIcon,
} from 'lucide-react';

/**
 * An element's kind as an icon, for the two Add surfaces — the block row's Add
 * submenus and Add element — so a long list scans by shape as well as by word
 * (ADR 0139), and for the element panel's header (ADR 0136), so a block wears
 * one glyph wherever it is named. A field reads as what it captures.
 *
 * A kind the manifest gains without an entry here draws {@link Type}: an Add
 * menu item with a plain glyph is still a working item.
 */
export function elementIcon(type: string, captures?: string | null): LucideIcon {
  if (type === 'field') return captures === 'email' ? Mail : captures === 'phone' ? Phone : captures === 'name' ? User : TextCursorInput;

  return ICONS[type] ?? Type;
}

const ICONS: Readonly<Record<string, LucideIcon>> = {
  heading: Heading, eyebrow: Type, text: Text, badge: Tag, rating: Star,
  image: Image, icon: Sparkles, divider: Minus,
  countdown: Timer, code: Ticket, products: Package,
  question: CircleHelp, consent: SquareCheck, button: RectangleHorizontal, followup: Link,
  stack: Rows3, row: Columns2, split: LayoutPanelLeft, grid: Columns3, panel: Square, media: PanelTop,
};

/** The Add surfaces' sections, in the order they are drawn. */
export const ELEMENT_SECTIONS = ['text', 'media', 'offer', 'form', 'layout'] as const;

export type ElementSection = (typeof ELEMENT_SECTIONS)[number];

/**
 * Which section an element is offered under. A leaf the manifest gains without
 * an entry here goes under Text rather than vanishing; every layout is Layout.
 */
export function elementSection(type: string, leaf: boolean): ElementSection {
  if (!leaf) return 'layout';

  return SECTIONS[type] ?? 'text';
}

const SECTIONS: Readonly<Record<string, ElementSection>> = {
  heading: 'text', eyebrow: 'text', text: 'text', badge: 'text', rating: 'text',
  image: 'media', icon: 'media', divider: 'media',
  countdown: 'offer', code: 'offer', products: 'offer',
  field: 'form', question: 'form', consent: 'form', button: 'form', followup: 'form',
};

export function elementSectionName(section: ElementSection): string {
  switch (section) {
    case 'text': return __('Text', 'wconvert');
    case 'media': return __('Media', 'wconvert');
    case 'offer': return __('Offer', 'wconvert');
    case 'form': return __('Form', 'wconvert');
    case 'layout': return __('Layout', 'wconvert');
  }
}
