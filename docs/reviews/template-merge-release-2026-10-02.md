# Pre-merge local release update — 2 October 2026

Bumped `publishers-starts` from 1.1.0 to 1.1.1 for the reviewed Excerpt window ratio correction. Other pack versions and membership remain unchanged. The new four-setup batch remains bundled rather than silently entering downloadable packs.

The existing local storage at `/tmp/wconvert-template-release-local` was promoted with an explicit expected prior release:

- Previous: `fcae3992f5664f27ae9287360e73008520becf13d7e3f9a991f6a702b62662d3`
- New: `828a0e930349d48934e678f6dc7cac41cb729a196fd926206fcbc880df27768c`
- First run: 4 objects created, 7 reused; validated by the shipping catalog and pack reader.
- Repeated identical run: 0 objects created, 11 reused; identical release ID.
- SHA-256 comparison against every file present before promotion: only `public/manifest.json` changed. All prior immutable files remain byte-identical; publisher packs 1.1.0 and 1.1.1 are both retained.

Native WordPress verifier passed preview/install for all four packs, offline access to 13 designs / 16 setups / 2 collections, and illustrated update/offline behaviour with reused artwork and the original snapshot retained. WordPress 7.1 / PHP 8.5.8 in the disposable instance; no site settings or campaigns changed. All six publisher tests passed, including rejection of changed bytes under an existing version.

This is a local release rehearsal, not hosted publication. R2/Worker/licence integration, 92 older setup re-reviews and future template expansion remain separate work. CI and external delivery remain skipped at the user's request. The user explicitly authorized merging after this check.
