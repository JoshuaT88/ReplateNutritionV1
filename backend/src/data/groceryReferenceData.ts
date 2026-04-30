/**
 * Grocery Reference Data
 *
 * Hardcoded lookup tables that let the app answer common questions locally
 * without burning an OpenAI API call. The AI is only called when the local
 * data doesn't cover the item.
 *
 * Price reference is based on 2024 USDA ERS retail price data and BLS CPI
 * grocery reports. Values are US national averages in USD. Actual prices will
 * vary by region — use as AI prompt context, not as authoritative pricing.
 */

// ---------------------------------------------------------------------------
// GROCERY CATEGORY MAP
// ---------------------------------------------------------------------------
export const GROCERY_CATEGORY_MAP: Record<string, string[]> = {
  Produce: [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry',
    'raspberry', 'blackberry', 'mango', 'pineapple', 'watermelon', 'cantaloupe', 'honeydew',
    'peach', 'pear', 'plum', 'cherry', 'apricot', 'nectarine', 'kiwi', 'papaya', 'passion fruit',
    'avocado', 'tomato', 'potato', 'sweet potato', 'yam', 'onion', 'garlic', 'ginger',
    'carrot', 'celery', 'broccoli', 'cauliflower', 'spinach', 'kale', 'lettuce', 'romaine',
    'arugula', 'cabbage', 'cucumber', 'zucchini', 'squash', 'butternut', 'acorn squash',
    'bell pepper', 'poblano', 'jalapeno', 'habanero', 'serrano', 'mushroom', 'corn',
    'green bean', 'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'parsnip',
    'eggplant', 'pea', 'snap pea', 'edamame', 'brussel', 'bok choy', 'collard',
    'swiss chard', 'cilantro', 'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary',
    'sage', 'chive', 'scallion', 'green onion', 'shallot', 'leek', 'fennel', 'endive',
    'radicchio', 'watercress', 'microgreens', 'sprout', 'kohlrabi', 'jicama', 'taro',
  ],
  Dairy: [
    'milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream', 'cream cheese',
    'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'gouda',
    'brie', 'goat cheese', 'swiss cheese', 'provolone', 'havarti', 'colby', 'jack cheese',
    'whipped cream', 'half and half', 'buttermilk', 'ghee', 'kefir', 'quark',
    'egg', 'eggs', 'heavy cream', 'heavy whipping cream', 'clotted cream',
  ],
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'veal', 'bison', 'duck', 'venison',
    'steak', 'ground beef', 'ground turkey', 'ground pork', 'ground chicken',
    'bacon', 'sausage', 'ham', 'salami', 'prosciutto', 'pepperoni', 'chorizo',
    'bratwurst', 'hot dog', 'deli meat', 'lunchmeat', 'roast beef', 'corned beef',
    'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'halibut', 'mahi mahi', 'snapper',
    'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'sardine', 'anchovy',
    'trout', 'catfish', 'bass', 'flounder', 'filet mignon', 'ribeye', 'sirloin',
    'tenderloin', 'chuck', 'brisket', 'ribs', 'wing', 'thigh', 'breast', 'drumstick',
    'pork chop', 'pork loin', 'pork belly', 'spare rib', 'baby back rib',
  ],
  Pantry: [
    'rice', 'pasta', 'noodle', 'spaghetti', 'penne', 'fettuccine', 'rigatoni', 'orzo',
    'flour', 'sugar', 'brown sugar', 'powdered sugar', 'salt', 'oil', 'olive oil',
    'coconut oil', 'vegetable oil', 'avocado oil', 'canola oil', 'sesame oil',
    'vinegar', 'apple cider vinegar', 'balsamic', 'red wine vinegar', 'white vinegar',
    'soy sauce', 'tamari', 'coconut aminos', 'honey', 'maple syrup', 'molasses', 'agave',
    'cereal', 'oat', 'oatmeal', 'granola', 'quinoa', 'couscous', 'barley', 'farro',
    'bulgur', 'millet', 'polenta', 'grits', 'cornmeal',
    'lentil', 'bean', 'chickpea', 'black bean', 'kidney bean', 'pinto bean',
    'navy bean', 'cannellini', 'split pea', 'canned', 'broth', 'stock',
    'tomato sauce', 'marinara', 'tomato paste', 'diced tomato', 'crushed tomato',
    'salsa', 'hot sauce', 'ketchup', 'mustard', 'mayonnaise', 'dijon',
    'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter',
    'jam', 'jelly', 'preserves', 'marmalade', 'nutella', 'hazelnut spread',
    'chocolate', 'cocoa', 'cacao', 'vanilla', 'extract',
    'baking soda', 'baking powder', 'yeast', 'cornstarch', 'arrowroot',
    'breadcrumb', 'panko', 'crouton', 'stuffing', 'bread mix',
    'almond', 'walnut', 'pecan', 'cashew', 'peanut', 'pistachio', 'macadamia',
    'hazelnut', 'pine nut', 'seed', 'chia', 'flax', 'hemp', 'sunflower seed',
    'pumpkin seed', 'sesame', 'poppy seed',
    'coconut', 'shredded coconut', 'coconut milk', 'coconut cream',
    'dried fruit', 'raisin', 'cranberry', 'apricot', 'date', 'fig', 'prune',
    'spice', 'cinnamon', 'cumin', 'paprika', 'smoked paprika', 'turmeric',
    'oregano', 'chili powder', 'curry', 'garam masala', 'bay leaf', 'nutmeg',
    'clove', 'cardamom', 'coriander', 'black pepper', 'white pepper', 'red pepper flake',
    'garlic powder', 'onion powder', 'celery seed', 'mustard seed', 'fennel seed',
    'tortilla', 'wrap', 'taco shell', 'tostada', 'chip', 'cracker', 'pretzel',
    'ramen', 'udon', 'soba', 'rice noodle', 'glass noodle',
    'protein powder', 'collagen', 'nutritional yeast',
  ],
  Bakery: [
    'bread', 'sourdough', 'whole wheat bread', 'rye bread', 'white bread',
    'bagel', 'muffin', 'croissant', 'roll', 'dinner roll', 'baguette',
    'pita', 'naan', 'flatbread', 'lavash', 'bun', 'hamburger bun', 'hot dog bun',
    'cake', 'cupcake', 'pie', 'pastry', 'danish', 'donut', 'cookie', 'brownie',
    'scone', 'biscuit', 'cornbread', 'brioche', 'challah', 'focaccia',
    'english muffin', 'pumpernickel', 'multigrain',
  ],
  Frozen: [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'sherbet', 'popsicle', 'ice pop',
    'frozen pizza', 'frozen dinner', 'frozen meal', 'frozen entree', 'frozen burrito',
    'frozen vegetable', 'frozen fruit', 'frozen berry', 'frozen edamame',
    'frozen waffle', 'frozen pancake', 'frozen french toast',
    'frozen fish', 'frozen shrimp', 'frozen chicken nugget', 'frozen chicken',
    'frozen pot pie', 'frozen lasagna', 'tater tot', 'frozen fry', 'hashbrown',
  ],
  Beverages: [
    'juice', 'apple juice', 'orange juice', 'grape juice', 'cranberry juice',
    'water', 'sparkling water', 'seltzer', 'club soda', 'tonic water',
    'soda', 'cola', 'lemon-lime', 'root beer', 'ginger ale',
    'coffee', 'espresso', 'cold brew', 'instant coffee',
    'tea', 'green tea', 'black tea', 'herbal tea', 'chai', 'kombucha',
    'lemonade', 'fruit punch', 'sports drink', 'energy drink', 'electrolyte',
    'coconut water', 'almond milk', 'oat milk', 'soy milk', 'rice milk',
    'cashew milk', 'pea milk', 'plant milk', 'smoothie', 'protein shake',
    'wine', 'beer', 'cider', 'hard seltzer', 'spirits',
  ],
  Snacks: [
    'chips', 'potato chip', 'tortilla chip', 'corn chip', 'pita chip', 'veggie chip',
    'popcorn', 'pretzel', 'trail mix', 'mixed nuts', 'granola bar', 'protein bar',
    'energy bar', 'fruit bar', 'rice cake', 'jerky', 'meat stick',
    'fruit snack', 'gummy', 'candy', 'chocolate bar', 'licorice',
    'crackers', 'graham cracker', 'animal cracker', 'cheese cracker',
    'pork rind', 'seaweed snack', 'dried mango', 'banana chip',
  ],
  Condiments: [
    'dressing', 'ranch', 'caesar', 'italian dressing', 'vinaigrette', 'thousand island',
    'marinade', 'bbq sauce', 'teriyaki', 'worcestershire', 'fish sauce',
    'oyster sauce', 'hoisin', 'sriracha', 'tabasco', 'frank\'s red hot',
    'tahini', 'hummus', 'guacamole', 'pesto', 'chimichurri',
    'relish', 'chutney', 'pickle', 'olive', 'caper', 'anchovy paste',
    'wasabi', 'horseradish', 'tartar sauce', 'cocktail sauce',
  ],
  'Baby & Toddler': [
    'baby food', 'infant formula', 'baby cereal', 'baby puree', 'toddler snack',
    'baby formula', 'similac', 'enfamil', 'gerber', 'beech-nut',
  ],
  'Pet Food': [
    'dog food', 'cat food', 'kibble', 'wet food', 'pet food', 'pet treat',
    'dog treat', 'cat treat', 'puppy food', 'kitten food', 'bird food', 'fish food',
    'hamster food', 'rabbit food', 'guinea pig food', 'reptile food',
  ],
  'Health & Wellness': [
    'vitamin', 'supplement', 'probiotic', 'omega', 'fish oil', 'multivitamin',
    'calcium', 'magnesium', 'zinc', 'iron', 'b12', 'vitamin d', 'vitamin c',
    'melatonin', 'elderberry', 'turmeric supplement', 'collagen supplement',
  ],
};

