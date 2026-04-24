import OpenAI from 'openai';
import { env } from '../config/env.js';
import {
  isGroceryItem,
  categorizeItem,
  predictAisleLocally,
  buildPriceReferenceContext,
  getStoreTier,
} from '../data/groceryReferenceData.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface ProfileContext {
  name: string;
  type: string;
  petType?: string;
  age?: number;
  criticalAllergies?: string[];
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  specialConditions: string[];
  foodPreferences: string[];
  foodDislikes: string[];
}

const SYSTEM_PROMPT = `You are a registered dietitian and food safety specialist for the Replate Nutrition app.
You help households — including families with disabilities, medical conditions, severe allergies, eating disorders, picky eaters, and special-needs pets — with evidence-based, safety-first dietary recommendations, meal planning, and grocery guidance.

══════════════════════════════════════════════════════════
 LIFE-SAFETY RULES — ABSOLUTE PRIORITY — NEVER OVERRIDE
══════════════════════════════════════════════════════════
- CRITICAL ALLERGIES (labeled "CRITICAL ALLERGENS"): NEVER, under any circumstances, recommend any item that contains or may contain these ingredients. This includes all hidden forms, derivatives, and manufacturing cross-contamination risks. A mistake here can kill someone.
- ALLERGIES (labeled "ALLERGIES (MUST AVOID)"): NEVER recommend items containing these. Zero exceptions.
- INTOLERANCES: Strictly exclude. Even trace amounts can cause severe reactions for some conditions.
- Pet toxins: NEVER suggest grapes, raisins, onions, garlic, xylitol, chocolate, macadamia nuts, avocado, alcohol, caffeine, or raw yeast dough for any dog or cat profile.
- When in doubt about whether an item is safe, DO NOT include it. Recommend alternatives instead.

══════════════════════════════════════════════════════════
 CONDITION-SPECIFIC RULES
══════════════════════════════════════════════════════════
- Autism/ARFID/Sensory Processing Disorder: Prioritize familiar textures and predictable presentations. Avoid mixed textures, surprise ingredients, or strong sensory variation. Label texture clearly.
- Celiac Disease / Gluten Intolerance: ALL items must be certified gluten-free. Always note cross-contamination risks (shared equipment, bulk bins, shared fryers).
- Eosinophilic Esophagitis (EoE): Avoid the six-food elimination diet allergens unless confirmed safe: milk, eggs, wheat, soy, peanuts/tree nuts, seafood.
- FPIES / MSPI: Only hypoallergenic, clearly-labeled options. No assumptions about safety.
- Phenylketonuria (PKU): Zero phenylalanine — avoid all high-protein foods, aspartame, and NutraSweet.
- PCOS: Low glycemic index, anti-inflammatory, hormone-balancing foods.
- Diabetes Type 1/2: Low glycemic index, high fiber, controlled and consistent carbohydrates.
- IBD / Crohn's / IBS: Avoid high-FODMAP, raw vegetables, seeds, and known trigger foods during flares.
- Kidney Disease (human or pet): Low phosphorus, low potassium, low sodium, controlled protein.
- ADHD: Minimize artificial colors, additives; omega-3-rich foods may be beneficial.
- Mast Cell Activation Syndrome: Avoid high-histamine foods (fermented, aged, processed), alcohol, vinegar.
- Cancer dietary support: Anti-inflammatory, nutrient-dense; avoid raw foods if immunocompromised.
- Gout: Low purine — avoid organ meats, shellfish, high-fructose corn syrup, alcohol.

══════════════════════════════════════════════════════════
 QUALITY RULES
══════════════════════════════════════════════════════════
- Always respond in valid JSON format when asked for structured data.
- Be specific — name exact products, cuts, and varieties (e.g., "boneless skinless chicken thighs" not just "chicken").
- For brand recommendations: include full product name, brand, size/variant.
- Provide accurate nutritional context, not vague generalities.
- Meal variety is important — if recent meals are provided, actively avoid repeating them.
- Always include a texture description for ARFID/sensory profiles.`;

