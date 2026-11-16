import type { Order } from '@/types/order';
import type { LiveCarrierCheckpoint } from '@/utils/shippingTracker';
import {
    CheckCircle2,
    ExternalLink,
    Home,
    MapPin,
    Navigation,
    Package,
    Truck,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    Image,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

interface GeoPoint {
  lat: number;
  lon: number;
  shortLabel: string;
}

// Sender warehouse: Vinhomes Grand Park, TP. Thủ Đức, TP. Hồ Chí Minh
const SENDER_WAREHOUSE_POINT: GeoPoint = {
  lat: 10.8412,
  lon: 106.8371,
  shortLabel: 'Kho Tiệm Cuộn Len (TP. Thủ Đức)',
};

const HCMC_DISTRICT_COORDS: Record<string, { lat: number; lon: number }> = {
  'quan 1': { lat: 10.7756, lon: 106.7004 },
  'quan 3': { lat: 10.7843, lon: 106.6844 },
  'quan 4': { lat: 10.7578, lon: 106.7012 },
  'quan 5': { lat: 10.754, lon: 106.6633 },
  'quan 6': { lat: 10.748, lon: 106.6352 },
  'quan 7': { lat: 10.734, lon: 106.7218 },
  'quan 8': { lat: 10.7241, lon: 106.6286 },
  'quan 10': { lat: 10.7745, lon: 106.6679 },
  'quan 11': { lat: 10.7629, lon: 106.6501 },
  'quan 12': { lat: 10.8671, lon: 106.6413 },
  'thu duc': { lat: 10.8494, lon: 106.7537 },
  'quan 2': { lat: 10.7872, lon: 106.7498 },
  'quan 9': { lat: 10.8428, lon: 106.8286 },
  'binh thanh': { lat: 10.8105, lon: 106.7091 },
  'go vap': { lat: 10.8386, lon: 106.6652 },
  'phu nhuan': { lat: 10.7991, lon: 106.6802 },
  'tan binh': { lat: 10.8014, lon: 106.6525 },
  'tan phu': { lat: 10.7901, lon: 106.628 },
  'binh tan': { lat: 10.7652, lon: 106.6038 },
  'binh chanh': { lat: 10.6874, lon: 106.5938 },
  'nha be': { lat: 10.6952, lon: 106.7048 },
  'hoc mon': { lat: 10.8863, lon: 106.5922 },
  'cu chi': { lat: 11.0066, lon: 106.5131 },
  'can gio': { lat: 10.4114, lon: 106.9547 },
};

const VIETNAM_PROVINCE_COORDS: Record<string, { lat: number; lon: number }> = {
  'ho chi minh': { lat: 10.7769, lon: 106.7009 },
  'ha noi': { lat: 21.0285, lon: 105.8542 },
  'da nang': { lat: 16.0544, lon: 108.2022 },
  'can tho': { lat: 10.0452, lon: 105.7469 },
  'hai phong': { lat: 20.8449, lon: 106.6881 },
  'binh duong': { lat: 10.9804, lon: 106.6519 },
  'dong nai': { lat: 10.9574, lon: 106.8426 },
  'ba ria vung tau': { lat: 10.4114, lon: 107.1362 },
  'long an': { lat: 10.5356, lon: 106.4133 },
  'tien giang': { lat: 10.36, lon: 106.36 },
  'ben tre': { lat: 10.2433, lon: 106.3755 },
  'vinh long': { lat: 10.2537, lon: 105.9722 },
  'an giang': { lat: 10.3864, lon: 105.4352 },
  'kien giang': { lat: 10.0125, lon: 105.0809 },
  'lam dong': { lat: 11.9404, lon: 108.4583 },
  'da lat': { lat: 11.9404, lon: 108.4583 },
  'khanh hoa': { lat: 12.2388, lon: 109.1967 },
  'nha trang': { lat: 12.2388, lon: 109.1967 },
  'binh thuan': { lat: 10.9289, lon: 108.1021 },
  'dak lak': { lat: 12.6667, lon: 108.05 },
  'gia lai': { lat: 13.9833, lon: 108.0 },
  'binh dinh': { lat: 13.782, lon: 109.2197 },
  'quang nam': { lat: 15.5736, lon: 108.474 },
  'thua thien hue': { lat: 16.4637, lon: 107.5909 },
  'nghe an': { lat: 18.6796, lon: 105.6813 },
  'thanh hoa': { lat: 19.8067, lon: 105.7852 },
  'quang ninh': { lat: 20.9599, lon: 107.0425 },
  'bac ninh': { lat: 21.1861, lon: 106.0763 },
  'hai duong': { lat: 20.9373, lon: 106.3145 },
  'thai nguyen': { lat: 21.5942, lon: 105.8482 },
};

function normalizeAscii(str?: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveRecipientGeoPoint(order: Order): GeoPoint {
  const addr = order.shippingAddress;
  const distNorm = normalizeAscii(addr?.district);
  const cityNorm = normalizeAscii(addr?.city);
  const label =
    [addr?.ward, addr?.district, addr?.city].filter(Boolean).slice(-2).join(', ') ||
    'Địa chỉ nhận hàng';

  for (const [key, coords] of Object.entries(HCMC_DISTRICT_COORDS)) {
    if (distNorm.includes(key)) {
      return { ...coords, shortLabel: label };
    }
  }
  for (const [key, coords] of Object.entries(VIETNAM_PROVINCE_COORDS)) {
    if (cityNorm.includes(key) || distNorm.includes(key)) {
      return { ...coords, shortLabel: label };
    }
  }
  return {
    lat: 10.7626,
    lon: 106.6602,
    shortLabel: label,
  };
}

function computeHaversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  // Multiply road factor (~1.28x straight line) for realistic road distance
  return Math.max(2, Math.round(R * c * 1.28));
}

function latLonToTileXY(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function computeDeliveryProgressPct(
  order: Order,
  checkpoints: LiveCarrierCheckpoint[]
): number {
  if (order.status === 'Hoàn thành') return 100;
  if (order.status === 'pending_payment' || order.status === 'Đã hủy') return 0;

  const latestText = normalizeAscii(
    checkpoints[0]?.title ||
      checkpoints[0]?.milestone ||
      order.shippingAddress?.goshipStatusText ||
      ''
  );

  if (latestText.includes('giao thanh cong') || latestText.includes('da giao')) {
    return 100;
  }
  if (
    latestText.includes('dang giao') &&
    (latestText.includes('buu ta') ||
      latestText.includes('shipper') ||
      latestText.includes('nhan vien'))
  ) {
    return 86;
  }
  if (
    latestText.includes('kho giao') ||
    latestText.includes('tram giao') ||
    latestText.includes('SOC') ||
    checkpoints.length >= 4
  ) {
    return 74;
  }
  if (
    latestText.includes('trung chuyen') ||
    latestText.includes('phan loai') ||
    checkpoints.length >= 2
  ) {
    return 56;
  }
  if (
    order.status === 'Đang giao' ||
    Boolean(order.shippingAddress?.trackingCode) ||
    order.shippingAddress?.craftingStage === 'handed_to_spx'
  ) {
    return 38;
  }
  return 12;
}

interface ShopeeDeliveryRouteMapProps {
  order: Order;
  checkpoints: LiveCarrierCheckpoint[];
}

export function ShopeeDeliveryRouteMap({
  order,
  checkpoints,
}: ShopeeDeliveryRouteMapProps) {
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth > 0 ? rawWidth : 390) < 640;
  const [expanded, setExpanded] = useState(false);

  const recipientPoint = useMemo(() => resolveRecipientGeoPoint(order), [order]);
  const roadDistanceKm = useMemo(
    () => computeHaversineKm(SENDER_WAREHOUSE_POINT, recipientPoint),
    [recipientPoint]
  );
  const progressPct = useMemo(
    () => computeDeliveryProgressPct(order, checkpoints),
    [order, checkpoints]
  );

  const mapTiles = useMemo(() => {
    const midLat = (SENDER_WAREHOUSE_POINT.lat + recipientPoint.lat) / 2;
    const midLon = (SENDER_WAREHOUSE_POINT.lon + recipientPoint.lon) / 2;
    const zoom = roadDistanceKm <= 35 ? 12 : roadDistanceKm <= 160 ? 9 : 6;
    const center = latLonToTileXY(midLat, midLon, zoom);
    // 3 columns x 2 rows of Carto Voyager street map tiles
    const urls: string[] = [];
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        urls.push(
          `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${
            center.x + dx
          }/${center.y + dy}@2x.png`
        );
      }
    }
    return urls;
  }, [recipientPoint, roadDistanceKm]);

  const currentStationHeadline = useMemo(() => {
    if (order.status === 'Hoàn thành') {
      return '🎉 Đã giao hàng thành công tới tay người nhận';
    }
    if (checkpoints.length > 0 && checkpoints[0]?.title) {
      return checkpoints[0].title;
    }
    if (order.shippingAddress?.goshipStatusText) {
      return order.shippingAddress.goshipStatusText;
    }
    if (
      order.status === 'Đang giao' ||
      Boolean(order.shippingAddress?.trackingCode)
    ) {
      return `Đang vận chuyển từ TP. Thủ Đức tới ${recipientPoint.shortLabel}`;
    }
    return 'Đang chuẩn bị tại Xưởng Tiệm Cuộn Len (TP. Thủ Đức)';
  }, [order, checkpoints, recipientPoint.shortLabel]);

  const currentLocationBadge = useMemo(() => {
    if (order.status === 'Hoàn thành') {
      return recipientPoint.shortLabel;
    }
    if (checkpoints[0]?.location) {
      return checkpoints[0].location;
    }
    if (progressPct >= 65) {
      return `Trạm giao ${recipientPoint.shortLabel}`;
    }
    if (progressPct >= 30) {
      return 'Trung tâm phân loại SPX TP.HCM';
    }
    return 'Kho Tiệm Cuộn Len • TP. Thủ Đức';
  }, [order.status, checkpoints, progressPct, recipientPoint.shortLabel]);

  const googleMapsRouteUrl = useMemo(() => {
    const origin = encodeURIComponent('Vinhomes Grand Park, Thủ Đức, Hồ Chí Minh');
    const dest = encodeURIComponent(
      [
        order.shippingAddress?.ward,
        order.shippingAddress?.district,
        order.shippingAddress?.city,
      ]
        .filter(Boolean)
        .join(', ') || 'Hồ Chí Minh'
    );
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
  }, [
    order.shippingAddress?.ward,
    order.shippingAddress?.district,
    order.shippingAddress?.city,
  ]);

  // Clamp truck horizontal position between 14% and 88% so the floating bubble never clips on mobile edges
  const clampedTruckLeftPct = Math.max(14, Math.min(86, progressPct));
  const mapHeight = isMobile ? (expanded ? 228 : 176) : expanded ? 260 : 204;

  return (
    <View style={styles.wrapper}>
      {/* Map Canvas Container */}
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={() => setExpanded((v) => !v)}
        style={[styles.mapViewport, { height: mapHeight }]}>
        {/* Real Street Map Tile Grid Layer (OpenStreetMap / Carto Voyager) */}
        <View style={styles.tileGrid} pointerEvents="none">
          {mapTiles.map((url, idx) => (
            <View key={idx} style={styles.tileCell}>
              {Platform.OS === 'web' ? (
                React.createElement('img', {
                  src: url,
                  alt: '',
                  loading: 'lazy',
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    filter: 'saturate(1.06) contrast(0.98)',
                  },
                })
              ) : (
                <Image
                  source={{ uri: url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              )}
            </View>
          ))}
        </View>

        {/* Soft warm tint overlay so route line & pins pop clearly on mobile */}
        <View style={styles.mapTintOverlay} pointerEvents="none" />

        {/* Top Floating Header Pill (Carrier + Distance + Expand Toggle) */}
        <View style={styles.topFloatingRow}>
          <View style={styles.carrierBadge}>
            <Navigation size={11} color="#FFFFFF" />
            <Text style={styles.carrierBadgeText} numberOfLines={1}>
              {order.shippingAddress?.shippingCarrier || 'SPX Express'} • ~{roadDistanceKm} km
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => Linking.openURL(googleMapsRouteUrl)}
            style={styles.openGmapsPill}
            activeOpacity={0.85}>
            <MapPin size={11} color="#0F5132" />
            <Text style={styles.openGmapsText}>Bản đồ lớn</Text>
            <ExternalLink size={10} color="#0F5132" />
          </TouchableOpacity>
        </View>

        {/* Floating Live Truck Callout Bubble (Shopee Style) */}
        <View
          style={[
            styles.calloutContainer,
            {
              left: `${clampedTruckLeftPct}%` as any,
            },
          ]}
          pointerEvents="none">
          <View style={styles.calloutBubble}>
            <View style={styles.calloutPulseDot} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.calloutTitle} numberOfLines={1}>
                {order.status === 'Hoàn thành'
                  ? 'Đã giao thành công'
                  : `Đang ở: ${currentLocationBadge}`}
              </Text>
              <Text style={styles.calloutSub} numberOfLines={1}>
                {currentStationHeadline}
              </Text>
            </View>
          </View>
          <View style={styles.calloutArrow} />
        </View>

        {/* Interactive Shopee Route Track Bar (Origin Pin ➔ Moving SPX Truck ➔ Destination Pin) */}
        <View style={styles.routeTrackZone} pointerEvents="none">
          {/* Background Dashed Uncompleted Track */}
          <View style={styles.trackBgLine} />

          {/* Active Completed Green/Orange Route Track */}
          <View
            style={[
              styles.trackActiveLine,
              { width: `${progressPct}%` as any },
            ]}
          />

          {/* Origin Node: Kho Tiệm Cuộn Len (TP. Thủ Đức) */}
          <View style={[styles.pinNode, { left: '4%' }]}>
            <View style={styles.originPinCircle}>
              <Package size={12} color="#FFFFFF" />
            </View>
            <View style={styles.pinLabelPill}>
              <Text style={styles.pinLabelText} numberOfLines={1}>
                Kho Thủ Đức
              </Text>
            </View>
          </View>

          {/* Moving SPX Delivery Truck Marker */}
          <View
            style={[
              styles.truckMarkerWrap,
              { left: `${clampedTruckLeftPct}%` as any },
            ]}>
            <View style={styles.truckRadarRing} />
            <View
              style={[
                styles.truckCircle,
                order.status === 'Hoàn thành' && { backgroundColor: '#15803D' },
              ]}>
              {order.status === 'Hoàn thành' ? (
                <CheckCircle2 size={15} color="#FFFFFF" />
              ) : (
                <Truck size={14} color="#FFFFFF" />
              )}
            </View>
          </View>

          {/* Destination Node: Địa chỉ Khách hàng */}
          <View style={[styles.pinNode, { right: '4%' }]}>
            <View
              style={[
                styles.destPinCircle,
                order.status === 'Hoàn thành' && {
                  backgroundColor: '#16A34A',
                  borderColor: '#DCFCE7',
                },
              ]}>
              <Home size={12} color="#FFFFFF" />
            </View>
            <View style={[styles.pinLabelPill, styles.destLabelPill]}>
              <Text
                style={[styles.pinLabelText, { color: '#14532D' }]}
                numberOfLines={1}>
                {recipientPoint.shortLabel}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Bottom Live Route Status Strip */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.bottomStatusText} numberOfLines={2}>
            <Text style={{ fontWeight: '900', color: '#065F46' }}>
              Lộ trình ({progressPct}%):{' '}
            </Text>
            {currentStationHeadline}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF5',
    marginBottom: 10,
  },
  mapViewport: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2EFE9',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  tileGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileCell: {
    width: '33.3333%',
    height: '50%',
    overflow: 'hidden',
  },
  mapTintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240, 253, 244, 0.22)',
  },
  topFloatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 9,
    zIndex: 4,
    gap: 6,
  },
  carrierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '64%',
  },
  carrierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  openGmapsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  openGmapsText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F5132',
  },
  calloutContainer: {
    position: 'absolute',
    bottom: 62,
    transform: [{ translateX: -95 }],
    width: 190,
    alignItems: 'center',
    zIndex: 5,
  },
  calloutBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#14532D',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    width: '100%',
  },
  calloutPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  calloutTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  calloutSub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#DCFCE7',
    marginTop: 1,
  },
  calloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#14532D',
  },
  routeTrackZone: {
    position: 'relative',
    height: 58,
    marginHorizontal: 14,
    marginBottom: 6,
    justifyContent: 'center',
    zIndex: 4,
  },
  trackBgLine: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  trackActiveLine: {
    position: 'absolute',
    left: '6%',
    height: 6,
    backgroundColor: '#16A34A',
    borderRadius: 999,
  },
  pinNode: {
    position: 'absolute',
    alignItems: 'center',
    top: 8,
  },
  originPinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#78350F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destPinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA580C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLabelPill: {
    marginTop: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxWidth: 112,
  },
  destLabelPill: {
    borderColor: '#86EFAC',
  },
  pinLabelText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#334155',
  },
  truckMarkerWrap: {
    position: 'absolute',
    top: 4,
    transform: [{ translateX: -16 }],
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckRadarRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(22, 163, 74, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.5)',
  },
  truckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  bottomStatusText: {
    fontSize: 11.5,
    color: '#14532D',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
});
