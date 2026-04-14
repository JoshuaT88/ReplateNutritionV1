import { env } from '../config/env.js';

interface PlaceResult {
  name: string;
  address: string;
  phone?: string;
  rating?: number;
  hours?: string[];
  location: { lat: number; lng: number };
  placeId: string;
}

export async function searchNearbyStores(zipCode: string, radius: number = 16000): Promise<PlaceResult[]> {
  // First, geocode the ZIP code
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipCode)}&key=${env.GOOGLE_PLACES_API_KEY}`;
  const geoRes = await fetch(geocodeUrl);
  const geoData = await geoRes.json() as any;

  if (!geoData.results?.length) return [];
  const { lat, lng } = geoData.results[0].geometry.location;

  // Search for grocery stores nearby
  const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=supermarket&key=${env.GOOGLE_PLACES_API_KEY}`;
  const placesRes = await fetch(placesUrl);
  const placesData = await placesRes.json() as any;

  if (!placesData.results?.length) return [];

  const stores: PlaceResult[] = [];
  for (const place of placesData.results.slice(0, 10)) {
    // Get details for phone and hours
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,opening_hours&key=${env.GOOGLE_PLACES_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json() as any;

    stores.push({
      name: place.name,
      address: place.vicinity || place.formatted_address || '',
      phone: detailData.result?.formatted_phone_number,
      rating: place.rating,
      hours: detailData.result?.opening_hours?.weekday_text,
      location: place.geometry.location,
      placeId: place.place_id,
    });
  }

  return stores;
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
