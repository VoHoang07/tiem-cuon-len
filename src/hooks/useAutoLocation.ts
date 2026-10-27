import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface ResolvedAddress {
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
}

interface NominatimResponse {
  display_name?: string;
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

function normalizeCityName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (
    trimmed.toLowerCase().includes('hồ chí minh') ||
    trimmed.toLowerCase() === 'tp.hcm' ||
    trimmed.toLowerCase() === 'tphcm'
  ) {
    return 'TP. Hồ Chí Minh';
  }
  return trimmed.replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
}

function parseVietnameseDisplayName(displayName?: string): Partial<ResolvedAddress> {
  if (!displayName) return {};
  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !/^\d{5,6}$/.test(p) &&
        p.toLowerCase() !== 'việt nam' &&
        p.toLowerCase() !== 'vietnam'
    );

  let city = '';
  let district = '';
  let ward = '';
  const detailParts: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (
      !ward &&
      (lower.startsWith('phường ') ||
        lower.startsWith('xã ') ||
        lower.startsWith('thị trấn '))
    ) {
      ward = part;
    } else if (
      !district &&
      (lower.startsWith('quận ') ||
        lower.startsWith('huyện ') ||
        lower.startsWith('thị xã ') ||
        lower.includes('thủ đức'))
    ) {
      district = part;
    } else if (
      !city &&
      (lower.startsWith('thành phố ') ||
        lower.startsWith('tỉnh ') ||
        lower === 'hà nội' ||
        lower === 'hồ chí minh' ||
        lower === 'đà nẵng' ||
        lower === 'cần thơ' ||
        lower === 'hải phòng')
    ) {
      city = normalizeCityName(part);
    }
  }

  for (const part of parts) {
    if (part === ward || part === district || normalizeCityName(part) === city) {
      break;
    }
    detailParts.push(part);
  }

  return {
    city,
    district,
    ward,
    detailAddress: detailParts.slice(0, 3).join(', '),
  };
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<ResolvedAddress | null> {
  try {
    // Do NOT send custom User-Agent header from browser fetch to avoid CORS preflight rejection
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data: NominatimResponse = await response.json();
    const addr = data.address ?? {};
    const fromDisplay = parseVietnameseDisplayName(data.display_name);

    const rawCity =
      fromDisplay.city ||
      addr.state ||
      addr.province ||
      addr.city ||
      addr.town ||
      '';
    const city = normalizeCityName(rawCity);

    const district =
      fromDisplay.district ||
      addr.city_district ||
      addr.district ||
      addr.state_district ||
      addr.county ||
      (addr.city && normalizeCityName(addr.city) !== city ? addr.city : '') ||
      addr.town ||
      '';

    const ward =
      fromDisplay.ward ||
      addr.quarter ||
      addr.suburb ||
      addr.village ||
      addr.neighbourhood ||
      addr.hamlet ||
      '';

    const roadAddress = [
      addr.house_number,
      addr.road || addr.building || addr.amenity,
    ]
      .filter(Boolean)
      .join(' ');

    const detailAddress =
      roadAddress ||
      fromDisplay.detailAddress ||
      [ward, district].filter(Boolean).join(', ') ||
      '';

    if (!city && !district && !ward && !detailAddress) return null;

    return { city, district, ward, detailAddress };
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
    const district = level6 || data.locality || '';
    const ward =
      level8 && level8 !== district
        ? level8
        : data.locality && data.locality !== district
        ? data.locality
        : '';
    const detailAddress = [ward, district].filter(Boolean).join(', ');

    if (!city && !district) {
      return { resolved: null, lat: data.latitude, lng: data.longitude };
    }

    return {
      resolved: {
        city,
        district,
        ward,
        detailAddress,
      },
      lat: data.latitude,
      lng: data.longitude,
    };
  } catch {
    return { resolved: null };
  }
}

function getBrowserCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('NO_GEOLOCATION'));
      return;
    }

    // Try fast balanced accuracy first (works reliably indoors & in mobile WebViews like Zalo),
    // with high-accuracy fallback if needed
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos2) =>
            resolve({
              latitude: pos2.coords.latitude,
              longitude: pos2.coords.longitude,
            }),
          (err2) => reject(err2),
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000,
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000,
      }
    );
  });
}

export function useAutoLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<ResolvedAddress | null> => {
    setLoading(true);
    setError(null);

    try {
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (Platform.OS === 'web') {
        try {
          const coords = await getBrowserCoordinates();
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch {
          // If browser GPS is blocked (e.g. inside Zalo in-app WebView), fallback to IP geolocation
          const ipFallback = await reverseGeocodeBigDataCloud();
          if (
            typeof ipFallback.lat === 'number' &&
            typeof ipFallback.lng === 'number'
          ) {
            latitude = ipFallback.lat;
            longitude = ipFallback.lng;
          } else if (ipFallback.resolved) {
            return ipFallback.resolved;
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
        } else {
          const ipFallback = await reverseGeocodeBigDataCloud();
          if (ipFallback.resolved) return ipFallback.resolved;
          setError('Vui lòng cấp quyền vị trí hoặc chọn nhanh Tỉnh/Thành bên dưới.');
          return null;
        }
      }

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        const [nominatimAddr, bdcResult] = await Promise.all([
          reverseGeocodeNominatim(latitude, longitude),
          reverseGeocodeBigDataCloud(latitude, longitude),
        ]);

        const bdcAddr = bdcResult.resolved;
        const merged: ResolvedAddress = {
          city: nominatimAddr?.city || bdcAddr?.city || '',
          district: nominatimAddr?.district || bdcAddr?.district || '',
          ward: nominatimAddr?.ward || bdcAddr?.ward || '',
          detailAddress:
            nominatimAddr?.detailAddress || bdcAddr?.detailAddress || '',
        };

        if (merged.city || merged.district || merged.ward || merged.detailAddress) {
          return merged;
        }
      }

      setError(
        'Trình duyệt đang chặn quyền vị trí. Bạn có thể chạm vào Tỉnh/Thành gợi ý bên dưới để điền nhanh.'
      );
      return null;
    } catch {
      setError(
        'Không lấy được vị trí tự động. Bạn hãy chọn nhanh Tỉnh/Thành phố bên dưới nhé.'
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentLocation, loading, error, setError };
}
