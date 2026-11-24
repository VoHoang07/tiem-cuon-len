import type { Order } from '@/types/order';
import {
    fetchPublicWarehouseOrigin,
    type LiveCarrierCheckpoint,
    type PublicWarehouseOrigin,
} from '@/utils/shippingTracker';
import {
    Check,
    CheckCircle2,
    Copy,
    ExternalLink,
    Home,
    MapPin,
    Package,
    RefreshCw,
    Truck,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface GeoPoint {
  lat: number;
  lon: number;
  shortLabel: string;
}

const DEFAULT_WAREHOUSE_POINT: GeoPoint = {
  lat: 10.7241,
  lon: 106.6286,
  shortLabel: 'Quận 8, TP.HCM',
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
  'tra vinh': { lat: 9.9347, lon: 106.3453 },
  'dong thap': { lat: 10.4938, lon: 105.6882 },
  'an giang': { lat: 10.3864, lon: 105.4352 },
  'kien giang': { lat: 10.0125, lon: 105.0809 },
  'hau giang': { lat: 9.7579, lon: 105.6413 },
  'soc trang': { lat: 9.6037, lon: 105.98 },
  'bac lieu': { lat: 9.294, lon: 105.7216 },
  'ca mau': { lat: 9.1768, lon: 105.1524 },
  'tay ninh': { lat: 11.3352, lon: 106.1099 },
  'binh phuoc': { lat: 11.7512, lon: 106.7235 },
  'lam dong': { lat: 11.9404, lon: 108.4583 },
  'da lat': { lat: 11.9404, lon: 108.4583 },
  'khanh hoa': { lat: 12.2388, lon: 109.1967 },
  'nha trang': { lat: 12.2388, lon: 109.1967 },
  'ninh thuan': { lat: 11.5752, lon: 108.989 },
  'binh thuan': { lat: 10.9289, lon: 108.1021 },
  'phu yen': { lat: 13.0955, lon: 109.3209 },
  'dak lak': { lat: 12.6667, lon: 108.05 },
  'dak nong': { lat: 12.2646, lon: 107.6098 },
  'gia lai': { lat: 13.9833, lon: 108.0 },
  'kon tum': { lat: 14.3497, lon: 108.0005 },
  'binh dinh': { lat: 13.782, lon: 109.2197 },
  'quang ngai': { lat: 15.1214, lon: 108.8044 },
  'quang nam': { lat: 15.5736, lon: 108.474 },
  'thua thien hue': { lat: 16.4637, lon: 107.5909 },
  hue: { lat: 16.4637, lon: 107.5909 },
  'quang tri': { lat: 16.7403, lon: 107.1855 },
  'quang binh': { lat: 17.4689, lon: 106.6223 },
  'ha tinh': { lat: 18.3559, lon: 105.8877 },
  'nghe an': { lat: 18.6796, lon: 105.6813 },
  'thanh hoa': { lat: 19.8067, lon: 105.7852 },
  'ninh binh': { lat: 20.2506, lon: 105.9745 },
  'nam dinh': { lat: 20.4388, lon: 106.1621 },
  'thai binh': { lat: 20.4463, lon: 106.3366 },
  'ha nam': { lat: 20.5835, lon: 105.923 },
  'hung yen': { lat: 20.6464, lon: 106.0511 },
  'quang ninh': { lat: 20.9599, lon: 107.0425 },
  'bac ninh': { lat: 21.1861, lon: 106.0763 },
  'bac giang': { lat: 21.2819, lon: 106.1975 },
  'hai duong': { lat: 20.9373, lon: 106.3145 },
  'vinh phuc': { lat: 21.3089, lon: 105.6049 },
  'phu tho': { lat: 21.3227, lon: 105.4019 },
  'thai nguyen': { lat: 21.5942, lon: 105.8482 },
  'hoa binh': { lat: 20.8172, lon: 105.3376 },
  'lang son': { lat: 21.8537, lon: 106.7615 },
  'lao cai': { lat: 22.4809, lon: 103.9755 },
  'son la': { lat: 21.3256, lon: 103.9188 },
  'yen bai': { lat: 21.7168, lon: 104.8986 },
  'tuyen quang': { lat: 21.8236, lon: 105.2142 },
  'ha giang': { lat: 22.8026, lon: 104.9784 },
  'cao bang': { lat: 22.6666, lon: 106.2639 },
  'bac kan': { lat: 22.147, lon: 105.8348 },
  'dien bien': { lat: 21.386, lon: 103.023 },
  'lai chau': { lat: 22.3864, lon: 103.4703 },
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

function resolveAddressGeoPoint(
  city?: string,
  district?: string,
  fallbackLabel = 'Điểm nhận'
): GeoPoint {
  const distNorm = normalizeAscii(district);
  const cityNorm = normalizeAscii(city);
  const cleanDist = (district || '')
    .replace(/^(Thành phố|Quận|Huyện|Thị xã)\s+/i, '')
    .trim();
  const cleanCity = (city || '')
    .replace(/^(Thành phố|Tỉnh|TP\.?)\s+/i, '')
    .trim();
  const shortLabel =
    cleanDist && cleanCity
      ? `${district?.startsWith('Quận') ? district : cleanDist}, ${
          cleanCity === 'Hồ Chí Minh' ? 'TP.HCM' : cleanCity
        }`
      : cleanDist || cleanCity || fallbackLabel;

  const isHcmc = !cityNorm || cityNorm.includes('ho chi minh') || cityNorm.includes('hcm');
  if (isHcmc) {
    for (const [key, coords] of Object.entries(HCMC_DISTRICT_COORDS)) {
      if (distNorm.includes(key)) {
        return { ...coords, shortLabel };
      }
    }
  }
  for (const [key, coords] of Object.entries(VIETNAM_PROVINCE_COORDS)) {
    if (cityNorm.includes(key) || distNorm.includes(key)) {
      return { ...coords, shortLabel };
    }
  }
  return {
    lat: 10.7626,
    lon: 106.6602,
    shortLabel,
  };
}

function resolveRecipientGeoPoint(order: Order): GeoPoint {
  return resolveAddressGeoPoint(
    order.shippingAddress?.city,
    order.shippingAddress?.district,
    'Điểm nhận'
  );
}

function resolveWarehouseGeoPoint(
  warehouseOrigin?: PublicWarehouseOrigin | null,
  pickupWarehouseLabel?: string
): GeoPoint {
  if (warehouseOrigin && (warehouseOrigin.fromCity || warehouseOrigin.fromDistrict)) {
    return resolveAddressGeoPoint(
      warehouseOrigin.fromCity,
      warehouseOrigin.fromDistrict,
      'Kho Tiệm Cuộn Len'
    );
  }
  if (pickupWarehouseLabel) {
    const parts = pickupWarehouseLabel.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      return resolveAddressGeoPoint(parts[parts.length - 1], parts[0], pickupWarehouseLabel);
    }
    return resolveAddressGeoPoint(pickupWarehouseLabel, '', pickupWarehouseLabel);
  }
  return DEFAULT_WAREHOUSE_POINT;
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
  return Math.max(2, Math.round(R * c * 1.28));
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
    return 84;
  }
  if (
    latestText.includes('kho giao') ||
    latestText.includes('tram giao') ||
    latestText.includes('soc') ||
    checkpoints.length >= 4
  ) {
    return 70;
  }
  if (
    latestText.includes('trung chuyen') ||
    latestText.includes('phan loai') ||
    checkpoints.length >= 2
  ) {
    return 55;
  }
  if (
    order.status === 'Đang giao' ||
    Boolean(order.shippingAddress?.trackingCode) ||
    order.shippingAddress?.craftingStage === 'handed_to_spx'
  ) {
    return 44;
  }
  return 15;
}