/** Retry an async function up to maxAttempts times on transient errors. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const isTransient =
        err instanceof Error &&
        (err.message.includes('timeout') ||
          err.message.includes('rate_limit') ||
          err.message.includes('503') ||
          err.message.includes('529'));
      if (!isTransient || attempt === maxAttempts) throw err;
    }
  }
  throw lastErr;
}

/** Strip control characters and newlines from user-provided strings before injecting into prompts. */
function sanitizeForPrompt(value: string): string {
  return value
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 200)
    .trim();
}

function buildProfileConstraints(profile: ProfileContext): string {
  const sanitize = (arr: string[]) => arr.map(sanitizeForPrompt).join(', ');
  const lines = [`Profile: ${sanitizeForPrompt(profile.name)} (${profile.type}${profile.petType ? ` - ${sanitizeForPrompt(profile.petType)}` : ''})`];
  if (profile.age) lines.push(`Age: ${profile.age}`);
  if (profile.criticalAllergies?.length) {
    lines.push(`⚠️ CRITICAL ALLERGENS — LIFE-THREATENING — ABSOLUTE EXCLUSION: ${sanitize(profile.criticalAllergies)}`);
    lines.push(`   → DO NOT include ANY item that contains these allergens in any form (including derivatives, traces, cross-contamination risk).`);
  }
  if (profile.allergies.length) lines.push(`ALLERGIES (MUST AVOID): ${sanitize(profile.allergies)}`);
  if (profile.intolerances.length) lines.push(`Intolerances: ${sanitize(profile.intolerances)}`);
  if (profile.dietaryRestrictions.length) lines.push(`Dietary restrictions: ${sanitize(profile.dietaryRestrictions)}`);
  if (profile.specialConditions.length) lines.push(`Special conditions: ${sanitize(profile.specialConditions)}`);
  if (profile.foodPreferences.length) lines.push(`Preferences: ${sanitize(profile.foodPreferences)}`);
  if (profile.foodDislikes.length) lines.push(`Dislikes (avoid): ${sanitize(profile.foodDislikes)}`);
  return lines.join('\n');
}

export async function generateRecommendations(
  profile: ProfileContext,
  categories: string[]
): Promise<any[]> {
  const isPet = profile.type === 'PET';

  const humanPrompt = `Generate 8-12 food and product recommendations for the following profile and categories.

${buildProfileConstraints(profile)}

Categories requested: ${categories.join(', ')}

IMPORTANT RULES:
- If category "brand" is requested, recommend specific commercial branded products with full product names (e.g., "Cheerios Honey Nut Cereal - 18oz Box", "Chobani Greek Yogurt - Strawberry"). Set itemType to "brand" and ingredients to an EMPTY array [].
- For "food" type: recommend whole/fresh ingredients or simple prepared items.
- For "recipe" type: recommend meals with ingredient lists.
- For brand items, set ingredients to an EMPTY array [] since they are purchased as a whole product.

Return JSON with this structure:
{
  "recommendations": [
    {
      "itemName": "string",
      "itemType": "food" | "brand" | "recipe",
      "category": "breakfast" | "lunch" | "dinner" | "snack" | "beverage" | "dessert" | "brand",
      "reason": "string (2-3 sentences explaining why this is good for this profile)",
      "ingredients": ["string"],
      "alternatives": ["string", "string"],
      "priceRange": "$" | "$$" | "$$$",
      "nutrition": { "calories": number, "protein": "string", "fiber": "string", "keyNutrients": ["string"] },
      "texture": "string (describe texture/sensory profile, especially relevant for ARFID)"
    }
  ]
}`;

  const petPrompt = `Generate 8-12 food and product recommendations for the following pet profile.

${buildProfileConstraints(profile)}

Categories requested: ${categories.join(', ')}

IMPORTANT PET RULES:
- For "brand" type: recommend specific commercial pet food brands with the full product name (e.g., "Purina Pro Plan Chicken & Rice Adult Dog Food - 30lb bag"). Include brand name, blend/flavor, and size.
- For "food" type: recommend species-appropriate fresh/whole foods (e.g., "Cooked chicken breast", "Blueberries", "Sweet potato").
- For "recipe" type: recommend homemade pet food recipes with ingredient lists.
- Use category values: "kibble", "wet_food", "treats", "fresh_food", "supplement" instead of human meal categories.
- For brand items, set ingredients to an EMPTY array [] since they are purchased as a whole product.
- For food/recipe items, list individual ingredients.

Return JSON with this structure:
{
  "recommendations": [
    {
      "itemName": "string (full product name for brands, food name for foods, recipe name for recipes)",
      "itemType": "food" | "brand" | "recipe",
      "category": "kibble" | "wet_food" | "treats" | "fresh_food" | "supplement",
      "reason": "string (2-3 sentences explaining why this is good for this pet)",
      "ingredients": ["string"],
      "alternatives": ["string", "string"],
      "priceRange": "$" | "$$" | "$$$",
      "nutrition": { "calories": number, "protein": "string", "fiber": "string", "keyNutrients": ["string"] },
      "texture": "string"
    }
  ]
}`;

  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: isPet ? petPrompt : humanPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  const recs = parsed.recommendations || [];

  // Post-process: ensure pet kibble/wet_food items that are clearly branded products get itemType 'brand'
  if (isPet) {
    for (const rec of recs) {
      if (rec.category === 'kibble' || rec.category === 'wet_food') {
        rec.itemType = 'brand';
        rec.ingredients = [];
      }
      if (rec.itemType === 'brand') {
        rec.ingredients = [];
      }
    }
  }

  return recs;
}

