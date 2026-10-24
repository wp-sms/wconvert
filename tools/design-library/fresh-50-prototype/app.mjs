import { render, closeButton } from "../../../resources/renderer/src/mount.ts";
import { SHADOW_CSS } from "../../../resources/renderer/src/css.ts";
import { decorateFullscreen } from "../../../pro/modules/display-types/loader/surface.ts";
import { designs, categories, formats } from "./designs.mjs";
// PROTOTYPE ONLY: all interaction is local and ephemeral. No capture/network writes.
const app = document.querySelector("#app"),
  params = () => new URLSearchParams(location.search);
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const find = (id) => designs.find((d) => d.id === id) || designs[0];
const url = (obj) => "?" + new URLSearchParams(obj);
let filter = {
    category: "All themes",
    format: "All formats",
    tier: "All plans",
    q: "",
    timer: false,
  },
  observer,
  interval,
  deadline = Date.parse("2026-10-31T20:00:00Z");
const badge = (d) =>
  `<span class="badge ${d.tier.toLowerCase()}">${d.tier}</span>`;
const brand = () =>
  '<a class="brand" href="./"><b>w.</b><span>wconvert <i>/</i> design explorations</span></a>';
const stats = `<span><b>50</b> designs</span><span><b>5</b> formats</span><span><b>35 / 15</b> Pro / Free</span><span><b>10</b> countdowns</span>`;
function nav(id, extra = {}) {
  history.pushState({}, "", url({ variant: id, ...extra }));
  viewer();
  scrollTo(0, 0);
}
function gallery() {
  clearInterval(interval);
  observer?.disconnect();
  document.body.className = "studio";
  app.innerHTML = `<header class="topbar">${brand()}<span class="prototype">PROTOTYPE COLLECTION 04</span></header><main class="gallery"><section class="intro"><div><p class="eyebrow">FIFTY NEW WAYS TO SAY HELLO</p><h1>Everyday,<br><em>extraordinary.</em></h1><p class="lede">For the small shops, big ideas and good things in between.<br>50 considered invitations. Each with a point of view.</p><div class="stats">${stats}</div></div><div class="intro-preview"><img src="./assets/dog.png" alt="A terrier in a blue bandana"><div><span>06 / GOOD DOG SOCIETY</span><p>Good design.<br><em>Good company.</em></p><a href="?variant=06">Meet the collection ↗</a></div></div></section><section class="browse" aria-label="Browse fifty designs"><div class="browse-heading"><h2>Find your kind of hello.</h2><p>Open any design for desktop + mobile, demo interactions and editor notes.</p></div><div class="theme-tabs">${["All themes", ...categories].map((c) => `<button data-cat="${esc(c)}" aria-pressed="${filter.category === c}">${c}</button>`).join("")}</div><div class="filters"><label class="search">Search<input type="search" id="search" placeholder="Try pottery, travel, launch…" value="${esc(filter.q)}"></label><label>Format<select id="format">${["All formats", ...formats].map((f) => `<option ${filter.format === f ? "selected" : ""}>${f}</option>`).join("")}</select></label><label>Plan<select id="tier">${["All plans", "Pro", "Free"].map((f) => `<option ${filter.tier === f ? "selected" : ""}>${f}</option>`).join("")}</select></label><label class="check"><input type="checkbox" id="timers" ${filter.timer ? "checked" : ""}> With countdown</label><a class="outline-button" href="?variant=01">Start at 01 ↗</a></div><p class="result-count" role="status"></p><div class="design-grid"></div></section><section class="closing-note"><div><p class="eyebrow">ONE EDITOR. MANY VOICES.</p><h2>Different by design.</h2></div><p>Every concept uses the editor’s native layouts and controls. Text, colours, offers, forms and countdowns stay editable. Artwork is a replaceable image. No custom layout CSS is hidden inside the designs.</p><p><strong>Proposed collection:</strong> Everyday, extraordinary. All 50 visible before installation, organised by theme and format. 35 Pro and 15 Free, with Free templates hosted individually rather than bundled.</p></section><footer><span>Built to explore. Made to be useful.</span><span>Prototype only · no details are sent or saved.</span></footer></main>`;
  renderCards();
  document.querySelectorAll("[data-cat]").forEach(
    (b) =>
      (b.onclick = () => {
        filter.category = b.dataset.cat;
        gallery();
      }),
  );
  document.querySelector("#search").oninput = (e) => {
    filter.q = e.target.value;
    renderCards();
  };
  for (const key of ["format", "tier"])
    document.querySelector("#" + key).onchange = (e) => {
      filter[key] = e.target.value;
      renderCards();
    };
  document.querySelector("#timers").onchange = (e) => {
    filter.timer = e.target.checked;
    renderCards();
  };
}
function renderCards() {
  observer?.disconnect();
  const list = designs.filter(
    (d) =>
      (filter.category === "All themes" || d.category === filter.category) &&
      (filter.format === "All formats" || d.format === filter.format) &&
      (filter.tier === "All plans" || d.tier === filter.tier) &&
      (!filter.timer || d.timer) &&
      JSON.stringify([d.name, d.idea, d.content])
        .toLowerCase()
        .includes(filter.q.toLowerCase()),
  );
  document.querySelector(".result-count").textContent =
    `${list.length} ${list.length === 1 ? "design" : "designs"} · ${list.filter((d) => d.tier === "Pro").length} Pro / ${list.filter((d) => d.tier === "Free").length} Free`;
  document.querySelector(".design-grid").innerHTML =
    list
      .map(
        (d) =>
          `<a class="design-card" href="${url({ variant: d.id })}" aria-label="Explore ${d.id}: ${esc(d.name)}"><div class="thumbnail" style="--ground:${d.tokens.bg === "#0000" ? "#ede8dc" : d.tokens.bg}"><iframe title="${esc(d.name)} preview" src="${url({ render: d.id, thumb: "1" })}" loading="lazy" tabindex="-1" inert></iframe><span class="open-card">↗</span></div><div class="card-meta"><span class="index">${d.id}</span><div><h3>${d.name}</h3><p>${d.category}</p></div>${badge(d)}</div><div class="card-foot"><span>${d.format}</span><span>${d.capture ? "Form + acknowledgement" : "Offer"}${d.timer ? " · Countdown" : ""}</span></div></a>`,
      )
      .join("") ||
    "<p>No designs match. Try another theme or clear the search.</p>";
  document.querySelectorAll(".design-card").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        nav(new URL(a.href).searchParams.get("variant"));
      }),
  );
  observer = new ResizeObserver((es) =>
    es.forEach(({ target, contentRect }) =>
      target.style.setProperty("--scale", contentRect.width / 1000),
    ),
  );
  document.querySelectorAll(".thumbnail").forEach((x) => observer.observe(x));
}
function viewer() {
  clearInterval(interval);
  observer?.disconnect();
  document.body.className = "studio";
  const d = find(params().get("variant")),
    phone = params().get("phone") === "320" ? 320 : 390,
    ack = params().get("screen") === "ack";
  app.innerHTML = `<header class="topbar">${brand()}<a href="./">↖ All 50 designs</a></header><main class="viewer"><section class="viewer-heading"><div><p class="eyebrow">${d.id} / ${d.category}</p><h1>${d.name}</h1><div class="tags">${badge(d)}<span>${d.format}</span><span>${d.timer ? "Live demo countdown" : "Native editor layout"}</span></div></div><div class="controls">${d.capture ? `<fieldset><legend>Screen</legend><button data-screen="entry" aria-pressed="${!ack}">Details</button><button data-screen="ack" aria-pressed="${ack}">Acknowledgement</button></fieldset>` : ""}<fieldset><legend>Mobile width</legend><button data-phone="390" aria-pressed="${phone === 390}">390px</button><button data-phone="320" aria-pressed="${phone === 320}">320px</button></fieldset>${d.timer ? '<button id="expiry">Preview expiry</button>' : ""}<button id="reset">Reset demo</button></div></section><div class="comparison"><section class="desktop-col"><div class="caption"><b>Desktop</b><span>1000px · scroll within preview</span></div><div class="viewport desktop"><iframe title="${esc(d.name)} desktop" src="${url({ render: d.id, screen: ack ? "ack" : "entry" })}"></iframe></div></section><section class="phone-col"><div class="caption"><b>Mobile</b><span>${phone}px</span></div><div class="viewport phone" style="--vw:${phone}px"><iframe title="${esc(d.name)} mobile" src="${url({ render: d.id, screen: ack ? "ack" : "entry", width: phone })}"></iframe></div></section></div><div class="notes"><section><h2>The idea</h2><p>${d.idea}</p></section><section><h2>In the editor</h2><p>Native ${d.format.toLowerCase()} using editable text, panels and standard ${d.capture ? "fields and submit actions" : "link and code controls"}. ${JSON.stringify(d.content).includes('"image"') ? "Replace the artwork as one image. " : ""}${d.timer ? "Countdown uses the campaign end date. " : ""}${d.resource ? "The resource link belongs on the acknowledgement. " : ""}${d.reward ? "The code appears after the signup. " : ""}</p></section><section><h2>Try it</h2><p>${d.capture ? "Enter example details and submit to see the acknowledgement. No data leaves this page." : "Try the action or copy the example code. Links demonstrate intent and do not open a real shop."} ${d.timer ? "The demo clock has a shared example deadline; test expiry above. " : ""}Offers, dates, resources and destinations must be configured before production use.</p></section></div></main><nav class="switcher" aria-label="Design switcher"><button id="prev" aria-label="Previous design">←</button><select id="variant" aria-label="Choose design">${designs.map((x) => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${x.id} · ${x.name}</option>`).join("")}</select><span>${d.id}/50</span><button id="next" aria-label="Next design">→</button></nav>`;
  const set = (key, value) => {
    const p = params();
    p.set(key, value);
    history.replaceState({}, "", `?${p}`);
    viewer();
  };
  document
    .querySelectorAll("[data-screen]")
    .forEach((b) => (b.onclick = () => set("screen", b.dataset.screen)));
  document
    .querySelectorAll("[data-phone]")
    .forEach((b) => (b.onclick = () => set("phone", b.dataset.phone)));
  document.querySelector("#variant").onchange = (e) =>
    nav(e.target.value, { phone });
  document.querySelector("#prev").onclick = () => cycle(-1);
  document.querySelector("#next").onclick = () => cycle(1);
  document.querySelector("#reset").onclick = () => set("screen", "entry");
  document
    .querySelector("#expiry")
    ?.addEventListener("click", () =>
      document
        .querySelectorAll("iframe")
        .forEach((f) =>
          f.contentWindow.postMessage(
            { type: "fresh50-expire" },
            location.origin,
          ),
        ),
    );
  observer = new ResizeObserver((es) =>
    es.forEach(({ target, contentRect }) => {
      const w = target.classList.contains("phone") ? phone : 1000;
      const scale = Math.min(1, contentRect.width / w);
      target.style.setProperty("--scale", scale);
      target.style.setProperty("--vw", w + "px");
      target.style.height = 860 * scale + "px";
    }),
  );
  document.querySelectorAll(".viewport").forEach((x) => observer.observe(x));
}
function cycle(n) {
  const i = designs.indexOf(find(params().get("variant")));
  nav(designs[(i + n + 50) % 50].id, { phone: params().get("phone") || 390 });
}
function renderScene() {
  observer?.disconnect();
  clearInterval(interval);
  const p = params(),
    d = find(p.get("render"));
  document.body.className = "render-page";
  const compact = p.get("thumb") === "1";
  const width = p.has("width") ? Number(p.get("width")) : null;
  app.innerHTML = `<main class="scene format-${d.display_type} ${compact ? "thumb-scene" : ""}" ${width ? `style="max-width:${width}px;margin:auto"` : ""}><div class="site-context" aria-hidden="true"><header><b>FORM & FIELD</b><span>Explore &nbsp; Stories &nbsp; About</span><span>Bag (0)</span></header><div><small>GOOD THINGS, WELL CONSIDERED</small><h2>A little more<br>everyday.</h2><p>Objects, ideas and stories for a life well lived.</p></div><section><i></i><i></i><i></i></section></div><div id="native-frame"><div id="native-host"></div></div><button class="reopen" hidden>Reopen example</button><p class="demo-status" role="status" hidden></p><dialog id="resource"><button class="resource-close" aria-label="Close sample resource">×</button><p class="eyebrow">LOCAL DEMO RESOURCE</p><h2>A small beginning.</h2><p>This is a sample resource preview for <strong>${esc(d.name)}</strong>.</p><ol><li>Choose one idea that feels useful.</li><li>Give it a little time and attention.</li><li>Keep what helps and try again.</li></ol><p>In a real campaign, this button opens your configured guide or page after submission.</p><button class="resource-close">Back to the example</button></dialog></main>`;
  const frame = document.querySelector("#native-frame"),
    host = document.querySelector("#native-host"),
    shadow = host.attachShadow({ mode: "open" });
  let step = p.get("screen") === "ack" && d.capture ? 1 : 0,
    expired = false,
    expiryShown = false;
  const status = (message) => {
    const el = document.querySelector(".demo-status");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => (el.hidden = true), 6500);
  };
  const close = () => {
    frame.hidden = true;
    document.querySelector(".reopen").hidden = false;
  };
  function paint() {
    const style = document.createElement("style");
    style.textContent =
      SHADOW_CSS + "\n.wc-root{max-block-size:none;margin-inline:auto}";
    const root = render(d.tree, d.tokens, step);
    root.setAttribute("aria-label", d.name);
    if (d.display_type === "fullscreen")
      decorateFullscreen(root, d.tokens.width, "100vh");
    if (d.display_type !== "inline") {
      const button = closeButton(close);
      if (d.display_type === "floating_bar") button.dataset.bar = "";
      root.append(button);
    }
    shadow.replaceChildren(style, root);
    if (compact)
      document.fonts.ready.then(() => {
        if (!root.isConnected) return;
        const h = root.getBoundingClientRect().height,
          scale = Math.min(1, (innerHeight - 80) / h);
        root.style.transform = `scale(${scale})`;
        root.style.transformOrigin = "top center";
        frame.style.height = `${h * scale}px`;
      });
    root.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!root.reportValidity()) return;
      step = 1;
      paint();
      shadow.querySelector("h2,h3")?.setAttribute("tabindex", "-1");
      shadow.querySelector("h2,h3")?.focus();
    });
    root.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) {
        e.preventDefault();
        if (expired && step === 0) return;
        if (a.getAttribute("href") === "#resource")
          document.querySelector("#resource").showModal();
        else
          status(
            "Demo action: this opens your configured page. No navigation or purchase occurred.",
          );
      }
      const btn = e.target.closest('[data-action="close"]');
      if (btn) close();
    });
    root
      .querySelectorAll('input[type="checkbox"]')
      .forEach((c) => (c.required = true));
    tick();
  }
  function tick() {
    const left = expired
      ? 0
      : Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    const vals = {
      d: Math.floor(left / 86400),
      h: Math.floor(left / 3600) % 24,
      m: Math.floor(left / 60) % 60,
      s: left % 60,
    };
    shadow
      .querySelectorAll(".wc-count")
      .forEach(
        (s) =>
          (s.textContent = s.dataset.unit
            ? String(vals[s.dataset.unit]).padStart(2, "0")
            : `${vals.d}d ${String(vals.h).padStart(2, "0")}:${String(vals.m).padStart(2, "0")}:${String(vals.s).padStart(2, "0")}`),
      );
    if (!left && d.timer && !expired) {
      expired = true;
    }
    if (expired && step === 0) {
      shadow
        .querySelectorAll("button:not(.wc-close),input,select,a")
        .forEach((x) => {
          x.disabled = true;
          x.setAttribute("aria-disabled", "true");
        });
      if (!expiryShown) {
        expiryShown = true;
        status(
          "The example deadline has passed. New entries and offer actions are closed.",
        );
      }
    }
  }
  paint();
  interval = setInterval(tick, 1000);
  document.querySelector(".reopen").onclick = () => {
    frame.hidden = false;
    document.querySelector(".reopen").hidden = true;
  };
  document
    .querySelectorAll(".resource-close")
    .forEach(
      (b) => (b.onclick = () => document.querySelector("#resource").close()),
    );
  window.onmessage = (e) => {
    if (e.origin === location.origin && e.data?.type === "fresh50-expire") {
      expired = true;
      tick();
    }
  };
  document.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "Escape" &&
        d.display_type !== "inline" &&
        !e.target.closest("dialog")
      )
        close();
    },
    { once: false },
  );
}
function route() {
  if (params().has("render")) renderScene();
  else if (params().has("variant")) viewer();
  else gallery();
}
addEventListener("popstate", route);
addEventListener("keydown", (e) => {
  if (
    !params().has("variant") ||
    e.target.closest("input,select,textarea,[contenteditable]")
  )
    return;
  if (e.key === "ArrowLeft") cycle(-1);
  if (e.key === "ArrowRight") cycle(1);
});
route();
