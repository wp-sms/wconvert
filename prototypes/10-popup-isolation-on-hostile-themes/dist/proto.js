(() => {
  // src/template.js
  var MARKUP = `
<div class="wcv-overlay" part="overlay">
  <div class="wcv-modal" role="dialog" aria-modal="true" aria-labelledby="wcv-t" aria-describedby="wcv-b">
    <button class="wcv-close" type="button" aria-label="Close">&#215;</button>
    <h2 class="wcv-title" id="wcv-t">Get 10% off your first order</h2>
    <p class="wcv-body" id="wcv-b">Join 12,000 readers. One email a week, no noise.</p>
    <form class="wcv-form" novalidate>
      <input class="wcv-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
      <button class="wcv-submit" type="submit">Send me the code</button>
    </form>
    <p class="wcv-fine">No spam. Unsubscribe any time.</p>
  </div>
</div>`;
  var CSS = `
@font-face {
  font-family: 'WCV Fraunces';
  src: url('@FONT@') format('woff2');
  font-weight: 700;
  font-display: block;
}
/* Nothing load-bearing lives on the root itself. On a shadow host that is not a
   nicety: a normal declaration in the OUTER tree beats a normal :host rule, so
   anything the design depends on here is a rule the theme is allowed to win. */
@R@ {
  display: block;
}
@R@ .wcv-overlay {
  position: fixed;
  inset: 0;
  z-index: @Z@;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 14, 20, 0.62);
  padding: 24px;
  box-sizing: border-box;
  /* The base every descendant inherits from. Declared explicitly so the design
     never depends on what the surrounding document happens to be inheriting --
     without this, "leakage" and "the reference has no theme" are the same delta. */
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: normal;
  color: rgb(24, 27, 34);
  text-align: start;
  text-transform: none;
}
@R@ .wcv-modal {
  position: relative;
  box-sizing: border-box;
  width: 440px;
  max-width: 100%;
  padding: 36px 34px 28px;
  background: rgb(255, 255, 255);
  border: 0 solid transparent;
  border-radius: 14px;
  box-shadow: rgba(9, 11, 16, 0.28) 0px 24px 64px 0px;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: rgb(24, 27, 34);
  text-align: start;
  letter-spacing: normal;
  margin: 0;
}
@R@ .wcv-close {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
  border: 0 solid transparent;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0);
  color: rgb(120, 126, 138);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 20px;
  font-weight: 400;
  line-height: 32px;
  text-align: center;
  text-transform: none;
  letter-spacing: normal;
  cursor: pointer;
  box-shadow: none;
  box-sizing: border-box;
}
@R@ .wcv-title {
  margin: 0 0 10px;
  padding: 0;
  font-family: 'WCV Fraunces', Georgia, serif;
  font-size: 27px;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(17, 19, 25);
  text-transform: none;
  letter-spacing: -0.4px;
  text-align: start;
}
@R@ .wcv-body {
  margin: 0 0 22px;
  padding: 0;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.55;
  color: rgb(88, 94, 106);
  text-align: start;
  letter-spacing: normal;
}
@R@ .wcv-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0 solid transparent;
}
@R@ .wcv-input {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  margin: 0;
  border: 1px solid rgb(206, 211, 221);
  border-radius: 9px;
  background: rgb(255, 255, 255);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 44px;
  color: rgb(24, 27, 34);
  text-align: start;
  text-transform: none;
  letter-spacing: normal;
  box-shadow: none;
  outline-offset: 0px;
  -webkit-appearance: none;
  appearance: none;
}
@R@ .wcv-submit {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 18px;
  margin: 0;
  border: 0 solid transparent;
  border-radius: 9px;
  background: rgb(29, 58, 214);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 46px;
  color: rgb(255, 255, 255);
  text-align: center;
  text-transform: none;
  letter-spacing: 0.1px;
  cursor: pointer;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
}
@R@ .wcv-fine {
  margin: 14px 0 0;
  padding: 0;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: rgb(140, 146, 158);
  text-align: center;
  text-transform: none;
  letter-spacing: normal;
}`;
  var PROBED = [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-transform",
    "text-align",
    "color",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-radius",
    "padding-top",
    "padding-left",
    "margin-top",
    "margin-bottom",
    "box-sizing",
    "box-shadow",
    "width",
    "height",
    "display",
    "position",
    "text-decoration-line",
    "opacity",
    "visibility",
    "direction",
    "appearance"
  ];
  var ELEMENTS = [
    ".wcv-overlay",
    ".wcv-modal",
    ".wcv-close",
    ".wcv-title",
    ".wcv-body",
    ".wcv-form",
    ".wcv-input",
    ".wcv-submit",
    ".wcv-fine"
  ];

  // src/isolate.js
  var NS = "wcv-x9f2";
  var MODES = {
    // closed shadow root, reset with `all: initial` on the host. The naive version.
    "shadow": { kind: "shadow", shadowMode: "closed", reset: "all-initial" },
    // same, but explicitly re-inheriting writing direction
    "shadow-dir": { kind: "shadow", shadowMode: "closed", reset: "all-initial-dir" },
    // ...and with @font-face hoisted out to the document, where it actually applies
    "shadow-fixed": { kind: "shadow", shadowMode: "closed", reset: "all-initial-dir", hoistFont: true },
    // ...and with the host reset made `!important`, which is the only thing an outer
    // -tree rule cannot beat. This is the candidate answer.
    "shadow-armour": { kind: "shadow", shadowMode: "closed", reset: "all-initial-dir-imp", hoistFont: true },
    // no reset at all -- is the shadow boundary alone enough?
    "shadow-bare": { kind: "shadow", shadowMode: "closed", reset: "none" },
    // open shadow root -- does `closed` actually buy anything?
    "shadow-open": { kind: "shadow", shadowMode: "open", reset: "all-initial" },
    // namespaced class + the strongest non-shadow reset available
    "scoped": { kind: "scoped", important: false },
    // ...and the same with `!important` on every single declaration
    "scoped-imp": { kind: "scoped", important: true },
    // total isolation, worst ergonomics
    "iframe": { kind: "iframe" },
    // Escape a `body { transform }` by hanging off <html> instead. Cheap, and it
    // does nothing about a transform on <html> itself.
    "shadow-html": { kind: "shadow", shadowMode: "closed", reset: "all-initial-dir-imp", hoistFont: true, appendTo: "html" },
    // The TOP LAYER. A modal <dialog> is promoted out of the normal painting order
    // entirely: its containing block is the viewport, not a transformed ancestor,
    // and it paints above every z-index on the page without competing on z-index.
    "dialog": { kind: "shadow", shadowMode: "closed", reset: "all-initial-dir-imp", hoistFont: true, dialog: true }
  };
  var FONT_FACE = /@font-face\s*\{[^}]*\}/g;
  function zIndex() {
    return String(window.WCV10_Z || 2147483646);
  }
  function fontUrl() {
    return window.WCV10_FONT || "./assets/fraunces.woff2";
  }
  function bang(css) {
    const faces = [];
    const body = css.replace(FONT_FACE, (m) => {
      faces.push(m);
      return `/*F${faces.length - 1}*/`;
    });
    const out = body.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g, (m, prop, val) => {
      if (/!important/.test(val)) return m;
      return `${prop}: ${val.trim()} !important;`;
    });
    return out.replace(/\/\*F(\d+)\*\//g, (m, i) => faces[Number(i)]);
  }
  function render(rootSel, cfg) {
    let css = CSS.replace(/@R@/g, rootSel).replace(/@FONT@/g, fontUrl()).replace(/@Z@/g, zIndex());
    let reset = "";
    if (cfg.hoistFont) {
      const faces = css.match(FONT_FACE) || [];
      css = css.replace(FONT_FACE, "");
      if (faces.length && !document.getElementById("wcv-faces")) {
        const s = document.createElement("style");
        s.id = "wcv-faces";
        s.textContent = faces.join("\n");
        document.head.appendChild(s);
      }
    }
    if (cfg.kind === "shadow") {
      if (cfg.reset === "all-initial") reset = `${rootSel} { all: initial; }`;
      if (cfg.reset === "all-initial-dir") reset = `${rootSel} { all: initial; direction: inherit; }`;
      if (cfg.reset === "all-initial-dir-imp") {
        reset = `${rootSel} { all: initial !important; direction: inherit !important; display: block !important;` + (cfg.dialog ? " position: fixed !important; inset: 0 !important; width: auto !important; height: auto !important; max-width: none !important; max-height: none !important; overflow: visible !important;" : "") + " }" + (cfg.dialog ? `
${rootSel}::backdrop { background: transparent; }` : "");
      }
    } else if (cfg.kind === "scoped") {
      reset = `${rootSel}, ${rootSel} *, ${rootSel} *::before, ${rootSel} *::after { all: revert; }`;
    }
    let out = reset + "\n" + css;
    if (cfg.important) out = bang(out);
    return out;
  }
  function mount(modeName, opts) {
    const cfg = MODES[modeName];
    if (!cfg) throw new Error("unknown mode " + modeName);
    const into = opts && opts.into;
    if (cfg.kind === "shadow") {
      const host = document.createElement("div");
      host.setAttribute("data-wcv", "");
      let outer = host;
      if (cfg.dialog) {
        outer = document.createElement("dialog");
        outer.setAttribute("data-wcv", "");
        const armour = {
          display: "block",
          position: "fixed",
          inset: "0",
          margin: "0",
          padding: "0",
          border: "0",
          background: "transparent",
          width: "auto",
          height: "auto",
          "max-width": "none",
          "max-height": "none",
          overflow: "visible"
        };
        for (const k in armour) outer.style.setProperty(k, armour[k], "important");
        outer.appendChild(host);
        if (!document.getElementById("wcv-backdrop")) {
          const s = document.createElement("style");
          s.id = "wcv-backdrop";
          s.textContent = "dialog[data-wcv]::backdrop{background:transparent}";
          document.head.appendChild(s);
        }
      }
      (into || (cfg.appendTo === "html" ? document.documentElement : document.body)).appendChild(outer);
      const root = host.attachShadow({ mode: cfg.shadowMode });
      root.innerHTML = `<style>${render(":host", cfg)}</style>${MARKUP}`;
      if (cfg.dialog && !into) outer.showModal();
      return {
        kind: "shadow",
        root,
        host: outer,
        shadowHost: host,
        dialog: !!cfg.dialog,
        query: (s) => root.querySelector(s),
        queryAll: (s) => Array.from(root.querySelectorAll(s)),
        destroy: () => {
          if (cfg.dialog && outer.open) outer.close();
          outer.remove();
        }
      };
    }
    if (cfg.kind === "scoped") {
      const host = document.createElement("div");
      host.className = NS;
      host.setAttribute("data-wcv", "");
      const style = document.createElement("style");
      style.textContent = render("." + NS, cfg);
      document.head.appendChild(style);
      host.innerHTML = MARKUP;
      (into || document.body).appendChild(host);
      return {
        kind: "scoped",
        root: host,
        host,
        query: (s) => host.querySelector(s),
        queryAll: (s) => Array.from(host.querySelectorAll(s)),
        destroy: () => {
          host.remove();
          style.remove();
        }
      };
    }
    const frame = document.createElement("iframe");
    frame.setAttribute("data-wcv", "");
    frame.setAttribute("title", "Get 10% off your first order");
    frame.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:" + zIndex() + ";background:transparent;color-scheme:normal;";
    frame.setAttribute("allowtransparency", "true");
    const dir = document.documentElement.getAttribute("dir") || "ltr";
    const lang = document.documentElement.getAttribute("lang") || "en";
    frame.srcdoc = `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;}${render("html", cfg)}</style></head><body>${MARKUP}</body></html>`;
    (into || document.body).appendChild(frame);
    return {
      kind: "iframe",
      root: frame,
      host: frame,
      query: (s) => frame.contentDocument && frame.contentDocument.querySelector(s),
      queryAll: (s) => frame.contentDocument ? Array.from(frame.contentDocument.querySelectorAll(s)) : [],
      destroy: () => frame.remove(),
      ready: new Promise((res) => frame.addEventListener("load", res, { once: true }))
    };
  }

  // src/a11y.js
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  function focusables(mounted) {
    return mounted.queryAll(FOCUSABLE).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }
  function inertSiblings(host, on) {
    Array.from(document.body.children).forEach((el) => {
      if (el === host) return;
      if (on) {
        el.setAttribute("inert", "");
        el.setAttribute("data-wcv-inert", "");
      } else if (el.hasAttribute("data-wcv-inert")) {
        el.removeAttribute("inert");
        el.removeAttribute("data-wcv-inert");
      }
    });
  }
  function attach(mounted, onClose) {
    const opener = document.activeElement;
    const state = { closed: false, escSeen: false, wrapped: 0 };
    inertSiblings(mounted.host, true);
    const close = (why) => {
      if (state.closed) return;
      state.closed = true;
      state.closedBy = why;
      inertSiblings(mounted.host, false);
      mounted.destroy();
      if (opener && opener.focus) opener.focus();
      state.restoredTo = document.activeElement === opener;
      if (onClose) onClose(why);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        state.escSeen = true;
        close("esc");
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables(mounted);
      if (!list.length) return;
      const active = activeInside(mounted);
      const i = list.indexOf(active);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        list[list.length - 1].focus();
        state.wrapped++;
      } else if (!e.shiftKey && i === list.length - 1) {
        e.preventDefault();
        list[0].focus();
        state.wrapped++;
      }
    };
    if (mounted.kind === "iframe") {
      const doc = mounted.root.contentDocument;
      doc.addEventListener("keydown", onKey);
      document.addEventListener("keydown", onKey);
      state.detach = () => {
        doc.removeEventListener("keydown", onKey);
        document.removeEventListener("keydown", onKey);
      };
    } else {
      mounted.root.addEventListener("keydown", onKey);
      document.addEventListener("keydown", onKey);
      state.detach = () => {
        mounted.root.removeEventListener("keydown", onKey);
        document.removeEventListener("keydown", onKey);
      };
    }
    const closeBtn = mounted.query(".wcv-close");
    if (closeBtn) closeBtn.addEventListener("click", () => close("button"));
    const first = focusables(mounted)[0];
    if (first) first.focus();
    return Object.assign(state, { close, opener, focusables: () => focusables(mounted) });
  }
  function activeInside(mounted) {
    if (mounted.kind === "shadow") return mounted.root.activeElement;
    if (mounted.kind === "iframe") {
      const d = mounted.root.contentDocument;
      return d ? d.activeElement : null;
    }
    return document.activeElement;
  }

  // src/proto.js
  var params = new URLSearchParams(location.search);
  var mode = params.get("wcv10") || "shadow";
  var inlineHost = params.get("wcv10_inline");
  var noA11y = params.has("wcv10_noa11y");
  function describe(el) {
    if (!el) return null;
    const bits = [el.tagName.toLowerCase()];
    if (el.id) bits.push("#" + el.id);
    if (el.className && typeof el.className === "string") bits.push("." + el.className.trim().split(/\s+/).join("."));
    return bits.join("");
  }
  function textWidth(el) {
    if (!el || !el.firstChild) return null;
    const doc = el.ownerDocument;
    const r = doc.createRange();
    r.selectNodeContents(el);
    const rect = r.getBoundingClientRect();
    return Math.round(rect.width * 100) / 100;
  }
  function boot() {
    const mounted = mount(mode);
    const finish = () => {
      const win = mounted.kind === "iframe" ? mounted.root.contentWindow : window;
      const trap = noA11y ? { closed: false, focusables: () => mounted.queryAll('button,input,[tabindex]:not([tabindex="-1"])'), close() {
      } } : attach(mounted, () => {
      });
      if (noA11y) {
        const f = trap.focusables()[0];
        if (f) f.focus();
      }
      const api = {
        mode,
        kind: mounted.kind,
        // ---- rendering fidelity -------------------------------------------------
        styles() {
          const out = {};
          for (const sel of ELEMENTS) {
            const el = mounted.query(sel);
            if (!el) {
              out[sel] = null;
              continue;
            }
            const cs = win.getComputedStyle(el);
            const props = {};
            for (const p of PROBED) props[p] = cs.getPropertyValue(p).trim();
            out[sel] = props;
          }
          return out;
        },
        rects() {
          const out = {};
          for (const sel of ELEMENTS) {
            const el = mounted.query(sel);
            if (!el) {
              out[sel] = null;
              continue;
            }
            const r = el.getBoundingClientRect();
            out[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          }
          const hr = mounted.host.getBoundingClientRect();
          out["@host"] = { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) };
          out["@viewport"] = { w: window.innerWidth, h: window.innerHeight };
          return out;
        },
        // Is our popup actually the thing the visitor can click? Asked in the PARENT
        // document, because that is where a cookie banner or sticky header lives.
        hitTest() {
          const out = {};
          for (const sel of [".wcv-modal", ".wcv-submit", ".wcv-input", ".wcv-close"]) {
            const el = mounted.query(sel);
            if (!el) {
              out[sel] = { ok: false, reason: "missing" };
              continue;
            }
            const r = el.getBoundingClientRect();
            const off = mounted.kind === "iframe" ? mounted.host.getBoundingClientRect() : { x: 0, y: 0 };
            const cx = off.x + r.x + r.width / 2;
            const cy = off.y + r.y + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            const isOurs = top === mounted.host || top && mounted.host.contains(top);
            out[sel] = { ok: !!isOurs, top: describe(top), at: [Math.round(cx), Math.round(cy)] };
          }
          return out;
        },
        // WHO PAINTS ON TOP, ignoring `inert`.
        //
        // `inert` removes an element from hit-testing, so a page we have inerted
        // reports us as "on top" even when a banner is painting a grey scrim over
        // us: clickable, but obscured. Lifting inert for the measurement is the only
        // way to ask about paint order rather than about pointer routing.
        paintOrder() {
          const inerted = Array.from(document.querySelectorAll("body > [data-wcv-inert]"));
          inerted.forEach((el) => el.removeAttribute("inert"));
          const out = {};
          for (const sel of [".wcv-modal", ".wcv-submit"]) {
            const el = mounted.query(sel);
            if (!el) {
              out[sel] = { ok: false, reason: "missing" };
              continue;
            }
            const r = el.getBoundingClientRect();
            const off = mounted.kind === "iframe" ? mounted.host.getBoundingClientRect() : { x: 0, y: 0 };
            const cx = off.x + r.x + r.width / 2;
            const cy = off.y + r.y + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            const isOurs = top === mounted.host || top && mounted.host.contains(top);
            out[sel] = { ok: !!isOurs, top: describe(top), at: [Math.round(cx), Math.round(cy)] };
          }
          inerted.forEach((el) => el.setAttribute("inert", ""));
          return out;
        },
        // Did the template's own webfont actually render?
        font() {
          const title = mounted.query(".wcv-title");
          return {
            declared: title ? win.getComputedStyle(title).getPropertyValue("font-family").trim() : null,
            textWidth: textWidth(title),
            docFontCheck: typeof document.fonts !== "undefined" ? document.fonts.check("700 27px 'WCV Fraunces'") : null,
            ownFontCheck: win.document && win.document.fonts ? win.document.fonts.check("700 27px 'WCV Fraunces'") : null
          };
        },
        // ---- accessibility ------------------------------------------------------
        a11y() {
          const dlg = mounted.query("[role=dialog]");
          return {
            role: dlg && dlg.getAttribute("role"),
            ariaModal: dlg && dlg.getAttribute("aria-modal"),
            // Do the IDREFs resolve? They must not cross a shadow/iframe boundary.
            labelResolves: !!(dlg && mounted.query("#" + dlg.getAttribute("aria-labelledby"))),
            describeResolves: !!(dlg && mounted.query("#" + dlg.getAttribute("aria-describedby"))),
            focusables: trap.focusables().map(describe),
            // What OUTSIDE code sees as focused -- the honest cross-boundary answer.
            documentActiveElement: describe(document.activeElement),
            actualActiveElement: describe(activeInside(mounted)),
            inertedSiblings: document.querySelectorAll("body > [data-wcv-inert]").length,
            bodyChildren: document.body.children.length,
            // Can a page-level Tab reach anything outside us?
            outsideFocusables: Array.from(document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]")).filter((el) => !mounted.host.contains(el) && el !== mounted.host).filter((el) => !el.closest("[inert]")).length
          };
        },
        tab(shift) {
          const list = trap.focusables();
          const cur = activeInside(mounted);
          const i = list.indexOf(cur);
          const next = shift ? i <= 0 ? list.length - 1 : i - 1 : i === list.length - 1 ? 0 : i + 1;
          if (list[next]) list[next].focus();
          return describe(activeInside(mounted));
        },
        // ---- behaviour ----------------------------------------------------------
        fill(email) {
          const input = mounted.query(".wcv-input");
          input.focus();
          input.value = email;
          input.dispatchEvent(new win.Event("input", { bubbles: true }));
          return { value: input.value, focused: describe(activeInside(mounted)) };
        },
        submit() {
          const form = mounted.query(".wcv-form");
          let captured = null;
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            captured = new (win.FormData || FormData)(form).get("email");
          }, { once: true });
          mounted.query(".wcv-submit").click();
          return { captured };
        },
        esc() {
          const target = mounted.kind === "iframe" ? mounted.root.contentDocument : mounted.root;
          target.dispatchEvent(new (win.KeyboardEvent || KeyboardEvent)("keydown", { key: "Escape", bubbles: true, composed: true }));
          return { closed: trap.closed, closedBy: trap.closedBy, restored: trap.restoredTo, bodyChildren: document.body.children.length };
        },
        // ---- what the theme's own JS can see ------------------------------------
        exposure() {
          const host = mounted.host;
          return {
            hostTag: host.tagName.toLowerCase(),
            // The classic theme/plugin sweep: does it find our fields?
            themeCanSeeInputs: document.querySelectorAll("input[type=email]").length,
            themeCanSeeButtons: document.querySelectorAll("button").length,
            shadowRootReachable: !!host.shadowRoot,
            iframeDocReachable: mounted.kind === "iframe" ? !!mounted.root.contentDocument : null
          };
        },
        dir() {
          const el = mounted.query(".wcv-modal");
          const close = mounted.query(".wcv-close");
          const modal = el.getBoundingClientRect();
          const cr = close.getBoundingClientRect();
          return {
            htmlDir: document.documentElement.getAttribute("dir"),
            modalDirection: win.getComputedStyle(el).getPropertyValue("direction"),
            hostDirection: getComputedStyle(mounted.host).getPropertyValue("direction"),
            titleTextAlign: win.getComputedStyle(mounted.query(".wcv-title")).getPropertyValue("text-align"),
            // inset-inline-end put the close button on which side of the modal?
            closeOnLeft: cr.x + cr.width / 2 < modal.x + modal.width / 2
          };
        },
        _mounted: mounted
      };
      window.__WCV10 = api;
      document.documentElement.setAttribute("data-wcv10-ready", mode);
    };
    if (mounted.ready) mounted.ready.then(finish);
    else finish();
  }
  function bootInline(sel) {
    const parent = document.querySelector(sel);
    const mounted = mount(mode, { into: parent });
    const go = () => {
      const r = mounted.query(".wcv-modal").getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      window.__WCV10 = {
        mode,
        kind: mounted.kind,
        inline: true,
        clip: {
          parent: { x: Math.round(pr.x), y: Math.round(pr.y), w: Math.round(pr.width), h: Math.round(pr.height) },
          modal: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          parentOverflow: getComputedStyle(parent).overflow,
          visibleAtCentre: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === mounted.host || mounted.host.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        }
      };
      document.documentElement.setAttribute("data-wcv10-ready", mode);
    };
    if (mounted.ready) mounted.ready.then(go);
    else go();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => inlineHost ? bootInline(inlineHost) : boot());
  } else {
    inlineHost ? bootInline(inlineHost) : boot();
  }
})();
