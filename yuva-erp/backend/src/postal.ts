// The place of a postal code: the Add Teacher form fills the city, the district and the state when a PIN code or a ZIP code is written, for any
// country of the list. India: the public service of the Indian Post (api.postalpincode.in). Other countries: the public service zippopotam.us,
// and when it does not know the code (it has no data for Nepal, Sri Lanka, Singapore...) the public map data of OpenStreetMap (Nominatim) answers.
// Only the postal code and the country go out, nothing about the person. An answer is kept in memory, so the same code is asked once.

import { ISO } from './countryData.ts';
export { ISO };

export interface Place { district: string; state: string; city: string }
type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const cache = new Map<string, Place | null>();

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

const getJson = async (fetchFn: FetchFn, url: string, headers?: Record<string, string>): Promise<any> => {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(6000), headers });
  return res.ok ? res.json() : null;
};

/** India: a PIN code has several post offices; the one that has the name of its block is the main town (305624: Bijainagar). */
async function indiaPost(fetchFn: FetchFn, code: string): Promise<Place | null> {
  const data = await getJson(fetchFn, `https://api.postalpincode.in/pincode/${encodeURIComponent(code)}`);
  const offices: any[] = Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0].PostOffice) ? data[0].PostOffice : [];
  const office = offices[0];
  if (!office) return null;
  const town = offices.find((o) => clean(o.Name) && clean(o.Name).toLowerCase() === clean(o.Block).toLowerCase());
  return { district: clean(office.District), state: clean(office.State), city: clean(town?.Name) };
}

async function zippopotam(fetchFn: FetchFn, iso: string, code: string): Promise<Place | null> {
  // (the service wants the first part of a code of the United Kingdom and of Canada)
  const part = iso === 'GB' ? code.split(' ')[0] : iso === 'CA' ? code.replace(/\s/g, '').slice(0, 3) : code;
  const data = await getJson(fetchFn, `https://api.zippopotam.us/${iso.toLowerCase()}/${encodeURIComponent(part)}`);
  const first = data?.places?.[0];
  return first ? { district: clean(first['place name']), state: clean(first.state), city: '' } : null;
}

/** The United Kingdom: the public service postcodes.io knows every postcode (the district of the council, the region). */
async function ukPostcodes(fetchFn: FetchFn, code: string): Promise<Place | null> {
  const data = await getJson(fetchFn, `https://api.postcodes.io/postcodes/${encodeURIComponent(code.replace(/\s/g, ''))}`);
  const r = data?.status === 200 ? data.result : null;
  if (!r) return null;
  const district = clean(r.admin_district || r.parish);
  return { district, state: clean(r.region || r.country), city: '' };
}

// A city-state is its own city, district and state (the services have no data for it)
const CITY_STATES: Record<string, string> = { SG: 'Singapore', MC: 'Monaco', VA: 'Vatican City', SM: 'San Marino' };

async function openStreetMap(fetchFn: FetchFn, iso: string, code: string): Promise<Place | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(code)}&country=${iso.toLowerCase()}&format=jsonv2&addressdetails=1&limit=1&accept-language=en`;
  const data = await getJson(fetchFn, url, { 'User-Agent': 'AcademiaOS-postal-lookup/1.0' });
  const a = Array.isArray(data) ? data[0]?.address : null;
  if (!a) return null;
  const city = clean(a.city || a.town || a.village || a.municipality || a.suburb);
  const district = clean(a.county || a.state_district || city);
  const state = clean(a.state || a.region || a.province);
  return district || state ? { district, state, city: city && city.toLowerCase() !== district.toLowerCase() ? city : '' } : null;
}

/** The city, the district and the state of a postal code, or null when the code is not known. */
export async function lookupPostal(country: string, code: string, fetchFn: FetchFn = fetch as unknown as FetchFn): Promise<Place | null> {
  const iso = ISO[country];
  if (!iso || !/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(code)) return null;
  const key = `${iso}:${code.toUpperCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const sources: (() => Promise<Place | null>)[] =
    iso === 'IN'
      ? [() => indiaPost(fetchFn, code), () => openStreetMap(fetchFn, iso, code)]
      : iso === 'GB'
      ? [() => ukPostcodes(fetchFn, code), () => openStreetMap(fetchFn, iso, code), () => zippopotam(fetchFn, iso, code)]
      : [() => zippopotam(fetchFn, iso, code), () => openStreetMap(fetchFn, iso, code)];
  if (CITY_STATES[iso]) sources.push(async () => ({ district: CITY_STATES[iso], state: CITY_STATES[iso], city: '' }));
  let place: Place | null = null;
  let reached = false; // did a service answer? (when none did, the answer is not kept: the next try asks again)
  for (const ask of sources) {
    try {
      place = await ask();
      reached = true;
      if (place) break;
    } catch {
      /* this service is not there now: the next one is asked */
    }
  }
  if (!reached) return null;
  if (cache.size > 2000) cache.clear();
  cache.set(key, place);
  return place;
}
