// THROWAWAY PROTOTYPE. Native v2 trees, not registered catalogue entries.
const serif = "'Instrument Serif', Georgia, serif",
  sans = "'DM Sans', Arial, sans-serif";
const H = (text, size = "3.2rem", tokens = {}) => ({
  type: "heading",
  role: "headline",
  text,
  tokens: { "heading-size": size, ...tokens },
  narrow: {
    "heading-size": size.includes("clamp")
      ? size
      : parseFloat(size) > 3
        ? "2.65rem"
        : size,
  },
});
const T = (text, tokens = {}) => ({ type: "text", role: "body", text, tokens });
const E = (text, tokens = {}) => ({
  type: "eyebrow",
  role: "eyebrow",
  text,
  tokens: { "text-size": ".88rem", tracking: ".1em", ...tokens },
});
const D = () => ({ type: "divider" });
const S = (children, tokens = {}) => ({
  type: "stack",
  tokens: { gap: "1rem", ...tokens },
  children,
});
const P = (children, tokens = {}, params = {}) => ({
  type: "panel",
  tokens: {
    pad: "2.5rem",
    radius: "0",
    gap: "1.1rem",
    ...(tokens.fg ? { muted: tokens.fg } : {}),
    ...tokens,
  },
  narrow: {
    pad:
      tokens.pad &&
      /^([0-9.]+)rem$/.test(tokens.pad) &&
      parseFloat(tokens.pad) <= 1.5
        ? tokens.pad
        : "1.5rem",
    gap: "1rem",
  },
  ...params,
  children,
});
const R = (children, tokens = {}) => ({
  type: "row",
  tokens: { gap: "1rem", ...tokens },
  children,
});
const G = (children, basis = "10rem", tokens = {}) => ({
  type: "grid",
  basis,
  tokens: { gap: "1rem", ...tokens },
  children,
});
const X = (a, b, ratio = 0.5, basis = "19rem") => ({
  type: "split",
  ratio,
  basis,
  tokens: { gap: 0 },
  start: [a],
  end: [b],
});
const I = (name, alt, height = "22rem", fit = "contain") => ({
  type: "image",
  src: `./assets/${name}.png`,
  alt,
  fit,
  tokens: { "image-height": height, radius: 0 },
  narrow: { "image-height": parseFloat(height) > 20 ? "16rem" : height },
});
const B = (label, action = "link", tokens = {}) => ({
  type: "button",
  role:
    action === "submit"
      ? "cta_label"
      : action === "close"
        ? "close_label"
        : "cta_label",
  label,
  action,
  ...(action === "submit"
    ? { submission: "primary" }
    : action === "link"
      ? { href: "#demo" }
      : {}),
  tokens: { radius: ".2rem", ...tokens },
});
const F = (name = "email", label = "Email address") => ({
  type: "field",
  name,
  label,
  placeholder:
    name === "phone"
      ? "+44 7700 900123"
      : name === "name"
        ? "Your name"
        : "you@example.com",
  required: true,
  tokens: { radius: ".2rem" },
});
const C = () => ({
  type: "consent",
  role: "consent_text",
  text: "I agree to receive marketing emails. Unsubscribe anytime.",
  hidden: false,
});
const Fine = (text) => ({
  type: "text",
  role: "fine_print",
  text,
  tokens: { "text-size": ".8rem", leading: 1.5 },
});
const Form = (cta = "Keep me in the loop", kind = "email", compact = false) =>
  S(
    [
      ...(kind === "request" ? [F("name", "Your name")] : []),
      compact
        ? R([
            F(
              kind === "phone" ? "phone" : "email",
              kind === "phone" ? "Phone number" : "Email address",
            ),
            B(cta, "submit"),
          ])
        : S(
            [
              F(
                kind === "phone" ? "phone" : "email",
                kind === "phone" ? "Phone number" : "Email address",
              ),
              B(cta, "submit"),
            ],
            { gap: ".7rem" },
          ),
      kind === "request"
        ? Fine("We use these details to respond to your request.")
        : kind === "phone"
          ? {
              ...C(),
              text: "I agree to receive marketing texts. Reply STOP to opt out. Message and data rates may apply.",
            }
          : C(),
    ],
    { gap: ".9rem" },
  );
const Clock = (layout = "line") =>
  S(
    [
      {
        type: "countdown",
        role: "countdown_units",
        layout,
        days_label: "Days",
        hours_label: "Hrs",
        minutes_label: "Mins",
        seconds_label: "Secs",
        tokens: { "countdown-size": "1.7rem" },
        narrow: { "countdown-size": "1.35rem" },
      },
    ],
    { align: "center" },
  );
const Code = (code) => ({
  type: "code",
  role: "code_value",
  text: code,
  copy: true,
  layout: "stack",
});
const Fact = (n, text, bg, fg) =>
  P(
    [
      H(n, "2.5rem", { "heading-font": sans, "heading-weight": 700 }),
      T(text, { "text-size": ".9rem" }),
    ],
    { bg, fg, pad: "1.25rem", gap: ".3rem" },
  );
const palette = (bg, fg, accent, afg = bg) => ({
  bg,
  fg,
  muted: fg,
  accent,
  "accent-fg": afg,
  border: fg,
  "input-bg": "transparent",
  placeholder: fg,
  "close-bg": bg,
  "close-fg": fg,
  "close-border": fg,
});
const colours = {
  cream: palette("#fff5df", "#26352c", "#273d2d", "#fff5df"),
  blue: palette("#173fda", "#fff7e8", "#fff7e8", "#173fda"),
  pink: palette("#fbd7cb", "#772b2a", "#772b2a", "#fff5e7"),
  green: palette("#183e35", "#fff7de", "#e4ee87", "#193d34"),
  paper: palette("#f3efe6", "#2e2d29", "#2e2d29", "#fffaf0"),
  plum: palette("#30213d", "#f6eccd", "#ecdc81", "#30213d"),
  lilac: palette("#e2d8ef", "#352440", "#352440", "#fff9ec"),
  orange: palette("#f16b37", "#272b25", "#272b25", "#fff1d3"),
  red: palette("#8d242d", "#fff3e0", "#fff3e0", "#8d242d"),
  ice: palette("#e2edf1", "#203a44", "#203a44", "#f7faf8"),
};
const drafts = [];
function add(id, name, format, category, colour, content, meta = {}) {
  drafts.push({
    id: String(id).padStart(2, "0"),
    name,
    format,
    category,
    tier: [1, 5, 7, 10, 12, 14, 18, 21, 25, 29, 34, 37, 42, 47, 49].includes(id)
      ? "Free"
      : "Pro",
    tokens: {
      ...colours[colour],
      font: sans,
      "heading-font": serif,
      "heading-weight": 400,
      "heading-leading": 0.98,
      tracking: "-.035em",
      "text-size": "1rem",
      leading: 1.5,
      pad: 0,
      gap: 0,
      radius: "0",
      width:
        format === "Floating bar"
          ? "70rem"
          : format === "Fullscreen"
            ? "65rem"
            : format === "Inline"
              ? "58rem"
              : format === "Slide-in"
                ? "25rem"
                : "44rem",
      shadow: "0 24px 65px -30px rgba(24,30,30,.35)",
      "close-inset": ".7rem",
      ...meta.tokens,
    },
    content,
    ...Object.fromEntries(
      Object.entries(meta).filter(([key]) => key !== "tokens"),
    ),
  });
}

