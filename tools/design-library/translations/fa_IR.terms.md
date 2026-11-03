# Persian terms for the admin, design and setup words

The term list a translator follows, so one idea reads one way across the admin and
every design. The design and setup words are in `fa_IR.po` (ADR 0183), the Free admin
in `tools/admin-translations/wconvert-fa_IR.po`, and Pro's admin in
`pro/resources/languages/wconvert-pro-fa_IR.po`. `CONTEXT.md` settles the English;
this settles the Persian.

## Voice

- **شما everywhere**, with the matching plural verb: `ایمیل خود را وارد کنید`,
  `کد شما آماده است`. Never تو or the singular imperative (`وارد کن`).
- Plain, everyday Persian, the way a good Iranian shop or app writes. Not literal. Say
  what the sentence means, then shape it the Persian way. Prefer a Persian word when
  people use it; keep a loanword when it is the word people use (`ایمیل`, `پاپ‌آپ`).
- **Admin:** clear and calm. Buttons are short imperatives or infinitive-style verbs in
  the way WordPress does them: `ذخیره`, `حذف`, `انتشار`, `افزودن صفحه`. Sentences are
  whole sentences with a verb.
- **Popups:** warm, short and direct. A button, an eyebrow or a badge stays about as
  long as its English. Longer text can break a layout, and nothing checks it. Byte
  limits are real: Persian takes about 2 bytes a letter.
- **Keep what the English does:** a line break stays where the sentence still breaks
  well, a missing full stop stays missing. ALL CAPS has no Persian form; just write
  it normally.
- Domain nouns are ordinary lower-case words in English and ordinary words here.

## Consent sentences

A consent sentence is the visitor speaking, so it addresses nobody and says what the
visitor agrees to, faithfully, adding and dropping nothing. First person:

- `Email me the guide.` → `می‌خواهم راهنما را با ایمیل دریافت کنم.`
- `Contact me about this request.` → `می‌خواهم درباره این درخواست با من تماس گرفته شود.`
- `Call me about this request.` → `می‌خواهم درباره این درخواست با من تماس تلفنی گرفته شود.`
- `Use my details to respond to this request.` → `اطلاعات من برای پاسخ به این درخواست استفاده شود.`

A button stays an instruction to the site: `Send me the guide` → `راهنما را برایم بفرستید`.

## Marks, numbers and spelling

- `%s`, `%d`, `%1$s`, `%b`, `%i`, `%%` and HTML tags stay exact, once each. Word order
  may change; when two placeholders swap, use the numbered form (`%2$s … %1$s`).
- **Persian digits in written text:** `۱۰٪ تخفیف`, `۳ مرحله`. A number after a
  placeholder is still the placeholder.
- **Stay as written:** prices and currency signs (`$49`), coupon codes (`SAVE10`), URLs,
  sample emails (`you@example.com`), code (`wconvert/get-campaign`, `design_id`,
  `wcv_display_session_v1`, shortcodes, file names).
- **A price carries a left-to-right mark (U+200E) before its sign**, and after a trailing `+`.
  Without it, right-to-left text shows `£40` as `40£` and `$100+` as `+100$`.
- **Dates stay Gregorian.** A sale's days: `November 27–30` → `۲۷ تا ۳۰ نوامبر`.
- **Stay in Latin:** WConvert, Pro, WordPress, WooCommerce, provider and service names
  (Mailchimp, Google, Zapier, Plausible and the like), technical abbreviations (URL, CSS,
  HTML, API, JSON, CSV, REST, SMS, IP, HTTP, A/B, ID), sample brands and product names
  (`Fern & Form`, `Maison Arden`), people's names (`Alex Morgan`).
- **Written in Persian:** بلک فرایدی، سایبر مانده، هالووین، کریسمس, because Latin words
  inside a Persian sentence are harder to read and mix text direction.
- **Spelling:** ی and ک, never ي or ك. نیم‌فاصله in `می‌خواهم`, `پاپ‌آپ`, `ایمیل‌ها`,
  `تنظیمات‌شده`. Plural `ها` joins with نیم‌فاصله.
- **Punctuation:** ، ؛ ؟ « » ٪. Never `,` `;` `?` `%` (as a percent sign) or `“ ”`
  in Persian text. `…` stays. The separator `·` stays.
- **Plurals:** a noun after a number stays singular: `۵ مشتری بالقوه`, `%d مرحله`. Both
  plural forms usually read the same. The form count is `nplurals=2; plural=n > 1`.

## Terms: WConvert's own words

