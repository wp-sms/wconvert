# Drawing exports — 25 October 2026

Thirteen inline SVG drawings in twelve Free designs had no reviewed raster, so the catalogue could not export those designs (ADR 0156). Each drawing was extracted unchanged from its design into `tools/design-library/pilot/assets/<name>.svg` (five were already there, byte-identical), and rasterised once with resvg-js 2.6.2 to an 8-bit PNG at about twice its largest displayed size. No build converts automatically: `publishing/catalog.json` binds each design's exact source URI hash to the PNG hash and to this report.

**Provenance.** Every drawing is original WConvert geometric artwork authored in this repository (first commits between 28 August and 28 September 2026; see `pilot/assets/README.md`), under the repository's GPL-2.0-or-later licence. They contain only rectangles, paths, circles, ellipses and one linear gradient: no external images, scripts, remote references or trademarks. `garment-measurement.svg` draws the letters A and B in Arial; the raster fixes those two glyphs as shapes. They illustrate, and claim no real product, person or completed project.

**Fidelity.** Each PNG was compared with an independent `rsvg-convert` render at the same size: at most 0.12% of pixels differ beyond 8% tolerance, all on anti-aliased edges. The contact sheet `exports.png` was inspected by eye: shapes, colours, proportions, the measurement arrows and labels, the crescent and stars, the floor-plan door swings and the gradient all match the vectors. Rounded corners in two drawings stay transparent.

| Design | Asset | Source URI SHA-256 | PNG SHA-256 | Size |
|---|---|---|---|---|
| collection-poster | `collection-poster.png` | `530efb5b8b7fd78d30b7a53af09412b7950b9f6194f757bc0e5f0da65df5a4f2` | `36cd86fe2e48e7cb99db04dfab558e2b76d52a11911c3349c7e36124b992c65d` | 1200 × 500, 16,195 bytes |
| inline-split | `inline-checklist.png` | `dd6a9049cc4c13ac923d730596c2609215ab58de81f69e5acb2a22d224b63f04` | `84f558f81077f3fc96018b2e8e0865ccf065b66bec851939989fcad55203c77e` | 1200 × 525, 11,665 bytes |
| makers-index | `makers-mug.png` | `6ddcbdd7139f8753c95bec6980214f6454fe8a09e36a6c0a8f0c3112e3d0955d` | `4d416c51f032bf1a582e094dc6a3624c7a0556ee69983e03c0fbc88a73e1416d` | 520 × 280, 6,626 bytes |
| measurement-map | `garment-measurement.png` | `18c7e505ecd4c200e08e7aeb8b60d89d1f750da8686ca9cd984d2725744351bb` | `80ccc21852de2f3555828a96c498cc9ece53a99d9d3df9d6e124c259ce4e65f7` | 1200 × 760, 29,715 bytes |
| night-observatory | `night-observatory.png` | `c48a47d8b5412d6ac13a41404fb22555790a643d1538a282cf0e2ad8585a1a27` | `c0d75ce248fc179d99415b9a774df7402e0617183bbbf9bd57997762394e817e` | 2000 × 520, 18,083 bytes |
| number-invitation | `invitation-check.png` | `9a1b52d7612e8f23f0a706d48650df1f15f7ffa078b091ac79be7f8fcd105922` | `f66edd13d7a13236586790179885b9150f7c20e683f7143929aba7547b984896` | 400 × 200, 7,084 bytes |
| photo-offer | `everyday-goods.png` | `1cd52bf7aca5d2f4c7c34c3005ba5024174dcff1f1891e0f31765f988a297077` | `310c8f6efe97ca51f2bc77e555a3f8dad7564c78644c524989c82839974e6151` | 1200 × 525, 17,330 bytes |
| portrait-frame | `portrait-study.png` | `78abd267073b52674f71a8d062760bdd49faa94cf03da1de92cc2ffda621c4b4` | `f7390525688a6814466f8babea517b52a78f5af8b359e7e8d0b7235e13dc63bf` | 1280 × 680, 26,479 bytes |
| project-pair | `workspace-before.png` | `387d47f3d537db2cfc60121bace7b08a39c952b8d7b7a8f47d6956d113787321` | `9041ee999c3bf534557455e6b74dec8686ad38fd958702f149bccb72e6f6ac3b` | 960 × 600, 10,399 bytes |
| project-pair | `workspace-after.png` | `ac113ef4131ef2d3e3b187a5b436a6197aebadbc42485202214eda26be687924` | `f43f16c5eadf83348e9d5abf24935b095f681155ef41e7e6653449fa01e4dbe1` | 960 × 600, 12,112 bytes |
| reader-review | `reader-avatar.png` | `fbe67c684cf87419ca810050e5756a278a79d3a49e0e5464f6335753b2334c5e` | `939186c57d92069e52a28e4b60e02d063508d3854a34d158b111a701048874f8` | 480 × 480, 6,495 bytes |
| split-hero | `sunrise-gradient.png` | `942a64db339e1f6b32c7978af1d07873c59cb2394e38e8435a50f931faecea5d` | `011c0e7b1cddd15fe8f48ff95a11973d8052709d25cead64471ea007e923db16` | 1200 × 600, 111,987 bytes |
| studio-window | `botanical-still-life.png` | `08b1b478c81a525149441f727a07b19cbc25fcd771d8d76978caee608ec371e7` | `c3826bc559873d5eba2658239400f7e1f719f9a4256c20c00e47115e346cf0d1` | 1000 × 960, 30,021 bytes |

Reviewed by Claude: provenance and raster review only. Campaign approvals are recorded separately; the bundled designs keep their compact vectors.
