# Nexus test keys

`tests/fixtures/nexus-test-keys.json` holds my.wconvert.io's real answers for
the thirteen `WCTEST-` licence keys, one per licence situation. The keys
themselves are not in it. `RecordedNexusTest` replays those answers through
the SDK and checks the state the License page shows.

To see whether the store still answers the same way:

```bash
node tools/nexus-test-keys/check.mjs
```

It is read-only: it sends the SDK's domain-less validate, which takes no seat.
It reads the keys, in the fixture's order, from `keys.local.json` in this
folder. Git ignores that file, so get the keys from the testing kit. Key 6
changes on its own around 2026-10-24, when its grace period ends.

A key marked `CHANGED` means the fixture is stale. Record that key again, then
update the test that reads it.
