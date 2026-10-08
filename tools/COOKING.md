# The cooking channel's recipes

The COOKING channel cooks AI-written recipes in a pixel kitchen, and the recipe site lists them for searching. This file covers the recipe data: what a recipe is made of, the rules every recipe follows, and how to add one. The channel and the site are built on top of it later. The plan behind all of this is in the project's `ideas/cooking-channel.md`.

| File | What it is |
| --- | --- |
| `data/cooking/ingredients.json` | The ingredient library: every ingredient a recipe may use, its group, allergens and food-safety facts. Every ingredient here gets pixel art. |
| `data/cooking/recipes/<slug>.json` | One recipe per file |
| `data/cooking/shows.json` | The shows: which recipes each one cooks, for which occasion, in which rundown section, and who cooks it |
| `tools/check_recipes.cjs` | Checks all of the above. Runs on every pull request. |
| `tools/build_recipes.cjs` | Builds the recipe site from all of the above: `recipes/` (the search page, `index.json` and one page per recipe), `sitemap.xml` and `robots.txt` |

Run `node tools/check_recipes.cjs` after any change to `data/cooking/`, then `node tools/build_recipes.cjs` to rebuild the site. GitHub runs `node tools/build_recipes.cjs --check` and fails if the site is out of date. Never edit the generated pages by hand.

## Why so strict

Recipes are written by AI, not tested in a kitchen, and people will cook along by watching. Everything the channel shows (amounts, timers, oven temperatures, heat levels) is generated from the recipe data, so the data has to be right. The checker refuses a recipe rather than letting a wrong number reach the screen.

## The ingredient library

A recipe may only use ingredients in `data/cooking/ingredients.json`, because the channel has to draw every one of them. To use something new, add it to the library first. The art comes with it in the same pull request once the channel exists.

Each ingredient has a `name` and a `group`, plus:
- `allergens`: from milk, egg, wheat, soy, peanut, tree-nut, fish, shellfish, sesame (the US major allergens)
- `safe_f`: the safe inside temperature for raw meat, poultry and fish (165°F for poultry, 160°F for ground beef and sausage, 145°F for whole cuts and fish)
- `must_cook`: eggs and bacon must be cooked on the stove or in the oven after they go in
- `precooked`: deli meats, hot dogs and canned fish, which need no temperature check

The group says which forms an ingredient can take in a recipe (whole, chopped, sliced, melted and so on). The channel draws each form.

## A recipe

```json
{
 "slug": "grilled-cheese",                 // the file name, and the recipe's web address
 "name": "Grilled Cheese",
 "summary": "Golden, buttery bread around melted cheddar.",
 "role": "main",                           // breakfast, starter, main, side, dessert, drink, snack, sauce
 "cuisine": "American",                    // or the country, for Around the world
 "occasions": ["lunch", "comfort"],
 "difficulty": "easy",                     // easy, medium, hard
 "tags": ["kid", "vegetarian"],            // kid, quick, vegetarian, make-ahead
 "serves": 2,
 "time": {"prep": 5, "cook": 8, "total": 15},   // minutes; total covers resting, rising and chilling too
 "allergens": ["milk", "wheat"],
 "ingredients": [
  {"id": "bread", "qty": 4, "unit": "slice", "form": "whole"},
  {"id": "salt", "unit": "to-taste", "form": "ground"}
 ],
 "steps": [
  {"do": "Cook in a pan for 4 minutes, until the bottom is golden.", "tool": "stove", "heat": "medium", "timer": 4, "cue": "golden underneath", "help": true}
 ]
}
```

A step can carry:
- `uses`: the ingredients that go in at this step, with the amount (`{"id": "butter", "qty": 1, "unit": "tbsp"}`). Count each ingredient where it is measured out or added, once.
- `tool`: knife, stove, oven, blender, or none
- `heat` (stove steps): low, medium-low, medium, medium-high, high
- `oven_f` (oven steps): the oven temperature in °F. The channel shows it in °F and °C.
- `timer`: minutes. The channel sets a kitchen timer to exactly this and starts it, then may fast-forward or jump ahead, always showing the real time left.
- `temp_f`: the inside temperature checked at this step
- `cue`: what "done" looks like ("golden brown", "no pink inside")
- `help`: true marks a step "Grown-up helps"

## The rules (the checker enforces all of them)

1. Every ingredient comes from the library, in a form its group allows, with a known unit. Only `to-taste` has no amount.
2. **Amounts add up:** the amounts the steps use equal the amount in the ingredient list, in the same unit, and every listed ingredient is used.
3. **Timers match the words:** a step that says a time ("8 minutes", "1 hour", "30 seconds") has a timer set to that time.
4. **Temperatures match the words:** a step that says a °F temperature carries it as its `oven_f` or `temp_f`. Stove steps have a heat level, and oven steps have an oven temperature.
5. **Food safety:** every raw meat, poultry or fish ingredient is checked at its safe inside temperature in some step, and eggs and bacon are cooked after they go in. No raw-egg dressings or mousses.
6. **Allergens** are exactly the ones the ingredients carry.
7. **Kid recipes** are never hard, and every knife, stove or oven step is marked "Grown-up helps".
8. **Quick** means 15 minutes or less in total. **Vegetarian** means no meat or fish, including hidden ones like anchovies, Worcestershire sauce and dashi.

## Shows and the rundown

A show cooks one or more recipes for an occasion. It doesn't have to be starter, main and dessert: breakfast can be pancakes and fruit, and lunch can be one sandwich. Each show belongs to one rundown section:

| Section | Share of the 3-hour cycle | What goes in it |
| --- | --- | --- |
| `popular` | about half | crowd favourites |
| `season` | about a quarter | the season and holidays coming up (give the show a `season`) |
| `world` | about a quarter | one country's food (give the show a `country`; the kitchen window shows that country) |

`cooks` picks the pair in the kitchen: `two-adults`, `parent-child`, `two-elders` or `grandparent-grandchild`. A show made only of kid recipes is cooked by a parent and child or a grandparent and grandchild.

**No repeats within 6 hours:** each section must hold at least two cycles' worth of airtime. Until the channel exists, the checker estimates airtime like this: 3 minutes a show (the opening and the table), plus for each recipe 1 minute of introduction, 1 minute a step and half a minute for every timer it skips. The channel's real pacing replaces that estimate when it is built. Every recipe has to be in at least one show.
