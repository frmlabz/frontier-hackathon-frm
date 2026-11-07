#!/usr/bin/env bash
# Full mock-mode UI QA: drives §12 steps 1-6 through the real browser UI (no API shortcuts), screenshots every step,
# records console errors and horizontal overflow. Run against a fresh mock server:
#   rm -rf data/mock && bun run mock   (then, in another shell)   bash scripts/qa-ui.sh
cd "$(dirname "$0")/.."
OUT=$(realpath -m "${QA_OUT:-logs/qa}"); mkdir -p "$OUT"; rm -f $OUT/*.png
A="npx agent-browser --session bos-qa"

busy() { curl -sf localhost:3000/api/state | grep -q -E '"busy":true|"status":"(generating|building|fixing)"|"status":"working"'; }
waitidle() { sleep 1.5; for i in $(seq 240); do busy || { sleep 1; busy || return 0; }; sleep 0.5; done; echo "TIMEOUT idle"; }
shot() { $A screenshot $OUT/$1.png >/dev/null; }
check() { # name: overflow + errors
  local of; of=$($A eval 'document.documentElement.scrollWidth > innerWidth')
  local er; er=$($A errors 2>&1 | grep -v '^✗$' | head -3)
  echo "[$1] overflow=$of errors=${er:-none}"
  $A errors --clear >/dev/null 2>&1
}
say() { # name text — types into the composer, captures the in-flight state, waits, captures the result
  $A fill 'textarea' "$2" >/dev/null; $A press Enter >/dev/null
  sleep 0.9; shot "$1-a-busy"
  waitidle; sleep 0.5; $A eval 'document.querySelector("main")?.scrollTo?.(0,1e9); window.scrollTo(0,1e9)' >/dev/null; shot "$1-b-done"; check "$1"
}

$A set viewport 1440 900 >/dev/null
$A open http://localhost:3000/ >/dev/null; sleep 1.5; $A errors --clear >/dev/null 2>&1
shot 00-empty-hub; check 00-empty-hub

say 01-intro "I run a small Mediterranean bistro with 8 people."
say 02-suppliers "Suppliers: Adriatic Fresh Produce for veg, Kalamata Imports for olive oil and feta, Novak Butchers for meat, Mlin for flour. They all send invoices by email."
say 03-pain "Biggest pain is stock. We track it in a paper notebook, nobody updates it, and we keep running out of tomatoes and feta. We use tomatoes, feta, olive oil, flour, lemons, chicken, lamb, basil."
say 04-yes "Yes, build that."
curl -sf localhost:3000/api/state | grep -o '"slug":"[a-z-]*","name":"[^"]*"' | head -3
say 05-hire "I need someone to pull supplier invoices from Gmail and update stock."

# Connect Gmail through the card's button
$A eval '[...document.querySelectorAll("button")].find(b=>/Connect Gmail/.test(b.textContent))?.click(); "clicked"'
sleep 0.4; shot 06-gmail-connecting
waitidle; sleep 1; $A eval 'window.scrollTo(0,1e9)' >/dev/null; shot 06-gmail-done; check 06-gmail

# Inventory app after the employee ran
$A open http://localhost:3000/app/inventory >/dev/null; sleep 3; shot 07-app-v1; check 07-app-v1
$A open http://localhost:3000/ >/dev/null; sleep 1.5
say 08-reorder "Add a reorder note column to Inventory."
sleep 3; shot 08-reorder-checks; check 08-reorder-checks
$A open http://localhost:3000/app/inventory/spec >/dev/null; sleep 2; shot 09-spec; check 09-spec
$A open http://localhost:3000/ >/dev/null; sleep 1.5
say 10-photo "Some suppliers hand me paper invoices. I'd like to drop a photo of one into Inventory and have the stock update."
sleep 3; shot 10-photo-checks; check 10-photo-checks

# Step 6 in the app itself: import button → FileDrop → review → apply
$A open http://localhost:3000/apps/inventory/ >/dev/null; sleep 2.5
$A eval '[...document.querySelectorAll("button")].find(b=>/Import invoice/i.test(b.textContent))?.click(); "ok"' >/dev/null; sleep 0.8; shot 11-import-open
$A upload 'input[type=file]' $PWD/fixtures/invoice/invoice-photo.png >/dev/null; sleep 0.6; shot 11-import-reading
sleep 3; shot 11-import-review; check 11-import
$A eval 'document.body.innerText.match(/\d+(\.\d+)? → \d+(\.\d+)?|New item/g)?.join(" | ")'
$A eval '[...document.querySelectorAll("button")].reverse().find(b=>/Update stock|Apply/i.test(b.textContent))?.click(); "ok"' >/dev/null; sleep 0.3; shot 11-import-applying
sleep 2; shot 11-import-applied; check 11-import-applied
curl -sf localhost:3000/api/apps/inventory/ingredients 2>/dev/null | grep -o '"name":"\(Tomatoes\|Zucchini\)"[^}]*"quantity":[0-9.]*' | head

# Other pages at both widths
for w in 1280 1920; do
  $A set viewport $w $([ $w = 1280 ] && echo 800 || echo 1080) >/dev/null
  for p in "" "team" "app/inventory" "app/inventory/spec" "people/purchasing-assistant" "dev/gallery"; do
    $A open "http://localhost:3000/$p" >/dev/null; sleep 2; n="20-${w}-$(echo ${p:-hub} | tr / _)"; shot $n; check $n
  done
  $A open http://localhost:3000/ >/dev/null; sleep 1
  K=$($A eval '[...document.querySelectorAll("nav a, aside a")].map(a=>a.getAttribute("href")).filter(h=>/^\/knowledge\//.test(h))[0]' | tr -d '"')
  [ -n "$K" ] && { $A open "http://localhost:3000$K" >/dev/null; sleep 1.5; shot "20-${w}-knowledge"; check "20-${w}-knowledge"; }
done
$A set viewport 1440 900 >/dev/null
echo QA DONE
