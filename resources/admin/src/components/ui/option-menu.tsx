import * as React from "react"
import { __, sprintf } from "@wordpress/i18n"
import { Check, ChevronRight, Info, Lock, Plug, Search, SearchX, type LucideIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive, Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { useDirection } from "@/hooks/useDirection"
import { InfoTip } from "@/shell/InfoTip"
import { PopoverContent } from "./popover"
import { DropdownMenuContent, DropdownMenuSubContent } from "./dropdown-menu"
import { TooltipContent } from "./tooltip"

/**
 * **One option menu for every rich list in the admin** (ADR 0139): a heading,
 * an icon, a name, a hint only where the name does not say it, presets as
 * chips, and a refusal that says why. Add rule, Add element, the block and
 * screen ⋯ menus, the swap menu and the campaign row's ⋯ were five copies of
 * that list, each with its own keyboard and its own idea of a disabled row.
 *
 * ============================================================================
 * ONE SET OF PARTS, TWO MODES, AND THE CONTAINER PICKS THE MODE.
 * ============================================================================
 * - **List mode**, inside {@link OptionListContent}: a searchable list in a
 *   popover. Items are plain buttons, sections are `role="group"` named by
 *   their heading, and {@link useListNavigation} owns the arrow keys.
 * - **Menu mode**, inside {@link OptionMenuContent}: the same parts become
 *   Radix menu items, and Radix owns the keyboard and typeahead.
 *
 * A caller writes `OptionGroup` and `OptionItem` either way and never says
 * which; the content it sits in does.
 *
 * ============================================================================
 * A REFUSED ITEM STAYS FOCUSABLE, AND ITS REASON IS ITS DESCRIPTION.
 * ============================================================================
 * `aria-disabled`, never `disabled` (GUIDELINES §6): a disabled menu item is
 * skipped by the keyboard, and the reason goes with it. The row shows a short
 * reason and the full sentence is in ⓘ — an `InfoTip` beside the item in list
 * mode, and a tooltip on the item itself in menu mode, because a button inside
 * a `menuitem` is pressed as the item and closes the menu. Both modes describe
 * the item by the full sentence, so a screen reader hears it either way.
 */

type Mode = "list" | "menu"

const ModeContext = React.createContext<Mode>("list")
const SearchContext = React.createContext<React.RefObject<HTMLInputElement | null> | null>(null)

/** What marks an arrow-key stop in list mode: items, chips, Clear search. */
const STOP = "[data-option-nav]"

/**
 * ArrowUp/Down, Home and End through a list's stops, and ArrowUp from the first
 * one back to the search. Lifted from the rule picker, which was the one list
 * that had it; Add element and the phone picker each wrote their own or none.
 *
 * Keys typed into another field — a number in a value pill's popover — are
 * left alone, because there they change the value.
 */
export function useListNavigation(
  list: React.RefObject<HTMLElement | null>,
  search?: React.RefObject<HTMLInputElement | null>,
) {
  return React.useCallback((event: { key: string; target: EventTarget | null; preventDefault(): void }) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const target = event.target as HTMLElement
    const onSearch = search?.current != null && target === search.current
    if (onSearch && !["ArrowDown", "ArrowUp"].includes(event.key)) return
    if (!onSearch && target.matches("input, select, textarea")) return
    const stops = [...(list.current?.querySelectorAll<HTMLElement>(STOP) ?? [])]
    if (stops.length === 0) return
    let at = stops.indexOf(target)
    // An ⓘ beside an item is not a stop; the keys carry on from the item before it.
    if (at < 0 && !onSearch && list.current?.contains(target)) {
      at = stops.filter(stop => stop.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).length - 1
    }
    const next = event.key === "ArrowDown" ? Math.min(at + 1, stops.length - 1)
      : event.key === "ArrowUp" ? (at < 0 && onSearch ? stops.length - 1 : at - 1)
        : event.key === "Home" ? 0 : stops.length - 1
    event.preventDefault()
    if (next < 0) (search?.current ?? stops[0])?.focus()
    else stops[next]?.focus()
  }, [list, search])
}

/**
 * The popover a list-mode menu sits in: no padding, a width that fits a phone,
 * and focus on the search — or the first item where there is none — as it
 * opens.
 */
function OptionListContent({
  className,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      className={cn(
        "wconvert-option-menu w-[min(380px,calc(100vw-32px))] max-h-(--radix-popover-content-available-height) overflow-hidden p-0",
        className
      )}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        const content = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
        content?.querySelector<HTMLElement>(`input[type="search"], ${STOP}`)?.focus()
      }}
      {...props}
    />
  )
}

