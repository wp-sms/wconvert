# Checking ad-block interference

Use **Check on a real page** for a published Campaign on the affected URL.
The panel reports whether WordPress supplied Campaign data, whether the loader
tag exists, whether the loader reached its boot milestones, and whether an
explicit empty-batch request received a response from the analytics endpoint.
It does not test form submission or prove that an earlier analytics event was
received. Test capture with an intentional submission on a disposable site.

If loader execution is not observed, first reload and allow any script-delay
optimizer to run. Inspect the browser network and console panels for the actual
loader URL and CSP or network errors. Compare the same URL in a clean browser
profile and with the site's blocker setting changed. A present script tag does
not prove the code executed. If both the loader and inspector are blocked, use
the browser network panel; the inspector cannot report its own absence.

Use **Check analytics connection** to send `{"events":[]}` to the configured
beacon endpoint. A 204 response confirms only that this request reached the
route; it creates no count. A 429 response indicates the route's rate limit.
Other HTTP errors, a timeout, or a network exception need investigation of the
actual request, connection, and site policy. A failure alone cannot identify an
ad blocker. Analytics failure does not establish capture failure.

The Pro **Ad-block status** audience condition checks whether an ad-like local
element is selectively hidden during a short visible-page window. **Detected**
means that this test observed interference. **Not detected** means it observed
none. **Unknown** or **Checking** matches neither authored choice. Theme CSS
can create a false positive; DNS-only blockers can be missed. Reload after
changing blocker settings, because the result belongs to the current document.
The condition cannot run if the whole loader is blocked.

Record the browser and version, blocker and enabled filter lists, affected URL,
relevant blocked request or cosmetic rule, console error, visible Campaign
behavior, and server-side capture or counter result before claiming a delivery
failure or considering a route change. The inspector is an authenticated live
page check beside real Campaigns; it is not equivalent to a logged-out visit.
