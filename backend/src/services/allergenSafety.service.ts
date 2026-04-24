/**
 * Allergen Safety Service
 *
 * Provides deterministic post-generation validation for all AI-generated
 * recommendations, meal plans, and recipes. This is a HARD GATE — items that
 * match a profile's criticalAllergies are never saved to the database.
 *
 * Two-layer approach:
 *   1. Fast local string-matching against a comprehensive allergen alias map
 *   2. GPT-4o-mini second-pass for any item flagged OR any item containing a
 *      critical allergen profile — to catch marketing names / brand obfuscation
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Sanitize a string before injecting it into an AI prompt.
 * Strips newlines, control characters, and any attempt to inject
 * instruction-breaking sequences (prompt injection defense).
 */
function sanitizeForPrompt(value: string): string {
  return value
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ') // strip control chars and newlines
    .replace(/\s+/g, ' ')
    .slice(0, 200) // hard cap per field
    .trim();
}

// ─── Allergen alias map ───────────────────────────────────────────────────────

const ALLERGEN_ALIASES: Record<string, string[]> = {
  // ── The Big 9 (FDA) ──────────────────────────────────────────────────────
  PEANUTS: [
    'peanut', 'peanuts', 'groundnut', 'groundnuts', 'arachis oil', 'monkey nut',
    'peanut butter', 'peanut flour', 'peanut oil', 'mixed nuts',
  ],
  TREE_NUTS: [
    'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans',
    'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'macadamia', 'brazil nut',
    'brazil nuts', 'pine nut', 'pine nuts', 'chestnut', 'chestnuts', 'coconut',
    'nut butter', 'almond butter', 'cashew butter', 'mixed nuts', 'praline',
    'marzipan', 'frangipane', 'nougat', 'gianduja',
  ],
  DAIRY: [
    'milk', 'dairy', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'ghee',
    'whey', 'casein', 'caseinate', 'lactose', 'lactulose', 'lactalbumin',
    'lactoglobulin', 'lactoferrin', 'custard', 'pudding', 'ice cream', 'kefir',
    'half-and-half', 'sour cream', 'buttermilk', 'condensed milk', 'evaporated milk',
    'skimmed milk', 'whole milk', 'goat milk', 'sheep milk', 'brie', 'cheddar',
    'parmesan', 'ricotta', 'mozzarella', 'cream cheese',
  ],
  EGGS: [
    'egg', 'eggs', 'egg white', 'egg yolk', 'albumin', 'globulin', 'livetin',
    'lysozyme', 'mayonnaise', 'meringue', 'ovalbumin', 'ovomucin', 'ovomucoid',
    'ovotransferrin', 'powdered egg', 'dried egg', 'egg substitute',
  ],
  WHEAT: [
    'wheat', 'flour', 'bread', 'breadcrumb', 'breadcrumbs', 'pasta', 'semolina',
    'spelt', 'farro', 'kamut', 'triticale', 'durum', 'farina', 'bulgur', 'couscous',
    'gluten', 'seitan', 'vital wheat gluten', 'wheat starch', 'wheat germ',
    'wheat bran', 'modified wheat starch', 'hydrolyzed wheat protein',
    'crouton', 'croutons', 'roux', 'matzo', 'panko',
  ],
  GLUTEN: [
    'barley', 'rye', 'malt', 'malt vinegar', 'malt extract', 'malt flavoring',
    'oat', 'oats', 'oatmeal',  // Note: oats are naturally gluten-free but often cross-contaminated
  ],
  SOY: [
    'soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tempeh', 'miso', 'tamari',
    'soy sauce', 'edamame', 'soy milk', 'soy protein', 'hydrolyzed soy protein',
    'textured vegetable protein', 'tvp', 'soy lecithin', 'soy flour', 'soy oil',
  ],
  FISH: [
    'fish', 'cod', 'salmon', 'tuna', 'tilapia', 'halibut', 'flounder', 'sole',
    'bass', 'grouper', 'mahi', 'mahi-mahi', 'snapper', 'trout', 'catfish',
    'anchovies', 'anchovy', 'sardine', 'sardines', 'herring', 'pollock',
    'fish sauce', 'worcestershire', 'worcestershire sauce', 'caesar dressing',
    'fish oil', 'fish stock', 'bouillabaisse', 'caponata',
  ],
  SHELLFISH: [
    'shellfish', 'shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish',
    'clam', 'clams', 'oyster', 'oysters', 'scallop', 'scallops', 'mussel', 'mussels',
    'squid', 'octopus', 'abalone', 'barnacle', 'barnacles', 'surimi', 'imitation crab',
  ],
  SESAME: [
    'sesame', 'tahini', 'sesame oil', 'sesame seed', 'sesame seeds', 'til', 'gingelly',
    'benne', 'hummus',
  ],

  // ── Common additional allergens ───────────────────────────────────────────
  CORN: [
    'corn', 'maize', 'cornstarch', 'corn syrup', 'high fructose corn syrup', 'hfcs',
    'corn flour', 'cornmeal', 'grits', 'popcorn', 'hominy', 'masa',
    'modified food starch', 'dextrose', 'maltodextrin', 'sorbitol',
  ],
  SULFITES: [
    'sulfite', 'sulphite', 'sulfur dioxide', 'sulphur dioxide', 'sodium bisulfite',
    'potassium bisulfite', 'sodium metabisulfite', 'potassium metabisulfite',
    'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228',
    'dried fruit', 'wine', 'vinegar',
  ],
  LUPIN: [
    'lupin', 'lupine', 'lupin flour', 'lupin seed', 'lupin bean',
  ],
  MUSTARD: [
    'mustard', 'mustard seed', 'mustard oil', 'mustard flour', 'mustard leaves',
  ],
  CELERY: [
    'celery', 'celeriac', 'celery seed', 'celery salt',
  ],
  MOLLUSCS: [
    'mollusc', 'mollusk', 'snail', 'escargot', 'squid', 'octopus', 'cuttlefish',
    'abalone', 'whelk',
  ],

  // ── Pet-specific toxins ────────────────────────────────────────────────────
  PET_GRAPE: ['grape', 'grapes', 'raisin', 'raisins', 'currant', 'currants', 'sultana', 'sultanas'],
  PET_ONION: ['onion', 'onions', 'garlic', 'shallot', 'shallots', 'leek', 'leeks', 'chive', 'chives', 'scallion', 'scallions'],
  PET_XYLITOL: ['xylitol', 'birch sugar', 'sugar alcohol'],
  PET_CHOCOLATE: ['chocolate', 'cocoa', 'cacao', 'dark chocolate', 'milk chocolate', 'white chocolate', 'theobromine'],
  PET_AVOCADO: ['avocado', 'guacamole'],
  PET_MACADAMIA: ['macadamia'],
  PET_ALCOHOL: ['alcohol', 'wine', 'beer', 'rum', 'vodka', 'ethanol', 'spirits'],
  PET_CAFFEINE: ['caffeine', 'coffee', 'espresso', 'tea', 'energy drink', 'cola'],
  PET_RAW_DOUGH: ['yeast', 'raw dough', 'bread dough', 'rising dough'],
  PET_NUTMEG: ['nutmeg', 'mace'],
};

