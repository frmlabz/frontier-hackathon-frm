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
- Tomatoes: 4 kg, minimum 10 kg, from Adriatic Fresh Produce
- Lemons: 3 kg, minimum 4 kg, from Adriatic Fresh Produce
- Fresh basil: 2 bunch, minimum 5 bunch, from Adriatic Fresh Produce
- Garlic: 1.5 kg, minimum 1 kg, from Adriatic Fresh Produce
- Olive oil: 6 L, minimum 10 L, from Kalamata Imports
- Feta: 2 kg, minimum 5 kg, from Kalamata Imports
- Kalamata olives: 4 kg, minimum 2 kg, from Kalamata Imports
- Chicken thighs: 5 kg, minimum 8 kg, from Novak Butchers
- Lamb shoulder: 3 kg, minimum 4 kg, from Novak Butchers
- Flour type 400: 18 kg, minimum 10 kg, from Mlin Flour & Grains
- Arborio rice: 3 kg, minimum 5 kg, from Mlin Flour & Grains
- Sea salt: 4 kg, minimum 2 kg, from Mlin Flour & Grains

## Acceptance
- low-stock-alert: Tomatoes shows "Low".
- list-ingredients: Olive oil is listed.
