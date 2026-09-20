# Evidence behind Readora's design rules

Researched on 2026-09-19 for the first design pass. Each rule in `frontend/AGENTS.md` "Design" traces back to a
source here. "Observed" means the live site was read that day; sites change, so re-check before relying on it.
Items marked **unverified** could not be confirmed from a primary source and are conventions, not evidence.

## Home page
- The first row for a signed-in user is what they were doing: Netflix's homepage ordering puts "Continue Watching"
  first, and a large share of viewing starts from that row.
  https://netflixtechblog.com/learning-a-personalized-homepage-aa8ec670359a
  https://netflixtechblog.com/to-be-continued-helping-you-find-shows-to-continue-watching-on-7c0d8ee4dab6
- Rails with literal headings: readers rely on explicit headings to understand why content is shown; one big
  "Recommended" group is too broad to browse. https://www.nngroup.com/articles/recommendation-guidelines/
  https://www.nngroup.com/articles/recommendation-expectations/
- WEBTOON's home (observed): trending and popular first, then popular by category with genre tabs, new releases, a
  daily schedule. https://www.webtoons.com/en/
- A static hero beats a rotating one; auto-forwarding carousels reduce visibility, hurt readers with motor or
  reading difficulties and should not be used on mobile; show a peeking next item instead of dots.
  https://www.nngroup.com/articles/designing-effective-carousels/ https://www.nngroup.com/articles/auto-forwarding/
- Personalisation helps when it saves progress and lets readers pick up where they left off; it does not replace
  good navigation and search. https://www.nngroup.com/articles/personalization/
  https://www.nngroup.com/articles/personalization-is-over-rated/

## Navigation
- Two links to one page on the same screen add clutter and interaction cost; repeating an item to stress it reduces
  its impact. A picture and its label linking to the same place is fine (one bigger target). Redundant links are
  acceptable when placed far apart. https://www.nngroup.com/articles/duplicate-links/
- Observed: WEBTOON and Comick have no text "Home" link in the desktop header, the logo is home.
  https://www.webtoons.com/en/ https://comick.art/filter
- Hidden navigation (hamburger) roughly halves discoverability and worsens task metrics.
  https://www.nngroup.com/articles/hamburger-menus/
- A bottom navigation bar holds three to five destinations. https://m3.material.io/components/navigation-bar/guidelines
  https://www.nngroup.com/articles/mobile-navigation-patterns/
- Tapas' app (release notes): content tabs at the top, Inbox and Library at the bottom, search top right.
  https://apps.apple.com/us/app/tapas-comics-and-novels/id578836126
- A prominent, always-visible search field makes people search more. https://baymard.com/blog/search-field-design
- Apple HIG tab-bar wording: **unverified** (page not fetchable).

## Series, catalog, reader (pass 2 will use these)
- One primary action that names the next step ("Continue, chapter N"); following a series means being told about new
  chapters (MANGA Plus favourites). https://mangaplus.shueisha.co.jp/faq/eng/
- Catalog: filter panel at the side (sheet on mobile), an applied-filters row with individual removal, several values
  per filter, at least four sorts with the active one visible. https://baymard.com/research/ecommerce-product-lists
  https://baymard.com/blog/current-state-product-list-and-filtering https://baymard.com/blog/essential-sort-types
- "Load more" suits a catalog better than infinite scroll (finding a specific item); infinite scroll only for a
  homogeneous feed. https://www.nngroup.com/articles/infinite-scrolling-tips/
- Reader controls: targets at least 24 by 24 CSS px; sticky chrome must not hide the focused element.
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- Grid density toggles: **unverified** (no study found).

## Visual design
- Dark mode is a preference, not a readability win: light mode performed better in NN/g's study, especially with
  small text. So dark is Readora's default look, and Light and System are always one choice away.
  https://www.nngroup.com/articles/dark-mode/
- In dark themes separate surfaces by tone, not by shadow. https://m3.material.io/styles/elevation/applying-elevation
  https://m3.material.io/blog/tone-based-surface-color-m3
