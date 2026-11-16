// The place of a postal code: the Add Teacher form fills the district (city) and the state when a PIN code or a ZIP code is written.
// India: the public service of the Indian Post (api.postalpincode.in). Other countries: the public service zippopotam.us.
// Only the postal code (and the country) goes out, nothing about the person. An answer is kept in memory, so the same code is asked once.

export const ISO: Record<string, string> = {
  India: 'IN', Nepal: 'NP', Bangladesh: 'BD', 'Sri Lanka': 'LK', Pakistan: 'PK', Bhutan: 'BT', Maldives: 'MV',
  'United Arab Emirates': 'AE', 'Saudi Arabia': 'SA', Qatar: 'QA', Kuwait: 'KW', Oman: 'OM', Bahrain: 'BH',
  'United States': 'US', Canada: 'CA', 'United Kingdom': 'GB', Australia: 'AU', 'New Zealand': 'NZ', Singapore: 'SG', Malaysia: 'MY',
  Germany: 'DE', France: 'FR', Italy: 'IT', Japan: 'JP',
};

export interface Place { district: string; state: string; city: string }
type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const cache = new Map<string, Place | null>();

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

/** The district (or city) and the state of a postal code, or null when the code is not known. */
export async function lookupPostal(country: string, code: string, fetchFn: FetchFn = fetch as unknown as FetchFn): Promise<Place | null> {
  const iso = ISO[country];
  if (!iso || !/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(code)) return null;
  const key = `${iso}:${code.toUpperCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let place: Place | null = null;
  try {
    if (iso === 'IN') {
      const res = await fetchFn(`https://api.postalpincode.in/pincode/${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(6000) });
      const data = res.ok ? await res.json() : null;
      const offices: any[] = Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0].PostOffice) ? data[0].PostOffice : [];
      const office = offices[0];
      if (office) {
        // one PIN code has several post offices; the one that has the name of its block is the main town (305624: Bijainagar)
        const town = offices.find((o) => clean(o.Name) && clean(o.Name).toLowerCase() === clean(o.Block).toLowerCase());
        place = { district: clean(office.District), state: clean(office.State), city: clean(town?.Name) };
      }
    } else {
      // (the services want the first part of a code of the United Kingdom and of Canada)
      const part = iso === 'GB' ? code.split(' ')[0] : iso === 'CA' ? code.replace(/\s/g, '').slice(0, 3) : code;
      const res = await fetchFn(`https://api.zippopotam.us/${iso.toLowerCase()}/${encodeURIComponent(part)}`, { signal: AbortSignal.timeout(6000) });
      const data = res.ok ? await res.json() : null;
      const first = data?.places?.[0];
      if (first) place = { district: clean(first['place name']), state: clean(first.state), city: '' };
    }
  } catch {
    return null; // the service is not there now: nothing is kept, and the person writes the place by hand
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, place);
  return place;
}