/**
 * The body of a list-mode menu: an optional search, the list, and an optional
 * footer for controls (a value pill's Custom… fields). Owns the arrow keys.
 */
function OptionList({
  search,
  header,
  footer,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  search?: {
    value: string
    onChange: (value: string) => void
    label: string
    placeholder: string
  }
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  const body = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const navigate = useListNavigation(list, searchRef)

  // A listener rather than `onKeyDown`, so the body stays a plain container
  // and not a focusless element pretending to take keys.
  React.useEffect(() => {
    const node = body.current
    node?.addEventListener("keydown", navigate)
    return () => node?.removeEventListener("keydown", navigate)
  }, [navigate])

  return (
    <ModeContext.Provider value="list">
      <SearchContext.Provider value={searchRef}>
        <div ref={body} className={cn("wconvert-option-menu__body", className)} {...props}>
          {header}
          {search && (
            <div className="wconvert-option-menu__search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={search.value}
                aria-label={search.label}
                placeholder={search.placeholder}
                onChange={(event) => search.onChange(event.target.value)}
              />
            </div>
          )}
          <div ref={list} className="wconvert-option-menu__list">
            {children}
          </div>
          {footer}
        </div>
      </SearchContext.Provider>
    </ModeContext.Provider>
  )
}

/** A dropdown menu's content, drawn as an option menu. Radix owns the keys. */
function OptionMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <ModeContext.Provider value="menu">
      <TooltipPrimitive.Provider delayDuration={300}>
        <DropdownMenuContent
          className={cn("wconvert-option-menu wconvert-option-menu--menu w-[min(320px,calc(100vw-24px))] p-1", className)}
          {...props}
        >
          {children}
        </DropdownMenuContent>
      </TooltipPrimitive.Provider>
    </ModeContext.Provider>
  )
}

/**
 * A submenu: its trigger is an option item with a chevron that points the way
 * it opens, which is the trailing side in either direction.
 */
function OptionSub({
  icon: Icon,
  name,
  hint,
  className,
  children,
}: {
  icon?: LucideIcon
  name: React.ReactNode
  hint?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger className="wconvert-option-menu__item" data-sub="" data-icon={Icon ? "" : undefined}>
        {Icon ? <Icon aria-hidden="true" /> : null}
        <span className="wconvert-option-menu__text">
          <span className="wconvert-option-menu__name">{name}</span>
          {hint ? <span className="wconvert-option-menu__hint">{hint}</span> : null}
        </span>
        <span className="wconvert-option-menu__trail">
          <ChevronRight aria-hidden="true" className="rtl:-scale-x-100" />
        </span>
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuSubContent
        className={cn("wconvert-option-menu wconvert-option-menu--menu w-[min(320px,calc(100vw-24px))] p-1", className)}
      >
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuPrimitive.Sub>
  )
}

const GROUP_ICONS = { lock: Lock, plug: Plug } as const

/**
 * A section. The heading is sentence case and sticks while the list scrolls;
 * `tone="dependency"` is the amber of a plugin the site is missing, and a lock
 * is grey because it costs money (GUIDELINES §14).
 */
function OptionGroup({
  heading,
  icon,
  tone,
  tip,
  note,
  noteTip,
  children,
}: {
  heading?: string | null
  icon?: keyof typeof GROUP_ICONS
  tone?: "dependency"
  tip?: string | null
  note?: string | null
  noteTip?: string | null
  children: React.ReactNode
}) {
  const mode = React.useContext(ModeContext)
  const id = React.useId()
  const Icon = icon ? GROUP_ICONS[icon] : null
  const about = heading ? sprintf(/* translators: %s: a menu section, e.g. "With WConvert Pro". */ __("About %s", "wconvert"), heading) : __("More about this", "wconvert")
  const tipFor = (text: string, label: string) =>
    mode === "list" ? <InfoTip label={label}>{text}</InfoTip> : <TipGlyph tip={text} />
  const described = [tip ? `${id}-tip` : null, noteTip ? `${id}-note` : null].filter(Boolean).join(" ") || undefined
  const head = heading ? (
    <p className="wconvert-option-menu__heading" data-tone={tone}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      <span>{heading}</span>
      {tip ? tipFor(tip, about) : null}
    </p>
  ) : null
  const noteLine = note ? (
    <p className="wconvert-option-menu__note">
      <span>{note}</span>
      {noteTip ? tipFor(noteTip, sprintf(/* translators: %s: a short note, e.g. "Up to 7 screens". */ __("About %s", "wconvert"), note)) : null}
    </p>
  ) : null
  // Menu mode has no reachable ⓘ, so the tips are the group's description.
  const spoken = mode === "menu" ? (
    <>
      {tip ? <span id={`${id}-tip`} className="sr-only">{tip}</span> : null}
      {noteTip ? <span id={`${id}-note`} className="sr-only">{noteTip}</span> : null}
    </>
  ) : null

  if (mode === "menu") {
    return (
      <DropdownMenuPrimitive.Group className="wconvert-option-menu__group" aria-label={heading ?? undefined} aria-describedby={described} data-tone={tone}>
        {head}
        {noteLine}
        {spoken}
        {children}
      </DropdownMenuPrimitive.Group>
    )
  }

  return (
    <div role="group" className="wconvert-option-menu__group" aria-label={heading ?? undefined} data-tone={tone}>
      {head}
      {noteLine}
      {children}
    </div>
  )
}

