# What curated work does

A local addition to this copy of unslop. It is not part of upstream unslop.

[recent.design](https://recent.design) is a feed of design work picked by hand: interfaces, websites, app icons, App Store screenshots, link preview images (OG images) and launch videos. Its stated rule is quality over quantity. Use it to calibrate taste before you write the direction, and again before the Visuals pass.

These notes come from looking at 108 featured items on 2026-11-11 (20 websites, 16 feed posts, 20 OG images, 20 App Store screenshots, 32 app icons). They say what that work does, in terms you can check on a screen. The work changes every week, so look at the current feed as well.

## Look at the current feed first

```
node <skill folder>/scripts/recent.mjs websites unslop/recent/websites --count 12
```

Categories: `design` (the mixed feed), `websites`, `app-store-screenshots`, `app-icons`, `og-images`, `launch-videos`. The script saves the images and an `index.md` with each title and link. Open six or more of the images and look at them. Pick the category nearest to what you are making: `websites` for a landing page, `design` for one component or one app screen, `app-icons` for an icon.

Take qualities, never a subject, palette or layout. This is the same rule as for the references in [refs.md](refs.md).

## What the work has in common

1. **One subject on an empty field.** Augen shows one head in profile on white. Podium shows one shape. Cathy Dolle shows one dot. The subject has no card, frame or badge around it, and most of the screen is empty. If a hero holds three things of equal size, cut two.
2. **The ground is white or black, and the content brings the color.** Of the 20 websites, 12 sit on white or off-white, 6 on black, and 2 on one photo or painting that fills the screen. None uses a color gradient as its ground. One (Interfere) has a faint pink wash at one edge.
3. **The headline is smaller than you expect.** Augen sets "Beyond Humanware." at body size in the bottom left corner. Ramp's sign-in screen is one small centered block on a dark texture. Kept puts four words in the top left and the wordmark in the bottom left. Small type on a large empty field reads as confidence. Make the headline large only when type is the visual (point 4).
4. **With no image, the type is the image.** Flim, Ingamana, Harry Atkins and Gregor Collienne fill the width with the name alone, in one heavy grotesque, cropped by the edge or cut by the photos around it. This is the one place for a heavy weight.
5. **Headlines are one plain claim in sentence case.** "Real-time conversations. Real results", "Ship software that never breaks", "The new era of influencing." Each is at most six words on one or two lines, in one sans at medium weight with tight tracking.
6. **The product is shown as it is.** Interfere's hero is its real issue screen with a believable bug, a code diff and a timeline, rising from the bottom edge and cut by the fold. Linear and Cursor use one line of text over one real screen as their App Store screenshot. Nothing is simplified into coloured rectangles.
7. **An idea is drawn as a diagram.** X Advertising shows overlapping circles on one axis with two small labels. The Rare Disease Cluster Explorer draws contour lines around dots. Kept draws a time axis labelled 1Y, 3M, 1M, 1W, 1D, NOW. The lines are one pixel wide, the labels are tiny mono, and there is one colour. For a technical or data product this beats an illustration.
8. **Material comes from the physical world.** Shopify Editions uses a Renaissance painting with a skateboard added. Granola uses a halftone print. Runner uses torn paper collage. Others use ink, glitter, embossed card, dithered pixels. The whole surface lives in that material, type included. It is never a filter on one image.
9. **One control can be the whole piece.** A stepper whose active step fills like liquid. A dark mode toggle with a pixel moon, lit along its lower edge like a real switch. The light there has a source and a meaning: the switch is on. This is the only glow in the sample.
10. **Chrome almost disappears.** Navigation is four or five small text links and at most one small pill button. No sticky bar with a shadow, no announcement strip, no badge row above the headline.

## By surface

| Surface | What the featured work does |
| --- | --- |
| App icon | One object fills about two thirds of the tile, in two or three colours. It is either a flat bold shape (Headspace's orange circle, a white check on stripes) or one fully rendered object with real material (a camera, a radio, an elephant). No text, no thin line glyph, no sparkle. |
| OG image | The name or one sentence of at most eight words, plus one visual. Half of the sample is the wordmark alone on a ground (Paper, Lightspark, Ingamana). Type is large enough to read at 300 px wide. |
| App Store screenshot | Two lines of at most six words at the top, then one device or one scene. The first screenshot is often a poster from the brand's world (Flighty's plane, Ivory's elephant) and the interface starts on the second. |
| Landing hero | Points 1 to 6. The first screen holds one claim, one visual and at most two actions. |
| App screen | Points 6, 7, 9 and 10. Dense, real, quiet, with one crafted moment. |

## Where this meets the nine passes

- For apps and dashboards the passes win: neutral surfaces, weights 400 to 600, no decoration.
- For landing pages, brand surfaces, icons and OG images, follow the direction. If the direction calls for heavy display type (point 4) or a whole-surface material (point 8), use it across the whole surface.
- One serif italic word inside a sans headline appears once in the sample (Interfere, "never *breaks*"). Treat it as that brand's signature, not as a pattern to copy.
- Template check: point 1 and point 2 are already common. A white page with one centered object is the next template if the object could belong to any product. The subject must come from the world in the direction.
