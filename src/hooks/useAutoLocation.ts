import {
    getBuiltinDistrictsForCity,
    matchVietnamProvince,
    parseSmartVietnameseAddress,
    removeVietnameseTones,
} from '@/data/vietnamLocations';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

export interface ResolvedAddress {
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
  source?: 'gps' | 'ip' | 'search';
  label?: string;
}

interface NominatimResponse {
  display_name?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    province?: string;
    state_district?: string;
    suburb?: string;
    city_district?: string;
    district?: string;
    quarter?: string;
    neighbourhood?: string;
    road?: string;
    house_number?: string;
    amenity?: string;
    building?: string;
    residential?: string;
  };
}

interface BigDataCloudAdminEntry {
  name?: string;
  description?: string;
  adminLevel?: number;
  order?: number;
}

interface BigDataCloudResponse {
  latitude?: number;
  longitude?: number;
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  localityInfo?: {
    administrative?: BigDataCloudAdminEntry[];
    informative?: BigDataCloudAdminEntry[];
  };
}

interface PhotonFeature {
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
    countrycode?: string;
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 3000
): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCityName(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return matchVietnamProvince(trimmed);
}

function normalizeDistrictName(raw?: string, resolvedCity?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (resolvedCity && normalizeCityName(trimmed) === resolvedCity) {
    return '';
  }
  return trimmed.replace(/^Thành phố\s+/i, 'TP. ');
}

function isDistrictLike(raw?: string, cityContext?: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('quận ') ||
    lower.startsWith('huyện ') ||
    lower.startsWith('thị xã ') ||
    lower.startsWith('thành phố ') ||
    lower.startsWith('tp. ') ||
    lower.includes('thủ đức')
  ) {
    // Make sure it's not a top-level province like "Thành phố Hồ Chí Minh"
    if (cityContext && matchVietnamProvince(trimmed) === cityContext) {
      return false;
    }
    if (!cityContext && matchVietnamProvince(trimmed)) {
      return false;
    }
    return true;
  }

  if (cityContext) {
    const knownDistricts = getBuiltinDistrictsForCity(cityContext);
    const rawAscii = removeVietnameseTones(trimmed)
      .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
      .trim();
    if (
      rawAscii.length >= 2 &&
      knownDistricts.some(
        (d) =>
          removeVietnameseTones(d)
            .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
            .trim() === rawAscii
      )
    ) {
      return true;
    }
  }

  return false;
}

function isWardLike(raw?: string, description?: string): boolean {
  const lower = (raw || '').trim().toLowerCase();
  const descLower = (description || '').trim().toLowerCase();
  return (
    lower.startsWith('phường ') ||
    lower.startsWith('xã ') ||
    lower.startsWith('thị trấn ') ||
    lower.startsWith('khu phố ') ||
    lower.startsWith('thôn ') ||
    descLower.startsWith('phường ') ||
    descLower.includes('phường thuộc') ||
    descLower.startsWith('xã ') ||
    descLower.includes('xã thuộc') ||
    descLower.startsWith('thị trấn ')
  );
}

function formatWardName(rawName?: string, description?: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('phường ') ||
    lower.startsWith('xã ') ||
    lower.startsWith('thị trấn ')
  ) {
    return trimmed;
  }
  const descLower = (description || '').toLowerCase();
  if (descLower.includes('phường')) return `Phường ${trimmed}`;
  if (descLower.includes('thị trấn')) return `Thị trấn ${trimmed}`;
  if (descLower.includes('xã')) return `Xã ${trimmed}`;
  return trimmed;
}