// ---------------------------------------------------------------------------
// AISLE LOCATION BY CATEGORY (generic — fallback before AI call)
// ---------------------------------------------------------------------------
export const AISLE_BY_CATEGORY: Record<string, string> = {
  Produce: 'Produce Section — usually front/entrance of store',
  Dairy: 'Dairy Section — back wall of store',
  'Meat & Seafood': 'Meat & Seafood Department — back perimeter',
  Bakery: 'Bakery Section — varies, often front or back perimeter',
  Frozen: 'Frozen Foods Aisles — center or back wall',
  Beverages: 'Beverage Aisle — center store',
  Snacks: 'Snack/Chip Aisle — center store',
  Condiments: 'Condiments & Sauces Aisle — center store',
  Pantry: 'Center Store Aisles (dry goods, canned goods, baking)',
  'Baby & Toddler': 'Baby/Infant Aisle — center store',
  'Pet Food': 'Pet Food Aisle — center or back store',
  'Health & Wellness': 'Health & Wellness / Pharmacy Section',
  Other: 'Center Store — check store directory',
};

// Per-store overrides (common chain-specific aisle names)
export const STORE_AISLE_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  'Walmart': {
    Produce: 'Produce Section (front-left)',
    Dairy: 'Dairy Wall (back-right)',
    'Meat & Seafood': 'Meat Department (back center)',
  },
  'Whole Foods': {
    Produce: 'Produce — front of store, organic section',
    Dairy: 'Dairy — back wall, cold case',
    'Meat & Seafood': 'Meat & Seafood Counter — back of store',
  },
  'Trader Joe\'s': {
    Produce: 'Produce — front of store',
    Frozen: 'Frozen Section — middle and back',
  },
  'Costco': {
    Produce: 'Fresh Produce — right side near entrance',
    'Meat & Seafood': 'Meat Department — back of warehouse',
    Frozen: 'Frozen Foods — center/back',
  },
};

