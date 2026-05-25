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
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    state_district?: string;
    suburb?: string;
    city_district?: string;
    quarter?: string;
    neighbourhood?: string;
    road?: string;
    house_number?: string;
    display_name?: string;
  };
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<ResolvedAddress | null> {
  const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`;

  const response = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent identifying the app
      'User-Agent': 'TiemCuonLen/1.0 (tiemcuonlen@gmail.com)',
      'Accept-Language': 'vi',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data: NominatimResponse = await response.json();

  if (!data.address) {
    return null;
  }

  const addr = data.address;

  // City: use city, town, or village
  const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? '';

  // District: Nominatim returns state_district, city_district, or suburb for Vietnam
  const district =
    addr.state_district ?? addr.city_district ?? addr.suburb ?? addr.county ?? '';

  // Ward: quarter or neighbourhood is closest to ward level
  const ward = addr.quarter ?? addr.neighbourhood ?? '';

  // Detail: road + house_number
  const detailAddress = [addr.house_number, addr.road].filter(Boolean).join(' ') || '';

  return { city, district, ward, detailAddress };
}

export function useAutoLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async (): Promise<ResolvedAddress | null> => {
    setLoading(true);
    setError(null);

    try {
      let latitude: number;
      let longitude: number;

      if (Platform.OS === 'web') {
        // Web: use browser Geolocation API
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Trình duyệt không hỗ trợ định vị.'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        // Mobile: use expo-location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Bạn đã từ chối quyền vị trí.');
          return null;
        }

        const locationResult = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = locationResult.coords.latitude;
        longitude = locationResult.coords.longitude;
      }

      // Reverse geocode via OpenStreetMap Nominatim (works on both web and mobile)
      const resolved = await reverseGeocodeNominatim(latitude, longitude);

      if (!resolved) {
        setError('Không lấy được địa chỉ hiện tại.');
        return null;
      }

      return resolved;
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Bạn đã từ chối quyền vị trí.');
        } else {
          setError('Không lấy được địa chỉ hiện tại.');
        }
        return null;
      }

      const message = err instanceof Error ? err.message : 'Không lấy được địa chỉ hiện tại.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentLocation, loading, error, setError };
}