add(
  1,
  "Sunday crumb",
  "Popup",
  "Food & hospitality",
  "cream",
  X(
    P(
      [
        I(
          "bakery",
          "Croissant and strawberries on a butter-yellow plate",
          "26rem",
        ),
        E("A better kind of morning"),
      ],
      { bg: "#ead9ad", pad: "1rem", align: "center" },
    ),
    P(
      [
        E("The Sunday crumb"),
        H("Good mornings,\nfreshly baked."),
        T(
          "Join our bakery notes for seasonal bakes, weekend recipes and 10% off your first order.",
        ),
        Form("Reveal my welcome code"),
      ],
      { pad: "2.25rem" },
    ),
  ),
  {
    idea: "A food-magazine cover meets the back of a paper bag. Warm serif copy balances a deliberately oversized still life.",
    reward: "CRUMB10",
    ack: "A little treat for you.",
    ackBody:
      "Thanks for your interest in our bakery notes. Here is your first-order code.",
  },
);
add(
  2,
  "The object room",
  "Fullscreen",
  "Retail & makers",
  "paper",
  X(
    P(
      [
        E("Form / furniture & objects"),
        H("Objects\nwith a\npoint of view.", "clamp(3rem,8cqi,6.8rem)", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
        T(
          "Get first access to the new studio collection. Considered pieces, made for everyday living.",
        ),
        Form("Join the preview list", "email", true),
      ],
      { fg: "#173fda", pad: "3rem" },
    ),
    P(
      [
        I("chair", "Sculptural cobalt-blue chair", "36rem"),
        R([E("The studio collection"), T("Coming soon")]),
      ],
      { bg: "#d8cfbd", pad: "1rem" },
    ),
    0.53,
    "23rem",
  ),
  {
    idea: "A furniture catalogue spread: architectural blue type, a full-height product photograph, and a grounded form.",
    tokens: { accent: "#173fda", "accent-fg": "#ffffff" },
    ack: "A seat on the preview list.",
    ackBody:
      "Your request is received. Thanks for taking an interest in the new collection.",
  },
);
add(
  3,
  "Listening party",
  "Popup",
  "Culture & learning",
  "plum",
  S([
    P(
      [
        R([E("Low volume / high feeling"), E("Listening room 01")]),
        I(
          "headphones",
          "Butter-yellow headphones on an aubergine plinth",
          "18rem",
        ),
        H("Good things\nsound different.", "3.8rem"),
        T(
          "Meet our new headphones. Join the preview before the collection opens.",
        ),
      ],
      { align: "center", pad: "2.2rem 2.4rem 1.3rem" },
    ),
    P(
      [E("Preview list closes in"), Clock("boxes"), Form("Put me on the list")],
      {
        bg: "#ecdc81",
        fg: "#30213d",
        muted: "#30213d",
        accent: "#30213d",
        "accent-fg": "#fff5de",
        border: "#30213d",
        "input-bg": "transparent",
        placeholder: "#30213d",
        pad: "1.7rem 2.4rem",
      },
    ),
  ]),
  {
    idea: "An album sleeve above a separate concert-yellow signup strip. The countdown is part of the invitation, not a floating badge.",
    tokens: { width: "31rem" },
    ack: "We have your request.",
    ackBody:
      "Thanks for your interest in the collection. Take a moment to enjoy the quiet.",
  },
);
add(
  4,
  "Almost somewhere",
  "Fullscreen",
  "Travel & outdoors",
  "cream",
  S([
    P(
      [
        E("Elsewhere / small escapes"),
        H("A little further\nfrom ordinary.", "clamp(3rem,7cqi,5.7rem)"),
        T(
          "Slow places. Independent stays. A few good reasons to take the long way.",
        ),
      ],
      { pad: "3rem", align: "center" },
    ),
    I(
      "coast",
      "Terracotta arch framing a quiet turquoise sea",
      "21rem",
      "cover",
    ),
    P(
      [
        X(
          S([
            E("A postcard, once a month"),
            T("Our favourite places, thoughtfully collected."),
          ]),
          Form("Send me somewhere", "email", true),
          0.35,
          "21rem",
        ),
      ],
      { pad: "2rem 3rem" },
    ),
  ]),
  {
    idea: "Panoramic travel editorial with a real image break between the headline and the signup. The form reads like a postcard subscription.",
    ack: "Your next chapter can wait.",
    ackBody:
      "Your request for Elsewhere postcards is received. Thanks for your curiosity.",
  },
);
add(
  5,
  "Bloom notes",
  "Inline",
  "Home & wellbeing",
  "cream",
  X(
    P([I("botanical", "Cut-paper red poppy with a green stem", "24rem")], {
      bg: "#eee5cd",
      pad: "1.2rem",
    }),
    P([
      E("Stem / seasonal flowers"),
      H("A little wild.\nA little wonderful.", "3.7rem"),
      T(
        "Flowers worth knowing, simple arranging ideas and seasonal studio news. One thoughtful email a month.",
      ),
      Form("Grow my inspiration"),
    ]),
    0.35,
    "19rem",
  ),
  {
    idea: "A narrow herbarium panel beside a generous journal-like form. Colour comes from the replaceable flower, not decorative UI.",
    ack: "A new leaf.",
    ackBody:
      "Thanks for requesting Bloom notes. We have received your details.",
  },
);
add(
  6,
  "Good dog society",
  "Slide-in",
  "Playful & community",
  "pink",
  S([
    I("dog", "Shaggy terrier in a blue bandana", "14rem", "contain"),
    P(
      [
        E("Good dog society"),
        H("For their\nvery best life.", "2.8rem"),
        T(
          "Useful care tips, new finds and 10% off your first order. A little something for your favourite someone.",
        ),
        Form("Get my good-dog code"),
      ],
      { pad: "1.5rem" },
    ),
  ]),
  {
    idea: "A friendly character peeks over the top of a practical corner signup. One expressive image, no decorative clutter.",
    reward: "GOODDOG10",
    ack: "A treat, well deserved.",
    ackBody: "Your request is received. Here is your first-order code.",
  },
);
add(
  7,
  "The lemon hour",
  "Popup",
  "Food & hospitality",
  "blue",
  S([
    P(
      [
        E("The summer pantry"),
        H("A squeeze\nof something\ngood.", "4rem"),
        I("lemon", "Painted yellow lemons on cobalt blue", "12rem", "contain"),
      ],
      { align: "center", pad: "2rem 2.5rem .5rem" },
    ),
    P(
      [
        T("Take 15% off our picnic pantry. A brighter lunch starts here."),
        Code("PICNIC15"),
        B("Shop the picnic edit"),
        Fine("Selected pantry items. Offer ends 30 June 2027."),
      ],
      { align: "center", pad: "1.5rem 2.5rem 2rem" },
    ),
  ]),
  {
    idea: "A citrus poster with oversized serif lettering and a compact code area. A direct offer with no invented signup requirement.",
    tokens: { width: "29rem" },
  },
);
add(
  8,
  "School of small things",
  "Inline",
  "Culture & learning",
  "lilac",
  X(
    P([
      E("An hour for a new idea"),
      H("Stay curious.\nStart small.", "4rem"),
      T(
        "Try our free drawing warm-ups: five short exercises to help you put pencil to paper.",
      ),
      Form("Show me the exercises"),
    ]),
    P(
      [
        I("octopus", "An orange octopus holding a blue pencil", "26rem"),
        Fine("No perfect drawings required."),
      ],
      { bg: "#d6c9e7", pad: "1rem", align: "center" },
    ),
    0.54,
    "20rem",
  ),
  {
    idea: "An illustrated learning invitation with a useful resource and a grown-up typographic voice.",
    ack: "Your next line starts here.",
    ackBody:
      "Your request is received. The sample exercise preview is available below.",
    resource: true,
  },
);
add(
  9,
  "Soft science",
  "Popup",
  "Home & wellbeing",
  "paper",
  S([
    P(
      [
        R([E("Soft science / daily care"), T("Less, but considered.")]),
        H("A simpler\nkind of ritual.", "3.6rem"),
      ],
      { pad: "2rem 2.5rem 1rem" },
    ),
    X(
      P([I("skincare", "Milky bottle, pear and pale green leaf", "22rem")], {
        bg: "#e4ddc7",
        pad: ".6rem",
      }),
      P(
        [
          E("The first look"),
          T(
            "Explore our new daily-care collection. Join the launch list for product notes and a preview of the range.",
          ),
          Form("Explore what’s next"),
        ],
        { pad: "1.8rem" },
      ),
      0.45,
      "17rem",
    ),
  ]),
  {
    idea: "Beauty editorial with a broad masthead and an inset two-column product/specimen layout. No medical claims or unverified badges.",
    ack: "A considered beginning.",
    ackBody:
      "Thanks for your interest. Your request for the collection preview is received.",
  },
);
add(
  10,
  "Frame by frame",
  "Inline",
  "Culture & learning",
  "red",
  X(
    P([
      E("Contact sheet / a photography letter"),
      H("Look longer.\nSee more.", "4rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      D(),
      T("One photo story. One practical idea. Every other Friday."),
      Form("Get the next issue", "email", true),
    ]),
    P(
      [
        I(
          "camera",
          "Silver rangefinder camera on a cherry red ground",
          "25rem",
        ),
        E("Made for curious eyes"),
      ],
      { bg: "#6e1a23", pad: "1rem", align: "center" },
    ),
    0.6,
    "20rem",
  ),
  {
    idea: "A red photographic contact sheet with a heavy sans-serif masthead, horizontal rule and clear subscription rhythm.",
    ack: "A fresh perspective.",
    ackBody:
      "We received your request for Contact sheet. Thanks for looking a little closer.",
  },
);
add(
  11,
  "The daily ritual",
  "Slide-in",
  "Food & hospitality",
  "green",
  S([
    P(
      [
        E("The daily ritual"),
        I("coffee", "Ivory espresso cup on a green table", "12rem", "contain"),
      ],
      { pad: "1rem" },
    ),
    P(
      [
        H("Your next\nfavourite cup.", "3rem"),
        T(
          "Get our brew guide and a first look at new roasts. Good coffee, without the guesswork.",
        ),
        Form("Get the brew guide"),
      ],
      { pad: "1.6rem", radius: "0 0 5rem 0" },
    ),
  ]),
  {
    idea: "A coffee-bag silhouette with an asymmetric lower corner and a compact, useful guide signup.",
    tokens: { radius: "0 0 5rem 0" },
    resource: true,
    ack: "Make time for a good cup.",
    ackBody:
      "Your guide request is received. Open the sample brew notes below.",
  },
);
add(
  12,
  "Permission to pause",
  "Popup",
  "Home & wellbeing",
  "cream",
  P(
    [
      E("Soft hours / the weekend edit"),
      I("fox", "Sleeping orange fox curled inside a blue bowl", "13rem"),
      H("Do almost\nnothing.", "3.8rem"),
      T(
        "Slow mornings. Comfortable things. Meet our edit for making yourself at home.",
      ),
      R([B("Explore the slow edit")], { align: "center" }),
      Fine("No rush. Take a look when you are ready."),
    ],
    { align: "center", pad: "2rem", radius: "5rem 5rem 1rem 1rem" },
  ),
  {
    idea: "An arched resting-place card with one calm character. A gentle click-through offer, not artificial urgency.",
    tokens: {
      width: "30rem",
      radius: "5rem 5rem 1rem 1rem",
      "close-inset": "1.8rem",
    },
  },
);
add(
  13,
  "Open atelier",
  "Fullscreen",
  "Retail & makers",
  "orange",
  S([
    P(
      [
        R([
          E("Open atelier / the annual studio sale"),
          E("Independent design, direct from the makers"),
        ]),
        D(),
        H("Made with care.\nYours for less.", "clamp(3rem,8cqi,7rem)", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
        T(
          "20% off selected studio pieces. Objects with a story, ready for your everyday.",
        ),
      ],
      { pad: "3rem" },
    ),
    G(
      [
        P(
          [
            H("20%", "5rem", { "heading-font": sans, "heading-weight": 700 }),
            T("Off selected pieces"),
          ],
          { bg: "#252b25", fg: "#fff2d6", align: "center" },
        ),
        P(
          [
            E("Studio sale closes in"),
            Clock("boxes"),
            B("Step inside the sale"),
            Fine("Selected items. Ends 31 October 2026."),
          ],
          { pad: "2rem" },
        ),
      ],
      "22rem",
      { gap: 0 },
    ),
  ]),
  {
    idea: "An exhibition poster with a huge typographic headline and a split dark voucher footer. The clock lives in its own useful region.",
  },
);
add(
  14,
  "The reading shelf",
  "Inline",
  "Culture & learning",
  "paper",
  S([
    R(
      [
        P([E("Fiction"), H("Other\nworlds.", "2.2rem")], {
          bg: "#e7c4af",
          pad: "1rem",
        }),
        P([E("Essays"), H("Fresh\nthinking.", "2.2rem")], {
          bg: "#d6dbc0",
          pad: "1rem",
        }),
        P([E("Poetry"), H("Small\nwonders.", "2.2rem")], {
          bg: "#d6dce9",
          pad: "1rem",
        }),
      ],
      { gap: ".45rem" },
    ),
    P(
      [
        X(
          S([
            E("Shelf life / the monthly letter"),
            H("Something\nworth reading.", "3rem"),
          ]),
          S([
            T(
              "Our booksellers’ favourite reads, new arrivals and stories from the shop.",
            ),
            Form("Find my next read", "email", true),
          ]),
          0.45,
          "22rem",
        ),
      ],
      { pad: "2rem" },
    ),
  ]),
  {
    idea: "Three editable book-spine panels lead into a low editorial signup. No baked-in cover typography.",
    ack: "A place on the shelf.",
    ackBody:
      "Your request for Shelf life is received. Thank you for supporting independent books.",
  },
);
add(
  15,
  "The small-start studio",
  "Popup",
  "Culture & learning",
  "ice",
  S([
    P([
      E("A practical creative course"),
      H("You don’t need\na big beginning.", "3.4rem"),
      T(
        "Start with a 15-minute project. Get a free lesson and see how our workshop works.",
      ),
    ]),
    G(
      [
        Fact("01", "Choose one small idea", "#cadadd", "#223f48"),
        Fact("02", "Make a first attempt", "#a9c5c9", "#223f48"),
        Fact("03", "See where it leads", "#31565d", "#fffaf0"),
      ],
      "12rem",
      { gap: 0 },
    ),
    P([Form("Get the starter lesson")], { pad: "1.7rem 2.5rem" }),
  ]),
  {
    idea: "A small instructional triptych gives the invitation a visual rhythm. The stages explain the lesson instead of pretending to be interactive.",
    resource: true,
    ack: "A small beginning.",
    ackBody:
      "Your lesson request is received. Open the sample starter lesson below.",
  },
);
add(
  16,
  "Out of office",
  "Floating bar",
  "Travel & outdoors",
  "blue",
  P(
    [
      X(
        S([
          E("Elsewhere / spring escapes"),
          H("Your out-of-office starts here.", "1.8rem"),
          T("15% off selected stays booked by 31 October 2026.", {
            "text-size": ".85rem",
          }),
        ]),
        R([Clock(), B("Find my escape")]),
        0.55,
        "24rem",
      ),
    ],
    { pad: "1.4rem 3rem", gap: ".6rem" },
  ),
  {
    idea: "A travel departure strip: message on the left, a clear deadline/action group on the right. Phone layout preserves those groups.",
  },
);
add(
  17,
  "The long weekend pass",
  "Popup",
  "Travel & outdoors",
  "paper",
  S([
    P(
      [
        E("The long weekend / getaway guide"),
        H("Three days.\nA different pace.", "3.8rem"),
        R([T("City walks"), T("Quiet corners"), T("Good food")]),
        D(),
        T(
          "Our favourite short escapes, gathered in one useful guide. Leave your email to open it.",
        ),
      ],
      { bg: "#d8e7e2", pad: "2.5rem" },
    ),
    P(
      [E("A little room for possibility"), Form("Open my weekend guide")],
      { bg: "#fff4dc", pad: "2rem 2.5rem" },
      { edges: "block-start", notch: true },
    ),
  ]),
  {
    idea: "A real ticket-style tear line separates an editorial travel cover from the practical form. Native notch geometry, editable copy.",
    tokens: { bg: "#0000", width: "31rem" },
    resource: true,
    ack: "Here’s to taking the long way.",
    ackBody:
      "Your request is received. Your sample weekend guide is ready to explore.",
  },
);
add(
  18,
  "Small batch bulletin",
  "Inline",
  "Retail & makers",
  "paper",
  X(
    P([
      E("Batch 04"),
      H("Made slowly.\nArriving soon.", "3.4rem"),
      T(
        "Our next run of handmade tableware is nearly ready. Request a preview of the pieces before launch.",
      ),
    ]),
    P(
      [
        E("Notes from the workshop"),
        D(),
        R([T("Material"), T("Stoneware")]),
        D(),
        R([T("Finish"), T("Glazed by hand")]),
        D(),
        Form("Request the preview"),
      ],
      { bg: "#ded9cc", pad: "2rem" },
    ),
    0.53,
    "20rem",
  ),
  {
    idea: "A maker’s product bulletin with an actual material/finish ledger. Information creates the structure, without fake stock counters.",
    ack: "A note for the next batch.",
    ackBody:
      "Your preview request is received. Thank you for your interest in handmade work.",
  },
);
add(
  19,
  "Better together",
  "Popup",
  "Retail & makers",
  "pink",
  X(
    P(
      [
        E("The good pair edit"),
        H("Some things\nare better\ntogether.", "3.6rem"),
        T("Choose any two everyday socks for £20. A little comfort, doubled."),
        B("Find my good pair"),
        Fine("Selected socks. Pair offer applied at checkout."),
      ],
      { pad: "2.3rem" },
    ),
    P(
      [
        H("2", "8rem", { "heading-font": sans, "heading-weight": 700 }),
        D(),
        H("for £20", "2.8rem"),
        E("Two good reasons"),
      ],
      { bg: "#a73340", fg: "#fff0d7", align: "center", pad: "2rem" },
    ),
    0.64,
    "18rem",
  ),
  {
    idea: "An asymmetric deal poster with the offer as the artwork. No decorative assets to maintain and no coupon to mistype.",
  },
);
add(
  20,
  "Make it yours",
  "Inline",
  "Retail & makers",
  "paper",
  X(
    P(
      [
        E("Monogram studio"),
        H("Aa", "8rem", { "heading-font": serif }),
        D(),
        T("A personal touch.\nA piece to keep."),
      ],
      { bg: "#283d32", fg: "#fff4dc", align: "center", pad: "2rem" },
    ),
    P([
      E("Made personal"),
      H("A little more you.", "3.3rem"),
      T(
        "Tell our studio you are interested in personalisation. We’ll use your details to discuss the options.",
      ),
      Form("Ask about personalisation", "request"),
    ]),
    0.3,
    "19rem",
  ),
  {
    idea: "A live typographic monogram becomes the image. The enquiry stays honest: asking about a service, not pretending to configure an order.",
    ack: "Your enquiry is received.",
    ackBody:
      "Thank you for asking about personalisation. The studio has your request.",
  },
);
add(
  21,
  "One good idea",
  "Popup",
  "Culture & learning",
  "paper",
  P(
    [
      E("The Friday idea"),
      D(),
      H("One idea.\nEvery Friday.", "4.4rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      T(
        "A useful thought for people who make things. Short enough to read with your coffee.",
      ),
      Form("Make room for one idea"),
      Fine("No daily noise. Just the weekly letter."),
    ],
    { pad: "2.7rem" },
  ),
  {
    idea: "A plainspoken typographic manifesto. Oversized sans-serif type does all the visual work; no generic icon or stock image.",
    tokens: { width: "30rem" },
    ack: "An idea worth making room for.",
    ackBody:
      "Your request for The Friday idea is received. Thanks for your curiosity.",
  },
);
add(
  22,
  "The next chapter",
  "Fullscreen",
  "Culture & learning",
  "red",
  X(
    P(
      [
        E("The next chapter / author’s notebook"),
        H("A story\nis a door.", "clamp(3rem,8cqi,6.5rem)"),
        T(
          "Come inside the writing process. Read a free opening chapter and occasional notes from the author.",
        ),
        Form("Open the first chapter"),
      ],
      { pad: "3rem" },
    ),
    P(
      [
        E("A new novel"),
        H("01", "clamp(6rem,20cqi,13rem)", { "heading-font": serif }),
        D(),
        T("Every beginning\nholds a possibility.", { "text-size": "1.7rem" }),
        E("The opening chapter"),
      ],
      { bg: "#eddac0", fg: "#75212b", pad: "3rem", align: "center" },
    ),
    0.55,
    "24rem",
  ),
  {
    idea: "A full-bleed book jacket and chapter-opening spread. A huge editable chapter number provides scale without inaccessible image lettering.",
    resource: true,
    ack: "The door is open.",
    ackBody: "Your chapter request is received. Read the sample opening below.",
  },
);
add(
  23,
  "Listen closer",
  "Floating bar",
  "Culture & learning",
  "plum",
  P(
    [
      R([
        P([E("On the record"), T("Episode 12", { "text-size": "1.1rem" })], {
          pad: "1rem",
          bg: "#e9db8d",
          fg: "#30213d",
        }),
        S([
          H("The art of starting again.", "1.6rem"),
          T("A conversation about creative second acts.", {
            "text-size": ".9rem",
          }),
        ]),
        B("Listen to the episode"),
      ]),
    ],
    { pad: "1rem 3rem" },
  ),
  {
    idea: "A podcast programme strip with an episode tile and one honest listening link. No fake player or decorative progress bar.",
  },
);
add(
  24,
  "A note from the maker",
  "Slide-in",
  "Retail & makers",
  "cream",
  P(
    [
      E("A note from the maker"),
      D(),
      H("Come behind\nthe scenes.", "2.8rem"),
      T(
        "I share what I’m making, what I’m learning and the pieces about to leave the studio. If that sounds like your kind of email, I’d love to write to you.",
      ),
      T("Alex, founder", { font: serif, "text-size": "1.5rem" }),
      Form("Send me the studio notes"),
    ],
    { pad: "1.7rem" },
  ),
  {
    idea: "A founder’s note with a live serif sign-off. Intimate copy and editorial spacing replace the usual discount-led corner card.",
    ack: "Thank you for stopping by.",
    ackBody:
      "Your request for studio notes is received. It’s good to have your interest.",
  },
);
add(
  25,
  "The useful checklist",
  "Inline",
  "Work & services",
  "ice",
  X(
    P([
      E("A useful download"),
      H("Less guesswork.\nA better launch.", "3.2rem"),
      T(
        "Our 12-point website launch checklist helps you review the essentials before you press publish.",
      ),
      Form("Open the checklist", "email", true),
    ]),
    P(
      [
        E("Inside the checklist"),
        D(),
        T("01 Content & clarity"),
        D(),
        T("02 Forms & journeys"),
        D(),
        T("03 Mobile & accessibility"),
        D(),
        T("04 The final checks"),
      ],
      { bg: "#254852", fg: "#f3f6e8", pad: "2rem" },
    ),
    0.62,
    "20rem",
  ),
  {
    idea: "A useful document preview, with real section labels and an adjacent resource request. Clearly a checklist, not another newsletter card.",
    resource: true,
    ack: "Ready for a clearer launch.",
    ackBody: "Your request is received. Open the sample checklist below.",
  },
);
add(
  26,
  "Build something good",
  "Popup",
  "Work & services",
  "green",
  P(
    [
      E("Workbench / early access"),
      D(),
      H("An idea is\na good start.", "3.7rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      T(
        "A calmer workspace for your next project. Join the early-access list and help shape what comes next.",
      ),
      P([E("Preview requests close in"), Clock()], {
        pad: "1.2rem",
        bg: "#d9ea9b",
        fg: "#213d32",
      }),
      Form("Request early access"),
      Fine("An invitation request, not a confirmed account."),
    ],
    { pad: "2.2rem" },
  ),
  {
    idea: "A terminal-inspired workshop invitation with a bright deadline inset. Technical without fake command lines or unexplained codes.",
    tokens: { width: "32rem", "heading-font": sans },
    ack: "A good place to begin.",
    ackBody:
      "Your early-access request is received. We’ll email you when access opens.",
  },
);
add(
  27,
  "Room in your inbox",
  "Floating bar",
  "Culture & learning",
  "lilac",
  P(
    [
      X(
        S([E("The weekly edit"), H("Better reading. Less noise.", "1.7rem")]),
        Form("Get the weekly edit", "email", true),
        0.4,
        "24rem",
      ),
    ],
    { pad: "1.4rem 3rem" },
  ),
  {
    idea: "A deliberately quiet newsletter bar with a compact form group. The message never sits beside a button stranded under its field.",
    ack: "Thanks for making room.",
    ackBody: "Your request for the weekly edit is received.",
  },
);
add(
  28,
  "The listening room",
  "Fullscreen",
  "Culture & learning",
  "paper",
  X(
    P(
      [
        I("vinyl", "Black vinyl record with a coral centre", "31rem"),
        E("Independent sounds / selected with care"),
      ],
      { bg: "#ef694c", pad: "2rem", align: "center" },
    ),
    P(
      [
        E("The listening room"),
        H("Find your\nnext repeat.", "clamp(3rem,6cqi,5.5rem)"),
        T(
          "Our record-store listening evening is back. Explore the programme and book through our events page.",
        ),
        D(),
        E("Bookings close in"),
        Clock("boxes"),
        B("See the listening programme"),
        Fine("Booking is completed on the events page."),
      ],
      { pad: "3rem" },
    ),
    0.5,
    "23rem",
  ),
  {
    idea: "A record sleeve opened into two halves: a replaceable geometric record image and the event invitation. No playback controls implied.",
  },
);
add(
  29,
  "A date with making",
  "Inline",
  "Culture & learning",
  "cream",
  X(
    P(
      [
        E("November"),
        H("14", "7rem", { "heading-font": sans, "heading-weight": 700 }),
        T("Saturday · 10:00–12:00"),
        D(),
        E("Make something with your hands"),
      ],
      { bg: "#c9d5b3", align: "center", pad: "2rem" },
    ),
    P([
      E("Clay club / introductory workshop"),
      H("A morning\nwell spent.", "3.3rem"),
      T(
        "Ask for details of our beginner pottery workshop. We’ll use your email to respond with availability and booking information.",
      ),
      Form("Request workshop details", "request"),
    ]),
    0.36,
    "20rem",
  ),
  {
    idea: "A large calendar date and a practical workshop enquiry. The form does not claim to reserve or sell a seat.",
    ack: "Your workshop enquiry is received.",
    ackBody:
      "Thanks for your interest. This request does not reserve a workshop place.",
  },
);
add(
  30,
  "Start a conversation",
  "Popup",
  "Work & services",
  "paper",
  P(
    [
      E("Goodwork / independent design studio"),
      H("Tell us what\nyou have in mind.", "3.3rem"),
      T(
        "A new website? A better identity? A small idea you want to explore? Start with the kind of help you need.",
      ),
      {
        type: "field",
        name: "interest",
        label: "What would you like help with?",
        placeholder: "Choose an option",
        required: false,
        options: [
          { value: "website", label: "A website" },
          { value: "identity", label: "A visual identity" },
          { value: "exploring", label: "I’m still exploring" },
        ],
      },
      Form("Start the conversation", "request"),
    ],
    { pad: "2.6rem" },
  ),
  {
    idea: "A clean studio brief with a single useful choice, followed by minimal contact details. No quiz UI or pretend instant recommendation.",
    tokens: { width: "33rem", radius: ".7rem" },
    ack: "A good conversation starts here.",
    ackBody:
      "Your enquiry is received. The studio has your details and area of interest.",
  },
);
add(
  31,
  "A desk away",
  "Inline",
  "Work & services",
  "blue",
  S([
    P(
      [
        R([E("Neighbourhood workspace"), E("A little room to focus")]),
        H("Your work.\nA different setting.", "3.8rem", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
      ],
      { pad: "2.3rem" },
    ),
    X(
      P(
        [
          I(
            "chair",
            "Blue chair in a quiet studio setting",
            "19rem",
            "contain",
          ),
        ],
        { pad: 0, bg: "#d8cfbd" },
      ),
      P(
        [
          T(
            "Ask about a day in our shared studio. Find out about desks, facilities and current availability.",
          ),
          Form("Ask about a studio day", "request"),
        ],
        { pad: "1.8rem" },
      ),
      0.4,
      "19rem",
    ),
  ]),
  {
    idea: "A workspace editorial strip with a full-width headline, then a short image and enquiry. Different hierarchy from a standard photo split.",
    ack: "Your studio-day enquiry is received.",
    ackBody:
      "Thanks for your interest. A desk has not been reserved by this request.",
  },
);
add(
  32,
  "Fix-it Friday",
  "Slide-in",
  "Work & services",
  "cream",
  P(
    [
      E("Fix-it Friday / local repair studio"),
      H("Still plenty\nof life in it.", "2.7rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      D(),
      T(
        "Ask about repairing your favourite piece. Leave your details and we’ll discuss what might be possible.",
      ),
      Form("Ask about a repair", "request"),
      Fine("Assessment and pricing are arranged separately."),
    ],
    { pad: "1.8rem", bg: "#efe08d" },
    { edges: "all" },
  ),
  {
    idea: "A yellow repair docket with a strong ruled hierarchy. Useful local-service copy, no guaranteed repair or instant quote.",
    ack: "Your repair enquiry is received.",
    ackBody:
      "The studio has your request. An assessment and price are still to be arranged.",
  },
);
add(
  33,
  "Your kind of weekend",
  "Popup",
  "Playful & community",
  "cream",
  S([
    P([
      E("Around here / the local letter"),
      H("Less scrolling.\nMore going.", "3.5rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      T(
        "A handful of good things happening nearby. Independent places, local events and reasons to step outside.",
      ),
    ]),
    G(
      [
        P([H("Eat.", "2rem")], { bg: "#f2c2af", pad: "1rem" }),
        P([H("See.", "2rem")], { bg: "#bfd3db", pad: "1rem" }),
        P([H("Do.", "2rem")], { bg: "#d5dea5", pad: "1rem" }),
      ],
      "5rem",
      { gap: ".4rem" },
    ),
    P([Form("Find my next weekend")], { pad: "1.8rem 2.5rem" }),
  ]),
  {
    idea: "Three coloured editorial tabs establish the local guide’s scope. Big type gives it personality without a crowded collage.",
    ack: "A good reason to get out.",
    ackBody:
      "Your request for the local letter is received. Thanks for exploring with us.",
  },
);
add(
  34,
  "An occasion worth keeping",
  "Inline",
  "Work & services",
  "cream",
  X(
    P([I("botanical", "A sculptural red poppy", "20rem")], {
      pad: "1rem",
      bg: "#ede6d4",
    }),
    P(
      [
        E("Wild stem / event flowers"),
        H("For the days\nyou’ll remember.", "3.5rem"),
        T(
          "Thoughtful flowers for gatherings, celebrations and everything in between. Ask our studio about your occasion.",
        ),
        Form("Enquire about event flowers", "request"),
      ],
      { pad: "2.4rem" },
    ),
    0.28,
    "19rem",
  ),
  {
    idea: "A slim botanical invitation with airy serif text. The image supports an enquiry rather than claiming a booking.",
    ack: "Your flower enquiry is received.",
    ackBody: "Thank you for considering the studio for your occasion.",
  },
);
add(
  35,
  "From the ground up",
  "Fullscreen",
  "Home & wellbeing",
  "green",
  S([
    P(
      [
        E("Patch / a garden for real life"),
        H("Small patch.\nBig possibility.", "clamp(3rem,8cqi,6.6rem)", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
      ],
      { pad: "3rem" },
    ),
    X(
      P([I("seedling", "Graphic green seedling on cream", "24rem")], {
        bg: "#f4eccf",
        pad: "1rem",
      }),
      P(
        [
          E("The beginner’s growing guide"),
          T(
            "A windowsill, a balcony or a little bit of earth. Start with five easy ideas for growing something of your own.",
          ),
          Form("Get the small-space guide"),
          Fine("Seasonal advice for curious beginners."),
        ],
        { pad: "2.5rem" },
      ),
      0.5,
      "22rem",
    ),
  ]),
  {
    idea: "A garden campaign with bold manifesto typography and a clean plant diagram as a replaceable image. Beginner value is explicit.",
    resource: true,
    ack: "A little room to grow.",
    ackBody:
      "Your guide request is received. Open the sample small-space guide below.",
  },
);
add(
  36,
  "A fresh start",
  "Floating bar",
  "Retail & makers",
  "pink",
  P(
    [
      R([
        H("15%", "3rem", { "heading-font": sans, "heading-weight": 700 }),
        S([
          H("A fresh start, on us.", "1.5rem"),
          T("Selected everyday essentials. Ends 31 October.", {
            "text-size": ".85rem",
          }),
        ]),
        Clock(),
        B("Shop the fresh-start edit"),
      ]),
    ],
    { pad: "1rem 3rem" },
  ),
  {
    idea: "A large offer number anchors a compact retail bar. The deadline and action have enough space to regroup on phones.",
  },
);
add(
  37,
  "The comfort zone",
  "Popup",
  "Home & wellbeing",
  "cream",
  P(
    [
      E("The comfort zone"),
      H("A softer\nlanding.", "3.9rem"),
      I("fox", "Orange fox resting in a blue bowl", "12rem"),
      T(
        "Ideas for a calmer home, a few lovely finds and 10% off your first order.",
      ),
      Form("Find my comfort code"),
    ],
    { pad: "2rem", align: "center" },
  ),
  {
    idea: "A gentle image break inside a centred welcome card. A welcoming everyday alternative to a high-pressure sale popup.",
    tokens: { width: "28rem", radius: "1.6rem" },
    reward: "SOFT10",
    ack: "Make yourself comfortable.",
    ackBody: "Your request is received. Here is your first-order code.",
  },
);
add(
  38,
  "An evening worth making",
  "Inline",
  "Food & hospitality",
  "red",
  X(
    P(
      [
        E("The neighbourhood table"),
        H("Good food.\nBetter company.", "3.8rem"),
        T(
          "Join us for our seasonal supper. Explore the menu, dates and booking details.",
        ),
        B("See the supper menu"),
      ],
      { pad: "2.5rem" },
    ),
    P(
      [
        E("At the table"),
        D(),
        T("Seasonal plates"),
        T("A shared main"),
        T("Something sweet"),
        D(),
        E("Booking closes in"),
        Clock(),
        Fine("Reserve and pay on the booking page."),
      ],
      { bg: "#eddfc7", fg: "#772c31", pad: "2rem", align: "center" },
    ),
    0.6,
    "19rem",
  ),
  {
    idea: "A supper-club menu spread with a separate bill-like deadline panel. The call to action leads to real booking, rather than simulating it.",
  },
);
add(
  39,
  "Slow Sunday notes",
  "Slide-in",
  "Food & hospitality",
  "paper",
  P(
    [
      E("Slow Sunday notes"),
      H("Pour a cup.\nStay a while.", "3rem"),
      I("coffee", "Espresso cup in morning sunlight", "12rem", "contain"),
      T(
        "Our monthly letter about food, rituals and small good things. Read it at your own pace.",
      ),
      Form("Get the Sunday letter"),
    ],
    { pad: "1.5rem" },
  ),
  {
    idea: "A tiny Sunday supplement with a shallow photographic strip. Quiet enough for a slide-in, with clear cadence.",
    ack: "Thanks for spending a moment.",
    ackBody: "Your request for Slow Sunday notes is received.",
  },
);
add(
  40,
  "The little-things shop",
  "Popup",
  "Playful & community",
  "orange",
  P(
    [
      E("The little-things shop"),
      H("Little things.\nBig joy.", "4.2rem", {
        "heading-font": sans,
        "heading-weight": 700,
      }),
      P(
        [H("10% off", "3rem"), T("Your first order of everyday good things.")],
        { bg: "#fff0d3", fg: "#293128", pad: "1.3rem", align: "center" },
      ),
      Form("Reveal my little welcome"),
      Fine("First orders only. Excludes gift cards."),
    ],
    { pad: "2rem" },
  ),
  {
    idea: "A typographic toy-box with a pale inset offer. Warm, playful and practical without adding a mascot to every surface.",
    tokens: { width: "30rem" },
    reward: "LITTLE10",
    ack: "A little welcome, just here.",
    ackBody: "Your request is received. Here is your first-order code.",
  },
);
add(
  41,
  "A curious future",
  "Fullscreen",
  "Culture & learning",
  "blue",
  X(
    P(
      [
        E("A curious future / creative learning"),
        H("What if\nyou tried?", "clamp(3.5rem,8cqi,7rem)", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
        T(
          "Short classes for people with curious minds. Get a free taster lesson and find your next small obsession.",
        ),
        Form("Try a little curiosity"),
      ],
      { pad: "3rem" },
    ),
    P(
      [
        I("octopus", "Curious octopus holding a pencil", "30rem"),
        E("No experience. Just a little curiosity."),
      ],
      { bg: "#ded1eb", fg: "#352440", pad: "1rem", align: "center" },
    ),
    0.55,
    "23rem",
  ),
  {
    idea: "A bold educational campaign with an oversized question and an expressive character. A resource-led invitation with no achievement promises.",
    resource: true,
    ack: "Curiosity looks good on you.",
    ackBody:
      "Your taster request is received. Explore the sample lesson below.",
  },
);
add(
  42,
  "The weekend court",
  "Inline",
  "Travel & outdoors",
  "green",
  X(
    P([I("tennis", "Simple tennis ball and court-line graphic", "18rem")], {
      bg: "#dce77f",
      pad: "1rem",
    }),
    P([
      E("The weekend court"),
      H("More outside.\nMore good days.", "3.4rem"),
      T(
        "Get our beginner’s guide to your first tennis session. What to bring, a few simple drills and where to begin.",
      ),
      Form("Open the starter guide"),
    ]),
    0.32,
    "20rem",
  ),
  {
    idea: "A sporting diagram and a reassuring beginner’s guide. Fresh green without clichéd performance statistics.",
    resource: true,
    ack: "A good place to start.",
    ackBody:
      "Your guide request is received. Open the sample starter guide below.",
  },
);
add(
  43,
  "Another good round",
  "Popup",
  "Home & wellbeing",
  "paper",
  S([
    P(
      [
        E("Again / repair & reuse"),
        H("Good things\ndeserve\nanother round.", "3.5rem"),
        T(
          "Ask us about restoring your favourite bag. A small repair can make a familiar piece feel ready again.",
        ),
      ],
      { bg: "#c4cbb3", pad: "2.4rem" },
    ),
    P(
      [
        {
          type: "field",
          name: "interest",
          label: "What needs attention?",
          placeholder: "Choose an option",
          required: false,
          options: [
            { value: "strap", label: "Strap or handle" },
            { value: "zip", label: "Zip or fastening" },
            { value: "other", label: "Something else" },
          ],
        },
        Form("Ask about restoration", "request"),
      ],
      { pad: "1.8rem 2.4rem" },
      { edges: "block-start", notch: true },
    ),
  ]),
  {
    idea: "A care-label form with a tear-line division. Clear repair intent and one relevant choice; no invented environmental impact claims.",
    tokens: { width: "32rem" },
    ack: "Your restoration enquiry is received.",
    ackBody:
      "Thank you for giving a familiar piece another chance. Assessment is arranged separately.",
  },
);
add(
  44,
  "Before the drop",
  "Floating bar",
  "Retail & makers",
  "plum",
  P(
    [
      X(
        S([
          E("Edition 02 / the next release"),
          H("Good things on the horizon.", "1.6rem"),
          T("Preview the new collection before it arrives.", {
            "text-size": ".85rem",
          }),
        ]),
        R([Clock("boxes"), B("Explore the next release")]),
        0.5,
        "24rem",
      ),
    ],
    { pad: "1.3rem 3rem" },
  ),
  {
    idea: "A launch strip with a boxed clock, restrained colour and one preview action. No secret-code styling or fabricated scarcity.",
  },
);
add(
  45,
  "The curious corner",
  "Slide-in",
  "Culture & learning",
  "paper",
  S([
    P([E("The curious corner / issue by issue")], {
      bg: "#922d31",
      fg: "#fff6e4",
      pad: "1rem 1.5rem",
    }),
    P(
      [
        H("Not just\nanother email.", "2.7rem", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
        T(
          "A monthly mix of curious stories, thoughtful objects and people making something good.",
        ),
        D(),
        Form("Keep my curiosity fed"),
      ],
      { pad: "1.6rem" },
    ),
  ]),
  {
    idea: "A miniature periodical with a red masthead and a substantial rule. Its personality comes from type, not an illustration repeated from another design.",
    ack: "A little more curiosity.",
    ackBody: "Your request for The curious corner is received.",
  },
);
add(
  46,
  "The scenic route",
  "Popup",
  "Travel & outdoors",
  "ice",
  S([
    P(
      [
        E("Sidequest / alternative city guides"),
        R([E("Walk a little"), E("Notice more")]),
        H("Take the\nscenic route.", "3.9rem"),
        T(
          "Our free city-walk sampler helps you find the small places worth slowing down for.",
        ),
        Form("Open the walk sampler"),
      ],
      { pad: "2.4rem" },
    ),
    I("coast", "A sunlit arch and a quiet sea", "9rem", "cover"),
  ]),
  {
    idea: "A compact field-note cover with a shallow destination photograph at the foot. Different from a travel postcard or full-image popup.",
    tokens: { width: "31rem" },
    resource: true,
    ack: "The long way is waiting.",
    ackBody: "Your request is received. Open the sample city walk below.",
  },
);
add(
  47,
  "First light journal",
  "Inline",
  "Home & wellbeing",
  "cream",
  X(
    P(
      [
        I("sun", "A minimal orange sunrise over green hills", "13rem"),
        E("A little space, each week"),
      ],
      { bg: "#ecddbc", pad: "1rem", align: "center" },
    ),
    P([
      E("First light / a quieter weekly letter"),
      H("Begin where\nyou are.", "3.4rem"),
      T(
        "Simple journal prompts, thoughtful reading and small ways to make room in your day.",
      ),
      Form("Get the First light letter", "email", true),
    ]),
    0.35,
    "21rem",
  ),
  {
    idea: "A calm sunrise diagram beside a useful writing invitation. No wellness outcome claims, only clear content and cadence.",
    ack: "A little space to begin.",
    ackBody:
      "Your request for First light is received. Thank you for taking a moment.",
  },
);
add(
  48,
  "The useful sale",
  "Popup",
  "Retail & makers",
  "paper",
  X(
    P(
      [
        E("The useful sale"),
        H("25%", "6.5rem", { "heading-font": sans, "heading-weight": 700 }),
        H("Less to spend.\nMore to use.", "2.1rem"),
        Fine("Selected everyday essentials."),
      ],
      { bg: "#252a26", fg: "#fff5e0", pad: "2rem" },
    ),
    P(
      [
        E("This week only"),
        T(
          "Thoughtfully chosen things for your everyday. Shop selected pieces for less.",
        ),
        Clock("boxes"),
        B("Shop the useful sale"),
        Fine("Offer ends 31 October 2026. Exclusions apply."),
      ],
      { pad: "2rem" },
    ),
    0.46,
    "18rem",
  ),
  {
    idea: "A strong black voucher panel paired with a compact offer summary. Clear discount, end date and action.",
    tokens: { accent: "#252a26", "accent-fg": "#fff5e0", width: "43rem" },
  },
);
add(
  49,
  "A little thank-you",
  "Inline",
  "Playful & community",
  "pink",
  P(
    [
      X(
        S([
          E("A little thank-you from us"),
          H("Small shop.\nBig appreciation.", "3rem"),
          T(
            "Take 10% off your next order. Thank you for choosing independent.",
          ),
        ]),
        S([
          Code("THANKYOU10"),
          B("Find something lovely"),
          Fine("One use per customer. Excludes gift cards."),
        ]),
        0.6,
        "19rem",
      ),
    ],
    { pad: "2rem 2.5rem" },
    { edges: "all" },
  ),
  {
    idea: "A simple thank-you note with an adjacent code slip. Designed for an inline position after useful page content.",
  },
);
add(
  50,
  "The future is friendly",
  "Fullscreen",
  "Work & services",
  "lilac",
  S([
    P(
      [
        R([
          E("Hello, tomorrow / new ideas for everyday life"),
          E("The launch edition"),
        ]),
        H("Make room\nfor what’s next.", "clamp(3.2rem,8cqi,7rem)", {
          "heading-font": sans,
          "heading-weight": 700,
        }),
      ],
      { pad: "3rem" },
    ),
    G(
      [
        P(
          [
            I(
              "orbit",
              "A minimal orbital sculpture of a sphere and ring",
              "20rem",
            ),
          ],
          { bg: "#c7b9dd", pad: "1rem" },
        ),
        P(
          [
            E("A first look, before the launch"),
            T(
              "We’re building something to make everyday work a little lighter. Request an invitation to the preview.",
            ),
            Clock("boxes"),
            Form("Request a first look"),
            Fine("A preview request, not confirmed access."),
          ],
          { pad: "2.4rem" },
        ),
      ],
      "23rem",
      { gap: 0 },
    ),
  ]),
  {
    idea: "A future-facing editorial poster with an original geometric image and a dedicated invitation panel. All headline lettering stays live.",
    ack: "Your first-look request is received.",
    ackBody:
      "Thanks for your interest in what comes next. Preview access is not yet confirmed.",
  },
);

function walk(n, fn) {
  fn(n);
  for (const k of ["children", "start", "end"])
    for (const x of n[k] || []) walk(x, fn);
}
export const designs = drafts.map((d) => {
  // A media block fills its split pane; an ordinary panel is intentionally
  // centred there. Keep inset book covers/calendar cards, but make the coloured
  // artwork, menu and offer columns read as continuous sides of the design.
  const flushSides = new Set([
    "01",
    "02",
    "05",
    "08",
    "09",
    "10",
    "19",
    "20",
    "25",
    "28",
    "31",
    "34",
    "35",
    "38",
    "41",
    "42",
    "47",
    "48",
  ]);
  walk(d.content, (n) => {
    if (flushSides.has(d.id) && n.type === "split") {
      for (const side of [...n.start, ...n.end]) {
        let hasField = false;
        walk(side, (child) => {
          if (child.type === "field") hasField = true;
        });
        if (
          side.type === "panel" &&
          side.tokens.bg &&
          !hasField &&
          !side.edges &&
          !side.notch
        ) {
          side.type = "media";
          // A single image can use the whole coloured pane and stay centred
          // with contain. Its narrow height still keeps stacked artwork short.
          if (side.children.length === 1 && side.children[0].type === "image") {
            side.children[0].tokens["image-height"] = "100%";
          }
        }
      }
    }
    // Fullscreen roots can exceed the editor's 24rem narrow breakpoint on a
    // 390px phone. Natural image height removes the desktop-sized letterbox
    // at both phone widths without cropping the subject or custom preview CSS.
    if (["02", "28", "35", "41"].includes(d.id) && n.type === "image") {
      n.tokens["image-height"] = "auto";
      n.narrow["image-height"] = "auto";
    }
    // Centre wrapped clock groups at either phone width. Full-width bars at
    // 390px sit just above the native 24rem narrow breakpoint.
    if (n.type === "row") {
      let hasClock = false;
      walk(n, (child) => {
        if (child.type === "countdown") hasClock = true;
      });
      if (hasClock) {
        n.tokens = { ...n.tokens, align: "center" };
        n.narrow = { ...n.narrow, align: "center" };
      }
    }
  });
  // Reserve a clear close-control area above the first text block on narrow screens.
  if (d.format !== "Inline") {
    let first = d.content;
    while (["split", "stack", "grid", "row"].includes(first.type))
      first = (first.start || first.children)[0];
    if (
      ["panel", "media"].includes(first.type) &&
      first.children[0]?.type !== "image"
    )
      first.narrow = {
        ...first.narrow,
        pad: d.id === "12" ? "5rem 1.5rem 1.5rem" : "4rem 1.5rem 1.5rem",
      };
    if (d.id === "12") first.tokens.pad = "5rem 2rem 2rem";
    if (d.id === "30") first.tokens.pad = "4rem 2.6rem 2.6rem";
    if (d.id === "41") first.tokens.pad = "4rem 3rem 3rem";
    if (["23", "27"].includes(d.id)) first.tokens.pad = "1.4rem 5rem";
    if (["36", "44"].includes(d.id)) first.tokens.pad = "1.3rem 4rem";
  }
  if (d.id === "19") {
    d.content.end[0].tokens.pad = "5rem 2rem 2rem";
    d.content.end[0].narrow.pad = "5rem 1.5rem 1.5rem";
  }
  if (d.id === "27") {
    d.content.children[0].basis = "32rem";
    d.content.children[0].ratio = 0.05;
  }
  if (d.id === "28") {
    d.content.start[0].tokens.fg = "#272b25";
    d.content.start[0].tokens.muted = "fg";
  }
  if (d.id === "14") {
    const shelf = d.content.children[0];
    shelf.type = "grid";
    shelf.basis = "5rem";
    for (const book of shelf.children) {
      book.narrow.pad = ".7rem";
      book.children[0].narrow = { "text-size": ".65rem", tracking: ".03em" };
      book.children[1].narrow = { "heading-size": "1.55rem" };
    }
  }
  let next = 1;
  walk(d.content, (n) => {
    if (n.tokens && !Object.keys(n.tokens).length) delete n.tokens;
    if (!["panel", "media", "stack", "split", "grid", "row"].includes(n.type))
      n.id = `n${next++}`;
  });
  let fields = [],
    consents = [];
  walk(d.content, (n) => {
    if (n.type === "field") fields.push(n.id);
    if (n.type === "consent") consents.push(n.id);
  });
  const capture = fields.length > 0;
  let steps = [
    {
      id: "s1",
      name: capture ? "Details" : "Offer",
      kind: capture ? "input" : "content",
      content: d.content,
    },
  ];
  if (capture) {
    // Acknowledgements keep the illustration, headline voice and palette, while
    // replacing the input region with an honest response and optional demo reward.
    let ack = structuredClone(d.content),
      headingDone = false,
      bodyDone = false;
    function change(n) {
      if (
        n.type === "field" ||
        n.type === "consent" ||
        n.type === "countdown" ||
        n.type === "divider" ||
        (n.type === "eyebrow" && /close(?:s)? in/i.test(n.text)) ||
        (n.role === "fine_print" && n.text.startsWith("We use these details"))
      )
        return null;
      if (
        n.type === "heading" &&
        n.role === "headline" &&
        !headingDone &&
        (!{ 14: "Something", 20: "A little more", 29: "A morning" }[d.id] ||
          n.text.startsWith(
            { 14: "Something", 20: "A little more", 29: "A morning" }[d.id],
          ))
      ) {
        headingDone = true;
        return {
          ...n,
          role: "success_headline",
          text: d.ack || "Your request is received.",
          tokens: { ...n.tokens, "heading-size": "2.7rem" },
          narrow: { "heading-size": "2.2rem" },
        };
      }
      if (
        n.type === "text" &&
        n.role === "body" &&
        !bodyDone &&
        (!{
          "09": "Explore our new",
          17: "Our favourite",
          20: "Tell our studio",
          29: "Ask for details",
        }[d.id] ||
          n.text.startsWith(
            {
              "09": "Explore our new",
              17: "Our favourite",
              20: "Tell our studio",
              29: "Ask for details",
            }[d.id],
          ))
      ) {
        bodyDone = true;
        return {
          ...n,
          role: "success_body",
          text:
            d.ackBody ||
            "Thank you for your interest. We have received your request.",
        };
      }
      if (n.type === "button" && n.action === "submit")
        return S([
          ...(d.reward ? [Code(d.reward)] : []),
          ...(d.resource
            ? [
                {
                  type: "followup",
                  role: "success_action",
                  label: "Open the resource",
                  href: "#resource",
                  tokens: { radius: ".2rem" },
                },
              ]
            : []),
          B("Continue browsing", "close"),
        ]);
      for (const k of ["children", "start", "end"])
        if (n[k]) n[k] = n[k].map(change).filter(Boolean);
      if (
        ["panel", "stack", "grid", "row"].includes(n.type) &&
        !n.children?.length
      )
        return null;
      return n;
    }
    ack = change(ack);
    walk(ack, (n) => {
      if (n.tokens && !Object.keys(n.tokens).length) delete n.tokens;
      if (!["panel", "media", "stack", "split", "grid", "row"].includes(n.type))
        n.id = `n${next++}`;
    });
    steps.push({
      id: "thanks",
      name: "Acknowledgement",
      kind: "acknowledgement",
      content: ack,
    });
  }
  let timer = false;
  walk(d.content, (n) => {
    if (n.type === "countdown") timer = true;
  });
  return {
    ...d,
    capture,
    timer,
    display_type: {
      Popup: "popup",
      Inline: "inline",
      "Slide-in": "slide_in",
      "Floating bar": "floating_bar",
      Fullscreen: "fullscreen",
    }[d.format],
    tree: {
      v: 2,
      steps,
      ...(capture
        ? {
            submissions: [
              {
                id: "primary",
                required: true,
                fields,
                consents,
                purpose:
                  d.content &&
                  JSON.stringify(d.content).includes("respond to your request")
                    ? "request"
                    : JSON.stringify(d.content).includes('"name":"phone"')
                      ? "sms_marketing"
                      : "email_marketing",
              },
            ],
          }
        : {}),
    },
  };
});
export const categories = [...new Set(designs.map((d) => d.category))];
export const formats = [
  "Popup",
  "Inline",
  "Slide-in",
  "Floating bar",
  "Fullscreen",
];
export { serif, sans };