- Artwork is the persuasion surface: keep chrome off it. https://netflixtechblog.com/artwork-personalization-c589f074ad76
- Contrast: 4.5:1 for text, 3:1 for large text and for the outlines of controls, in both themes.
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Line length 50 to 75 characters for prose. https://baymard.com/blog/line-length-readability
- Skeletons for a page or a list loading, spinners only for a single module.
  https://www.nngroup.com/articles/skeleton-screens/
- Reserve the space of every image (width and height or `aspect-ratio`); never lazy-load the LCP image, give it high
  fetch priority, and only it. https://web.dev/articles/optimize-cls https://web.dev/articles/optimize-lcp
- Core Web Vitals targets at the 75th percentile: LCP 2.5 s, INP 200 ms, CLS 0.1. https://web.dev/articles/vitals
- The 2:3 cover ratio and blur-up placeholders: **unverified** as standards. Readora keeps 5:7, the ratio of its
  existing covers and fallback image.

## Accounts, Premium, notifications
- Login walls make people leave; ask for an account after they got value, at the moment it helps.
  https://www.nngroup.com/articles/login-walls/ https://www.nngroup.com/articles/optional-registration/
- No deceptive patterns: no silent renewal after a trial, no guilt-worded declines, no exit popups.
  https://www.nngroup.com/videos/avoid-deceptive-patterns/ https://www.nngroup.com/articles/needy-design-patterns/
- Ask for notification permission only after the reader has seen the value, say what will be sent, keep it
  configurable per series. https://www.nngroup.com/articles/push-notification/

## Accessibility of covers, rails and cards
- A cover inside a link is a functional image: the link's name is the destination (the title), the image `alt=""`.
  Comic pages are images of text: a positional alt ("Page 7") when there is no transcript.
  https://www.w3.org/WAI/tutorials/images/
- The ARIA carousel pattern is for rotating slides with rotation controls. A scrollable list of links that never
  rotates does not need it; its links are reachable with Tab. https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
- Motion from interaction can be disabled with `prefers-reduced-motion` (global rule in `styles.scss`).
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

## CSS features used, and their Baseline status (MDN)
`aspect-ratio` (widely available, 2021), `color-mix()` (2023), `:has()` (2023), `light-dark()` (newly available,
2024), `text-wrap: balance` (newly available, 2024; balancing is limited to a few lines), scroll snap (mature; badge
**unverified**). Not used as load-bearing: scroll-driven animations (limited availability), view transitions and
anchor positioning (newly available; enhancement only). Container queries are Baseline but Readora's rule is one
breakpoint set through `bp.from()`, so the card is sized by its grid cell or rail item instead.
https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
https://developer.mozilla.org/en-US/docs/Web/CSS/:has
https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap-style
https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline

## Font and icons
- Archivo Variable, SIL OFL 1.1, from `@fontsource-variable/archivo` 5.3.0: axes `wght` 100 to 900 and `wdth` 62 to
  125; features `tnum` and `pnum` (read from the font file with fontkit); ascent 878, descent 210, line gap 0 of 1000
  units, used for the fallback face's metric overrides so lines keep their height when the fonts swap. Latin and
  Latin Extended only (176 kB), no italic file. Licence in `frontend/public/licenses/ARCHIVO-OFL.txt`.
- Icons: Lucide, ISC licence (`frontend/public/licenses/LUCIDE-ISC.txt`), path data generated from the
  `lucide-static` devDependency, so nothing is fetched at run time.

## Colours: how they were chosen
`scripts/contrast.mjs` parses the `light-dark()` pairs of `src/styles/_tokens.scss` and checks, in both themes: every
text colour on every surface (4.5:1), text on accent, danger and success fills (4.5:1), control outlines and the
focus ring on every surface (3:1), and coloured text on its own soft tint composited over the surface (4.5:1).
Findings that shaped the palette: in the light theme a bright orange fails as text on the grey surfaces, so the text
accent is a burnt orange (`#a83f00`) and the fill a deeper orange (`#c2410c`) with white text; in the dark theme the
bright orange (`#ff8a3d`) passes everywhere and fills carry dark ink. Run it with `--table` to print every ratio.
