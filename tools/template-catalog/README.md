# Local template catalog

Build the sample service as static files:

```sh
php tools/template-catalog/build.php
wp option update wconvert_template_catalog_url \
  http://wconvert.local/wp-content/plugins/wconvert/tools/template-catalog/out/index.json \
  --autoload=no
```

The default URL is for this local WordPress. Pass a different base URL as the
build script's first argument when needed. HTTP is accepted only for the current
site host with `WP_ENVIRONMENT_TYPE=local`. Production requires HTTPS. No default
production service is configured or implied.

Open a draft, choose **Change template → Template packs → Check catalog**.
Preview a pack, select designs and screens, inspect desktop/320px, then install.
**Preview and use this design** returns to the existing keep/sample-content
preview. It respects the draft's display format and existing compatibility rules.

The fixture reuses three bundled designs and contains no new artwork. `out/` is
ignored and tools are excluded from release ZIPs. Source strings in a future
remote service must be localized by that service; bundled PHP translation rules
are unchanged. Free packs are the only entitlement supported by this slice.

Index contract: `schema: 1`, `packs: [{id, version, name, description, url,
sha256}]`; at most 20 packs. Pack contract is demonstrated by the generated JSON.
Minimum plugin/tree/capability declarations are mandatory; extra or unsafe design
content is refused before preview. Pack URLs must share the index origin.

Installed JSON is stored by digest under uploads/wconvert-template-packs.
Back up that directory with the site. Refresh does not delete installed versions.
No media or remotely supplied code is installed. The archive is bounded at 128
pack files; automatic garbage collection is deliberately absent because old
versions supply baselines for existing drafts.