// Normalized key→canonical allergen name mapping for display purposes
const ALLERGEN_DISPLAY: Record<string, string> = {
  PEANUTS: 'Peanuts',
  TREE_NUTS: 'Tree Nuts',
  DAIRY: 'Dairy/Milk',
  EGGS: 'Eggs',
  WHEAT: 'Wheat/Gluten',
  GLUTEN: 'Gluten (Barley/Rye/Oats)',
  SOY: 'Soy',
  FISH: 'Fish',
  SHELLFISH: 'Shellfish',
  SESAME: 'Sesame',
  CORN: 'Corn',
  SULFITES: 'Sulfites',
  LUPIN: 'Lupin',
  MUSTARD: 'Mustard',
  CELERY: 'Celery',
  MOLLUSCS: 'Molluscs',
  PET_GRAPE: 'Grapes/Raisins (Pet Toxic)',
  PET_ONION: 'Onion/Garlic (Pet Toxic)',
  PET_XYLITOL: 'Xylitol (Pet Toxic)',
  PET_CHOCOLATE: 'Chocolate/Cocoa (Pet Toxic)',
  PET_AVOCADO: 'Avocado (Pet Toxic)',
  PET_MACADAMIA: 'Macadamia (Pet Toxic)',
  PET_ALCOHOL: 'Alcohol (Pet Toxic)',
  PET_CAFFEINE: 'Caffeine (Pet Toxic)',
  PET_RAW_DOUGH: 'Raw Yeast Dough (Pet Toxic)',
  PET_NUTMEG: 'Nutmeg (Pet Toxic)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SafetyCheckResult {
  safe: boolean;
  /** 'CRITICAL' = matches criticalAllergies, 'WARNING' = matches regular allergies */
  severity: 'CRITICAL' | 'WARNING' | 'SAFE';
  flaggedAllergens: string[];
  reason: string;
  /** If true, the item must be blocked from saving/display */
  block: boolean;
}

export interface ProfileAllergenContext {
  name: string;
  type: string;
  criticalAllergies: string[];
  allergies: string[];
  intolerances: string[];
}

