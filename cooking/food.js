/* PBC Cooking: the ingredient art (tools/LOOK_BOOK.md, section 6). Every ingredient in data/cooking/ingredients.json has
   an entry in ART, and tools/check_recipes.cjs fails when one is missing, so a recipe can only use food the show can draw.
   Food is seen from above, on the counter and in the pan; jars, bottles and bags lean back a little so their labels read.
   - ART[id] = [shape, skin, flesh, accent, fill]   shape: how the whole thing is drawn (SHAPES below). skin: its outside
       color. flesh: its inside, or what's in the jar. accent: stems, lids, labels. fill: how it looks loose in a bowl, a
       measuring cup or a pan (FILLS below; the shape's default when left out).
   - item(g, id, x, y, s)              the whole ingredient in a 16 x 16 cell, s screen pixels to an art pixel
   - unit(g, id, unit, x, y, s)        one of a counted unit: a clove, a leaf, a slice, a sprig, a stalk, a sheet, a can
   - loose(g, id, form, cx, cy, rx, ry, s, n, ox, oy)   the ingredient in its form (chopped, sliced, melted...) filling an
                                       ellipse in art pixels from ox, oy; n from 0 to 1 is how full
   - measure(use) / drawMeasure(g, part, x, y, full, t)   the measuring tools for one amount, laid out by the caller:
       cups, spoons and 4-cup jugs that add up to the amount exactly, a scale for weights, or the exact count of pieces
   - color(id)                         the ingredient's main color, for spills and dishes
   Amounts on screen come from the recipe; the art only ever shows the same amount, never a different one. */