function extractStructuredNominatimAddress(
  item: NominatimResponse
): ResolvedAddress | null {
  const addr = item.address ?? {};
  const fromDisplay = parseSmartVietnameseAddress(item.display_name || '');

  const cityCandidates = [
    addr.state,
    addr.province,
    fromDisplay.city,
    addr.city,
    addr.town,
  ];
  let city = '';
  for (const cand of cityCandidates) {
    const matched = matchVietnamProvince(cand);
    if (matched) {
      city = matched;
      break;
    }
  }

  const districtCandidates = [
    addr.city_district,
    addr.district,
    addr.state_district,
    addr.county,
    isDistrictLike(addr.suburb, city) ? addr.suburb : undefined,
    addr.city && matchVietnamProvince(addr.city) !== city ? addr.city : undefined,
    addr.town && matchVietnamProvince(addr.town) !== city ? addr.town : undefined,
    fromDisplay.district,
  ];

  let district = '';
  for (const cand of districtCandidates) {
    const normalized = normalizeDistrictName(cand, city);
    if (normalized && !isWardLike(normalized)) {
      district = normalized;
      break;
    }
  }

  const wardCandidates = [
    addr.quarter,
    !isDistrictLike(addr.suburb, city) ? addr.suburb : undefined,
    addr.village,
    addr.hamlet,
    addr.neighbourhood,
    addr.residential,
    fromDisplay.ward,
  ];

  let ward = '';
  for (const cand of wardCandidates) {
    if (cand && cand.trim() && cand.trim() !== district && cand.trim() !== city) {
      ward = cand.trim();
      break;
    }
  }

  const roadPart = [
    addr.house_number,
    addr.road || addr.building || addr.amenity || item.name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  let detailAddress = roadPart || fromDisplay.detailAddress || '';
  if (
    detailAddress &&
    (detailAddress === ward ||
      detailAddress === district ||
      normalizeCityName(detailAddress) === city)
  ) {
    detailAddress = '';
  }

  if (!city && !district && !ward && !detailAddress) return null;

  return {
    city,
    district,
    ward,
    detailAddress,
    label: item.display_name,
  };
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`;
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      2500
    );

    if (!response.ok) return null;

    const data: NominatimResponse = await response.json();
    return extractStructuredNominatimAddress(data);
  } catch {
    return null;
  }
}

async function reverseGeocodePhoton(
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json' } },
      2800
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feat: PhotonFeature | undefined = Array.isArray(data?.features)
      ? data.features[0]
      : undefined;
    const props = feat?.properties;
    if (!props) return null;

    const city =
      normalizeCityName(props.city) ||
      normalizeCityName(props.state) ||
      normalizeCityName(props.district) ||
      '';

    let district = '';
    let ward = '';

    if (props.district) {
      if (isDistrictLike(props.district, city)) {
        district = normalizeDistrictName(props.district, city);
      } else {
        ward = formatWardName(props.district, 'phường');
      }
    }

    if (props.locality && props.locality !== district) {
      if (!ward) {
        ward = props.locality;
      }
    }

    const detailAddress = [props.housenumber, props.street || props.name]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!city && !district && !ward && !detailAddress) return null;

    return {
      city,
      district,
      ward,
      detailAddress,
    };
  } catch {
    return null;
  }
}

async function reverseGeocodeBigDataCloud(
  lat?: number,
  lng?: number
): Promise<{ resolved: ResolvedAddress | null; lat?: number; lng?: number }> {
  const query =
    typeof lat === 'number' && typeof lng === 'number'
      ? `?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
      : `?localityLanguage=vi`;

  // Call api-bdc.io directly first to avoid 307 redirect CSP issues, with fallback to api.bigdatacloud.net
  const endpoints = [
    `https://api-bdc.io/data/reverse-geocode-client${query}`,
    `https://api.bigdatacloud.net/data/reverse-geocode-client${query}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetchWithTimeout(url, {}, 3500);
      if (!response.ok) continue;

      const data: BigDataCloudResponse = await response.json();
      const admins = data.localityInfo?.administrative ?? [];
      const informatives = data.localityInfo?.informative ?? [];
      const allEntries = [...admins, ...informatives];

      const level4 = admins.find((a) => a.adminLevel === 4)?.name;
      const city =
        normalizeCityName(level4) ||
        normalizeCityName(data.principalSubdivision) ||
        normalizeCityName(data.city) ||
        '';

      let district = '';
      let ward = '';

      // 1. Find District from administrative or informative entries (e.g., "Thành phố Thủ Đức", "Quận 1", etc.)
      for (const entry of allEntries) {
        const name = (entry.name || '').trim();
        const desc = (entry.description || '').toLowerCase();
        if (!name || normalizeCityName(name) === city) continue;

        if (isWardLike(name, desc)) {
          if (!ward) {
            ward = formatWardName(name, desc);
          }
          continue;
        }

        if (
          isDistrictLike(name, city) ||
          desc.includes('quận') ||
          desc.includes('huyện') ||
          desc.includes('thị xã') ||
          desc.includes('thành phố thuộc')
        ) {
          district = normalizeDistrictName(name, city);
          break;
        }
      }

      // 2. If district or ward still missing, inspect adminLevel 5, 6, 7, 8, 9 and data.locality
      const level6Entry = admins.find(
        (a) => a.adminLevel === 6 || a.adminLevel === 5 || a.adminLevel === 7
      );
      const level8Entry = admins.find(
        (a) => a.adminLevel === 8 || a.adminLevel === 9
      );

      if (level6Entry?.name) {
        const l6Name = level6Entry.name.trim();
        const l6Desc = level6Entry.description || '';
        if (isWardLike(l6Name, l6Desc)) {
          if (!ward) ward = formatWardName(l6Name, l6Desc);
        } else if (!district && normalizeCityName(l6Name) !== city) {
          district = normalizeDistrictName(l6Name, city);
        }
      }

      if (level8Entry?.name) {
        const l8Name = level8Entry.name.trim();
        const l8Desc = level8Entry.description || '';
        if (!ward && l8Name !== district && normalizeCityName(l8Name) !== city) {
          ward = formatWardName(l8Name, l8Desc);
        }
      }

      if (
        !ward &&
        data.locality &&
        data.locality !== district &&
        normalizeCityName(data.locality) !== city
      ) {
        ward = formatWardName(data.locality, 'phường');
      }

      // Match against built-in districts if district has no prefix
      if (city && !district && ward) {
        const knownDistricts = getBuiltinDistrictsForCity(city);
        const wardAscii = removeVietnameseTones(ward)
          .replace(/^(?:phuong|xa|thi tran)\s+/i, '')
          .trim();
        const matchedDist = knownDistricts.find(
          (d) =>
            removeVietnameseTones(d)
              .replace(/^(?:quan|huyen|thi xa|tp\.?)\s+/i, '')
              .trim() === wardAscii
        );
        if (matchedDist) {
          district = matchedDist;
          ward = '';
        }
      }

      if (!city && !district && !ward) {
        return { resolved: null, lat: data.latitude, lng: data.longitude };
      }

      return {
        resolved: {
          city,
          district,
          ward,
          detailAddress: '',
        },
        lat: data.latitude,
        lng: data.longitude,
      };
    } catch {
      // try next endpoint
    }
  }

  return { resolved: null };
}

async function fetchIpFallbackCoordinates(): Promise<{
  lat?: number;
  lng?: number;
  city?: string;
  district?: string;
}> {
  // 1. Try ipwho.is
  try {
    const res = await fetchWithTimeout('https://ipwho.is/?lang=vi', {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const city =
          normalizeCityName(data.region) || normalizeCityName(data.city) || '';
        const lat = typeof data.latitude === 'number' ? data.latitude : undefined;
        const lng = typeof data.longitude === 'number' ? data.longitude : undefined;
        if (lat !== undefined && lng !== undefined) {
          return { lat, lng, city };
        }
        if (city) return { city };
      }
    }
  } catch {
    // continue to next provider
  }

  // 2. Try ipapi.co
  try {
    const res = await fetchWithTimeout('https://ipapi.co/json/', {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const city =
          normalizeCityName(data.region) || normalizeCityName(data.city) || '';
        const lat = typeof data.latitude === 'number' ? data.latitude : undefined;
        const lng = typeof data.longitude === 'number' ? data.longitude : undefined;
        if (lat !== undefined && lng !== undefined) {
          return { lat, lng, city };
        }
        if (city) return { city };
      }
    }
  } catch {
    // continue to next provider
  }

  return {};
}

interface BrowserCoordsResult {
  latitude: number;
  longitude: number;
}

async function getBrowserCoordinates(): Promise<BrowserCoordsResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const err = new Error('NO_GEOLOCATION') as Error & { code?: number };
    err.code = 0;
    throw err;
  }

  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({
        name: 'geolocation' as PermissionName,
      });
      if (status.state === 'denied') {
        const deniedErr = new Error('PERMISSION_DENIED') as Error & { code?: number };
        deniedErr.code = 1;
        throw deniedErr;
      }
    }
  } catch (permErr) {
    if ((permErr as { code?: number })?.code === 1) {
      throw permErr;
    }
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (firstErr) => {
        if (firstErr && firstErr.code === 1) {
          reject(firstErr);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos2) =>
            resolve({
              latitude: pos2.coords.latitude,
              longitude: pos2.coords.longitude,
            }),
          (err2) => reject(err2),
          {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 120000,
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 4500,
        maximumAge: 300000,
      }
    );
  });
}

async function searchPhotonSuggestions(
  query: string,
  cityHint?: string
): Promise<ResolvedAddress[]> {
  const fullQuery =
    cityHint &&
    !query.toLowerCase().includes(cityHint.toLowerCase().replace(/^tp\.\s*/i, ''))
      ? `${query}, ${cityHint}, Việt Nam`
      : `${query}, Việt Nam`;

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      fullQuery
    )}&limit=6`;
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json' } },
      2800
    );
    if (!res.ok) return [];
    const data = await res.json();
    const features: PhotonFeature[] = Array.isArray(data?.features)
      ? data.features
      : [];

    const results: ResolvedAddress[] = [];
    for (const f of features) {
      const p = f.properties;
      if (!p) continue;
      if (p.countrycode && p.countrycode.toUpperCase() !== 'VN') continue;

      const city =
        normalizeCityName(p.city) ||
        normalizeCityName(p.state) ||
        normalizeCityName(p.district) ||
        (cityHint ? normalizeCityName(cityHint) : '');

      let district = '';
      let ward = '';

      if (p.district) {
        if (isDistrictLike(p.district, city)) {
          district = normalizeDistrictName(p.district, city);
        } else if (normalizeCityName(p.district) !== city) {
          ward = formatWardName(p.district, 'phường');
        }
      }
      if (p.locality && p.locality !== district && normalizeCityName(p.locality) !== city) {
        if (!ward) ward = p.locality;
      }

      const detailAddress = [p.housenumber, p.street || p.name]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!city && !district && !detailAddress) continue;

      const label = [detailAddress, ward, district, city]
        .filter(Boolean)
        .join(', ');

      results.push({
        city,
        district,
        ward,
        detailAddress,
        source: 'search',
        label,
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function searchNominatimSuggestions(
  query: string,
  cityHint?: string
): Promise<ResolvedAddress[]> {
  const fullQuery =
    cityHint &&
    !query.toLowerCase().includes(cityHint.toLowerCase().replace(/^tp\.\s*/i, ''))
      ? `${query}, ${cityHint}, Việt Nam`
      : `${query}, Việt Nam`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=vn&addressdetails=1&accept-language=vi&limit=5&q=${encodeURIComponent(
      fullQuery
    )}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json' } },
      2500
    );
    if (!res.ok) return [];
    const rows: NominatimResponse[] = await res.json();
    if (!Array.isArray(rows)) return [];

    const results: ResolvedAddress[] = [];
    for (const row of rows) {
      const parsed = extractStructuredNominatimAddress(row);
      if (!parsed || (!parsed.city && !parsed.district && !parsed.detailAddress)) {
        continue;
      }
      results.push({
        ...parsed,
        source: 'search',
        label:
          [parsed.detailAddress, parsed.ward, parsed.district, parsed.city]
            .filter(Boolean)
            .join(', ') || row.display_name,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Live search for Vietnamese addresses / streets / buildings (Photon + Nominatim in parallel)
 */
export async function searchVietnamAddressSuggestions(
  query: string,
  cityHint?: string
): Promise<ResolvedAddress[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const [photonRes, nominatimRes] = await Promise.all([
    searchPhotonSuggestions(trimmed, cityHint),
    searchNominatimSuggestions(trimmed, cityHint),
  ]);

  const combined = [...nominatimRes, ...photonRes];
  const deduped: ResolvedAddress[] = [];
  const seen = new Set<string>();

  for (const item of combined) {
    const key = removeVietnameseTones(
      `${item.detailAddress}|${item.ward}|${item.district}|${item.city}`
    );
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 5) break;
  }

  return deduped;
}

export function useAutoLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<ResolvedAddress | null> => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      let resolvedSource: 'gps' | 'ip' = 'gps';
      let gpsDenied = false;
      let fallbackCity = '';
      let fallbackDistrict = '';
      let fallbackWard = '';

      if (Platform.OS === 'web') {
        try {
          const coords = await getBrowserCoordinates();
          latitude = coords.latitude;
          longitude = coords.longitude;
          resolvedSource = 'gps';
        } catch (gpsErr) {
          resolvedSource = 'ip';
          if ((gpsErr as { code?: number })?.code === 1) {
            gpsDenied = true;
          }
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const locationResult = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = locationResult.coords.latitude;
          longitude = locationResult.coords.longitude;
          resolvedSource = 'gps';
        } else {
          resolvedSource = 'ip';
          gpsDenied = true;
        }
      }

      // If GPS did not provide coordinates, fetch IP-based coordinates & administrative info
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        const [bdcIp, ipOther] = await Promise.all([
          reverseGeocodeBigDataCloud(),
          fetchIpFallbackCoordinates(),
        ]);

        if (typeof bdcIp.lat === 'number' && typeof bdcIp.lng === 'number') {
          latitude = bdcIp.lat;
          longitude = bdcIp.lng;
        } else if (
          typeof ipOther.lat === 'number' &&
          typeof ipOther.lng === 'number'
        ) {
          latitude = ipOther.lat;
          longitude = ipOther.lng;
        }

        fallbackCity = bdcIp.resolved?.city || ipOther.city || '';
        fallbackDistrict = bdcIp.resolved?.district || ipOther.district || '';
        fallbackWard = bdcIp.resolved?.ward || '';
      }

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        const [bdcResult, photonAddr, nominatimAddr] = await Promise.all([
          reverseGeocodeBigDataCloud(latitude, longitude),
          reverseGeocodePhoton(latitude, longitude),
          reverseGeocodeNominatim(latitude, longitude),
        ]);

        const bdcAddr = bdcResult.resolved;
        let mergedCity =
          nominatimAddr?.city ||
          bdcAddr?.city ||
          photonAddr?.city ||
          fallbackCity ||
          '';
        let mergedDistrict =
          nominatimAddr?.district ||
          bdcAddr?.district ||
          photonAddr?.district ||
          fallbackDistrict ||
          '';
        let mergedWard =
          nominatimAddr?.ward ||
          bdcAddr?.ward ||
          photonAddr?.ward ||
          fallbackWard ||
          '';
        const mergedDetail =
          resolvedSource === 'gps'
            ? nominatimAddr?.detailAddress ||
              photonAddr?.detailAddress ||
              bdcAddr?.detailAddress ||
              ''
            : '';

        // Safety net: if coordinate reverse-geocode didn't resolve city, query IP fallback
        if (!mergedCity && !mergedDistrict) {
          const [bdcIp, ipOther] = await Promise.all([
            reverseGeocodeBigDataCloud(),
            fetchIpFallbackCoordinates(),
          ]);
          mergedCity = bdcIp.resolved?.city || ipOther.city || '';
          mergedDistrict = bdcIp.resolved?.district || ipOther.district || '';
          mergedWard = mergedWard || bdcIp.resolved?.ward || '';
        }

        if (mergedCity || mergedDistrict || mergedWard || mergedDetail) {
          if (resolvedSource === 'ip') {
            setNotice(
              gpsDenied
                ? 'Đã tự động điền Tỉnh/Thành & khu vực theo mạng hiện tại (Trình duyệt đang tắt GPS chính xác — bạn hãy kiểm tra lại Phường/Xã và nhập số nhà hoặc tìm tên đường bên dưới nhé).'
                : 'Đã tự động điền Tỉnh/Thành & khu vực hiện tại. Bạn hãy kiểm tra lại Phường/Xã và nhập số nhà bên dưới nhé.'
            );
          }
          return {
            city: mergedCity,
            district: mergedDistrict,
            ward: mergedWard,
            detailAddress: mergedDetail,
            source: resolvedSource,
          };
        }
      }

      if (fallbackCity || fallbackDistrict) {
        setNotice(
          'Đã tự động điền Tỉnh/Thành theo kết nối hiện tại. Bạn hãy chọn Quận/Huyện, Phường/Xã và nhập số nhà bên dưới nhé.'
        );
        return {
          city: fallbackCity,
          district: fallbackDistrict,
          ward: fallbackWard,
          detailAddress: '',
          source: 'ip',
        };
      }

      setError(
        'Trình duyệt đang chặn quyền vị trí. Bạn có thể gõ tìm tên đường ở ô Tìm kiếm nhanh hoặc chạm vào Tỉnh/Thành bên dưới.'
      );
      return null;
    } catch {
      setError(
        'Không lấy được vị trí tự động. Bạn hãy gõ tìm địa chỉ hoặc chọn nhanh Tỉnh/Thành phố bên dưới nhé.'
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getCurrentLocation,
    loading,
    error,
    setError,
    notice,
    setNotice,
  };
}
