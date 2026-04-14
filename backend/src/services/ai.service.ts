import OpenAI from 'openai';
import { env } from '../config/env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface ProfileContext {
  name: string;
  type: string;
  petType?: string;
  age?: number;
  allergies: string[];
  intolerances: string[];
  dietaryRestrictions: string[];
  specialConditions: string[];
  foodPreferences: string[];
  foodDislikes: string[];
}

const SYSTEM_PROMPT = `You are a nutritionist assistant for the Replate Nutrition app. You help households (humans and pets) with dietary recommendations, meal planning, and shopping.

CRITICAL SAFETY RULES:
- NEVER recommend items that conflict with listed allergies or restrictions. This is a health-critical requirement.
- Always respect intolerances and special conditions.
- For pets, only recommend species-appropriate foods.
- When recommending for special conditions (e.g., Autism/ARFID, Celiac, Diabetes), tailor recommendations to those needs.
- Always respond in valid JSON format when asked for structured data.`;

function buildProfileConstraints(profile: ProfileContext): string {
  const lines = [`Profile: ${profile.name} (${profile.type}${profile.petType ? ` - ${profile.petType}` : ''})`];
  if (profile.age) lines.push(`Age: ${profile.age}`);
  if (profile.allergies.length) lines.push(`ALLERGIES (MUST AVOID): ${profile.allergies.join(', ')}`);
  if (profile.intolerances.length) lines.push(`Intolerances: ${profile.intolerances.join(', ')}`);
  if (profile.dietaryRestrictions.length) lines.push(`Dietary restrictions: ${profile.dietaryRestrictions.join(', ')}`);
  if (profile.specialConditions.length) lines.push(`Special conditions: ${profile.specialConditions.join(', ')}`);
  if (profile.foodPreferences.length) lines.push(`Preferences: ${profile.foodPreferences.join(', ')}`);
  if (profile.foodDislikes.length) lines.push(`Dislikes (avoid): ${profile.foodDislikes.join(', ')}`);
  return lines.join('\n');
}

export async function generateRecommendations(
  profile: ProfileContext,
  categories: string[]
): Promise<any[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate 8-12 food and product recommendations for the following profile and categories.

${buildProfileConstraints(profile)}

Categories requested: ${categories.join(', ')}

Return JSON with this structure:
{
  "recommendations": [
    {
      "itemName": "string",
      "itemType": "food" | "brand" | "recipe",
      "category": "breakfast" | "lunch" | "dinner" | "snack" | "beverage" | "dessert",
      "reason": "string (2-3 sentences explaining why this is good for this profile)",
      "ingredients": ["string"],
      "alternatives": ["string", "string"],
      "priceRange": "$" | "$$" | "$$$",
      "nutrition": { "calories": number, "protein": "string", "fiber": "string", "keyNutrients": ["string"] },
      "texture": "string (describe texture/sensory profile, especially relevant for ARFID)"
    }
  ]
}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.recommendations || [];
}

export async function generateMeals(
  profiles: ProfileContext[],
  date: string,
  mealTypes: string[],
  recentMeals: string[]
): Promise<any[]> {
  const profilesText = profiles.map(buildProfileConstraints).join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate meal suggestions for ${date}.

Profiles:
${profilesText}

Meal types needed: ${mealTypes.join(', ')}

Recent meals to AVOID repeating: ${recentMeals.length ? recentMeals.join(', ') : 'None'}

Return JSON:
{
  "meals": [
    {
      "profileName": "string",
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "mealName": "string",
      "ingredients": ["string"],
      "preparationNotes": "string",
      "calories": number
    }
  ]
}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.meals || [];
}

export async function generateShoppingListFromMeals(
  ingredients: string[]
): Promise<any[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Consolidate these meal ingredients into a shopping list. Combine duplicates, estimate reasonable quantities for a household.

Ingredients: ${ingredients.join(', ')}

Return JSON:
{
  "items": [
    {
      "itemName": "string",
      "category": "Produce" | "Dairy" | "Meat & Seafood" | "Pantry" | "Frozen" | "Bakery" | "Beverages" | "Snacks" | "Condiments" | "Other",
      "quantity": "string (e.g., '2 lbs', '1 gallon', '3 cans')"
    }
  ]
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.items || [];
}

export async function findNearbyStores(
  items: { name: string; quantity: string }[],
  zipCode: string,
  crowdSourcedPrices: Record<string, Record<string, number>>
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

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Find grocery stores near ZIP code ${zipCode} and estimate the total cost of this shopping list at each store. 

IMPORTANT: Calculate totals by multiplying each item's unit price by its quantity. For example, "16 filet mignons" at ~$14/each = $224, NOT $14.

Shopping list:
${itemList}

${priceContext ? `Known crowd-sourced prices (use these where available, estimate the rest):\n${priceContext}` : 'No crowd-sourced price data available. Estimate all prices.'}

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
          "confidence": "crowd_sourced" | "ai_estimate"
        }
      ]
    }
  ]
}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.stores || [];
}

export async function validateGroceryItem(
  itemName: string
): Promise<{ isValid: boolean; reason: string; suggestedCategory?: string }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You validate whether items are grocery/food items. Respond in JSON.' },
      {
        role: 'user',
        content: `Is "${itemName}" a valid grocery or food item? Return: { "isValid": boolean, "reason": "string", "suggestedCategory": "string or null" }`,
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return { isValid: false, reason: 'Could not validate item' };
  return JSON.parse(content);
}

export async function predictAisleLocation(
  itemName: string,
  storeName: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You predict likely aisle locations in grocery stores. Respond in JSON.' },
      {
        role: 'user',
        content: `Where would "${itemName}" most likely be found in ${storeName}? Return: { "aisle": "string (e.g., 'Aisle 3 - Canned Goods', 'Produce Section', 'Dairy Aisle')" }`,
      },
    ],
    temperature: 0.3,
    max_tokens: 100,
  });

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
  const response = await openai.chat.completions.create({
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
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from AI');
  const parsed = JSON.parse(content);
  return parsed.alternatives || [];
}
