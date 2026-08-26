#!/usr/bin/env bash
#
# plugin-check.sh — wp.org's own Plugin Check, against a staged tree.
#
#   ./bin/plugin-check.sh <staged-tree> <plugin-check-version|latest>
#
# Exit 0 = no ERROR. Exit 1 = at least one ERROR, or the check could not run.
# WARNINGs are printed and never block.
#
# ============================================================================
# WHY THIS IS NOT `WordPress/plugin-check-action`.
# ============================================================================
# It very nearly is — the sequence below is that action's sequence, and the
# action is the obvious thing to reach for. But it has NO INPUT FOR THE PLUGIN
# CHECK VERSION: it runs `wp plugin install plugin-check --activate`, which is
# always the latest release on wp.org. Pinning the action's own SHA pins the
# wrapper and not the checker, so the gate would still change under us on
# somebody else's schedule.
#
# ADR 0029 asks for the opposite in as many words: "Plugin Check, PINNED TO AN
# EXACT VERSION ... a blocking gate whose owner controls when `main` breaks is
# not a gate we own." WSMS makes the same argument twice, pinning
# dorny/paths-filter to a commit and the wp.org deploy action to a SHA because
# "`stable` is a tag someone else can repoint at will". A gate that installs
# `latest` is that tag, one layer down.
#
# So the version is an ARGUMENT — required, never defaulted. `latest` is a
# legitimate value and .github/workflows/plugin-check-drift.yml passes it
# deliberately, which is the whole point of that job: the pin is what release
# runs on, and the drift job is what finds out what the pin is holding back.
# The pinned number itself lives in .github/plugin-check-version, once.
#
# ============================================================================
# BLOCKING ON `error`, REPORTING `warning`.
# ============================================================================
# Since 2025-10-27 Plugin Check runs on every wp.org release, so an ERROR is a
# release blocker whatever we decide here — this only moves the discovery from
# the review queue to the release run. WARNINGs are printed in full and pass,
# because a gate that blocks on everything is a gate somebody turns off.
#
# The verdict is computed HERE from the JSON rather than taken from wp-cli's
# exit code, so that "the checker did not run" and "the checker found nothing"
# cannot arrive as the same answer.
#
# Requirements: node, npm and Docker (@wordpress/env), and a staged plugin tree.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The harness version. See the note beside the install below.
WP_ENV_VERSION='11.13.0'

TREE="${1:-}"
PC_VERSION="${2:-}"

if [ -z "$TREE" ] || [ -z "$PC_VERSION" ]; then
    echo "usage: $0 <staged-tree> <plugin-check-version|latest>" >&2
    echo "==> plugin-check FAILED: nothing was checked." >&2
    exit 1
fi

TREE="$(cd "$TREE" 2>/dev/null && pwd)" || {
    echo "==> plugin-check FAILED: '${1}' is not a readable directory — nothing was checked." >&2
    exit 1
}

SLUG="$(basename "$TREE")"
RESULTS="${PLUGIN_CHECK_RESULTS:-$TREE/../plugin-check-${SLUG}.json}"

echo "==> plugin-check: $SLUG (Plugin Check $PC_VERSION)"

# ---------------------------------------------------------------------------
# THE PIN — resolved and fetched on the HOST, installed from disk.
#
# Not `wp plugin install plugin-check --version=X`, and not a download URL
# handed to wp-cli either. WordPress runs every outbound URL through
# wp_http_validate_url(), which REFUSES a host resolving into a private or
# reserved IP range — and any machine whose DNS is intercepted by a VPN or a
# proxy resolves public hosts into 198.18.0.0/15, which is exactly such a
# range. wp-cli then reports `Download failed. "A valid URL was not provided."`
# for a URL that is perfectly valid and that `curl` fetches with a 200 from
# inside the same container. Nothing about the pin is wrong in that case, and
# no amount of retrying fixes it.
#
# So the ZIP is fetched by curl, on the host, and mounted in. The container's
# HTTP stack leaves the picture, and with it every way a proxy, a corporate CA
# or a DNS policy can turn a compliance gate into a red run nobody can act on.
#
# `latest` IS RESOLVED TO A NUMBER FIRST, which is a second thing this buys.
# The weekly drift job passes `latest`, and "the latest" is not a fact anybody
# can reproduce a month later — the report has to name the version it actually
# compared against.
# ---------------------------------------------------------------------------
if [ "$PC_VERSION" = "latest" ]; then
    RESOLVED="$(curl -sSL --max-time 30 --retry 3 --retry-delay 2 \
        'https://api.wordpress.org/plugins/info/1.0/plugin-check.json' \
        | php -r '
            $data = json_decode(stream_get_contents(STDIN), true);
            $version = is_array($data) ? ($data["version"] ?? null) : null;

            if (!is_string($version) || $version === "") {
                fwrite(STDERR, "wp.org did not say which Plugin Check version is current\n");
                exit(1);
            }

            echo $version;
        ')" || {
        echo "  ✗ could not resolve which Plugin Check version is latest — nothing was checked" >&2
        exit 1
    }

    echo "  · latest resolves to $RESOLVED"