(function(root){
"use strict";
const S_ = {};   // shared drawing state: context, origin and scale
function mix(a, b, k){
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
const dk = (c, k) => mix(c, "#000000", k === undefined ? .28 : k), lt = (c, k) => mix(c, "#ffffff", k === undefined ? .4 : k);

/* ---------- the library ----------
   Skins and fleshes are real food colors; accents are stems, lids and labels. */
const ART = {
  // vegetables
  "onion": ["round", "#c98a3a", "#f4efe6", "#8b5a2b"], "red-onion": ["round", "#8e2f5a", "#ead0e2", "#5a2a3a"],
  "shallot": ["bulb", "#b0704a", "#e8c8d8", "#7a4a2c"], "garlic": ["bulb", "#efe8da", "#f8f4ea", "#c9b89a"],
  "green-onion": ["stick", "#5fbf6f", "#e8f4d8", "#f4efe6"], "tomato": ["round", "#e5383b", "#f07a6a", "#3f8f3a"],
  "cherry-tomatoes": ["cluster", "#e5383b", "#f07a6a", "#3f8f3a"], "lettuce": ["leafy", "#8fd36a", "#d8f0b0", "#5fbf6f", "leaves"],
  "romaine": ["leaves", "#5fbf6f", "#c8eca0", "#e8f4d8", "leaves"], "spinach": ["leaves", "#2f7a3a", "#4f9a4a", "#5fbf6f", "leaves"],
  "kale": ["leaves", "#2a5a3a", "#3f7a4a", "#5f9a6a", "leaves"], "cabbage": ["leafy", "#a8d890", "#e8f4d0", "#7ab870", "strands"],
  "celery": ["stick", "#9ad86a", "#d8f0b0", "#5fbf6f"], "carrots": ["long", "#f2902a", "#f6b04a", "#3f8f3a"],
  "potatoes": ["oval", "#b8895a", "#f2e3a8", "#8b5a2b"], "sweet-potato": ["oval", "#a5523a", "#f2902a", "#7a3a2a"],
  "broccoli": ["floret", "#3f8f3a", "#6abf5a", "#8fd36a"], "cauliflower": ["floret", "#f4efe6", "#f8f4ea", "#8fd36a"],
  "green-beans": ["stick", "#4fa84a", "#8fd36a", "#3f8f3a"], "peas": ["cluster", "#6abf4a", "#9ad86a", "#4fa84a", "balls"],
  "corn": ["corn", "#f6d24a", "#fbe58a", "#9ad86a", "balls"], "asparagus": ["stick", "#5f9a4a", "#9ad86a", "#8e5a8a"],
  "mushrooms": ["mush", "#a5835a", "#e8dcc4", "#7a5a3a"], "bell-pepper": ["pepper", "#e5383b", "#f07a6a", "#3f8f3a"],
  "jalapeno": ["chili", "#3f8f3a", "#9ad86a", "#2a5a2a"], "cucumber": ["long", "#3f7a3a", "#c8eca0", "#2a5a2a"],
  "zucchini": ["long", "#2f6a3a", "#e8f0b0", "#8b7a3a"], "eggplant": ["oval", "#4a2a5a", "#f2ecc8", "#3f8f3a"],
  "butternut-squash": ["gourd", "#e8b060", "#f2902a", "#8b5a2b"], "avocado": ["half", "#2f4a2a", "#c8e070", "#8b5a2b"],
  "bean-sprouts": ["sprouts", "#f4efe6", "#f8f4ea", "#d8e070", "strands"], "ginger": ["knob", "#c8a070", "#f2e0a0", "#a5835a"],
  // fruit
  "lemon": ["round", "#f6e27a", "#fff2b0", "#3f8f3a", "liquid"], "lime": ["round", "#5fbf6f", "#c8eca0", "#3f8f3a", "liquid"],
  "orange": ["round", "#f2902a", "#f6b04a", "#3f8f3a", "liquid"], "apples": ["round", "#d8343c", "#f4ecc8", "#6b4a2e"],
  "pears": ["pear", "#b8c84a", "#f4f0c8", "#6b4a2e"], "banana": ["banana", "#f6d24a", "#f8f0c8", "#6b4a2e"],
  "strawberries": ["berry", "#e5383b", "#f07a7a", "#3f8f3a"], "blueberries": ["cluster", "#3a4a9a", "#5a6ab8", "#2a2a5a", "balls"],
  "raspberries": ["cluster", "#d8345a", "#e8607a", "#a52440", "balls"], "grapes": ["cluster", "#7a3a8a", "#a05ab0", "#6b4a2e", "balls"],
  "cherries": ["cluster", "#a51e32", "#c83a4a", "#5a3a2a", "balls"], "peaches": ["round", "#f6a070", "#f6c060", "#6b4a2e"],
  "mango": ["oval", "#e8a030", "#f6c040", "#7ab040"], "pineapple": ["pine", "#d8a040", "#f6e070", "#3f8f3a"],
  "watermelon": ["melon", "#3f8f3a", "#e8505a", "#2a2a2a"], "cranberries": ["cluster", "#b8283e", "#d84a5a", "#7a1a2a", "balls"],
  "coconut": ["round", "#6b4a2e", "#f4f5fb", "#4a3020"],
  // herbs
  "basil": ["sprig", "#3f9a3a", "#6abf5a", "#2f6a2a", "leaves"], "cilantro": ["sprig", "#4fa84a", "#7ac86a", "#3f7a3a", "leaves"],
  "parsley": ["sprig", "#2f8a3a", "#5fbf6f", "#2f6a2a", "leaves"], "thyme": ["needle", "#6a8a5a", "#8aaa6a", "#5a4a3a", "leaves"],
  "sage": ["sprig", "#8aa88a", "#a8c0a0", "#5a6a5a", "leaves"], "rosemary": ["needle", "#3f6a4a", "#5f8a5a", "#5a4a3a", "leaves"],
  "mint": ["sprig", "#4fbf6a", "#8fe08a", "#3f8f4a", "leaves"], "dill": ["needle", "#7ab85a", "#a8d88a", "#5f8a4a", "leaves"],
  "chives": ["stick", "#3f9a3a", "#6abf5a", "#2f6a2a", "leaves"], "oregano": ["sprig", "#5a8a4a", "#7aa86a", "#4a5a3a", "leaves"],
  "bay-leaf": ["leaf", "#8aa860", "#a8c080", "#6a7a4a", "leaves"],
  // meat, fish and eggs
  "egg": ["egg", "#f2e6d0", "#f6c744", "#e0b080", "liquid"], "chicken-breast": ["slab", "#f2b8a8", "#f6d0c0", "#f8e0d8"],
  "chicken-thighs": ["slab", "#e8a090", "#f0b8a8", "#f6e0d0"], "whole-chicken": ["bird", "#f2c8a8", "#f6d8c0", "#f4efe6"],
  "ground-beef": ["mince", "#c8505a", "#d8707a", "#f4dcd8", "mince"], "ground-turkey": ["mince", "#e8b0a0", "#f0c8b8", "#f8e8e0", "mince"],
  "steak": ["slab", "#b83a44", "#c85a62", "#f4e0dc"], "pork-chops": ["chop", "#f0b0a0", "#f4c8b8", "#f8f0e8"],
  "sausage": ["link", "#c87a6a", "#d89080", "#a85a4a"], "turkey-breast": ["slab", "#f2c0b0", "#f6d4c8", "#f8e8e0"],
  "salmon": ["fillet", "#f28a5a", "#f6a878", "#f8e0d0"], "white-fish": ["fillet", "#f4ece4", "#f8f4f0", "#d8ccc4"],
  "shrimp": ["shrimp", "#f4a090", "#f8c0b0", "#e86a4a"], "bacon": ["strip", "#c8505a", "#d86a70", "#f4e0d8"],
  "ham": ["slice", "#f0a0a8", "#f4b8c0", "#f8e0e4"], "deli-turkey": ["slice", "#f2d8c8", "#f6e4d8", "#e8c8b8"],
  "hot-dogs": ["link", "#d0604a", "#e07a64", "#a8463a"], "pepperoni": ["pep", "#b83a34", "#c84a40", "#e8a090"],
  "cooked-turkey": ["slab", "#e8c8a8", "#f2dcc4", "#c89a6a"], "anchovies": ["tin", "#9aa8b0", "#8a6a5a", "#c84a3a"],
  "tuna": ["tin", "#c9ccd6", "#d8b8a0", "#2b8fb3", "flakes"], "tofu": ["block", "#f4f1e8", "#f8f6f0", "#e3ddd0"],
  // dairy and cheese
  "butter": ["butter", "#f6e08a", "#f6d860", "#e3e7f0"], "milk": ["carton", "#f4f5fb", "#f8f8fc", "#2b8fb3"],
  "buttermilk": ["carton", "#f4f5fb", "#f4f2e8", "#5fbf6f"], "cream": ["carton", "#f4f5fb", "#fbf8ee", "#c2417a"],
  "sour-cream": ["tub", "#f4f5fb", "#f8f6f0", "#2b8fb3", "paste"], "yogurt": ["tub", "#f4f5fb", "#f8f8f4", "#e5607f", "paste"],
  "greek-yogurt": ["tub", "#f4f5fb", "#f8f8f4", "#2b5fb0", "paste"], "cream-cheese": ["foil", "#c9ccd6", "#f8f6ee", "#2b5fb0", "paste"],
  "evaporated-milk": ["can", "#f4efe6", "#f4ead0", "#2b5fb0", "liquid"], "cheddar": ["block", "#f2a33a", "#f6b85a", "#d8862a", "shreds"],
  "parmesan": ["wedge", "#f2e0a0", "#f6ecc0", "#d8b870", "powder"], "mozzarella": ["block", "#f6f2e4", "#fbf8ee", "#e3ddd0", "shreds"],
  "fresh-mozzarella": ["ball", "#f8f6ee", "#fbfaf4", "#e3ddd0"], "gruyere": ["wedge", "#f2d080", "#f6e0a0", "#c8a050", "shreds"],
  "swiss": ["swiss", "#f6e08a", "#f8eaa8", "#d8c060", "shreds"], "provolone": ["wheel", "#f4e4b0", "#f8eec8", "#d8b870"],
  "feta": ["block", "#f8f8f4", "#fbfbf8", "#e3e3dc", "crumbs"], "ricotta": ["tub", "#f4f5fb", "#fbfaf4", "#5fbf6f", "paste"],
  "queso-fresco": ["wheel", "#f8f6ee", "#fbfaf4", "#e3ddd0", "crumbs"],
  // bread, wraps and dough
  "bread": ["loaf", "#c8843a", "#f2deb0", "#8b5a2b"], "sourdough": ["boule", "#b8783a", "#f2e2b8", "#7a4a2a"],
  "baguette": ["baguette", "#d8963a", "#f4e2b8", "#8b5a2b"], "tortilla": ["flat", "#f2e2b8", "#f6ecc8", "#c8a060"],
  "corn-tortilla": ["flat", "#f2d27a", "#f6e09a", "#c8a040"], "pita": ["pita", "#e8c88a", "#f4e2b8", "#c8a060"],
  "hamburger-buns": ["bun", "#d89040", "#f2deb0", "#f8f4e0"], "hot-dog-buns": ["hdbun", "#d89040", "#f2deb0", "#b87030"],
  "bagel": ["bagel", "#c8843a", "#f2deb0", "#8b5a2b"], "english-muffin": ["muffin", "#e8d0a0", "#f4e8c8", "#c8a870"],
  "croissant": ["croissant", "#e09a3a", "#f4dca0", "#b8702a"], "puff-pastry": ["sheet", "#f4e4b8", "#f8ecc8", "#e0c890"],
  "pie-crust": ["crust", "#f2deb0", "#f6e8c8", "#d8b878"], "breadcrumbs": ["bag", "#d8963a", "#d8a860", "#b8283e", "crumbs"],
  "panko": ["bag", "#f4efe6", "#f2e2b8", "#e5383b", "crumbs"], "tortilla-chips": ["bag", "#f2b632", "#f2d27a", "#e5383b", "chips"],
  // grains, pasta and beans
  "rice": ["bag", "#f4f5fb", "#f8f8f4", "#2b8fb3", "rice"], "brown-rice": ["bag", "#c8a070", "#d8b888", "#7a4a2c", "rice"],
  "sushi-rice": ["bag", "#f4f5fb", "#fbfaf4", "#e5383b", "rice"], "spaghetti": ["pastabox", "#2b5fb0", "#f2d27a", "#f4f5fb", "longpasta"],
  "pasta": ["pastabox", "#2b8fb3", "#f2d27a", "#f4f5fb", "shortpasta"], "penne": ["pastabox", "#1f7a52", "#f2d27a", "#f4f5fb", "tubes"],
  "egg-noodles": ["bag", "#f6e27a", "#f6d860", "#2b5fb0", "noodles"], "rice-noodles": ["bag", "#f4f5fb", "#f8f6ee", "#e5383b", "noodles"],
  "oats": ["canister", "#b8283e", "#e8d6a8", "#f4efe6", "oats"], "cornmeal": ["bag", "#f2d27a", "#f6d860", "#c4582b", "powder"],
  "quinoa": ["bag", "#e8d6a8", "#f2e2b8", "#5fbf6f", "dots"], "couscous": ["bag", "#f2d27a", "#f6e09a", "#2b8fb3", "dots"],
  "lentils": ["bag", "#c87a3a", "#d8904a", "#5fbf6f", "beans"], "chickpeas": ["can", "#e8c88a", "#e8c88a", "#c4582b", "beans"],
  "black-beans": ["can", "#2a2230", "#3a3040", "#5fbf6f", "beans"], "kidney-beans": ["can", "#8e2f3a", "#a5404a", "#c4582b", "beans"],
  // baking
  "flour": ["bag", "#f4f5fb", "#fbfbf8", "#2b5fb0", "powder"], "sugar": ["bag", "#f4f5fb", "#fbfbfb", "#e5383b", "powder"],
  "brown-sugar": ["bag", "#c8843a", "#b8783a", "#f4efe6", "powder"], "powdered-sugar": ["bag", "#f4f5fb", "#ffffff", "#e5607f", "powder"],
  "baking-powder": ["tin", "#e5383b", "#fbfbf8", "#f4f5fb", "powder"], "baking-soda": ["box", "#f2902a", "#fbfbf8", "#f4f5fb", "powder"],
  "yeast": ["packet", "#e5383b", "#d8b888", "#f6e27a", "powder"], "vanilla": ["vial", "#5a3020", "#6b3a22", "#f4efe6", "liquid"],
  "cocoa": ["tin", "#6b3a22", "#5a3020", "#f4efe6", "powder"], "cornstarch": ["box", "#f6e27a", "#fbfbf8", "#2b5fb0", "powder"],
  "chocolate-chips": ["bag", "#6b3a22", "#4a2a18", "#f2b632", "chips"], "dark-chocolate": ["bar", "#4a2a18", "#3a2010", "#c2417a", "chunks"],
  "sprinkles": ["shaker", "#e5607f", "#f6e27a", "#f4f5fb", "sprinkles"],
  // spices: a small jar of each, tinted by the spice
  "salt": ["shaker", "#f4f5fb", "#fbfbfb", "#c9ccd6", "powder"], "pepper": ["mill", "#2a2230", "#3a3530", "#7a8090", "powder"],
  "cinnamon": ["shaker", "#a5603a", "#b8703a", "#8b5a2b", "powder"], "cumin": ["shaker", "#a5803a", "#b8904a", "#8b5a2b", "powder"],
  "chili-powder": ["shaker", "#b83a2a", "#c84a30", "#8b5a2b", "powder"], "nutmeg": ["shaker", "#a5703a", "#b8804a", "#8b5a2b", "powder"],
  "ground-ginger": ["shaker", "#d8b060", "#e0c070", "#8b5a2b", "powder"], "coriander": ["shaker", "#b8a060", "#c8b070", "#8b5a2b", "powder"],
  "garam-masala": ["shaker", "#8b5a2b", "#9a6a3a", "#c4582b", "powder"], "turmeric": ["shaker", "#f2b632", "#f6c040", "#8b5a2b", "powder"],
  "cardamom": ["shaker", "#a8b080", "#b8c090", "#6a7a4a", "powder"], "cloves": ["shaker", "#5a3020", "#6b3a22", "#8b5a2b", "seeds"],
  "mustard-powder": ["shaker", "#f2d040", "#f6dc60", "#8b5a2b", "powder"], "paprika": ["shaker", "#d84a2a", "#e05a3a", "#8b5a2b", "powder"],
  "smoked-paprika": ["shaker", "#a5302a", "#b8403a", "#5a3020", "powder"], "red-pepper-flakes": ["shaker", "#c83a2a", "#e8a050", "#8b5a2b", "seeds"],
  "garlic-powder": ["shaker", "#f2e2b8", "#f6ecc8", "#8b5a2b", "powder"], "onion-powder": ["shaker", "#f2deb0", "#f6e8c8", "#8b5a2b", "powder"],
  "italian-seasoning": ["shaker", "#6a8a4a", "#7a9a5a", "#c4582b", "seeds"], "curry-powder": ["shaker", "#e8a830", "#f0b840", "#8b5a2b", "powder"],
  "cayenne": ["shaker", "#d8402a", "#e8503a", "#8b5a2b", "powder"], "allspice": ["shaker", "#7a4a2c", "#8b5a3a", "#5a3020", "powder"],
  "dried-oregano": ["shaker", "#6a8a4a", "#7a9a5a", "#8b5a2b", "seeds"],
  // oils, sauces and jars
  "olive-oil": ["bottle", "#3f7a3a", "#c8c040", "#2a2f3a", "liquid"], "vegetable-oil": ["bottle", "#f6e27a", "#f6e08a", "#f2b632", "liquid"],
  "sesame-oil": ["bottle", "#8b5a2b", "#c8803a", "#e5383b", "liquid"], "soy-sauce": ["bottle", "#2a1810", "#3a2010", "#e5383b", "liquid"],
  "mayonnaise": ["jar", "#f4f5fb", "#f8f4e4", "#2b5fb0", "paste"], "mustard": ["jar", "#f2d27a", "#c8a030", "#2a2f3a", "paste"],
  "yellow-mustard": ["squeeze", "#f6d024", "#f6d024", "#e5383b", "paste"], "ketchup": ["squeeze", "#d8282e", "#c8202a", "#f4f5fb", "paste"],
  "honey": ["honey", "#f2b632", "#f2a020", "#e5383b", "liquid"], "maple-syrup": ["bottle", "#b8702a", "#a85a20", "#f4efe6", "liquid"],
  "peanut-butter": ["jar", "#c8843a", "#c8843a", "#e5383b", "paste"], "jam": ["jar", "#b8283e", "#a51e32", "#f4efe6", "paste"],
  "salsa": ["jar", "#d84a2a", "#c83a2a", "#5fbf6f", "chunks"], "hot-sauce": ["bottle", "#d8282e", "#c8202a", "#2a2f3a", "liquid"],
  "worcestershire": ["bottle", "#3a2010", "#4a2a18", "#f2b632", "liquid"], "red-wine-vinegar": ["bottle", "#8e1f3a", "#a5304a", "#f4efe6", "liquid"],
  "balsamic": ["bottle", "#2a1418", "#3a1c20", "#f2b632", "liquid"], "rice-vinegar": ["bottle", "#f4efe6", "#f8f4ea", "#e5383b", "liquid"],
  "tomato-paste": ["can", "#e5383b", "#b8282e", "#f4f5fb", "paste"], "canned-tomatoes": ["can", "#e5383b", "#d8382e", "#3f8f3a", "chunks"],
  "pumpkin-puree": ["can", "#f2902a", "#e8802a", "#f4efe6", "paste"], "cranberry-sauce": ["can", "#a51e32", "#b8283e", "#f4efe6", "paste"],
  "chicken-stock": ["carton", "#f2b632", "#e8c870", "#c4582b", "liquid"], "beef-stock": ["carton", "#8b5a2b", "#a0703a", "#f4efe6", "liquid"],
  "vegetable-stock": ["carton", "#5fbf6f", "#d8c070", "#f4efe6", "liquid"], "gochujang": ["tub", "#b8283e", "#a5202a", "#2a2f3a", "paste"],
  "miso": ["tub", "#e8c070", "#d8a860", "#b8283e", "paste"], "dashi": ["carton", "#f4efe6", "#e8d8a0", "#2b5fb0", "liquid"],
  "nori": ["nori", "#1e3a2a", "#2a4a34", "#3f6a4a"], "wakame": ["bag", "#2a5a3a", "#3f7a4a", "#f4efe6", "leaves"],
  "water": ["glass", "#bfe8ff", "#8fd3ff", "#e3e7f0", "liquid"],
  // drinks
  "apple-cider": ["jug", "#c8802a", "#b8702a", "#f4efe6", "liquid"], "ground-coffee": ["bag", "#2a1810", "#5a3020", "#f2b632", "powder"],
  "ice": ["ice", "#d8ecf0", "#e8f6fa", "#bfe8ff", "ice"],
  // nuts, seeds and dried fruit
  "almonds": ["nuts", "#b8783a", "#e8c890", "#8b5a2b", "nuts"], "walnuts": ["walnut", "#a5703a", "#c8904a", "#7a4a2a", "nuts"],
  "pecans": ["nuts", "#8b4a2a", "#a5603a", "#5a3020", "nuts"], "peanuts": ["nuts", "#d8a860", "#e8c080", "#a5703a", "nuts"],
  "sesame-seeds": ["seeds", "#f4e8c8", "#f8f0d8", "#d8c8a0", "seeds"], "raisins": ["nuts", "#4a2230", "#5a2a3a", "#2a1418", "nuts"]
};
const DEFAULT_FILL = {cluster: "balls", nuts: "nuts", seeds: "seeds", leafy: "leaves", leaves: "leaves", sprig: "leaves", needle: "leaves",
  leaf: "leaves", bottle: "liquid", carton: "liquid", jug: "liquid", glass: "liquid", vial: "liquid", honey: "liquid", jar: "paste",
  tub: "paste", squeeze: "paste", bag: "powder", box: "powder", tin: "powder", shaker: "powder", mill: "powder", packet: "powder", canister: "powder"};
const spec = id => { const a = ART[id] || ["round", "#c9ccd6", "#e3e7f0", "#7a8090"]; return {shape: a[0], c: a[1], f: a[2], a: a[3], fill: a[4] || DEFAULT_FILL[a[0]] || "pieces"}; };
const color = id => { const s = spec(id); return /bottle|carton|jar|tub|can|bag|box|tin|shaker|mill|packet|canister|squeeze|honey|jug|glass|vial|pastabox/.test(s.shape) ? s.f : s.c; };

/* ---------- drawing primitives, in art pixels ---------- */
function P(c, x, y, w, h){ const {g, ox, oy, s} = S_; g.fillStyle = c; g.fillRect(Math.round(ox + x * s), Math.round(oy + y * s), Math.round(w * s), Math.round(h * s)); }
function ell(cx, cy, rx, ry, c){ for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2))); P(c, cx - hw, cy + dy, hw * 2 + 1, 1); } }
function ball(cx, cy, r, c){ ell(cx + 1, cy + 1, r, r, dk(c, .3)); ell(cx, cy, r, r, c); if (r >= 2) { P(lt(c, .5), cx - r + 2, cy - r + 1, 2, 1); if (r >= 3) P(lt(c, .5), cx - r + 1, cy - r + 2, 1, 1); } }
function oval(cx, cy, rx, ry, c){ ell(cx + 1, cy + 1, rx, ry, dk(c, .3)); ell(cx, cy, rx, ry, c); P(lt(c, .45), cx - rx + 2, cy - ry + 1, Math.max(1, rx - 1), 1); }
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s){ let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function at(g, x, y, s){ S_.g = g; S_.ox = x; S_.oy = y; S_.s = s || 1; }

/* ---------- whole ingredients, each in a 16 x 16 cell ---------- */
const SHAPES = {
  round(c, f, a){ ball(8, 8, 6, c); if (a) { P(a, 8, 1, 1, 2); P(dk(a, 0) , 9, 1, 2, 1); } },
  bulb(c, f, a){ ball(8, 9, 5, c); P(dk(c, .12), 6, 6, 1, 7); P(dk(c, .12), 10, 6, 1, 7); P(a, 8, 2, 1, 3); P(a, 7, 14, 3, 1); },
  oval(c, f, a){ oval(8, 8, 7, 4, c); P(a, 1, 7, 2, 2); P(dk(c, .2), 6, 7, 1, 1); P(dk(c, .2), 11, 9, 1, 1); },
  long(c, f, a){ for (let i = 0; i < 12; i++) { const th = i < 6 ? 4 : i < 10 ? 3 : 2; P(i % 4 ? c : dk(c, .12), 3 + i, 8 - (th >> 1), 1, th); }
    P(lt(c, .4), 3, 6, 6, 1); P(a, 0, 5, 3, 1); P(a, 0, 7, 3, 1); P(a, 1, 9, 2, 1); },
  stick(c, f, a){ [3, 7, 11].forEach(y => { P(dk(c, .2), 1, y + 1, 14, 2); P(c, 1, y, 14, 2); P(lt(c, .4), 1, y, 14, 1); P(a, 13, y, 2, 2); }); },
  leafy(c, f, a){ ball(8, 8, 7, c); ell(8, 8, 4, 4, lt(c, .25)); ell(8, 8, 2, 2, f); P(a, 3, 8, 3, 1); P(a, 11, 7, 3, 1); P(a, 8, 2, 1, 3); P(a, 7, 12, 1, 3); },
  leaves(c, f, a){ oval(5, 8, 3, 7, c); oval(11, 8, 3, 7, f); oval(8, 7, 3, 7, lt(c, .15)); P(a, 8, 1, 1, 13); P(a, 5, 2, 1, 12); P(a, 11, 2, 1, 12); },
  sprig(c, f, a){ P(a, 8, 1, 1, 14); for (let k = 0; k < 5; k++) { P(k % 2 ? f : c, 4, 2 + k * 3, 4, 2); P(k % 2 ? c : f, 9, 3 + k * 3, 4, 2); } P(c, 7, 0, 3, 2); },
  needle(c, f, a){ P(a, 8, 1, 1, 14); for (let k = 0; k < 7; k++) { P(c, 5, 2 + k * 2, 3, 1); P(f, 9, 2 + k * 2, 3, 1); } },
  leaf(c, f, a){ oval(8, 8, 4, 6, c); P(dk(c, .2), 8, 3, 1, 10); P(a, 8, 14, 1, 2); },
  cluster(c, f, a){ [[5, 6], [10, 5], [8, 10], [4, 11], [12, 10], [7, 3]].forEach(([x, y]) => ball(x, y, 2, c)); P(a, 7, 1, 1, 2); P(a, 10, 3, 1, 1); },
  floret(c, f, a){ P(a, 7, 10, 3, 5); [[5, 6], [10, 6], [8, 4], [7, 8], [11, 9], [4, 9]].forEach(([x, y]) => ball(x, y, 3, c)); P(f, 6, 4, 1, 1); P(f, 10, 7, 1, 1); },
  pepper(c, f, a){ oval(5, 9, 3, 5, c); oval(11, 9, 3, 5, c); oval(8, 8, 3, 6, lt(c, .12)); P(a, 7, 1, 2, 3); },
  chili(c, f, a){ oval(9, 8, 6, 2, c); P(a, 1, 7, 3, 2); },
  half(c, f, a){ oval(8, 8, 5, 7, c); ell(8, 8, 4, 6, f); ball(8, 10, 2, a); },
  banana(c, f, a){ for (let i = 0; i < 13; i++) { const y = 5 + Math.round(((i - 6) ** 2) / 8); P(dk(c, .2), 2 + i, y + 2, 1, 2); P(c, 2 + i, y, 1, 3); } P(a, 1, 8, 1, 2); P(a, 15, 9, 1, 1); },
  berry(c, f, a){ [5, 6, 6, 6, 5, 5, 4, 3, 2, 1].forEach((w, i) => { P(dk(c, .25), 8 - w + 1, 4 + i, w * 2, 1); P(c, 8 - w, 4 + i, w * 2 - 1, 1); });
    [[6, 6], [10, 7], [8, 10], [5, 10], [11, 11]].forEach(([x, y]) => P(lt(c, .6), x, y, 1, 1)); P(a, 5, 2, 6, 2); P(a, 7, 1, 2, 1); },
  pear(c, f, a){ ball(8, 10, 5, c); ball(8, 5, 3, c); P(a, 8, 1, 1, 2); },
  pine(c, f, a){ oval(8, 10, 5, 5, c); for (let y = 6; y < 15; y += 2) for (let x = 4 + (y % 4 ? 1 : 0); x < 13; x += 3) P(dk(c, .25), x, y, 1, 1); [5, 7, 9, 11].forEach((x, i) => P(a, x, 1 + (i % 2), 1, 4)); },
  melon(c, f, a){ for (let r = 0; r < 10; r++) { const w = 2 + r * 1.2 | 0; P(f, 8 - w, 3 + r, w * 2, 1); } P(c, 2, 13, 12, 2); P(lt(c, .4), 2, 12, 12, 1); [[6, 7], [9, 9], [7, 10], [10, 6]].forEach(([x, y]) => P(a, x, y, 1, 1)); },
  corn(c, f, a){ oval(8, 8, 6, 3, c); for (let x = 4; x < 13; x += 2) { P(dk(c, .15), x, 6, 1, 1); P(dk(c, .15), x, 9, 1, 1); } P(a, 0, 6, 3, 4); P(a, 14, 7, 2, 2); },
  knob(c, f, a){ ball(6, 9, 3, c); ball(10, 8, 3, c); ball(9, 12, 2, c); P(a, 8, 7, 1, 4); },
  gourd(c, f, a){ oval(8, 11, 5, 4, c); oval(8, 5, 3, 4, c); P(a, 8, 0, 1, 2); },
  mush(c, f, a){ ball(8, 8, 5, c); [[6, 6], [10, 7], [8, 10]].forEach(([x, y]) => P(lt(c, .35), x, y, 2, 1)); },
  sprouts(c, f, a){ for (let i = 0; i < 7; i++) { const x = 2 + i * 2; P(c, x, 4 + (i % 3), 1, 9); P(a, x - 1, 3 + (i % 3), 2, 2); } },
  slab(c, f, a){ oval(8, 8, 7, 5, c); P(a, 4, 7, 6, 1); P(a, 9, 10, 4, 1); P(lt(c, .2), 4, 5, 7, 1); },
  chop(c, f, a){ oval(9, 8, 6, 5, c); P(a, 2, 6, 2, 6); P(a, 1, 5, 2, 2); P(lt(c, .2), 6, 5, 6, 1); },
  fillet(c, f, a){ for (let i = 0; i < 14; i++) { const h = i < 3 ? 3 + i : i > 10 ? 3 + (13 - i) : 6; P(c, 1 + i, 8 - (h >> 1), 1, h); } for (let x = 4; x < 13; x += 3) P(a, x, 6, 1, 4); },
  bird(c, f, a){ oval(8, 8, 6, 5, c); ball(3, 12, 2, c); ball(13, 12, 2, c); P(a, 1, 14, 2, 1); P(a, 14, 14, 2, 1); P(lt(c, .3), 6, 5, 4, 1); },
  egg(c, f, a){ oval(8, 8, 4, 5, c); },
  strip(c, f, a){ [4, 9].forEach(y => { for (let x = 1; x < 15; x++) { const w = (x >> 1) % 2; P(c, x, y + w, 1, 3); P(a, x, y + 1 + w, 1, 1); } }); },
  slice(c, f, a){ ell(8, 8, 7, 6, dk(c, .1)); ell(8, 8, 6, 5, c); P(f, 5, 6, 3, 1); P(a, 9, 10, 2, 1); },
  pep(c, f, a){ [[5, 5], [11, 6], [7, 11]].forEach(([x, y]) => { ball(x, y, 3, c); P(a, x - 1, y, 1, 1); P(a, x + 1, y - 1, 1, 1); }); },
  link(c, f, a){ [5, 10].forEach(y => { P(c, 2, y, 12, 3); P(c, 1, y + 1, 14, 1); P(lt(c, .35), 3, y, 9, 1); P(a, 1, y + 1, 1, 1); P(a, 14, y + 1, 1, 1); }); },
  shrimp(c, f, a){ for (let i = 0; i < 9; i++) { const ang = Math.PI * (.2 + i * .16), x = 8 + Math.round(Math.cos(ang) * 5), y = 8 + Math.round(Math.sin(ang) * 5); P(i % 2 ? c : lt(c, .2), x - 1, y - 1, 3, 3); } P(a, 10, 2, 3, 2); },
  mince(c, f, a){ const q = rng(7); ell(8, 8, 7, 5, c); for (let i = 0; i < 30; i++) P(q() < .5 ? f : a, 2 + q() * 12 | 0, 4 + q() * 9 | 0, 1, 1); },
  tin(c, f, a){ P(dk(c, .3), 2, 5, 12, 8); P(c, 2, 4, 12, 8); P(lt(c, .3), 3, 5, 10, 1); P(a, 2, 8, 12, 2); P("#7a8090", 6, 6, 4, 1); },
  block(c, f, a){ P(dk(c, .25), 2, 6, 12, 7); P(c, 2, 5, 12, 6); P(lt(c, .3), 2, 4, 12, 2); P(a, 2, 10, 12, 1); },
  butter(c, f, a){ P(dk(c, .2), 1, 7, 14, 5); P(c, 1, 6, 14, 4); P(lt(c, .3), 1, 5, 14, 2); P(a, 1, 5, 4, 7); P(dk(a, .1), 4, 5, 1, 7); },
  swiss(c, f, a){ SHAPES.wedge(c, f, a); [[7, 9], [10, 11], [6, 12]].forEach(([x, y]) => P(dk(c, .2), x, y, 2, 1)); },
  wedge(c, f, a){ for (let r = 0; r < 9; r++) P(r === 8 ? dk(c, .2) : c, 3, 4 + r, 2 + r, 1); P(a, 3, 4, 1, 9); P(lt(c, .4), 4, 5, 1, 6); },
  ball(c, f, a){ ball(8, 8, 6, c); },
  wheel(c, f, a){ ell(8, 9, 7, 5, dk(c, .2)); ell(8, 8, 7, 5, c); ell(8, 8, 6, 4, lt(c, .2)); P(a, 1, 8, 1, 2); },
  foil(c, f, a){ P(dk(c, .25), 2, 5, 12, 8); P(c, 2, 4, 12, 8); P(a, 3, 6, 10, 4); P("#f4f5fb", 5, 7, 6, 1); },
  carton(c, f, a){ P(dk(c, .2), 4, 4, 8, 11); P(c, 4, 4, 7, 11); P(lt(c, .3), 4, 2, 8, 2); P(dk(c, .25), 5, 1, 6, 1); P(a, 4, 8, 8, 3); },
  jug(c, f, a){ P(dk(f, .2), 3, 5, 10, 10); P(f, 3, 5, 9, 10); P(a, 3, 8, 10, 3); P(lt(f, .3), 6, 3, 4, 2); P("#f4f5fb", 6, 2, 4, 1); P(dk(f, .2), 12, 6, 2, 4); },
  bottle(c, f, a){ P(dk(c, .25), 5, 6, 6, 9); P(c, 5, 6, 5, 9); P(c, 6, 4, 4, 2); P(c, 7, 2, 2, 2); P(a, 7, 1, 2, 1); P(lt(f, .2), 5, 9, 6, 3); P(lt(c, .35), 6, 7, 1, 7); },
  vial(c, f, a){ P(dk(c, .2), 6, 6, 4, 8); P(c, 6, 6, 3, 8); P(a, 6, 4, 4, 2); P(a, 6, 9, 4, 2); },
  honey(c, f, a){ ball(8, 10, 4, c); ball(8, 5, 3, c); P(a, 7, 1, 2, 2); P(lt(c, .3), 6, 9, 2, 3); },
  squeeze(c, f, a){ P(dk(c, .2), 5, 5, 6, 10); P(c, 5, 5, 5, 10); P(a, 6, 2, 4, 3); P(a, 7, 0, 2, 2); P(lt(c, .35), 6, 6, 1, 7); },
  jar(c, f, a){ P(dk(f, .2), 4, 6, 8, 9); P(f, 4, 6, 7, 9); P(a, 4, 3, 8, 3); P(lt(a, .3), 4, 3, 8, 1); P(c, 4, 9, 8, 3); },
  tub(c, f, a){ P(dk(c, .2), 3, 7, 10, 7); P(c, 3, 7, 9, 7); ell(8, 6, 5, 2, lt(c, .3)); P(a, 3, 10, 10, 2); },
  can(c, f, a){ P(dk(c, .25), 4, 5, 8, 10); P(c, 4, 5, 7, 10); ell(8, 4, 4, 1, "#c9ccd6"); P(a, 4, 8, 8, 3); P("#9aa8b0", 4, 14, 8, 1); },
  bag(c, f, a){ P(dk(c, .2), 3, 3, 10, 12); P(c, 3, 3, 9, 12); P(dk(c, .15), 3, 3, 10, 2); P(a, 3, 6, 10, 1); P(f, 5, 9, 6, 4); P(dk(f, .15), 5, 12, 6, 1); },
  box(c, f, a){ P(dk(c, .25), 3, 3, 10, 12); P(c, 3, 3, 9, 12); P(a, 4, 6, 7, 4); P(lt(c, .3), 3, 3, 10, 1); },
  pastabox(c, f, a){ P(dk(c, .25), 2, 4, 12, 10); P(c, 2, 4, 11, 10); P(a, 3, 5, 9, 2); P(f, 4, 9, 8, 3); P(dk(f, .2), 4, 10, 8, 1); },
  canister(c, f, a){ P(dk(c, .25), 4, 4, 8, 11); P(c, 4, 4, 7, 11); ell(8, 3, 4, 1, lt(c, .3)); P(a, 5, 7, 5, 4); },
  tin2(c, f, a){ SHAPES.can(c, f, a); },
  packet(c, f, a){ P(dk(c, .2), 4, 4, 8, 10); P(c, 4, 4, 7, 10); P(a, 4, 7, 8, 2); P(dk(c, .3), 4, 4, 8, 1); },
  shaker(c, f, a){ P("#aeb8c4", 5, 6, 6, 8); P("#d8ecf0", 5, 6, 5, 8); P(c, 6, 8, 4, 6); P(a, 5, 4, 6, 2); P(lt(a, .3), 5, 4, 6, 1); },
  mill(c, f, a){ P(dk(c, .2), 6, 3, 4, 12); P(c, 6, 3, 3, 12); P(a, 5, 7, 6, 2); P(a, 7, 1, 2, 2); },
  loaf(c, f, a){ oval(8, 8, 7, 5, c); [5, 8, 11].forEach(x => P(lt(c, .35), x, 6, 1, 4)); },
  boule(c, f, a){ ball(8, 8, 6, c); P(lt(c, .4), 5, 7, 6, 1); P(lt(c, .4), 8, 4, 1, 8); },
  baguette(c, f, a){ oval(8, 8, 7, 2, c); [4, 7, 10, 13].forEach(x => P(lt(c, .4), x, 7, 2, 1)); },
  flat(c, f, a){ ell(8, 8, 7, 7, dk(c, .1)); ell(8, 8, 7, 6, c); [[5, 5], [10, 7], [7, 11], [11, 11]].forEach(([x, y]) => P(a, x, y, 1, 1)); },
  pita(c, f, a){ oval(8, 8, 7, 5, c); P(lt(c, .3), 4, 6, 6, 1); P(a, 9, 10, 2, 1); },
  bun(c, f, a){ ball(8, 8, 6, c); [[6, 5], [9, 6], [7, 8], [10, 9], [5, 9]].forEach(([x, y]) => P(a, x, y, 1, 1)); },
  hdbun(c, f, a){ oval(8, 8, 7, 3, c); P(a, 3, 8, 10, 1); },
  bagel(c, f, a){ ball(8, 8, 6, c); ell(8, 8, 2, 2, "#3a2a1c"); P(lt(c, .4), 5, 4, 3, 1); },
  muffin(c, f, a){ ball(8, 8, 6, c); [[5, 6], [9, 5], [7, 9], [11, 8], [6, 11], [10, 11]].forEach(([x, y]) => P(a, x, y, 1, 1)); },
  croissant(c, f, a){ for (let i = 0; i < 11; i++) { const y = 9 - Math.round(Math.sin(i / 10 * Math.PI) * 4), h = 2 + Math.round(Math.sin(i / 10 * Math.PI) * 3); P(i % 3 ? c : a, 3 + i, y, 1, h); } },
  sheet(c, f, a){ P(dk(c, .15), 2, 3, 12, 11); P(c, 2, 2, 12, 11); for (let y = 4; y < 13; y += 3) P(a, 3, y, 10, 1); },
  crust(c, f, a){ ball(8, 8, 7, c); ell(8, 8, 5, 5, f); for (let i = 0; i < 12; i++) { const ang = i * Math.PI / 6; P(a, 8 + Math.round(Math.cos(ang) * 6), 8 + Math.round(Math.sin(ang) * 6), 1, 1); } },
  nori(c, f, a){ P(c, 2, 3, 12, 10); P(a, 3, 5, 9, 1); P(a, 4, 9, 7, 1); P(f, 2, 3, 12, 1); },
  nuts(c, f, a){ [[4, 5], [9, 4], [12, 8], [7, 9], [3, 11], [10, 12], [6, 13]].forEach(([x, y]) => { P(dk(c, .25), x, y + 1, 3, 2); P(c, x, y, 3, 2); P(lt(c, .3), x, y, 1, 1); }); },
  walnut(c, f, a){ [[5, 5], [11, 6], [7, 11]].forEach(([x, y]) => { ball(x, y, 3, c); P(a, x, y - 2, 1, 5); }); },
  seeds(c, f, a){ const q = rng(3); for (let i = 0; i < 40; i++) P(i % 4 ? c : a, 3 + q() * 10 | 0, 3 + q() * 10 | 0, 1, 1); },
  bar(c, f, a){ P(a, 2, 3, 12, 11); P(c, 3, 4, 10, 9); for (let x = 3; x < 13; x += 3) P(dk(c, .3), x, 4, 1, 9); P(dk(c, .3), 3, 8, 10, 1); },
  glass(c, f, a){ ell(8, 8, 6, 6, a); ell(8, 8, 5, 5, f); P(lt(f, .5), 5, 5, 3, 1); },
  ice(c, f, a){ [[2, 3], [9, 2], [5, 9], [11, 9]].forEach(([x, y]) => { P(a, x, y + 4, 5, 1); P(c, x, y, 5, 4); P(f, x, y, 5, 1); P("#ffffff", x + 1, y + 1, 1, 1); }); }
};
function item(g, id, x, y, s){ at(g, x, y, s); const sp = spec(id); (SHAPES[sp.shape] || SHAPES.round)(sp.c, sp.f, sp.a); }

/* ---------- one of a counted unit ---------- */
function unit(g, id, u, x, y, s){
  at(g, x, y, s); const {shape, c, f, a} = spec(id);
  if (u === "clove") { oval(8, 9, 3, 5, c); P(dk(c, .15), 8, 5, 1, 8); P(a, 8, 2, 1, 2); return; }
  if (u === "leaf") { if (shape === "leafy" || shape === "leaves") { oval(8, 8, 5, 7, c); P(a, 8, 2, 1, 12); return; } SHAPES.leaf(c, f, a); return; }
  if (u === "sprig") { SHAPES[shape === "needle" ? "needle" : "sprig"](c, f, a); return; }
  if (u === "stalk") { P(dk(c, .2), 1, 8, 14, 3); P(c, 1, 7, 14, 3); P(lt(c, .4), 1, 7, 14, 1); P(a, 13, 6, 3, 2); P(a, 14, 9, 2, 2); return; }
  if (u === "sheet") { SHAPES[shape === "nori" ? "nori" : "sheet"](c, f, a); return; }
  if (u === "can") { SHAPES.can(c, f, a); return; }
  if (u === "slice") {
    if (shape === "strip") { for (let x = 1; x < 15; x++) { const w = (x >> 1) % 2; P(c, x, 6 + w, 1, 4); P(a, x, 7 + w, 1, 1); } return; }
    if (shape === "pep") { ball(8, 8, 5, c); [[6, 6], [10, 8], [7, 10]].forEach(([px, py]) => P(a, px, py, 1, 1)); return; }
    if (/loaf|boule|baguette|bun/.test(shape)) { P(dk(c, .1), 2, 4, 12, 11); P(c, 2, 3, 12, 11); ell(8, 4, 6, 2, c); P(f, 3, 5, 10, 8); ell(8, 5, 5, 1, f); return; }
    if (/block|wedge|wheel|swiss|ball/.test(shape)) { P(dk(f, .15), 2, 3, 12, 11); P(f, 2, 2, 12, 11); if (shape === "swiss") [[5, 5], [10, 8], [6, 10]].forEach(([px, py]) => ell(px, py, 1, 1, dk(f, .2))); return; }
    if (/round|oval|half/.test(shape)) { ball(8, 8, 6, c); ell(8, 8, 5, 5, f); P(dk(f, .2), 8, 4, 1, 8); P(dk(f, .2), 4, 8, 8, 1); return; }
    SHAPES.slice(c, f, a); return;
  }
  SHAPES[shape] ? SHAPES[shape](c, f, a) : SHAPES.round(c, f, a);
}

/* ---------- loose food: what an ingredient looks like in its form, filling an ellipse ----------
   The look comes from the form (chopped, sliced, melted...) and, for food as it comes (whole), from the ingredient's fill. */
const LOOK = {chopped: "pieces", diced: "dice", cubed: "cubes", minced: "mince", sliced: "coins", grated: "shreds", shredded: "shreds",
  zested: "zest", torn: "leaves", mashed: "paste", juiced: "liquid", melted: "liquid", warm: null, cold: null, beaten: "liquid", brewed: "liquid",
  ground: null, crumbled: "crumbs", flaked: "flakes", softened: "paste", whipped: "whip", toasted: null, crumbs: "crumbs", sifted: "powder",
  frozen: "frozen", cooked: null, drained: null, rinsed: null, dry: null, sprig: "leaves", raw: null, whole: null};
function lookOf(id, form){
  const sp = spec(id), l = LOOK[form];
  if (l === "coins" && /slab|chop|fillet|bird|slice|strip|block|wedge|wheel|swiss|ball|loaf|boule|baguette|bun|tin/.test(sp.shape)) return "strips";
  if (form === "ground") return sp.shape === "mince" ? "mince" : "powder";
  if (l) return l;
  if (form === "toasted") return sp.fill === "nuts" || sp.fill === "seeds" ? sp.fill : "pieces";
  return sp.fill;
}
function loose(g, id, form, cx, cy, rx, ry, s, n, ox, oy){
  at(g, ox || 0, oy || 0, s); const sp = spec(id), look = lookOf(id, form), q = rng(hash(id + form));
  const c = form === "toasted" ? dk(sp.c, .2) : sp.c, f = form === "toasted" ? dk(sp.f, .2) : form === "cooked" ? dk(sp.f, .12) : sp.f;
  const full = n === undefined ? 1 : Math.max(0, Math.min(1, n));
  if (full <= 0) return;
  const RX = rx, RY = ry, inside = (x, y) => ((x - cx) / RX) ** 2 + ((y - cy) / RY) ** 2 <= 1;
  const area = Math.PI * RX * RY;
  if (look === "liquid" || look === "paste" || look === "whip") {
    const col = look === "liquid" && /bottle|carton|jug|glass|vial|honey|can|egg/.test(sp.shape) ? f : look === "liquid" ? lt(f, .1) : f;
    const ry2 = Math.max(1, Math.round(RY * (look === "liquid" ? Math.sqrt(full) : full))), rx2 = Math.max(1, Math.round(RX * Math.sqrt(full)));
    ell(cx, cy, rx2, ry2, col);
    if (look === "liquid") { P(lt(col, .5), cx - (rx2 >> 1), cy - (ry2 >> 1), Math.max(1, rx2 >> 1), 1); }
    else for (let i = 0; i < 3; i++) P(look === "whip" ? "#ffffff" : dk(col, .12), cx - (rx2 >> 1) + i * 2, cy - 1 + i, Math.max(1, rx2 >> 1), 1);
    return;
  }
  if (look === "powder") {
    const rx2 = Math.max(1, Math.round(RX * Math.sqrt(full))), ry2 = Math.max(1, Math.round(RY * Math.sqrt(full)));
    ell(cx, cy, rx2, ry2, f); for (let i = 0; i < area * .25 * full; i++) { const x = cx - rx2 + q() * rx2 * 2 | 0, y = cy - ry2 + q() * ry2 * 2 | 0; P(dk(f, .12), x, y, 1, 1); }
    P(lt(f, .5), cx - 1, cy - (ry2 >> 1), 2, 1); return;
  }
  // everything else is pieces scattered over the ellipse, more of them the fuller it is
  const piece = {pieces: [2, 3], dice: [2, 2], cubes: [3, 3], mince: [1, 1], crumbs: [1, 2], flakes: [2, 3], frozen: [3, 3], coins: [3, 3], strips: [5, 2],
    shreds: [1, 3], zest: [1, 2], leaves: [3, 2], balls: [2, 2], nuts: [3, 2], seeds: [1, 1], rice: [2, 1], longpasta: [7, 1], shortpasta: [2, 2],
    tubes: [3, 1], noodles: [4, 1], beans: [2, 2], oats: [2, 1], dots: [1, 1], chips: [2, 2], chunks: [2, 2], sprinkles: [2, 1], ice: [3, 3]}[look] || [2, 2];
  const [pw, ph] = piece, count = Math.round(area / (pw * ph) * (look === "mince" || look === "seeds" || look === "dots" ? .7 : .9) * full);
  // food piles up toward the middle, so the first pieces land in the center and the rim fills last
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(q()) * Math.sqrt(full), ang = q() * Math.PI * 2, x = Math.round(cx + Math.cos(ang) * RX * r - pw / 2), y = Math.round(cy + Math.sin(ang) * RY * r - ph / 2);
    if (!inside(x + pw / 2, y + ph / 2)) continue;
    const v = q();
    switch (look) {
      case "coins": ell(x + 1, y + 1, 1, 1, v < .5 ? f : lt(f, .15)); P(c, x + 2, y + 1, 1, 1); break;
      case "strips": P(dk(f, .15), x, y + 1, pw, 1); P(v < .5 ? f : c, x, y, pw, 1); break;
      case "shreds": case "zest": P(v < .7 ? f : c, x + (v < .5 ? 0 : 1), y, 1, 1); P(v < .7 ? f : c, x + (v < .5 ? 1 : 0), y + 1, 1, ph - 1); break;
      case "leaves": P(v < .5 ? c : lt(c, .2), x, y, pw, ph); P(dk(c, .25), x + 1, y + 1, 1, 1); break;
      case "balls": case "beans": P(dk(c, .25), x, y + 1, pw, 1); P(v < .3 ? lt(c, .2) : c, x, y, pw, ph - 1 || 1); break;
      case "rice": case "oats": case "dots": P(v < .3 ? dk(f, .1) : f, x, y, pw, ph); break;
      case "longpasta": case "noodles": P(v < .5 ? f : lt(f, .2), x, y, pw, 1); P(dk(f, .15), x + 1, y + 1, pw - 2, 1); break;
      case "tubes": case "shortpasta": P(f, x, y, pw, ph); P(dk(f, .2), x + pw - 1, y, 1, ph); break;
      case "sprinkles": P(["#e5607f", "#f6e27a", "#5fb4ff", "#5fbf6f", "#f4f5fb"][i % 5], x, y, pw, ph); break;
      case "frozen": P(f, x, y, pw, ph); P("#e8f6fa", x, y, 1, 1); break;
      case "ice": P(c, x, y, pw, ph); P("#ffffff", x, y, 1, 1); break;
      case "chips": P(c, x, y, pw, ph); P(dk(c, .25), x + 1, y + 1, 1, 1); break;
      case "chunks": case "flakes": case "crumbs": P(v < .6 ? f : c, x, y, pw - (v < .3 ? 1 : 0), ph - (v > .7 ? 1 : 0)); break;
      case "mince": P(v < .6 ? c : v < .85 ? f : sp.a, x, y, 1, 1); break;
      case "seeds": P(v < .8 ? c : sp.a, x, y, 1, 1); break;
      default: P(dk(f, .2), x, y + 1, pw, 1); P(v < .25 ? c : f, x, y, pw, ph - 1 || 1);
    }
  }
}