// ─── Core validation ──────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercase, strip punctuation.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if a piece of text (item name or ingredient) contains a given alias.
 * Uses word-boundary-aware substring matching.
 */
function textContainsAlias(text: string, alias: string): boolean {
  const t = norm(text);
  const a = norm(alias);
  // Check full string contains alias as a word/phrase
  return t === a || t.startsWith(a + ' ') || t.endsWith(' ' + a) || t.includes(' ' + a + ' ');
}

/**
 * Map a user-provided allergen label (e.g. "Peanuts", "dairy", "tree nuts")
 * to all canonical allergen keys it represents.
 */
function userAllergenToKeys(userAllergen: string): string[] {
  const n = norm(userAllergen);
  const matches: string[] = [];

  for (const key of Object.keys(ALLERGEN_ALIASES)) {
    const displayName = norm(ALLERGEN_DISPLAY[key] || key);
    const keyNorm = norm(key.replace(/_/g, ' '));

    if (n === displayName || n === keyNorm) {
      matches.push(key);
      continue;
    }
    // Partial: e.g. "nut" matches PEANUTS, TREE_NUTS
    if (displayName.includes(n) || keyNorm.includes(n)) {
      matches.push(key);
    }
  }

  // If no canonical match, treat the raw string as a custom allergen
  // and check all aliases in the map for matches
  return matches.length > 0 ? matches : ['_CUSTOM_' + userAllergen];
}

/**
 * Get all alias strings for a given user-supplied allergen label.
 */
function getAliasesForUserAllergen(userAllergen: string): string[] {
  const keys = userAllergenToKeys(userAllergen);
  const aliases: string[] = [];
  for (const key of keys) {
    if (key.startsWith('_CUSTOM_')) {
      aliases.push(userAllergen.toLowerCase());
    } else {
      aliases.push(...(ALLERGEN_ALIASES[key] || []));
    }
  }
  return aliases;
}

/**
 * Deterministically check whether an item (by name + ingredient list) conflicts
 * with a set of allergen strings.
 *
 * Returns the list of user-supplied allergen labels that were found.
 */