export async function generateMeals(
  profiles: ProfileContext[],
  dates: string | string[],
  mealTypes: string[],
  recentMeals: string[],
  dietaryGoals?: string
): Promise<any[]> {
  const profilesText = profiles.map(buildProfileConstraints).join('\n\n');
  const dateList = Array.isArray(dates) ? dates : [dates];
  const datesText = dateList.length === 1
    ? `for ${dateList[0]}`
    : `for EACH of these dates: ${dateList.join(', ')}`;

  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate meal suggestions ${datesText}.

Profiles:
${profilesText}

Meal types needed per day per profile: ${mealTypes.join(', ')}

${dateList.length > 1 ? `CRITICAL: You MUST generate meals for EVERY date listed. Each profile needs ALL meal types for EACH day. Every meal object MUST include a "date" field set to the YYYY-MM-DD it belongs to. Do NOT put all meals on one date.\n` : ''}
Recent meals to AVOID repeating: ${recentMeals.length ? recentMeals.join(', ') : 'None'}
${dietaryGoals ? `\nDIETARY GOALS: The user wants meals that are: ${dietaryGoals}. Prioritize meals that align with these goals.\n` : ''}

Return JSON:
{
  "meals": [
    {
      "profileName": "string (must match a profile name exactly)",
      "date": "YYYY-MM-DD (must be one of the dates listed above)",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "mealName": "string",
      "ingredients": ["string"],
      "preparationNotes": "string",
      "calories": number
    }
  ]
}

${dateList.length > 1 ? `Expected total: approximately ${dateList.length * profiles.length * mealTypes.length} meals (${dateList.length} days × ${profiles.length} profiles × ${mealTypes.length} meal types).` : ''}`,
      },
    ],
    temperature: 0.75,
    max_tokens: Math.min(16384, dateList.length * profiles.length * mealTypes.length * 160 + 500),
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.meals || [];
}

/**
 * Consolidate meal plan ingredients into a de-duplicated shopping list.
 * Locally categorizes known items (free), only asks AI for unknowns.
 */
export async function generateShoppingListFromMeals(
  ingredients: string[]
): Promise<any[]> {
  // Phase 1: Local categorization for known items
  const locallyResolved: Array<{ itemName: string; category: string; quantity: string }> = [];
  const needsAI: string[] = [];

  // Normalize and de-duplicate
  const normalized = new Map<string, number>();
  for (const raw of ingredients) {
    const key = raw.toLowerCase().trim();
    normalized.set(key, (normalized.get(key) || 0) + 1);
  }

  for (const [item, count] of normalized.entries()) {
    const category = categorizeItem(item);
    if (category) {
      locallyResolved.push({
        itemName: item.charAt(0).toUpperCase() + item.slice(1),
        category,
        quantity: count > 1 ? `${count}x` : '1',
      });
    } else {
      // Combine duplicates for AI
      const existing = needsAI.find((i) => i.toLowerCase() === item);
      if (!existing) needsAI.push(count > 1 ? `${item} (×${count})` : item);
    }
  }

  // Phase 2: AI only for items not in reference data
  if (needsAI.length > 0) {
    const response = await withRetry(() => openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Consolidate these meal ingredients into shopping list items. Estimate reasonable household quantities.

Ingredients: ${needsAI.join(', ')}

Return JSON:
{
  "items": [
    {
      "itemName": "string",
      "category": "Produce" | "Dairy" | "Meat & Seafood" | "Pantry" | "Frozen" | "Bakery" | "Beverages" | "Snacks" | "Condiments" | "Pet Food" | "Other",
      "quantity": "string (e.g., '2 lbs', '1 gallon', '3 cans')"
    }
  ]
}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }));

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      locallyResolved.push(...(parsed.items || []));
    }
  }

  return locallyResolved;
}

export async function findNearbyStores(
  items: { name: string; quantity: string }[],
  zipCode: string,
  crowdSourcedPrices: Record<string, Record<string, number>>,
  knownStores?: { name: string; address: string; phone?: string; rating?: number; hours?: string[] }[]
): Promise<any[]> {
  const itemList = items.map((i) => `${i.quantity} × ${i.name}`).join('\n');
  const priceContext = Object.entries(crowdSourcedPrices)
    .map(([store, prices]) => {
      const priceLines = Object.entries(prices)
        .map(([item, price]) => `  ${item}: $${price.toFixed(2)}`)
        .join('\n');
      return `${store}:\n${priceLines}`;
    })
    .join('\n\n');

  // Build per-store tier context for known stores
  const storeTierContext = knownStores?.length
    ? knownStores
        .map((s) => `  ${s.name}: ${getStoreTier(s.name)} tier`)
        .join('\n')
    : '';

  const storeDirective = knownStores?.length
    ? `KNOWN STORES (from Google Places — use ONLY these stores, do NOT invent others):
${knownStores.map((s) => `- ${s.name} — ${s.address}${s.phone ? ` — ${s.phone}` : ''}${s.rating ? ` — Rating: ${s.rating}` : ''}${s.hours?.length ? ` — Hours: ${s.hours[0]}` : ''}`).join('\n')}

Store pricing tiers:
${storeTierContext}

Estimate prices for each store. Use crowd-sourced data where available, then reference prices below, then adjust for store tier.`
    : `Find ALL grocery stores within an 8-10 mile radius of ZIP code ${zipCode} and estimate the total cost of this shopping list at each store.

IMPORTANT:
- Include ALL major grocery stores within 8-10 miles (at least 6-10 stores).
- Include budget stores (Walmart, Aldi, Lidl), mid-range (Kroger, Publix, HEB, Safeway, Meijer, Food Lion), and premium (Whole Foods, Trader Joe's, Sprouts).
- Also include warehouse clubs (Costco, Sam's Club) if nearby.
- DO NOT limit to just the same ZIP code — include surrounding areas.`;

  const refPrices = buildPriceReferenceContext();

  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${storeDirective}

PRICING RULES:
- Calculate totals by multiplying each item's unit price by its quantity.
- Use crowd-sourced prices first (most accurate). Then use the reference prices below. Then estimate for the store's tier.
- Budget stores are ~22% below reference average; premium stores are ~35% above; club stores ~15% below (bulk sizes).
- Sort results by estimated total (cheapest first).

Shopping list:
${itemList}

${priceContext ? `Crowd-sourced prices (highest priority — use these exactly):\n${priceContext}\n` : ''}
${refPrices}

Return JSON:
{
  "stores": [
    {
      "name": "string",
      "address": "string",
      "phone": "string",
      "hours": "string",
      "distance": "string",
      "estimatedTotal": number,
      "itemPrices": [
        {
          "itemName": "string",
          "unitPrice": number,
          "quantity": number,
          "subtotal": number,
          "confidence": "crowd_sourced" | "reference_data" | "ai_estimate"
        }
      ]
    }
  ]
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.stores || [];
}

/**
 * Validate whether an item name is a grocery/food item.
 * Checks local reference data first — only calls AI for ambiguous items.
 */
export async function validateGroceryItem(
  itemName: string
): Promise<{ isValid: boolean; reason: string; suggestedCategory?: string }> {
  // Local check first (free, instant)
  const category = categorizeItem(itemName);
  if (category) {
    return { isValid: true, reason: 'Recognized grocery item', suggestedCategory: category };
  }
  if (isGroceryItem(itemName)) {
    return { isValid: true, reason: 'Recognized grocery item' };
  }

  // Fall back to AI for truly ambiguous items
  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You validate whether items are grocery/food items. Respond in JSON only.' },
      {
        role: 'user',
        content: `Is "${itemName}" a valid grocery or food item that someone would buy at a grocery store? Return: { "isValid": boolean, "reason": "string (one sentence)", "suggestedCategory": "string or null" }`,
      },
    ],
    temperature: 0.1,
    max_tokens: 100,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) return { isValid: false, reason: 'Could not validate item' };
  return JSON.parse(content);
}

/**
 * Predict where an item would be found in a store.
 * Uses local reference data first — only calls AI when the item is not recognized.
 */
export async function predictAisleLocation(
  itemName: string,
  storeName: string
): Promise<string> {
  // Local check first (free)
  const local = predictAisleLocally(itemName, storeName);
  if (local) return local;

  // AI fallback for specialty items
  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You predict likely aisle locations in US grocery stores. Be specific. Respond in JSON only.' },
      {
        role: 'user',
        content: `Where would "${itemName}" most likely be found in a ${storeName} store? Return: { "aisle": "string (e.g., 'Aisle 7 - International Foods', 'Produce Section', 'Back Wall - Dairy')" }`,
      },
    ],
    temperature: 0.2,
    max_tokens: 80,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) return 'Unknown';
  const parsed = JSON.parse(content);
  return parsed.aisle || 'Unknown';
}

export async function findAlternativeStores(
  incompleteItems: string[],
  currentStore: string,
  zipCode: string
): Promise<any[]> {
  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `I'm shopping at ${currentStore} near ZIP ${zipCode} but these items were unavailable or too expensive:
${incompleteItems.join('\n')}

Suggest 2-3 nearby alternative stores likely to carry these items, with estimated prices.

Return JSON:
{
  "alternatives": [
    {
      "storeName": "string",
      "address": "string",
      "distance": "string",
      "estimatedItemPrices": [{ "item": "string", "price": number }],
      "estimatedTotal": number,
      "reason": "string"
    }
  ]
}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 2000,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.alternatives || [];
}

export interface ReceiptLineItem {
  itemName: string;
  price: number;
  quantity: number;
}

export interface ReceiptOcrResult {
  storeName: string | null;
  storeAddress: string | null;
  date: string | null;
  items: ReceiptLineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

export async function extractReceiptData(
  imageBase64: string,
  mimeType: string
): Promise<ReceiptOcrResult> {
  const response = await withRetry(() => openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You extract structured data from grocery store receipt images. Return accurate data only — do not hallucinate items or prices that are not visible.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all line items, store info, and totals from this receipt image.

Return JSON:
{
  "storeName": "string or null",
  "storeAddress": "string or null",
  "date": "YYYY-MM-DD or null",
  "items": [
    { "itemName": "string", "price": number, "quantity": number }
  ],
  "subtotal": number or null,
  "tax": number or null,
  "total": number or null
}

Rules:
- Only include items clearly visible on the receipt
- Price should be the total for that line (price × quantity if shown)
- quantity defaults to 1 if not explicit
- Normalize item names to plain English (e.g., "ORG BANANNAS" → "Organic Bananas")`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  }));

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Could not read receipt');
  return JSON.parse(content);
}