else
    RESOLVED="$PC_VERSION"
fi

# wp-env reads its config from the working directory. Kept OUT of the staged
# tree on purpose: a .wp-env.json written inside it would become part of the
# artifact being checked, and Plugin Check would then report on a file the
# checker put there.
#
# A STABLE directory rather than a mktemp one, because wp-env derives its
# Docker project name from this path: a fresh temp directory every run means a
# fresh ~1.2GB WordPress image built every run, and — when a run is interrupted
# before its trap fires — a container set left behind that the next run cannot
# find to clean up. One path, one environment, reused.
WP_ENV_DIR="$(dirname "$SCRIPT_DIR")/dist/plugin-check"
PIN_DIR="$WP_ENV_DIR/pin"
mkdir -p "$PIN_DIR"

ZIP="$PIN_DIR/plugin-check.zip"

if ! curl -fsSL --max-time 120 --retry 3 --retry-delay 2 \
    -o "$ZIP" \
    "https://downloads.wordpress.org/plugin/plugin-check.${RESOLVED}.zip"; then
    echo "  ✗ could not download Plugin Check ${RESOLVED} — nothing was checked" >&2
    exit 1
fi

# A 404 body saved to disk is still a file. Checking it is a real archive is
# what stops "installed successfully" from meaning "unpacked an error page".
if ! unzip -tq "$ZIP" >/dev/null 2>&1; then
    echo "  ✗ what wp.org returned for Plugin Check ${RESOLVED} is not a ZIP — nothing was checked" >&2
    rm -f "$ZIP"
    exit 1
fi

# `testsEnvironment: false` because wp-env otherwise starts a second WordPress
# and a second database that nothing here uses.
#
# The pin is MOUNTED rather than copied into WordPress's own directory: that
# lives under ~/.wp-env/<a hash of this path>/ and computing that hash here
# would be reaching into wp-env's internals. A mapping is the supported way to
# put a host file where the container can reach it. Deliberately not under
# wp-content/plugins/, where WordPress would try to read it as a plugin.
cat > "$WP_ENV_DIR/.wp-env.json" <<JSON
{
  "core": null,
  "plugins": [],
  "testsEnvironment": false,
  "mappings": {
    "wp-content/plugins/${SLUG}": "${TREE}",
    "wp-env-pin": "${PIN_DIR}"
  }
}
JSON

cd "$WP_ENV_DIR"

# Pinned, for the reason the checker is pinned: this is the harness a blocking
# gate runs inside, and `latest` is a version somebody else chooses the timing
# of. WordPress itself is deliberately NOT pinned — `"core": null` above is
# current WordPress, which is what wp.org's reviewers run the checker against,
# so pinning it would make the gate answer a question nobody is asking.
npm -g --no-fund --silent install "@wordpress/env@${WP_ENV_VERSION}" >/dev/null

# The trap goes on BEFORE the start, not after it. `wp-env start` is the step
# most likely to fail or be interrupted — it builds a ~1.2GB image on a cold
# cache — and a cleanup registered afterwards is a cleanup that does not run on
# exactly the runs that leave containers behind.
#
# `stop`, not `destroy`. The environment is what the next run reuses, and CI
# runners are thrown away anyway — destroying it buys nothing there and costs an
# image rebuild here.
trap 'wp-env stop >/dev/null 2>&1 || true' EXIT