// ---------------------------------------------------------------------------
// STORE PRICE TIERS
// Used to give the AI better pricing context when estimating costs at
// stores with no crowd-sourced data.
// ---------------------------------------------------------------------------
export const STORE_PRICE_TIER: Record<string, 'budget' | 'mid' | 'premium' | 'club'> = {
  // Budget
  'Aldi': 'budget',
  'Lidl': 'budget',
  'Walmart': 'budget',
  'Walmart Supercenter': 'budget',
  'Walmart Neighborhood Market': 'budget',
  'Save-A-Lot': 'budget',
  'Dollar General': 'budget',
  'Family Dollar': 'budget',
  'WinCo': 'budget',
  'Food4Less': 'budget',
  'Grocery Outlet': 'budget',
  'Big Lots': 'budget',
  'Market Basket': 'budget',
  'Price Rite': 'budget',
  // Mid
  'Kroger': 'mid',
  'Publix': 'mid',
  'HEB': 'mid',
  'H-E-B': 'mid',
  'Safeway': 'mid',
  'Meijer': 'mid',
  'Food Lion': 'mid',
  'Stop & Shop': 'mid',
  'Giant': 'mid',
  'Giant Eagle': 'mid',
  'Vons': 'mid',
  'Albertsons': 'mid',
  'Harris Teeter': 'mid',
  'Winn-Dixie': 'mid',
  'ShopRite': 'mid',
  'Hannaford': 'mid',
  'Jewel-Osco': 'mid',
  'Ralphs': 'mid',
  'Fred Meyer': 'mid',
  'Smith\'s': 'mid',
  'King Soopers': 'mid',
  'Fry\'s': 'mid',
  'Tom Thumb': 'mid',
  'Randalls': 'mid',
  'Ingles': 'mid',
  'Piggly Wiggly': 'mid',
  'Stater Bros': 'mid',
  // Premium
  'Whole Foods': 'premium',
  'Whole Foods Market': 'premium',
  'Trader Joe\'s': 'premium',
  'Sprouts': 'premium',
  'Sprouts Farmers Market': 'premium',
  'Fresh Market': 'premium',
  'The Fresh Market': 'premium',
  'Central Market': 'premium',
  'Wegmans': 'premium',
  'Fresh Thyme': 'premium',
  'Natural Grocers': 'premium',
  'Earth Fare': 'premium',
  // Club
  'Costco': 'club',
  'Sam\'s Club': 'club',
  'BJ\'s Wholesale': 'club',
  "BJ's": 'club',
};

