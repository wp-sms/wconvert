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

# wp-env reads its config from the working directory. Kept OUT of the staged
# tree on purpose: a .wp-env.json written inside it would become part of the
# artifact being checked, and Plugin Check would then report on a file the
# checker put there.
#
# A STABLE directory rather than a mktemp one, because wp-env derives its
# Docker project name from this path: a fresh temp directory every run means a
# fresh ~1.2GB WordPress image built every run, and — when a run is
# interrupted before its trap fires — a container set left behind that the next
# run cannot find to clean up. One path, one environment, reused.
WP_ENV_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")/dist/plugin-check"
mkdir -p "$WP_ENV_DIR"

# `testsEnvironment: false` because wp-env otherwise starts a second WordPress
# and a second database that nothing here uses.
cat > "$WP_ENV_DIR/.wp-env.json" <<JSON
{
  "core": null,
  "plugins": [],
  "testsEnvironment": false,
  "mappings": {
    "wp-content/plugins/${SLUG}": "${TREE}"
  }
}
JSON

cd "$WP_ENV_DIR"

npm -g --no-fund --silent install @wordpress/env >/dev/null

# NOT silenced. `wp-env start` builds a WordPress image on a cold cache and can
# take minutes; a silent minutes-long step is indistinguishable from a hung one,
# and the first thing anybody debugging this needs is to see it moving.
wp-env start --update

# `stop`, not `destroy`. The environment is what the next run reuses, and CI
# runners are thrown away anyway — destroying it buys nothing there and costs an
# image rebuild here.
trap 'wp-env stop >/dev/null 2>&1 || true' EXIT

# THE PIN. `--version=` is the whole reason this script exists rather than the
# action; `--force` so a warm environment cannot leave a different build
# installed and quietly satisfy the `is-installed` shortcut the action takes.
if [ "$PC_VERSION" = "latest" ]; then
    wp-env run --quiet cli wp plugin install plugin-check --activate --force
else
    wp-env run --quiet cli wp plugin install plugin-check --version="$PC_VERSION" --activate --force
fi

INSTALLED="$(wp-env run --quiet cli wp plugin get plugin-check --field=version | tr -d '\r\n')"
echo "  · Plugin Check $INSTALLED"

if [ "$PC_VERSION" != "latest" ] && [ "$INSTALLED" != "$PC_VERSION" ]; then
    echo "  ✗ asked for Plugin Check $PC_VERSION and got $INSTALLED — the pin did not hold" >&2
    exit 1
fi

wp-env run --quiet cli wp plugin activate "$SLUG"

# --require is how the action reaches Plugin Check's own CLI commands; without
# it `wp plugin check` is not a command.
wp-env run --quiet cli wp plugin check "$SLUG" \
    --format=json \
    --require=./wp-content/plugins/plugin-check/cli.php > "$RESULTS"

# The verdict, computed from the JSON. An unparseable result is a failure: a
# checker that produced nothing readable checked nothing, and that must not
# arrive as a pass.
php -r '
    $path = $argv[1];
    $raw = is_file($path) ? (string) file_get_contents($path) : "";

    // wp-cli prefixes its own chatter on some runs; the payload is the JSON.
    $start = strpos($raw, "[");
    $findings = $start === false ? null : json_decode(substr($raw, $start), true);

    if (!is_array($findings)) {
        fwrite(STDERR, "  ✗ Plugin Check produced no readable result — nothing was checked\n");
        exit(1);
    }

    $errors = [];
    $warnings = [];

    foreach ($findings as $finding) {
        if (!is_array($finding)) {
            continue;
        }

        $line = sprintf(
            "%s:%s:%s  %s  %s",
            $finding["file"] ?? "?",
            $finding["line"] ?? "?",
            $finding["column"] ?? "?",
            $finding["code"] ?? "?",
            $finding["message"] ?? ""
        );

        if (strtoupper((string) ($finding["type"] ?? "")) === "ERROR") {
            $errors[] = $line;
        } else {
            $warnings[] = $line;
        }
    }

    printf("  · %d error(s), %d warning(s)\n", count($errors), count($warnings));

    foreach ($warnings as $warning) {
        echo "  ! ", $warning, "\n";
    }

    foreach ($errors as $error) {
        fwrite(STDERR, "  ✗ " . $error . "\n");
    }

    if ($errors !== []) {
        fwrite(STDERR, "==> plugin-check FAILED with " . count($errors) . " error(s).\n");
        exit(1);
    }

    echo "  ✓ no errors\n";
' "$RESULTS"