# NOT silenced. `wp-env start` builds a WordPress image on a cold cache and can
# take minutes; a silent minutes-long step is indistinguishable from a hung one,
# and the first thing anybody debugging this needs is to see it moving.
wp-env start --update

# No `--quiet` on any wp-env run: there is no such flag, and passing one makes
# wp-env read it as the container name and print its usage instead of running
# anything. It wraps every command in a preamble and a "✔ Ran ..." line
# regardless, which is why the output below is extracted rather than read whole.
#
# `--force` so a warm environment cannot leave a different build installed and
# quietly satisfy the `is-installed` shortcut the official action takes.
wp-env run cli wp plugin install wp-env-pin/plugin-check.zip --activate --force

# The version, out of wp-env's chatter: the one line that is nothing but a
# version. `|| true` so a no-match does not end the script here — the
# comparison below is where "could not read it" becomes a verdict.
INSTALLED="$(wp-env run cli wp plugin get plugin-check --field=version 2>/dev/null \
    | tr -d '\r' | grep -Eo '^[0-9][0-9A-Za-z.+-]*$' | head -1 || true)"

if [ -z "$INSTALLED" ]; then
    echo "  ✗ could not read which Plugin Check version is installed — the pin was not verified" >&2
    exit 1
fi

echo "  · Plugin Check $INSTALLED"

# Checked even when `latest` was asked for, because `latest` was resolved to a
# number above. A gate that cannot say which version ran is a gate whose result
# nobody can reproduce.
if [ "$INSTALLED" != "$RESOLVED" ]; then
    echo "  ✗ asked for Plugin Check $RESOLVED and got $INSTALLED — the pin did not hold" >&2
    exit 1
fi

wp-env run cli wp plugin activate "$SLUG"

# --require is how the official action reaches Plugin Check's own CLI commands;
# without it `wp plugin check` is not a command.
#
# `--format` and `--fields` come from bin/plugin-check-results.php, so the
# request and the parse cannot disagree about what a finding contains. Read
# that file for why `strict-json` and not `json`.
#
# `|| true` IS LOAD-BEARING. `wp plugin check` exits non-zero when it finds
# errors, and under `set -e` that would end this script here — before the
# verdict below runs, so no finding is ever printed and a WARNING-only run
# would block. The header of this file promises the opposite: "the verdict is
# computed HERE from the JSON rather than taken from wp-cli's exit code", and
# without this the exit code is the first arbiter. Losing the exit code costs
# nothing, because an unreadable or absent result file is already a failure.
PC_FORMAT="$(php -r 'require $argv[1]; echo PLUGIN_CHECK_FORMAT;' "$SCRIPT_DIR/plugin-check-results.php")"
PC_FIELDS="$(php -r 'require $argv[1]; echo PLUGIN_CHECK_FIELDS;' "$SCRIPT_DIR/plugin-check-results.php")"

wp-env run cli wp plugin check "$SLUG" \
    --format="$PC_FORMAT" \
    --fields="$PC_FIELDS" \
    --require=./wp-content/plugins/plugin-check/cli.php > "$RESULTS" || true

# The verdict, computed from the JSON by the reader both this script and
# bin/plugin-check-drift.php share.
php -r '
    require $argv[1];

    $findings = pluginCheckFindings($argv[2]);

    if ($findings === null) {
        fwrite(STDERR, "  ✗ Plugin Check produced no readable result — nothing was checked\n");
        exit(1);
    }

    $errors = array_values(array_filter($findings, "pluginCheckIsError"));
    $warnings = array_values(array_filter($findings, fn (array $f): bool => !pluginCheckIsError($f)));

    printf("  · %d error(s), %d warning(s)\n", count($errors), count($warnings));

    foreach ($warnings as $warning) {
        echo "  ! ", pluginCheckLine($warning), "\n";
    }

    foreach ($errors as $error) {
        fwrite(STDERR, "  ✗ " . pluginCheckLine($error) . "\n");
    }

    if ($errors !== []) {
        fwrite(STDERR, "==> plugin-check FAILED with " . count($errors) . " error(s).\n");
        exit(1);
    }

    echo "  ✓ no errors\n";
' "$SCRIPT_DIR/plugin-check-results.php" "$RESULTS"
