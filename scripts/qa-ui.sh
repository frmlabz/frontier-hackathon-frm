#!/usr/bin/env bash
# Full mock-mode UI QA: drives the §12 demo (02-demo-spec.md) through the real browser UI (no API shortcuts),
# screenshots every step, and records console errors and horizontal overflow. Exits non-zero if any screen has either.
# Run against a fresh mock server:
#   rm -rf data/mock && bun run mock   (then, in another shell)   bash scripts/qa-ui.sh
# QA_BASE overrides the server (default http://localhost:3000); QA_OUT the screenshot dir (default logs/qa).
cd "$(dirname "$0")/.."
BASE="${QA_BASE:-http://localhost:3000}"
OUT=$(realpath -m "${QA_OUT:-logs/qa}"); mkdir -p "$OUT"; rm -f $OUT/*.png
A="npx agent-browser --session bos-qa"
FAILS=0

state() { curl -sf "$BASE/api/state"; }
busy() { state | grep -q -E '"busy":true|"status":"(generating|building|fixing|researching)"|"status":"working"'; }
waitidle() { sleep 1.5; for i in $(seq 240); do busy || { sleep 1; busy || return 0; }; sleep 0.5; done; echo "TIMEOUT idle"; FAILS=$((FAILS + 1)); }
shot() { $A screenshot $OUT/$1.png >/dev/null; }
bottom() { $A eval 'document.querySelector("main")?.scrollTo?.(0,1e9); window.scrollTo(0,1e9); "ok"' >/dev/null; }
check() { # name: overflow + errors
  local of; of=$($A eval 'document.documentElement.scrollWidth > innerWidth')
  local er; er=$($A errors 2>&1 | grep -v '^✗$' | head -3)
  echo "[$1] overflow=$of errors=${er:-none}"
  { [ "$of" = "true" ] || [ -n "$er" ]; } && FAILS=$((FAILS + 1))
  $A errors --clear >/dev/null 2>&1
}
say() { # name text — types into the composer, captures the in-flight state, waits, captures the result
  $A fill 'textarea' "$2" >/dev/null; $A press Enter >/dev/null
  sleep 0.9; bottom; shot "$1-a-busy"
  waitidle; sleep 0.5; bottom; shot "$1-b-done"; check "$1"
}
click() { # button text regex
  $A eval "[...document.querySelectorAll('button')].find(b=>/$1/.test(b.textContent))?.click(); 'ok'" >/dev/null
}

$A set viewport 1440 900 >/dev/null
$A open $BASE/ >/dev/null; sleep 1.5; $A errors --clear >/dev/null 2>&1
shot 00-empty-hub; check 00-empty-hub

# 1–3. Discovery, then the report streams in the chat
say 01-intro "I run a small Mediterranean bistro. Ana is my head chef, Luka is sous-chef, Jovan and Mila are line cooks, Sara, Nikola and Tea wait tables, and Petar manages the place."
say 02-pain "The hardest part is inventory management and intake. We track stock in a paper notebook that nobody keeps up to date, so we run out of tomatoes and feta mid-service. Deliveries come in all week, the invoices arrive by email, and someone has to copy them into the notebook by hand."
$A fill 'textarea' "Petar spends about 5 hours a week copying invoices, and we run out of something two or three times a week. We do around 120 covers a day and spend about €9,000 a month on food." >/dev/null
$A press Enter >/dev/null
sleep 3; bottom; shot 03-sizing-researching
waitidle; sleep 0.5; bottom; shot 03-sizing-done; check 03-sizing
REPORT=$(state | grep -o '"reports":\[{"id":"[^"]*"' | grep -o '[^"]*"$' | tr -d '"')
echo "report cards: $(state | grep -o '"kind":"report_card"' | wc -l), report: $REPORT"

# The report page, then back to the Hub
$A open "$BASE/report/$REPORT" >/dev/null; sleep 2; shot 03-report; check 03-report
$A eval '[...document.querySelectorAll("[data-tile] button")][0]?.click(); "ok"' >/dev/null; sleep 0.3; shot 03-report-details
$A open $BASE/ >/dev/null; sleep 1.5

# 4–5. The choice, then stock; the CEO builds without a second yes
say 04-yes "Yes, let's start with that."
say 05-stock "Adriatic Fresh Produce for veg, Kalamata Imports for olive oil and feta, Novak Butchers for meat, Mlin for flour. Right now we have 4 kg tomatoes (need 10), 2 kg feta (need 5), 6 L olive oil (need 10), 3 kg lemons (need 4), 2 bunches of basil (need 5), 1.5 kg garlic (need 1), 4 kg Kalamata olives (need 2), 5 kg chicken thighs (need 8), 3 kg lamb shoulder (need 4), 18 kg flour (need 10), 3 kg arborio rice (need 5) and 4 kg sea salt (need 2)."
state | grep -o '"slug":"[a-z-]*","name":"[^"]*"' | head -3

# 6. Hire, then connect Gmail through the card: chooser → Marko → consent → Allow
say 06-hire "I need someone to pull supplier invoices from Gmail and update stock."
click "Connect Gmail"
sleep 0.6; shot 06-gmail-chooser
$A eval 'document.querySelector("[role=dialog] [data-account]")?.click(); "ok"' >/dev/null; sleep 0.4; shot 06-gmail-consent
$A eval '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.trim()==="Allow")?.click(); "ok"' >/dev/null
sleep 0.4; shot 06-gmail-connecting
waitidle; sleep 1; bottom; shot 06-gmail-done; check 06-gmail

# Inventory app after the employee ran
$A open $BASE/app/inventory >/dev/null; sleep 3; shot 07-app-v1; check 07-app-v1
$A open $BASE/ >/dev/null; sleep 1.5

# 7. Change the app
say 08-reorder "Add a reorder note column to Inventory."
sleep 3; shot 08-reorder-checks; check 08-reorder-checks
$A open $BASE/app/inventory/spec >/dev/null; sleep 2; shot 09-spec; check 09-spec
$A open $BASE/ >/dev/null; sleep 1.5

# 8. Photo import
say 10-photo "Some suppliers hand me paper invoices. I'd like to drop a photo of one into Inventory and have the stock update."
sleep 3; shot 10-photo-checks; check 10-photo-checks

# Photo import in the app itself: import button → FileDrop → review → apply
$A open $BASE/apps/inventory/ >/dev/null; sleep 2.5
click "Import invoice"; sleep 0.8; shot 11-import-open
$A upload 'input[type=file]' $PWD/fixtures/invoice/invoice-photo.png >/dev/null; sleep 0.6; shot 11-import-reading
sleep 3; shot 11-import-review; check 11-import
$A eval 'document.body.innerText.match(/\d+(\.\d+)? → \d+(\.\d+)?|New item/g)?.join(" | ")'
$A eval '[...document.querySelectorAll("button")].reverse().find(b=>/Update stock|Apply/i.test(b.textContent))?.click(); "ok"' >/dev/null; sleep 0.3; shot 11-import-applying
sleep 2; shot 11-import-applied; check 11-import-applied
curl -sf $BASE/api/apps/inventory/ingredients 2>/dev/null | grep -o '"name":"\(Tomatoes\|Zucchini\)"[^}]*"quantity":[0-9.]*' | head

# Connectors page: search, then the generic consent (Slack) and Disconnect
$A open $BASE/connectors >/dev/null; sleep 1.5; shot 12-connectors; check 12-connectors
$A eval 'document.querySelector("[data-connector=slack] button")?.click(); "ok"' >/dev/null; sleep 0.5; shot 12-slack-consent
$A eval '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.trim()==="Allow")?.click(); "ok"' >/dev/null; sleep 1.5; shot 12-slack-connected; check 12-slack
$A eval 'document.querySelector("[aria-label=\"Slack options\"]")?.click(); "ok"' >/dev/null; sleep 0.3; click "Disconnect"; sleep 1; check 12-slack-disconnected
echo "connected: $(state | grep -o '"provider":"[a-z-]*"' | tr '\n' ' ')"

# Every page at three widths
for w in 390 1280 1920; do
  h=$([ $w = 390 ] && echo 844 || { [ $w = 1280 ] && echo 800 || echo 1080; })
  $A set viewport $w $h >/dev/null
  for p in "" "team" "connectors" "report/$REPORT" "app/inventory" "app/inventory/spec" "people/purchasing-assistant" "dev/gallery"; do
    $A open "$BASE/$p" >/dev/null; sleep 2; n="20-${w}-$(echo ${p:-hub} | tr / _)"; shot $n; check $n
  done
  $A open $BASE/ >/dev/null; sleep 1
  K=$($A eval '[...document.querySelectorAll("nav a, aside a")].map(a=>a.getAttribute("href")).filter(h=>/^\/knowledge\//.test(h))[0]' | tr -d '"')
  [ -n "$K" ] && { $A open "$BASE$K" >/dev/null; sleep 1.5; shot "20-${w}-knowledge"; check "20-${w}-knowledge"; }
done
$A set viewport 1440 900 >/dev/null
[ $FAILS = 0 ] && echo "QA PASSED" || { echo "QA FAILED: $FAILS screen(s) with errors or overflow"; exit 1; }
