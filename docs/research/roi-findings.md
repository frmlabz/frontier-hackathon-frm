# ROI findings for the demo report (web research, 2026-11-08)

This is the raw material for `fixtures/research/report.json`, the report the mock (:3001) shows. It is also the reference shape for live runs. Every quote below was read on the live page on 2026-11-08 and copied word for word.

## Sources

| id | Source | Kind | Verbatim quotes (checked) |
|---|---|---|---|
| S1 | Champions 12.3 (WRI + WRAP), *The Business Case for Reducing Food Loss and Waste: Restaurants*, Feb 2019. https://champions123.org/the-business-case-for-reducing-food-loss-and-waste-restaurants/ | study | "A review of 114 restaurants across 12 countries found that nearly every site achieved a positive return" · "with the average restaurant saving $7 for every $1 invested in reducing kitchen food waste." · "Within just one year, the restaurants had reduced food waste from their kitchens by 26 percent on average" · "over 75 percent had recouped their investment." · "Within two years, 89 percent had recouped their investment." · "Every site was able to keep their total investment below $20,000." |
| S2 | LeanPath, *5 Food Waste Myths to Debunk – Now!* (webinar page), July 2016. https://info.leanpath.com/webinars/072016-myths-registration | vendor | "Most foodservice operations throw away between 4-10% of the food they purchase before it's ever served to a guest." |
| S3 | Stampli, *How to Calculate the True Cost of AP Automation* (year not shown). https://www.stampli.com/blog/ap-automation/ap-automation-cost/ | vendor (cites APQC) | "According to accounts payable benchmarking research by the American Productivity and Quality Center (APQC), companies using manual data entry processes only process 6,082 invoices per year per FTE and companies with fully-automated accounts payable processes handle 23,333 invoices per year per FTE." |

### Corrections from the first pass

- **S1:**
  - The year-one payback share is "over 75 percent", not 76%.
  - The return is "$7 for every $1 invested". The page doesn't say "7:1 benefit-cost ratio over 3 years"; that wording comes from secondary coverage.
  - The page has no line saying the results can't be generalised. The caveat stays, but as our own statement, not attributed to the authors.
- **S2:**
  - The Sodexo URL (`ie.sodexo.com/…/getting-smart-about-food-waste-1.html`) returns 404, so it is replaced by LeanPath's own page, which carries the same figure.
  - hotelbusiness.com refuses automated fetches (403).
- **S3:**
  - The $7.75 and $2.02 per-invoice costs are not used. $7.75 is Stampli's own calculation, and $2.02 has no source on the page. Only the APQC throughput figures are used.

The following sources were rejected and must not be used:

- "Cut waste by 60/70/85%" listicles (thebrandindustry, poolrepairguy). No sources.
- A "32% average, ScienceDirect" claim quoted secondhand with no citation.
- "Only 20% of restaurants measure waste" (duck-hub). Not traced to a primary source.
- Restaurant365's "$400M saved in 2024". An aggregate marketing figure that doesn't scale to one restaurant.
- Stock-outs and 86'd items: no restaurant-specific survey with a lost-sales percentage was found. The report says so rather than borrowing retail numbers.

## Estimates for the demo inputs

Marko's numbers from demo message 3: 5 h/week copying invoices, a stock-out 2–3×/week, 120 covers/day, €9,000/month on food. The estimates are computed in code from structured references (see `05` §4.2), not written by the model. Finding ids match `fixtures/research/report.json` (`05` §5): F1 $7 per $1, F2 26%, F3 over 75%, F4 89%, F5 4–10%, F6 6,082, F7 23,333.

| id | Estimate | Computation | Result |
|---|---|---|---|
| E3 | Food wasted in the kitchen today | €9,000 × 4–10% (F5) | €360–900/month |
| E1 | Waste cut in year one | €9,000 × 4–10% (F5) × 26% (F2) | **€94–234/month** |
| E4 | Kitchen waste after that cut | €9,000 × 4–10% (F5) × (1 − 26%) (F2) | €266–666/month |
| E2 | Time back from automated invoice intake | 5 h × (1 − 6,082/23,333) (F6, F7) | **≈ 3.7 h/week** |
| E5 | Invoice work left after automation | 5 h × 6,082/23,333 (F6, F7) | ≈ 1.3 h/week |

Two figures are deliberately not computed:

- **Payback:** Marko's cost is unknown. The report shows S1 instead: over 75% of sites paid back within a year, 89% within two.
- **Stock-outs:** there is no sourced figure. The report shows his own number (2–3×/week) and the caveat.

Covers/day (120) goes in "You told us" only. No per-cover math.

## Charts

1. **Headline tiles:**
   - €94–234/month less waste (E1).
   - ~3.7 h/week back (E2).
   - A study tile: "$7 saved per $1 invested · average of 114 restaurants" (F1).
2. **Possible kitchen waste (range bars):** before €360–900 (E3), and after the 26% cut €266–666 (E4).
3. **Invoice time per week (bars):** 5 h today vs about 1.3 h (E5).
4. **Payback (step):** over 75% of sites by year 1, 89% by year 2 (F3, F4).
5. **Source chips:** Study / Vendor claim on every finding and in the source list.

## Caveats the report carries

- S1 is an average across 114 restaurants in 12 countries. It isn't a prediction for one restaurant, and it measures food-waste programs, not an inventory app on its own.
- S2 and S3 come from software vendors. The 4–10% waste range and the ~74% time saving are their figures, not measurements at Marko's Bistro.
- The invoice benchmark covers fully automated accounts payable. Reading supplier invoices into Inventory is narrower work and may save less.
- Nothing solid was found on lost sales from stock-outs.
