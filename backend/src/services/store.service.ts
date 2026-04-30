import { env } from '../config/env.js';
import prisma from '../config/database.js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1/places';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const CACHE_TTL_DAYS = 7;

interface PlaceResult {
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  hours?: string[];
  location: { lat: number; lng: number };
  placeId: string;
}

function placesHeaders(fieldMask: string) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
    'X-Goog-FieldMask': fieldMask,
  };
}

function cacheExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + CACHE_TTL_DAYS);
  return d;
}

async function getFromCache<T>(key: string): Promise<T | null> {
  const row = await prisma.storeCache.findUnique({ where: { cacheKey: key } });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await prisma.storeCache.delete({ where: { cacheKey: key } }).catch(() => {});
    return null;
  }
  return row.results as T;
}

async function setCache(key: string, queryType: 'zip' | 'name', results: unknown): Promise<void> {
  await prisma.storeCache.upsert({
    where: { cacheKey: key },
    create: { cacheKey: key, queryType, results: results as any, expiresAt: cacheExpiry() },
    update: { results: results as any, expiresAt: cacheExpiry() },
  }).catch(() => {}); // Fire-and-forget; don't block the response
}

async function geocodeZip(zipCode: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(`${GEOCODE_BASE}?address=${encodeURIComponent(zipCode)}&key=${env.GOOGLE_PLACES_API_KEY}`);
  const data = await res.json() as any;
  if (data.status === 'REQUEST_DENIED' || data.error_message) {
    throw new Error(`Geocoding API error: ${data.error_message || data.status}`);
  }
  if (!data.results?.length) return null;
  return data.results[0].geometry.location as { lat: number; lng: number };
}

export async function searchNearbyStores(zipCode: string, radius: number = 16000): Promise<PlaceResult[]> {
  if (!env.GOOGLE_PLACES_API_KEY) throw new Error('Google Places API key not configured');

  const cacheKey = `zip:${zipCode.trim()}`;
  const cached = await getFromCache<PlaceResult[]>(cacheKey);
  if (cached) return cached;

  const location = await geocodeZip(zipCode);
  if (!location) return [];

  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius,
      },
    },
    includedTypes: ['supermarket', 'grocery_store'],
    maxResultCount: 10,
  };

  const res = await fetch(`${PLACES_NEW_BASE}:searchNearby`, {
    method: 'POST',
    headers: placesHeaders('places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours,places.rating'),
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`Places API error: ${data.error.message}`);
  if (!data.places?.length) return [];

  const results: PlaceResult[] = (data.places as any[]).map((p: any) => ({
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    phone: p.nationalPhoneNumber,
    rating: p.rating,
    hours: p.regularOpeningHours?.weekdayDescriptions,
    location: { lat: p.location?.latitude ?? 0, lng: p.location?.longitude ?? 0 },
    placeId: p.id ?? '',
  }));

  setCache(cacheKey, 'zip', results);
  return results;
}

export async function searchStoresByName(query: string): Promise<{ name: string; address: string }[]> {
  if (!env.GOOGLE_PLACES_API_KEY) throw new Error('Google Places API key not configured');

  const cacheKey = `name:${query.trim().toLowerCase()}`;
  const cached = await getFromCache<{ name: string; address: string }[]>(cacheKey);
  if (cached) return cached;

  const body = { textQuery: query };
  const res = await fetch(`${PLACES_NEW_BASE}:searchText`, {
    method: 'POST',
    headers: placesHeaders('places.displayName,places.formattedAddress'),
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`Places API error: ${data.error.message}`);
  if (!data.places?.length) return [];

  const results = (data.places as any[]).slice(0, 8).map((p: any) => ({
    name: p.displayName?.text as string ?? '',
    address: (p.formattedAddress ?? '') as string,
  }));

  setCache(cacheKey, 'name', results);
  return results;
}

export async function getStoreDistance(
  originZip: string,
  destinationPlaceId: string
): Promise<string> {
  const distUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originZip)}&destinations=place_id:${destinationPlaceId}&key=${env.GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(distUrl);
  const data = await res.json() as any;
  return data.rows?.[0]?.elements?.[0]?.distance?.text || 'Unknown';
}
