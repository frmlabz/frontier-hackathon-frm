---
app: inventory
emoji: 🥫
---
## Definitions
- :Ingredient: — something the kitchen stocks; has name, category, quantity, unit, minimum and supplier.

## Functional specs
### list-ingredients
Marko sees every :Ingredient: in a table with a search box and a category filter.

### low-stock-alert
An :Ingredient: at or below its minimum shows a red "Low" badge and is counted in a "Low stock" stat.

### add-ingredient
Marko can add an :Ingredient: from an "Add item" form.

### reorder-note
Add a reorder note column to Inventory.

## Starter data
Marko's ingredients: tomatoes, feta, olive oil, flour, lemons, chicken, lamb, basil, with their suppliers. Realistic example stock and minimums; tomatoes and feta start below their minimum.

## Acceptance
- low-stock-alert: Tomatoes shows "Low".
- list-ingredients: Olive oil is listed.
