<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Something the **site** would need for a registry member to be usable, and
 * which we cannot sell.
 *
 * This is the half of [[Availability]] that is not about [[Pro]]. The
 * distinction is load-bearing: `locked` is buyable from us and `unavailable`
 * is not, and collapsing the two shows a Pro customer an advertisement for Pro
 * and offers a merchant a WooCommerce licence we do not have (ADR 0026).
 *
 * A closed enum rather than a string on each member, so "no WooCommerce" has
 * one spelling and {@see SitePresence} has one thing to answer about. One case
 * in v1: CONTEXT.md's [[Availability]] entry also names WSMS, but nothing in
 * v1 needs it — a Standalone install captures phone numbers into the [[Lead]]
 * log like any other capture, and WSMS is a [[Destination]], which is optional
 * by definition.
 *
 * @since 0.1.0
 */
enum SiteDependency: string
{
    /**
     * A store. The cart [[Goal]] needs one, and a site without one is never
     * shown it — not greyed out, not explained, absent (ADR 0026).
     */
    case WooCommerce = 'woocommerce';
}