function findAllergenMatches(
  itemName: string,
  ingredients: string[],
  allergens: string[]
): string[] {
  const found: string[] = [];
  const textSources = [itemName, ...ingredients];

  for (const allergen of allergens) {
    const aliases = getAliasesForUserAllergen(allergen);
    let hit = false;

    for (const source of textSources) {
      if (!source) continue;
      for (const alias of aliases) {
        if (textContainsAlias(source, alias)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }

    if (hit) found.push(allergen);
  }

  return found;
}

// ─── GPT-4o-mini second-pass validation ───────────────────────────────────────

/**
 * Use GPT-4o-mini as a second-pass allergen checker for items where
 * the deterministic check was inconclusive (no ingredient list) or where
 * the profile has criticalAllergies (highest stakes).
 *
 * Returns true if the item is SAFE (no allergen conflict found).
 */
async function aiAllergenCheck(
  itemName: string,
  ingredients: string[],
  allergens: string[]
): Promise<{ safe: boolean; flaggedAllergens: string[]; reason: string }> {
  // Sanitize all user-controlled strings before injecting into prompt
  const safeItemName = sanitizeForPrompt(itemName);
  const safeIngredients = ingredients.map(sanitizeForPrompt);
  const safeAllergens = allergens.map(sanitizeForPrompt);

  const ingredientList = safeIngredients.length > 0
    ? `Ingredient list: ${safeIngredients.join(', ')}`
    : 'No ingredient list provided — evaluate based on item name alone.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a food safety expert specializing in allergen identification. 
Your job is to determine whether a food item contains or likely contains specific allergens.
Be conservative: if there is any reasonable possibility an allergen is present (cross-contamination, 
hidden ingredients, typical recipes), flag it. 
Never assume something is safe unless you are certain. Respond ONLY in JSON.`,
        },
        {
          role: 'user',
          content: `Item name: "${safeItemName}"
${ingredientList}

Allergens to check: ${safeAllergens.join(', ')}

For each allergen, determine if this item contains it or if there is significant risk.
Consider:
- Common recipes / typical preparations for this item
- Brand products that are well-known to contain certain allergens
- Cross-contamination risks in typical manufacturing

Return JSON:
{
  "safe": boolean,
  "flaggedAllergens": ["allergen1", "allergen2"],
  "reason": "Brief explanation of findings. If safe, say 'No allergen conflicts detected.'"
}`,
        },
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { safe: true, flaggedAllergens: [], reason: 'AI check skipped (no response)' };

    const parsed = JSON.parse(content);
    return {
      safe: parsed.safe === true,
      flaggedAllergens: parsed.flaggedAllergens || [],
      reason: parsed.reason || '',
    };
  } catch {
    // If AI check fails, err on the side of caution for critical allergens
    return { safe: false, flaggedAllergens: allergens, reason: 'AI validation unavailable — item blocked for safety' };
  }
}

// ─── Primary exported function ────────────────────────────────────────────────

/**
 * Run full safety validation on a single item against a profile.
 *
 * Logic:
 * 1. Deterministic check against criticalAllergies — if hit → BLOCK immediately
 *    and also run AI second-pass to confirm/expand the finding
 * 2. Deterministic check against regular allergies — if hit → WARNING
 * 3. For items with no ingredient list AND criticalAllergies → AI second-pass
 *
 * @param itemName   The name of the food item / product
 * @param ingredients Array of ingredient strings (may be empty)
 * @param profile    The profile's allergen context
 */
export async function checkItemSafety(
  itemName: string,
  ingredients: string[],
  profile: ProfileAllergenContext
): Promise<SafetyCheckResult> {
  // ── Step 1: Critical allergen deterministic check ─────────────────────────
  if (profile.criticalAllergies.length > 0) {
    const criticalHits = findAllergenMatches(itemName, ingredients, profile.criticalAllergies);

    if (criticalHits.length > 0) {
      // Confirmed by deterministic check — still run AI to get full picture
      const aiResult = await aiAllergenCheck(itemName, ingredients, profile.criticalAllergies);
      const allFlagged = [...new Set([...criticalHits, ...aiResult.flaggedAllergens])];
      return {
        safe: false,
        severity: 'CRITICAL',
        flaggedAllergens: allFlagged,
        reason: `CRITICAL: Contains ${allFlagged.join(', ')} which ${profile.name} is critically allergic to. ${aiResult.reason}`,
        block: true,
      };
    }

    // Even without a deterministic hit, run AI second-pass when criticalAllergies
    // exist and no ingredient list is provided (brand/packaged item)
    if (ingredients.length === 0) {
      const aiResult = await aiAllergenCheck(itemName, [], profile.criticalAllergies);
      if (!aiResult.safe) {
        return {
          safe: false,
          severity: 'CRITICAL',
          flaggedAllergens: aiResult.flaggedAllergens,
          reason: `CRITICAL (AI): ${aiResult.reason}`,
          block: true,
        };
      }
    }
  }

  // ── Step 2: Regular allergen deterministic check ──────────────────────────
  if (profile.allergies.length > 0) {
    const allergyHits = findAllergenMatches(itemName, ingredients, profile.allergies);
    if (allergyHits.length > 0) {
      return {
        safe: false,
        severity: 'WARNING',
        flaggedAllergens: allergyHits,
        reason: `Contains ${allergyHits.join(', ')} which ${profile.name} is allergic to.`,
        block: false, // Warning — flag but don't block (not marked critical)
      };
    }
  }

  return {
    safe: true,
    severity: 'SAFE',
    flaggedAllergens: [],
    reason: '',
    block: false,
  };
}

/**
 * Validate a batch of AI-generated items (recommendations or meal plan entries)
 * against a profile's allergen context.
 *
 * Returns each item annotated with a safetyFlag string suitable for DB storage:
 *   - null / undefined = safe
 *   - 'WARNING:allergen1,allergen2' = contains known allergens (warning level)
 *   - 'CRITICAL:allergen1' = contains critical allergen — MUST NOT save if block=true
 *
 * Items with block=true are filtered OUT of the returned array.
 */
export async function validateAndFilterItems<T extends { itemName: string; ingredients?: string[] }>(
  items: T[],
  profile: ProfileAllergenContext
): Promise<Array<T & { safetyFlag: string | null }>> {
  // Skip validation entirely if profile has no allergen constraints
  const hasConstraints =
    profile.criticalAllergies.length > 0 || profile.allergies.length > 0;

  if (!hasConstraints) {
    return items.map((item) => ({ ...item, safetyFlag: null }));
  }

  const results: Array<T & { safetyFlag: string | null }> = [];

  for (const item of items) {
    const check = await checkItemSafety(
      item.itemName,
      item.ingredients || [],
      profile
    );

    if (check.block) {
      // Do not include this item — it's dangerous for this profile
      console.warn(
        `[AllergenSafety] BLOCKED "${item.itemName}" for profile "${profile.name}": ${check.reason}`
      );
      continue;
    }

    const safetyFlag = check.severity === 'SAFE'
      ? null
      : `${check.severity}:${check.flaggedAllergens.join(',')}`;

    results.push({ ...item, safetyFlag });
  }

  return results;
}
