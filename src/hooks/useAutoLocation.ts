import {
    matchVietnamProvince,
    parseSmartVietnameseAddress,
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

interface BigDataCloudResponse {
  latitude?: number;
  longitude?: number;
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  localityInfo?: {
    administrative?: Array<{
      name?: string;
      adminLevel?: number;
    }>;
  };
}

function normalizeCityName(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const matched = matchVietnamProvince(trimmed);
  if (matched) return matched;
  return trimmed.replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
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

function isDistrictLike(raw?: string): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  return (
    lower.startsWith('quận ') ||
    lower.startsWith('huyện ') ||
    lower.startsWith('thị xã ') ||
    lower.startsWith('thành phố ') ||
    lower.startsWith('tp. ') ||
    lower.includes('thủ đức')
  );
}

function isWardLike(raw?: string): boolean {
  if (!raw) return false;
  const lower = raw.trim().toLowerCase();
  return (
    lower.startsWith('phường ') ||
    lower.startsWith('xã ') ||
    lower.startsWith('thị trấn ') ||
    lower.startsWith('khu phố ') ||
    lower.startsWith('thôn ')
  );
}

function extractStructuredNominatimAddress(
  item: NominatimResponse
): ResolvedAddress | null {
  const addr = item.address ?? {};
  const fromDisplay = parseSmartVietnameseAddress(item.display_name || '');

  // 1. Resolve canonical Vietnam Province / City (63 provinces)
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
  if (!city) {
    city = normalizeCityName(
      fromDisplay.city || addr.state || addr.province || addr.city || ''
    );
  }

  // 2. Resolve District (Quận / Huyện / Thị xã / TP thuộc tỉnh như TP. Thủ Đức, TP. Dĩ An)
  const districtCandidates = [
    addr.city_district,
    addr.district,
    addr.state_district,
    addr.county,
    isDistrictLike(addr.suburb) ? addr.suburb : undefined,
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

  // 3. Resolve Ward (Phường / Xã / Thị trấn)
  const wardCandidates = [
    addr.quarter,
    !isDistrictLike(addr.suburb) ? addr.suburb : undefined,
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

  // 4. Resolve Street / Detail Address
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
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data: NominatimResponse = await response.json();
    return extractStructuredNominatimAddress(data);
  } catch {
    return null;
  }
}

async function reverseGeocodeBigDataCloud(
  lat?: number,
  lng?: number
): Promise<{ resolved: ResolvedAddress | null; lat?: number; lng?: number }> {
  try {
    const query =
      typeof lat === 'number' && typeof lng === 'number'
        ? `?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
        : `?localityLanguage=vi`;
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client${query}`;
    const response = await fetch(url);
    if (!response.ok) return { resolved: null };

    const data: BigDataCloudResponse = await response.json();
    const admins = data.localityInfo?.administrative ?? [];

    const level4 = admins.find((a) => a.adminLevel === 4)?.name;
    const level6 = admins.find(
      (a) => a.adminLevel === 6 || a.adminLevel === 5 || a.adminLevel === 7
    )?.name;
    const level8 = admins.find(
      (a) => a.adminLevel === 8 || a.adminLevel === 9
    )?.name;

    const city = normalizeCityName(
      level4 || data.principalSubdivision || data.city || ''
    );
    const rawDistrict = level6 || data.locality || '';
    const district = normalizeDistrictName(rawDistrict, city);
    const ward =
      level8 && level8 !== district && normalizeCityName(level8) !== city
        ? level8
        : data.locality &&
            data.locality !== district &&
            normalizeCityName(data.locality) !== city
          ? data.locality
          : '';

    if (!city && !district) {
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
    return { resolved: null };
  }
}

async function fetchIpFallbackCoordinates(): Promise<{
  lat?: number;
  lng?: number;
  city?: string;
  district?: string;
}> {
  // 1. Try ipwho.is (already in CSP connect-src, fast & supports CORS)
  try {
    const res = await fetch('https://ipwho.is/?lang=vi');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        const city = normalizeCityName(data.region || data.city || '');
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

  // 2. Try ipapi.co (already in CSP connect-src)
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const city = normalizeCityName(data.region || data.city || '');
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

  // 3. Try same-origin Vercel/Cloudflare Edge telemetry (/api/security-audit?action=whoami)
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/security-audit?action=whoami', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const rawCity = data?.telemetry?.city || data?.telemetry?.region || '';
        const city = normalizeCityName(rawCity);
        if (city) return { city };
      }
    }
  } catch {
    // ignore
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

  // Check Permissions API first so we don't hang if permission is already explicitly denied
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
        // Do NOT retry if user or browser explicitly denied permission (code === 1)
        if (firstErr && firstErr.code === 1) {
          reject(firstErr);
          return;
        }
        // Retry once with high accuracy / longer timeout if position was temporarily unavailable
        navigator.geolocation.getCurrentPosition(
          (pos2) =>
            resolve({
              latitude: pos2.coords.latitude,
              longitude: pos2.coords.longitude,
            }),
          (err2) => reject(err2),
          {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 120000,
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  });
}

/**
 * Live search for Vietnamese addresses / streets / buildings via OpenStreetMap Nominatim
 */
export async function searchVietnamAddressSuggestions(
  query: string,
  cityHint?: string
): Promise<ResolvedAddress[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const fullQuery =
    cityHint &&
    !trimmed.toLowerCase().includes(cityHint.toLowerCase().replace(/^tp\.\s*/i, ''))
      ? `${trimmed}, ${cityHint}, Việt Nam`
      : `${trimmed}, Việt Nam`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=vn&addressdetails=1&accept-language=vi&limit=5&q=${encodeURIComponent(
      fullQuery
    )}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const rows: NominatimResponse[] = await res.json();
    if (!Array.isArray(rows)) return [];

    const results: ResolvedAddress[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const parsed = extractStructuredNominatimAddress(row);
      if (!parsed || (!parsed.city && !parsed.district && !parsed.detailAddress)) {
        continue;
      }
      const key = `${parsed.detailAddress}|${parsed.ward}|${parsed.district}|${parsed.city}`;
      if (seen.has(key)) continue;
      seen.add(key);
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

          // Run BigDataCloud IP reverse-geocoding & IPWhoIs/IPApi/Edge in parallel
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
      }

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        const [nominatimAddr, bdcResult] = await Promise.all([
          reverseGeocodeNominatim(latitude, longitude),
          reverseGeocodeBigDataCloud(latitude, longitude),
        ]);

        const bdcAddr = bdcResult.resolved;
        const merged: ResolvedAddress = {
          city: nominatimAddr?.city || bdcAddr?.city || fallbackCity || '',
          district:
            nominatimAddr?.district || bdcAddr?.district || fallbackDistrict || '',
          ward: nominatimAddr?.ward || bdcAddr?.ward || fallbackWard || '',
          detailAddress:
            resolvedSource === 'gps'
              ? nominatimAddr?.detailAddress || bdcAddr?.detailAddress || ''
              : '',
          source: resolvedSource,
        };

        if (merged.city || merged.district || merged.ward || merged.detailAddress) {
          if (resolvedSource === 'ip') {
            setNotice(
              gpsDenied
                ? 'Đã tự động điền Tỉnh/Thành & khu vực theo mạng hiện tại (Trình duyệt đang tắt GPS chính xác — bạn hãy kiểm tra lại Phường/Xã và nhập số nhà hoặc tìm tên đường bên dưới nhé).'
                : 'Đã tự động điền Tỉnh/Thành & khu vực hiện tại. Bạn hãy kiểm tra lại Phường/Xã và nhập số nhà bên dưới nhé.'
            );
          }
          return merged;
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