export interface OptionChip {
  readonly label: string
  /** A fuller name where the chip's own words lean on the item's. */
  readonly ariaLabel?: string
  /** `Custom…`, drawn dashed as the way out of the presets. */
  readonly custom?: boolean
  readonly onSelect: () => void
}

export interface OptionItemProps {
  readonly icon?: LucideIcon
  readonly name: string
  /** A fuller accessible name, where the visible one leans on its menu (“Add follow-up” for which choice). */
  readonly label?: string
  /** Shown under the name. Pass none where the name already says it. */
  readonly hint?: string | null
  /** The longer help, in ⓘ. */
  readonly tip?: string | null
  /** Why it cannot be chosen here: a few words on screen, the sentence in ⓘ. */
  readonly refused?: { readonly short: string; readonly reason: string } | null
  /** Presets offered under the item, each its own stop. */
  readonly chips?: readonly OptionChip[]
  readonly checked?: boolean
  readonly destructive?: boolean
  /** At the row's end, e.g. a count. */
  readonly trail?: React.ReactNode
  /** Menu mode: the item is this link. */
  readonly href?: string
  /** Without one (and without chips) the item is a line of text, e.g. a locked rule. */
  readonly onSelect?: () => void
  /**
   * BUSY, not refused: the real attribute, out of the way until the work ends.
   * A refusal has a reason and stays focusable; this has neither.
   */
  readonly disabled?: boolean
}