/* ---------- measuring: tools that add up to the amount exactly ----------
   A part is one cup, spoon, jug, scale or group of counted pieces, with the label printed under it. */
const COUNT = ["piece", "slice", "clove", "leaf", "sprig", "stalk", "sheet", "can"];
function fracLabel(x){
  const w = Math.floor(x + 1e-9), r = x - w, F = [[1 / 4, "1/4"], [1 / 3, "1/3"], [1 / 2, "1/2"], [2 / 3, "2/3"], [3 / 4, "3/4"]];
  const fr = r > 1e-6 ? (F.find(([v]) => Math.abs(v - r) < .02) || [r, String(Math.round(r * 100) / 100)])[1] : "";
  return (w ? String(w) : "") + (w && fr ? " " : "") + fr;
}
const plural = (n, one, many) => n === 1 || n < 1 ? one : many;
function measure(use){ return parts(use).map(p => Object.assign(p, {form: use.form})); }
function parts(use){
  const q = use.qty, u = use.unit, parts = [];
  if (u === "to-taste") return [{kind: "taste", id: use.id, label: "TO TASTE", w: 28, h: 30}];
  if (u === "pinch") { for (let i = 0; i < (q || 1); i++) parts.push({kind: "pinch", id: use.id, label: "PINCH", w: 22, h: 30}); return parts; }
  if (u === "lb" || u === "oz" || u === "g" || u === "kg") return [{kind: "scale", id: use.id, label: fracLabel(q).replace(" ", "-") + " " + u.toUpperCase(), w: 44, h: 40}];
  if (COUNT.includes(u)) { const n = Math.ceil(q), big = n <= 4; return [{kind: "count", id: use.id, unit: u, n, half: q % 1 !== 0, w: big ? Math.min(n, 2) * 34 : Math.min(n, 6) * 17, h: big ? Math.ceil(n / 2) * 34 : Math.ceil(n / 6) * 17}]; }
  if (u === "cup" && q > 4) {
    // big amounts are poured from 4-cup jugs: as many full ones as fit, then one holding the rest
    let left = q; while (left > 1e-6) { const v = Math.min(4, left); parts.push({kind: "jug", id: use.id, label: fracLabel(v) + " " + plural(v, "CUP", "CUPS"), fill: v / 4, w: 34, h: 40}); left -= v; }
    return parts;
  }
  if (u === "cup" || u === "tbsp" || u === "tsp") {
    const name = u.toUpperCase(), w = Math.floor(q + 1e-9), r = q - w, kind = u === "cup" ? "cup" : "spoon";
    // the whole ones fan out as one group you can count (three spoons for 3 tbsp), then a smaller measure for any fraction
    const bw = kind === "cup" ? 30 : 26;
    if (w) parts.push({kind, id: use.id, unit: u, size: 1, count: w, label: w + " " + (u === "cup" ? plural(w, "CUP", "CUPS") : name), w: Math.max(bw + (w - 1) * 7, (w + " " + name).length * 4 + 4), h: 34});
    if (r > 1e-6) parts.push({kind, id: use.id, unit: u, size: r, label: fracLabel(r) + " " + name, w: kind === "cup" ? 30 : 26, h: 34});
    return parts;
  }
  return [{kind: "taste", id: use.id, label: fracLabel(q) + " " + u.toUpperCase(), w: 28, h: 30}];
}
// draws one part with its top left at x, y; full is 1 while it's waiting and 0 once it has been poured in
function drawMeasure(g, part, x, y, full, t){
  const txt = (s, tx, ty, c) => root.PBC_ADS && root.PBC_ADS.pixText(g, s, Math.round(tx), Math.round(ty), false, c, 1);
  const label = s => { if (!s) return; const w = s.length * 4 - 1, lx = Math.round(x + (part.lw || part.w) / 2 - w / 2); at(g, 0, 0, 1); P("#1d2766", lx - 2, y + part.h - 7, w + 4, 7); txt(s, lx, y + part.h - 6, "#ffffff"); };
  const sp = spec(part.id);
  if ((part.kind === "cup" || part.kind === "spoon") && part.count > 1) {
    // a fanned group: each one drawn a little to the right of the last, the front one carrying the label
    for (let i = part.count - 1; i >= 0; i--) drawMeasure(g, Object.assign({}, part, {count: 1, label: i ? "" : part.label, w: part.kind === "cup" ? 30 : 26, lw: part.w}), x + i * 7, y - i * 2, full, t);
    return;
  }
  if (part.kind === "cup") {
    at(g, x, y, 2); const r = 6, cx = 7, cy = 7;
    P("#7a8090", cx + 5, cy - 1, 7 - 0, 2); ell(cx + 1, cy + 1, r, r, "#7a8090"); ell(cx, cy, r, r, "#c9ccd6"); ell(cx, cy, r - 1, r - 1, "#9aa8b0");
    // how full the cup is drawn: a 1/2 cup is a smaller cup, filled to the top
    const inner = Math.max(2, Math.round((r - 1) * Math.sqrt(part.size || 1)));
    if (part.size < 1) { ell(cx, cy, r - 1, r - 1, "#aeb3c2"); ell(cx, cy, inner, inner, "#9aa8b0"); }
    if (full > 0) loose(g, part.id, part.form || "whole", cx, cy, inner - 1 || 1, inner - 1 || 1, 2, 1, x, y);
    label(part.label); return;
  }
  if (part.kind === "spoon") {
    at(g, x, y, 2); const cx = 5, cy = 7, rx = part.unit === "tbsp" ? 4 : 3, ry = part.unit === "tbsp" ? 3 : 2;
    const sc = part.size < 1 ? Math.sqrt(part.size) : 1, rx2 = Math.max(1, Math.round(rx * sc)), ry2 = Math.max(1, Math.round(ry * sc));
    P("#7a8090", cx + rx2, cy, 7, 2); P("#c9ccd6", cx + rx2, cy - 1, 7, 2); ell(cx + 1, cy + 1, rx2, ry2, "#7a8090"); ell(cx, cy, rx2, ry2, "#c9ccd6");
    if (full > 0) loose(g, part.id, part.form || "whole", cx, cy, Math.max(1, rx2 - 1), Math.max(1, ry2 - 1), 2, 1, x, y);
    label(part.label); return;
  }
  if (part.kind === "jug") {
    at(g, x, y, 2); P("#7a8090", 2, 2, 12, 15); P("#d8ecf0", 3, 2, 10, 14); P("#aeb8c4", 13, 5, 3, 7); P("#d8ecf0", 14, 6, 1, 5);
    const lvl = Math.round(13 * part.fill * (full > 0 ? 1 : 0));
    if (lvl) { P(sp.fill === "liquid" ? spec(part.id).f : color(part.id), 3, 16 - lvl, 10, lvl); P(lt(color(part.id), .4), 3, 16 - lvl, 10, 1); }
    for (let k = 1; k <= 4; k++) P("#5a6070", 3, 16 - Math.round(13 * k / 4), 3, 1);
    label(part.label); return;
  }
  if (part.kind === "scale") {
    at(g, 0, 0, 1); P("#7a8090", x + 2, y + 18, 40, 14); P("#c9ccd6", x + 2, y + 16, 40, 14); P("#9aa8b0", x + 6, y + 14, 32, 4);
    P("#1b1f2e", x + 8, y + 21, 28, 7); txt(part.label.split(" ")[0], x + 10, y + 22, "#7ef0a0");
    if (full > 0) item(g, part.id, x + 14, y - 1, 1);
    label(part.label); return;
  }
  if (part.kind === "count") {
    const big = part.n <= 4, cell = big ? 34 : 17, cols = big ? Math.min(part.n, 2) : Math.min(part.n, 6), s = big ? 2 : 1;
    for (let i = 0; i < part.n; i++) {
      if (full <= 0) break;
      const cx = x + (i % cols) * cell, cy = y + Math.floor(i / cols) * cell, half = part.half && i === part.n - 1;
      if (half) { g.save(); g.beginPath(); g.rect(cx, cy, cell / 2, cell); g.clip(); }
      unit(g, part.id, part.unit, cx, cy, s);
      if (half) { g.restore(); at(g, cx, cy, s); P(sp.f, 7, 3, 1, 10); }
    }
    return;
  }
  if (part.kind === "pinch") { loose(g, part.id, "ground", x + 11, y + 12, 3, 2, 1, full > 0 ? 1 : 0); label(part.label); return; }
  if (part.kind === "taste") { item(g, part.id, x + 6, y, 1); label(part.label); return; }
}

const API = {ART, SHAPES, spec, color, item, unit, loose, measure, drawMeasure, fracLabel, lookOf, COUNT};
if (typeof module === "object" && module.exports) module.exports = API; else root.PBC_FOOD = API;
})(typeof window !== "undefined" ? window : globalThis);