| English | Persian |
|---|---|
| campaign | کمپین |
| lead, leads | مشتری بالقوه، مشتریان بالقوه |
| submission (one form fill) | ثبت فرم |
| visitor | بازدیدکننده |
| popup | پاپ‌آپ |
| floating bar | نوار شناور |
| slide-in | پنجره کناری |
| inline form, inline campaign | فرم داخل محتوا، کمپین داخل محتوا |
| fullscreen | تمام‌صفحه |
| display type, format | نوع نمایش، قالب نمایش |
| template (what you pick or start from) | قالب |
| design (how it looks now) | طرح |
| campaign setup | الگوی کمپین |
| template library | کتابخانه قالب‌ها |
| pack (of designs) | بسته |
| collection (a set of setups or designs) | مجموعه |
| goal | هدف |
| destination | مقصد |
| display rules | قوانین نمایش |
| rule, condition, group | قانون، شرط، گروه |
| first match wins | اولین مورد منطبق اعمال می‌شود |
| screen (a step in a popup) | مرحله |
| first screen, next screen | مرحله اول، مرحله بعد |
| flow, flow map | مسیر، نقشه مسیر |
| line (between screens on the flow map) | خط |
| answer line | خط پاسخ |
| conversion, conversion rate | تبدیل، نرخ تبدیل |
| variant, A/B test | نسخه، آزمون A/B |
| consent, consent checkbox | رضایت، چک‌باکس رضایت |
| coupon, discount code | کد تخفیف |
| reward | پاداش |
| lead magnet | هدیه ثبت‌نام |
| occasion | مناسبت |
| analytics | آمار |
| help | راهنما |
| content lock | قفل محتوا |
| reopen button | دکمه باز کردن دوباره |
| trigger (when it appears) | زمان نمایش |
| targeting | هدف‌گیری |
| placement | جایگاه |
| automatic placement, manual placement | جایگذاری خودکار، جایگذاری دستی |
| overlay | لایه روی صفحه |
| anchor | لنگر |
| inspector | بازرس |
| signup | ثبت‌نام |
| follow-up | پیگیری |
| question, answer, choice | پرسش، پاسخ، گزینه |
| activity | فعالیت |
| recommendation | پیشنهاد |
| weekly summary | خلاصه هفتگی |
| sales, revenue | فروش، درآمد |
| Look (editor tab), Content (editor tab) | ظاهر، محتوا |
| canvas, quiz | بوم، کوییز |

## Terms: WordPress and WooCommerce's words

| English | Persian |
|---|---|
| publish, published | انتشار، منتشرشده |
| draft, saved draft | پیش‌نویس، پیش‌نویس ذخیره‌شده |
| page, post | برگه، نوشته |
| theme | پوسته |
| plugin | افزونه |
| block | بلوک |
| shortcode | کد کوتاه |
| dashboard | پیشخوان |
| settings | تنظیمات |
| save, saved, saving | ذخیره، ذخیره شد، در حال ذخیره |
| edit, delete, remove | ویرایش، حذف، حذف |
| add, create | افزودن، ایجاد |
| cancel, close, back | انصراف، بستن، بازگشت |
| continue, next, previous | ادامه، بعدی، قبلی |
| skip | رد شدن |
| undo, restore | برگرداندن، بازیابی |
| preview | پیش‌نمایش |
| search, filter | جستجو، فیلتر |
| category, tag | دسته‌بندی، برچسب |
| link | پیوند |
| image, picture | تصویر |
| import, export | درون‌ریزی، برون‌بری |
| upload, download | بارگذاری، دانلود |
| update, upgrade, activate | به‌روزرسانی، ارتقا، فعال‌سازی |
| license, license key | لایسنس، کلید لایسنس |
| user, role, account | کاربر، نقش، حساب |
| site, store, shop (noun) | سایت، فروشگاه، فروشگاه |
| product, order, customer | محصول، سفارش، مشتری |
| cart, basket | سبد خرید |
| checkout | تسویه‌حساب |
| Add to cart | افزودن به سبد خرید |
| browser, session, cookie | مرورگر، نشست، کوکی |
| report, tracking | گزارش، ردیابی |
| time zone | منطقه زمانی |

## Terms: forms and popups

| English | Persian |
|---|---|
| form, field, label | فرم، فیلد، برچسب |
| button | دکمه |
| required, optional, (optional) | الزامی، اختیاری، (اختیاری) |
| email (noun), Email address | ایمیل، آدرس ایمیل |
| phone number, Mobile number | شماره تلفن، شماره موبایل |
| Your name, First name | نام شما، نام |
| contact details, Your details | اطلاعات تماس، اطلاعات شما |
| newsletter | خبرنامه |
| subscribe | عضویت |
| Unsubscribe anytime | هر زمان می‌توانید لغو عضویت کنید |
| Privacy Policy | سیاست حریم خصوصی |
| I agree to receive marketing emails | می‌خواهم ایمیل‌های تبلیغاتی دریافت کنم |
| Message rates may apply | ممکن است هزینه پیامک محاسبه شود |
| discount, % off | تخفیف، `۱۰٪ تخفیف` |
| UP TO 40% OFF | تا ۴۰٪ تخفیف |
| offer, sale | پیشنهاد، حراج |
| Shop the sale | خرید از حراج |
| free delivery, free shipping | ارسال رایگان |
| Exclusions apply | شامل برخی محصولات نمی‌شود |
| Offer terms apply | شرایط پیشنهاد اعمال می‌شود |
| Selected items | محصولات منتخب |
| request, enquiry | درخواست |
| quote (a price) | استعلام قیمت |
| appointment, booking | نوبت، رزرو |
| Request received | ثبت شد, short because it is a screen name in designs at their byte cap |
| Thank you | سپاسگزاریم |
| Maybe later | شاید بعداً |
| Choose an option | یک گزینه انتخاب کنید |
| Days, Hrs, Mins, Secs | روز، ساعت، دقیقه، ثانیه |
| guide, checklist | راهنما، چک‌لیست |
| Christmas, New Year | کریسمس، سال نو |
| try again | دوباره تلاش کنید |
| unavailable, invalid | در دسترس نیست، نامعتبر |