export const STORE_TIER_PRICE_MULTIPLIERS: Record<string, number> = {
  budget: 0.78,
  mid: 1.00,
  premium: 1.35,
  club: 0.85,
};

// ---------------------------------------------------------------------------
// USDA / BLS NATIONAL AVERAGE RETAIL PRICES (2024 estimate, USD)
// format: { unit, avg, min, max }
// These are used to seed AI pricing prompts so estimates are grounded in
// real data rather than hallucinated numbers.
// ---------------------------------------------------------------------------
export interface PriceRef {
  unit: string;
  avg: number;
  min: number;
  max: number;
}

export const PRICE_REFERENCE: Record<string, PriceRef> = {
  // Produce
  'banana': { unit: 'lb', avg: 0.49, min: 0.29, max: 0.79 },
  'apple': { unit: 'lb', avg: 1.79, min: 0.99, max: 2.99 },
  'orange': { unit: 'lb', avg: 1.29, min: 0.89, max: 1.99 },
  'avocado': { unit: 'each', avg: 1.19, min: 0.69, max: 2.49 },
  'strawberry': { unit: 'lb', avg: 2.99, min: 1.49, max: 4.99 },
  'blueberry': { unit: 'pint', avg: 3.49, min: 1.99, max: 5.99 },
  'grape': { unit: 'lb', avg: 2.49, min: 1.49, max: 3.99 },
  'tomato': { unit: 'lb', avg: 1.69, min: 0.99, max: 3.49 },
  'potato': { unit: '5 lb bag', avg: 3.99, min: 2.49, max: 5.99 },
  'sweet potato': { unit: 'lb', avg: 1.29, min: 0.79, max: 2.49 },
  'onion': { unit: '3 lb bag', avg: 2.99, min: 1.49, max: 4.99 },
  'garlic': { unit: '3-count bulb', avg: 0.79, min: 0.49, max: 1.99 },
  'broccoli': { unit: 'lb', avg: 1.49, min: 0.99, max: 2.99 },
  'spinach': { unit: '5 oz bag', avg: 3.49, min: 1.99, max: 4.99 },
  'carrot': { unit: 'lb', avg: 0.99, min: 0.59, max: 1.79 },
  'bell pepper': { unit: 'each', avg: 0.99, min: 0.59, max: 2.49 },
  'mushroom': { unit: '8 oz pkg', avg: 2.99, min: 1.79, max: 4.99 },
  'cucumber': { unit: 'each', avg: 0.89, min: 0.49, max: 1.99 },
  'celery': { unit: 'bunch', avg: 1.99, min: 1.29, max: 3.49 },
  'kale': { unit: 'bunch', avg: 2.49, min: 1.49, max: 3.99 },
  'lettuce': { unit: 'head', avg: 1.99, min: 0.99, max: 3.49 },
  'zucchini': { unit: 'lb', avg: 1.29, min: 0.79, max: 2.49 },
  'corn': { unit: 'ear', avg: 0.69, min: 0.39, max: 1.29 },
  'lemon': { unit: 'each', avg: 0.69, min: 0.39, max: 1.29 },
  'lime': { unit: 'each', avg: 0.39, min: 0.19, max: 0.79 },
  'mango': { unit: 'each', avg: 1.29, min: 0.79, max: 2.49 },
  'pineapple': { unit: 'whole', avg: 2.49, min: 1.49, max: 3.99 },
  'peach': { unit: 'lb', avg: 2.49, min: 1.49, max: 3.99 },
  'pear': { unit: 'lb', avg: 1.99, min: 1.29, max: 2.99 },
  'cherry': { unit: 'lb', avg: 4.99, min: 2.99, max: 7.99 },
  'ginger': { unit: 'lb', avg: 3.49, min: 1.99, max: 5.99 },
  // Dairy
  'milk': { unit: 'gallon', avg: 4.29, min: 2.99, max: 6.99 },
  'eggs': { unit: 'dozen', avg: 3.99, min: 2.49, max: 6.99 },
  'butter': { unit: '1 lb (4 sticks)', avg: 4.99, min: 2.99, max: 8.99 },
  'cheddar cheese': { unit: '8 oz block', avg: 3.99, min: 2.49, max: 6.99 },
  'mozzarella': { unit: '8 oz', avg: 3.49, min: 2.29, max: 5.99 },
  'parmesan': { unit: '8 oz shredded', avg: 4.99, min: 3.49, max: 7.99 },
  'cream cheese': { unit: '8 oz brick', avg: 2.99, min: 1.79, max: 4.99 },
  'yogurt': { unit: '32 oz container', avg: 5.49, min: 3.49, max: 7.99 },
  'sour cream': { unit: '16 oz', avg: 2.49, min: 1.49, max: 3.99 },
  'heavy cream': { unit: 'pint', avg: 3.99, min: 2.49, max: 5.99 },
  'cottage cheese': { unit: '24 oz', avg: 3.99, min: 2.49, max: 5.99 },
  // Meat & Seafood
  'chicken breast': { unit: 'lb', avg: 3.99, min: 2.49, max: 6.99 },
  'chicken thigh': { unit: 'lb', avg: 2.49, min: 1.49, max: 3.99 },
  'whole chicken': { unit: 'lb', avg: 1.99, min: 1.29, max: 2.99 },
  'ground beef': { unit: 'lb (80/20)', avg: 5.49, min: 3.99, max: 8.99 },
  'ground turkey': { unit: 'lb', avg: 4.49, min: 2.99, max: 6.99 },
  'beef steak': { unit: 'lb (sirloin)', avg: 8.99, min: 5.99, max: 14.99 },
  'pork chop': { unit: 'lb', avg: 3.99, min: 2.49, max: 5.99 },
  'bacon': { unit: '12 oz pkg', avg: 5.99, min: 3.99, max: 8.99 },
  'sausage': { unit: 'lb', avg: 4.49, min: 2.99, max: 7.99 },
  'ham': { unit: 'lb (deli)', avg: 5.99, min: 3.99, max: 9.99 },
  'salmon': { unit: 'lb fillet', avg: 11.99, min: 7.99, max: 17.99 },
  'tilapia': { unit: 'lb', avg: 4.99, min: 2.99, max: 7.99 },
  'shrimp': { unit: 'lb frozen', avg: 8.99, min: 5.99, max: 13.99 },
  'tuna canned': { unit: '5 oz can', avg: 1.79, min: 0.99, max: 2.99 },
  'cod': { unit: 'lb', avg: 7.99, min: 4.99, max: 12.99 },
  // Pantry
  'white rice': { unit: '5 lb bag', avg: 5.49, min: 2.99, max: 8.99 },
  'brown rice': { unit: '5 lb bag', avg: 6.49, min: 3.99, max: 9.99 },
  'pasta': { unit: '1 lb box', avg: 1.49, min: 0.89, max: 2.99 },
  'all-purpose flour': { unit: '5 lb bag', avg: 3.99, min: 2.49, max: 5.99 },
  'olive oil': { unit: '16 oz bottle', avg: 7.99, min: 4.99, max: 13.99 },
  'vegetable oil': { unit: '48 oz bottle', avg: 5.49, min: 3.49, max: 7.99 },
  'canned black beans': { unit: '15 oz can', avg: 1.09, min: 0.79, max: 1.99 },
  'canned chickpeas': { unit: '15 oz can', avg: 1.29, min: 0.79, max: 2.29 },
  'canned tomatoes': { unit: '14.5 oz can', avg: 1.19, min: 0.79, max: 2.49 },
  'chicken broth': { unit: '32 oz carton', avg: 2.99, min: 1.79, max: 4.49 },
  'peanut butter': { unit: '16 oz jar', avg: 3.99, min: 2.49, max: 6.49 },
  'honey': { unit: '12 oz bottle', avg: 5.49, min: 3.49, max: 8.99 },
  'soy sauce': { unit: '10 oz bottle', avg: 2.99, min: 1.49, max: 4.99 },
  'sugar': { unit: '5 lb bag', avg: 3.99, min: 2.79, max: 5.99 },
  'oats': { unit: '42 oz container', avg: 4.99, min: 2.99, max: 7.99 },
  'cereal': { unit: '12-18 oz box', avg: 4.99, min: 2.99, max: 7.99 },
  'bread': { unit: '20 oz loaf', avg: 3.49, min: 1.99, max: 5.99 },
  'almond': { unit: '1 lb bag', avg: 7.99, min: 4.99, max: 11.99 },
  'walnuts': { unit: '1 lb bag', avg: 8.99, min: 5.99, max: 13.99 },
  // Beverages
  'orange juice': { unit: '64 oz carton', avg: 5.49, min: 3.49, max: 7.99 },
  'coffee ground': { unit: '12 oz bag', avg: 7.99, min: 4.99, max: 12.99 },
  'bottled water': { unit: '24-pack 16oz', avg: 5.99, min: 3.49, max: 8.99 },
  'almond milk': { unit: '64 oz carton', avg: 3.99, min: 2.49, max: 5.99 },
  'oat milk': { unit: '64 oz carton', avg: 4.99, min: 2.99, max: 6.99 },
  // Frozen
  'frozen broccoli': { unit: '12 oz bag', avg: 2.49, min: 1.49, max: 3.99 },
  'frozen mixed vegetables': { unit: '16 oz bag', avg: 2.49, min: 1.49, max: 3.99 },
  'frozen fruit': { unit: '16 oz bag', avg: 3.99, min: 2.49, max: 5.99 },
  'ice cream': { unit: '48 oz container', avg: 4.99, min: 2.99, max: 7.99 },
  'frozen pizza': { unit: '12-14 inch', avg: 6.99, min: 3.99, max: 11.99 },
  // Condiments
  'ketchup': { unit: '24 oz bottle', avg: 2.99, min: 1.79, max: 4.49 },
  'mustard': { unit: '14 oz bottle', avg: 2.49, min: 1.29, max: 3.99 },
  'mayonnaise': { unit: '30 oz jar', avg: 5.49, min: 3.49, max: 7.99 },
  'bbq sauce': { unit: '18 oz bottle', avg: 2.99, min: 1.79, max: 4.99 },
  'hot sauce': { unit: '12 oz bottle', avg: 2.99, min: 1.49, max: 4.99 },
  'salsa': { unit: '16 oz jar', avg: 3.99, min: 2.49, max: 5.99 },
  'ranch dressing': { unit: '16 oz bottle', avg: 3.99, min: 2.49, max: 5.99 },
  'hummus': { unit: '10 oz container', avg: 3.99, min: 2.49, max: 5.99 },
};

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/** Returns true if the item name matches any known grocery keyword locally. */
export function isGroceryItem(itemName: string): boolean {
  const lower = itemName.toLowerCase().trim();
  // Direct match
  for (const keywords of Object.values(GROCERY_CATEGORY_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return true;
    }
  }
  return false;
}