interface ShopeeDeliveryRouteMapProps {
  order: Order;
  checkpoints: LiveCarrierCheckpoint[];
  loadingCheckpoints?: boolean;
  onRefresh?: () => void;
  onCopyTracking?: (code: string) => void;
  copiedTracking?: boolean;
  warehouseOrigin?: PublicWarehouseOrigin | null;
}

export function ShopeeDeliveryRouteMap({
  order,
  checkpoints,
  loadingCheckpoints = false,
  onRefresh,
  onCopyTracking,
  copiedTracking = false,
  warehouseOrigin: propWarehouseOrigin,
}: ShopeeDeliveryRouteMapProps) {
  const [fetchedOrigin, setFetchedOrigin] = useState<PublicWarehouseOrigin | null>(null);

  useEffect(() => {
    if (propWarehouseOrigin) return;
    let active = true;
    fetchPublicWarehouseOrigin().then((o) => {
      if (active && o) setFetchedOrigin(o);
    });
    return () => {
      active = false;
    };
  }, [propWarehouseOrigin]);

  const effectiveOrigin = propWarehouseOrigin || fetchedOrigin;

  const originPoint = useMemo(
    () =>
      resolveWarehouseGeoPoint(
        effectiveOrigin,
        order.shippingAddress?.pickupWarehouseLabel
      ),
    [effectiveOrigin, order.shippingAddress?.pickupWarehouseLabel]
  );

  const recipientPoint = useMemo(() => resolveRecipientGeoPoint(order), [order]);
  const roadDistanceKm = useMemo(
    () => computeHaversineKm(originPoint, recipientPoint),
    [originPoint, recipientPoint]
  );
  const progressPct = useMemo(
    () => computeDeliveryProgressPct(order, checkpoints),
    [order, checkpoints]
  );

  const carrierName = order.shippingAddress?.shippingCarrier || 'SPX Express';
  const trackingCode = (order.shippingAddress?.trackingCode || '').trim();
  const isCompleted = order.status === 'Hoàn thành';

  const statusBadgeLabel = useMemo(() => {
    if (isCompleted) return 'Giao thành công • 100%';
    if (progressPct >= 80) return 'Shipper đang giao tới bạn';
    if (progressPct >= 55) return `Đang trung chuyển • ~${roadDistanceKm} km`;
    return `Đang vận chuyển • ~${roadDistanceKm} km`;
  }, [isCompleted, progressPct, roadDistanceKm]);

  const googleMapsRouteUrl = useMemo(() => {
    const originText =
      effectiveOrigin && (effectiveOrigin.fromDistrict || effectiveOrigin.fromCity)
        ? [
            effectiveOrigin.fromWard,
            effectiveOrigin.fromDistrict,
            effectiveOrigin.fromCity,
          ]
            .filter(Boolean)
            .join(', ')
        : order.shippingAddress?.pickupWarehouseLabel || 'Quận 8, Hồ Chí Minh';
    const origin = encodeURIComponent(originText);
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
    effectiveOrigin,
    order.shippingAddress?.pickupWarehouseLabel,
    order.shippingAddress?.ward,
    order.shippingAddress?.district,
    order.shippingAddress?.city,
  ]);

  // Keep truck strictly between 24% and 76% on the track so it never collides with origin/destination nodes
  const truckTrackLeftPct = isCompleted
    ? 78
    : Math.max(26, Math.min(74, progressPct));

  return (
    <View style={styles.card}>
      {/* 1. Clean Carrier & Waybill Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={styles.carrierIconBox}>
            <Truck size={15} color="#15803D" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.carrierTitleRow}>
              <Text style={styles.carrierTitleText} numberOfLines={1}>
                {carrierName}
              </Text>
              <View style={styles.distanceTag}>
                <Text style={styles.distanceTagText}>~{roadDistanceKm} km</Text>
              </View>
            </View>
            <Text style={styles.trackingSubText} numberOfLines={1}>
              {trackingCode
                ? `Mã vận đơn: ${trackingCode}`
                : 'Đã bàn giao đơn vị vận chuyển (Tự động cập nhật mã SPX)'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {trackingCode && onCopyTracking ? (
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => onCopyTracking(trackingCode)}
              activeOpacity={0.8}>
              {copiedTracking ? (
                <Check size={12} color="#15803D" />
              ) : (
                <Copy size={12} color="#3D2B1F" />
              )}
              <Text style={styles.actionPillText}>
                {copiedTracking ? 'Đã chép' : 'Chép mã'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {onRefresh ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onRefresh}
              disabled={loadingCheckpoints}
              activeOpacity={0.8}>
              {loadingCheckpoints ? (
                <ActivityIndicator size="small" color="#15803D" />
              ) : (
                <RefreshCw size={13} color="#15803D" />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 2. Clean Vector Map Canvas (Zero Watermark, Mobile-First Layout) */}
      <View style={styles.mapCanvas}>
        {/* Subtle Vector Map Grid & River Aesthetics */}
        <View style={styles.mapRoadHorizontal1} pointerEvents="none" />
        <View style={styles.mapRoadHorizontal2} pointerEvents="none" />
        <View style={styles.mapRoadVertical1} pointerEvents="none" />
        <View style={styles.mapRoadVertical2} pointerEvents="none" />
        <View style={styles.mapRiverCurve} pointerEvents="none" />

        {/* Top Row inside Map: Floating Status Pill + Google Maps Link */}
        <View style={styles.mapTopRow}>
          <View style={styles.liveStatusPill}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveStatusPillText} numberOfLines={1}>
              {statusBadgeLabel}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.gmapsBtn}
            onPress={() => Linking.openURL(googleMapsRouteUrl)}
            activeOpacity={0.85}>
            <MapPin size={11} color="#166534" />
            <Text style={styles.gmapsBtnText}>Xem lộ trình</Text>
            <ExternalLink size={10} color="#166534" />
          </TouchableOpacity>
        </View>

        {/* Center Route Track with Aligned Endpoints & Moving Truck */}
        <View style={styles.routeContainer}>
          <View style={styles.trackRow}>
            {/* Left Endpoint Circle: Kho Thủ Đức */}
            <View style={styles.originDot}>
              <Package size={12} color="#FFFFFF" />
            </View>

            {/* Route Progress Bar */}
            <View style={styles.trackBarWrapper}>
              <View style={styles.trackBarBg} />
              <View
                style={[
                  styles.trackBarFill,
                  { width: `${progressPct}%` as any },
                ]}
              />

              {/* Moving SPX Truck Badge on Track */}
              <View
                style={[
                  styles.truckNodeWrap,
                  { left: `${truckTrackLeftPct}%` as any },
                ]}>
                <View style={styles.truckHalo} />
                <View style={styles.truckBadgeCircle}>
                  {isCompleted ? (
                    <CheckCircle2 size={14} color="#FFFFFF" />
                  ) : (
                    <Truck size={13} color="#FFFFFF" />
                  )}
                </View>
              </View>
            </View>

            {/* Right Endpoint Circle: Địa chỉ nhận */}
            <View
              style={[
                styles.destDot,
                isCompleted && { backgroundColor: '#16A34A' },
              ]}>
              <Home size={12} color="#FFFFFF" />
            </View>
          </View>

          {/* Endpoint Labels Row (Cleanly aligned underneath) */}
          <View style={styles.endpointLabelsRow}>
            <View style={styles.endpointLabelLeft}>
              <Text style={styles.endpointTitle} numberOfLines={1}>
                Kho {effectiveOrigin?.senderName || 'Tiệm Cuộn Len'}
              </Text>
              <Text style={styles.endpointSub} numberOfLines={1}>
                {originPoint.shortLabel}
              </Text>
            </View>

            <View style={styles.endpointLabelRight}>
              <Text style={[styles.endpointTitle, { textAlign: 'right', color: '#14532D' }]} numberOfLines={1}>
                {recipientPoint.shortLabel}
              </Text>
              <Text style={[styles.endpointSub, { textAlign: 'right' }]} numberOfLines={1}>
                {order.shippingAddress?.ward || 'Địa chỉ nhận hàng'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Compact Handmade Completion & Shop Note Strip */}
      <View style={styles.footerStrip}>
        <CheckCircle2 size={13} color="#15803D" />
        <Text style={styles.footerStripText} numberOfLines={2}>
          Đã hoàn thiện đan & đóng hộp quà 100%
          {order.shippingAddress?.craftingNote
            ? ` • 💌 "${order.shippingAddress.craftingNote}"`
            : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  carrierIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carrierTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  distanceTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  distanceTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  trackingSubText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCanvas: {
    position: 'relative',
    backgroundColor: '#ECF6F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    gap: 14,
  },
  mapRoadHorizontal1: {
    position: 'absolute',
    top: '28%',
    left: -10,
    right: -10,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '-4deg' }],
  },
  mapRoadHorizontal2: {
    position: 'absolute',
    bottom: '22%',
    left: -10,
    right: -10,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ rotate: '3deg' }],
  },
  mapRoadVertical1: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: '32%',
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '12deg' }],
  },
  mapRoadVertical2: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    right: '28%',
    width: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ rotate: '-8deg' }],
  },
  mapRiverCurve: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '48%',
    width: 22,
    backgroundColor: 'rgba(186, 230, 253, 0.55)',
    borderRadius: 12,
    transform: [{ rotate: '18deg' }],
  },
  mapTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#14532D',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    maxWidth: '65%',
  },
  livePulseDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  liveStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gmapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  gmapsBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  routeContainer: {
    zIndex: 2,
    gap: 8,
    paddingTop: 2,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#78350F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  destDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EA580C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  trackBarWrapper: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: -2,
  },
  trackBarBg: {
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 999,
    width: '100%',
  },
  trackBarFill: {
    position: 'absolute',
    left: 0,
    height: 5,
    backgroundColor: '#16A34A',
    borderRadius: 999,
  },
  truckNodeWrap: {
    position: 'absolute',
    transform: [{ translateX: -15 }],
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckHalo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 163, 74, 0.22)',
  },
  truckBadgeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointLabelsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  endpointLabelLeft: {
    flex: 1,
    minWidth: 0,
  },
  endpointLabelRight: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  endpointTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  endpointSub: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  footerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  footerStripText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
    lineHeight: 16,
  },
});
