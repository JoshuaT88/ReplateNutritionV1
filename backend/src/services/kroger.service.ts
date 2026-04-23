/**
 * Kroger API Service
 *
 * Uses the Kroger Public API (developer.kroger.com) to:
 *  - Find nearby Kroger-family stores by ZIP code
 *  - Search products to get in-store aisle location hints
 *  - Seed AisleLocation table for a store's item catalog
 *
 * APIs used (all Public tier — no partnership required):
 *   - Authorization Endpoints (Public): /connect/oauth2/token
 *   - Location API (Public):            /locations
 *   - Product API (Public):             /products
 */

import prisma from '../config/database.js';
import { env } from '../config/env.js';

const KROGER_BASE = 'https://api.kroger.com/v1';

// ─── Token cache ───────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getKrogerToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;

  if (!env.KROGER_CLIENT_ID || !env.KROGER_CLIENT_SECRET) {
    throw new Error('Kroger API credentials not configured (KROGER_CLIENT_ID / KROGER_CLIENT_SECRET)');
  }

  const credentials = Buffer.from(`${env.KROGER_CLIENT_ID}:${env.KROGER_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${KROGER_BASE}/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger auth failed (${res.status}): ${body}`);
  }

  const data: any = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;
  return cachedToken!;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function krogerGet(path: string): Promise<any> {
  const token = await getKrogerToken();
  const res = await fetch(`${KROGER_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kroger API error (${res.status}): ${body}`);
  }
  return res.json();
}

// ─── Location Search ───────────────────────────────────────────────────────

export interface KrogerLocation {
  locationId: string;
  name: string;
  chain: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  distance?: number;
}

export async function findKrogerStores(zipCode: string, radiusMiles = 15): Promise<KrogerLocation[]> {
  const data = await krogerGet(
    `/locations?filter.zipCode.near=${zipCode}&filter.radiusInMiles=${radiusMiles}&filter.limit=10`
  );

  return (data.data || []).map((loc: any) => ({
    locationId: loc.locationId,
    name: loc.name,
    chain: loc.chain,
    address: loc.address?.addressLine1 || '',
    city: loc.address?.city || '',
    state: loc.address?.state || '',
    zipCode: loc.address?.zipCode || zipCode,
    distance: loc.geolocation?.latLng ? undefined : undefined,
  }));
}

// ─── Product / Aisle Search ────────────────────────────────────────────────

export interface KrogerProduct {
  productId: string;
  name: string;
  brand: string;
  category: string;
  aisleLocation: string | null;
  upc: string;
}

export async function searchKrogerProducts(
  term: string,
  locationId: string,
  limit = 5
): Promise<KrogerProduct[]> {
  const encoded = encodeURIComponent(term);
  const data = await krogerGet(
    `/products?filter.term=${encoded}&filter.locationId=${locationId}&filter.limit=${limit}`
  );

  return (data.data || []).map((p: any) => ({
    productId: p.productId,
    name: p.description,
    brand: p.brand || '',
    category: p.categories?.[0] || 'Other',
    aisleLocation: p.aisleLocations?.[0]?.description || null,
    upc: p.upc || '',
  }));
}

// ─── Aisle Seeding ────────────────────────────────────────────────────────

/**
 * For each item on the user's shopping list, search Kroger for aisle info
 * at the given store location. Upserts AisleLocation records.
 * Returns count of newly seeded aisles.
 */
export async function seedAislesFromKroger(
  userId: string,
  locationId: string,
  storeName: string,
  zipRegion: string
): Promise<{ seeded: number; items: string[] }> {
  if (!env.KROGER_CLIENT_ID || !env.KROGER_CLIENT_SECRET) {
    throw new Error('Kroger API credentials not configured');
  }

  const shoppingList = await prisma.shoppingList.findMany({
    where: { userId },
    select: { itemName: true },
  });

  if (!shoppingList.length) return { seeded: 0, items: [] };

  const seededItems: string[] = [];
  let seeded = 0;

  for (const { itemName } of shoppingList) {
    try {
      const products = await searchKrogerProducts(itemName, locationId, 3);
      const best = products.find((p) => p.aisleLocation) ?? null;
      if (!best?.aisleLocation) continue;

      await prisma.aisleLocation.upsert({
        where: { itemName_storeName_zipRegion: { itemName, storeName, zipRegion } },
        create: {
          itemName,
          storeName,
          zipRegion,
          aisleLocation: best.aisleLocation,
          verifiedCount: 1,
          createdBy: 'kroger-api',
        },
        update: {
          aisleLocation: best.aisleLocation,
          lastVerifiedDate: new Date(),
          createdBy: 'kroger-api',
        },
      });

      seededItems.push(itemName);
      seeded++;

      // Stay within Kroger rate limits (~5 req/s)
      await new Promise((r) => setTimeout(r, 220));
    } catch (err) {
      console.warn(`[Kroger] Aisle seed skipped for "${itemName}":`, (err as Error).message);
    }
  }

  return { seeded, items: seededItems };
}

export function krogerConfigured(): boolean {
  return !!(env.KROGER_CLIENT_ID && env.KROGER_CLIENT_SECRET);
}