/** Returns the grocery category for an item using local lookup. Returns null if not found. */
export function categorizeItem(itemName: string): string | null {
  const lower = itemName.toLowerCase().trim();
  // Preserved/processed prefixes override the base ingredient's natural category
  const pantryPrefixes = ['canned ', 'jarred ', 'tinned ', 'dried ', 'dehydrated '];
  const frozenPrefixes = ['frozen '];
  if (pantryPrefixes.some((p) => lower.startsWith(p))) return 'Pantry';
  if (frozenPrefixes.some((p) => lower.startsWith(p))) return 'Frozen';
  for (const [category, keywords] of Object.entries(GROCERY_CATEGORY_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return null;
}

/** Returns the aisle hint for an item, checking category first, then store overrides. */
export function predictAisleLocally(itemName: string, storeName: string): string | null {
  const category = categorizeItem(itemName);
  if (!category) return null;

  const storeKey = Object.keys(STORE_AISLE_OVERRIDES).find(
    (k) => storeName.toLowerCase().includes(k.toLowerCase()),
  );

  if (storeKey) {
    const override = STORE_AISLE_OVERRIDES[storeKey][category];
    if (override) return override;
  }

  return AISLE_BY_CATEGORY[category] || null;
}

/** Returns the price tier for a store (budget/mid/premium/club) or 'mid' as default. */
export function getStoreTier(storeName: string): 'budget' | 'mid' | 'premium' | 'club' {
  const key = Object.keys(STORE_PRICE_TIER).find(
    (k) => storeName.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? STORE_PRICE_TIER[key] : 'mid';
}

/** Returns adjusted price for a store tier given a national average price. */
export function adjustPriceForTier(basePrice: number, storeName: string): number {
  const tier = getStoreTier(storeName);
  const multiplier = STORE_TIER_PRICE_MULTIPLIERS[tier];
  return Math.round(basePrice * multiplier * 100) / 100;
}

/** Builds a compact price reference string for AI prompts (limits to ~40 items). */
export function buildPriceReferenceContext(): string {
  const lines = ['National average retail prices (2024 USDA/BLS estimates):'];
  for (const [item, ref] of Object.entries(PRICE_REFERENCE)) {
    lines.push(`  ${item} (per ${ref.unit}): avg $${ref.avg.toFixed(2)}, range $${ref.min.toFixed(2)}–$${ref.max.toFixed(2)}`);
  }
  lines.push('');
  lines.push('Store price tiers vs national average:');
  lines.push('  Budget stores (Aldi, Lidl, Walmart): ~22% below average');
  lines.push('  Mid-range stores (Kroger, Publix, HEB, Safeway): at average');
  lines.push('  Premium stores (Whole Foods, Sprouts, Trader Joe\'s): ~35% above average');
  lines.push('  Club stores (Costco, Sam\'s Club): ~15% below average (bulk sizes)');
  return lines.join('\n');
}
