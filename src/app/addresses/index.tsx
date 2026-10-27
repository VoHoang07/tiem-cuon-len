import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Plus,
  MapPin,
  Check,
  Trash2,
  Edit3,
  Home,
  Phone,
} from 'lucide-react-native';
import { useAddresses } from '@/store/AddressContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function AddressesScreen() {
  const router = useRouter();
  const { userAddresses, removeAddress, setDefaultAddress } = useAddresses();
  const [refreshing, setRefreshing] = useState(false);

  const handleDelete = (id: string) => {
    Alert.alert('Xóa địa chỉ', 'Bạn có chắc muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => removeAddress(id) },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const renderItem = ({ item: addr }: { item: (typeof userAddresses)[0] }) => {
    const addressParts = [
      addr.detailAddress,
      addr.ward,
      addr.district,
      addr.city,
    ].filter(Boolean);

    return (
      <View
        style={[
          styles.addressCard,
          addr.isDefault && styles.addressCardDefault,
        ]}>
        <View style={styles.addressHeader}>
          <View style={styles.namePhoneRow}>
            <Text style={styles.addressName}>{addr.fullName}</Text>
            {addr.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Mặc định</Text>
              </View>
            )}
          </View>
          <View style={styles.addressActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/addresses/add?id=${addr.id}`)}>
              <Edit3 size={15} color="#5C4033" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => handleDelete(addr.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Trash2 size={15} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Phone size={13.5} color="#8C7A6B" />
          <Text style={styles.addressPhone}>{addr.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <MapPin size={14} color="#8C7A6B" style={{ marginTop: 2 }} />
          <Text style={styles.addressDetail}>{addressParts.join(', ')}</Text>
        </View>

        {!addr.isDefault && (
          <TouchableOpacity
            style={styles.setDefaultBtn}
            onPress={() => setDefaultAddress(addr.id)}
            activeOpacity={0.75}>
            <View style={styles.defaultCircle} />
            <Text style={styles.setDefaultText}>Đặt làm địa chỉ mặc định</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const ListHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.iconBtn}>
            <ChevronLeft size={20} color="#3D2B1F" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.replace('/')}>
            <Home size={18} color="#3D2B1F" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Sổ địa chỉ nhận hàng</Text>
        <View style={{ width: 76 }} />
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => router.push('/addresses/add')}
        activeOpacity={0.85}>
        <Plus size={18} color="#FFFDF9" />
        <Text style={styles.addBtnText}>Thêm địa chỉ nhận hàng mới</Text>
      </TouchableOpacity>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconCircle}>
        <MapPin size={32} color="#8C7A6B" />
      </View>
      <Text style={styles.emptyTitle}>Chưa có địa chỉ giao hàng</Text>
      <Text style={styles.emptySubtext}>
        Thêm địa chỉ để tiệm gửi những món đồ len thủ công đến tận tay bạn nhé
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={userAddresses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  listContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 60,
    flexGrow: 1,
  },
  headerBlock: {
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5C4033',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    ...SHADOWS.small,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFDF9',
  },
  emptyCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F4ECE1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  emptySubtext: {
    fontSize: 13.5,
    color: '#7D6B5D',
    textAlign: 'center',
    lineHeight: 20,
  },
  addressCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    gap: 8,
    ...SHADOWS.small,
  },
  addressCardDefault: {
    borderColor: '#C8A98E',
    backgroundColor: '#FFFDF9',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  namePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  defaultBadge: {
    backgroundColor: '#F1E7DA',
    borderWidth: 1,
    borderColor: '#D8C3AD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  defaultBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4033',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F4ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: {
    backgroundColor: '#FDECEC',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressPhone: {
    fontSize: 14,
    color: '#5F5044',
    fontWeight: '500',
  },
  addressDetail: {
    flex: 1,
    fontSize: 14,
    color: '#5F5044',
    lineHeight: 20,
  },
  setDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DD',
  },
  defaultCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#9C8B7A',
  },
  setDefaultText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#6E5239',
  },
});