/** One option. See the file's docblock for what refused means in each mode. */
function OptionItem({
  icon: Icon,
  name,
  label,
  hint,
  tip,
  refused,
  chips,
  checked,
  destructive,
  trail,
  href,
  onSelect,
  disabled,
}: OptionItemProps) {
  const mode = React.useContext(ModeContext)
  const id = React.useId()
  const shown = refused ? refused.short : hint
  const reason = refused && refused.reason !== refused.short ? refused.reason : null
  const more = reason ?? (refused ? null : tip)
  const leading = Icon ? <Icon aria-hidden="true" /> : checked !== undefined ? (checked ? <Check aria-hidden="true" /> : <span aria-hidden="true" />) : null
  const text = (
    <span className="wconvert-option-menu__text">
      <span id={`${id}-name`} className="wconvert-option-menu__name">{name}</span>
      {shown ? <span id={`${id}-hint`} className="wconvert-option-menu__hint">{shown}</span> : null}
    </span>
  )
  const describedBy = refused
    ? `${id}-reason`
    : [shown ? `${id}-hint` : null, mode === "menu" && tip ? `${id}-tip` : null].filter(Boolean).join(" ") || undefined
  const spoken = (
    <>
      {refused ? <span id={`${id}-reason`} className="sr-only">{refused.reason}</span> : null}
      {mode === "menu" && !refused && tip ? <span id={`${id}-tip`} className="sr-only">{tip}</span> : null}
    </>
  )
  const trailing = trail || (mode === "menu" && more) ? (
    <span className="wconvert-option-menu__trail">
      {trail}
      {mode === "menu" && more ? <Info aria-hidden="true" className="wconvert-option-menu__glyph" /> : null}
    </span>
  ) : null
  const look = {
    "data-refused": refused ? "" : undefined,
    "data-destructive": destructive ? "" : undefined,
    "data-icon": leading ? "" : undefined,
  }

  if (mode === "menu" && onSelect === undefined && href === undefined && !refused && checked === undefined) {
    // Nothing to do: a line under its heading (a locked upsell), never a dead item.
    return (
      <div className="wconvert-option-menu__item" data-static="" {...look}>
        {leading}{text}{trailing}
      </div>
    )
  }

  if (mode === "menu") {
    const item = (
      <DropdownMenuPrimitive.Item
        className="wconvert-option-menu__item"
        textValue={name}
        disabled={disabled}
        // Radix spreads these over its own `role="menuitem"`, so an undefined
        // role would erase it rather than leave it.
        {...(checked !== undefined ? { role: "menuitemradio", "aria-checked": checked } : {})}
        aria-disabled={refused ? true : undefined}
        aria-label={label}
        aria-labelledby={label ? undefined : `${id}-name`}
        aria-describedby={describedBy}
        asChild={href !== undefined && !refused}
        onSelect={(event) => {
          if (refused) {
            event.preventDefault()
            return
          }
          onSelect?.()
        }}
        {...look}
      >
        {href !== undefined && !refused ? (
          <a href={href}>{leading}{text}{trailing}{spoken}</a>
        ) : (
          <>{leading}{text}{trailing}{spoken}</>
        )}
      </DropdownMenuPrimitive.Item>
    )

    return more ? <ItemTip tip={more}>{item}</ItemTip> : item
  }

  // List mode.
  const interactive = onSelect !== undefined && !chips
  const head = interactive ? (
    <button
      type="button"
      className="wconvert-option-menu__item"
      data-option-nav=""
      disabled={disabled}
      aria-label={label}
      aria-labelledby={label ? undefined : `${id}-name`}
      aria-describedby={describedBy}
      aria-disabled={refused ? true : undefined}
      aria-current={checked ? "true" : undefined}
      onClick={() => {
        if (!refused) onSelect?.()
      }}
      {...look}
    >
      {leading}{text}{trailing}{spoken}
    </button>
  ) : (
    <p className="wconvert-option-menu__item" data-static="" aria-hidden={chips ? true : undefined} {...look}>
      {leading}{text}{trailing}
    </p>
  )

  return (
    <div
      className="wconvert-option-menu__option"
      role={chips ? "group" : undefined}
      aria-label={chips ? name : undefined}
      data-tipped={more ? "" : undefined}
    >
      {head}
      {more ? (
        <InfoTip label={sprintf(/* translators: %s: a menu item, e.g. "Content archive". */ refused ? __("Why: %s", "wconvert") : __("About %s", "wconvert"), name)}>
          {more}
        </InfoTip>
      ) : null}
      {chips ? (
        <div className="wconvert-option-menu__chips">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="wconvert-option-menu__chip"
              data-option-nav=""
              data-custom={chip.custom ? "" : undefined}
              aria-label={chip.ariaLabel}
              onClick={chip.onSelect}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Menu mode's ⓘ: the item itself is the trigger, on hover or keyboard focus. */
function ItemTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  const dir = useDirection()

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={dir === "rtl" ? "left" : "right"} sideOffset={6} className="wconvert-option-menu__tip">
        {tip}
      </TooltipContent>
    </TooltipPrimitive.Root>
  )
}

/** A heading's ⓘ in menu mode, where nothing in a heading can take focus. */
function TipGlyph({ tip }: { tip: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span className="wconvert-option-menu__glyph" aria-hidden="true"><Info /></span>
      </TooltipPrimitive.Trigger>
      <TooltipContent sideOffset={6} className="wconvert-option-menu__tip">{tip}</TooltipContent>
    </TooltipPrimitive.Root>
  )
}

function OptionSeparator() {
  const mode = React.useContext(ModeContext)

  return mode === "menu"
    ? <DropdownMenuPrimitive.Separator className="wconvert-option-menu__sep" />
    : <div role="separator" className="wconvert-option-menu__sep" />
}

/** Nothing matched: say so, and give the way back. */
function OptionEmpty({ what, onClear }: { what: string; onClear: () => void }) {
  const search = React.useContext(SearchContext)

  return (
    <div role="status" className="wconvert-option-menu__empty">
      <SearchX aria-hidden="true" />
      <b>{sprintf(/* translators: %s: what was searched for, e.g. "rules" or "elements". */ __("No matching %s", "wconvert"), what)}</b>
      <span>{__("Try another word, or", "wconvert")}</span>
      <button type="button" data-option-nav="" onClick={() => { onClear(); search?.current?.focus() }}>
        {__("Clear search", "wconvert")}
      </button>
    </div>
  )
}

export {
  OptionListContent,
  OptionList,
  OptionMenuContent,
  OptionSub,
  OptionGroup,
  OptionItem,
  OptionSeparator,
  OptionEmpty,
}
