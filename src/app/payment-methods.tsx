import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Building2,
  Smartphone,
  Wallet,
  Truck,
  Check,
  Plus,
  Trash2,
  Edit3,
  Star,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  bank_transfer: 'Chuyển khoản',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  cod: 'COD',
};

const TYPE_ICONS: Record<PaymentMethodType, React.ReactNode> = {
  bank_transfer: <Building2 size={22} color="#765341" />,
  momo: <Smartphone size={22} color="#A50064" />,
  zalopay: <Wallet size={22} color="#0068FF" />,
  cod: <Truck size={22} color="#6BAF5C" />,
};

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const {
    methods,
    enabledMethods,
    defaultMethod,
    loading,
    error,
    addMethod,
    updateMethod,
    deleteMethod,
    setDefault,
  } = usePaymentMethods();

  const isAdmin = role === 'admin';

  // Customer sees only enabled; Admin sees all
  const displayMethods = isAdmin ? methods : enabledMethods;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editTransferPrefix, setEditTransferPrefix] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Add new payment method state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<PaymentMethodType>('bank_transfer');
  const [addTitle, setAddTitle] = useState('');
  const [addBankName, setAddBankName] = useState('');
  const [addAccountName, setAddAccountName] = useState('');
  const [addAccountNumber, setAddAccountNumber] = useState('');
  const [addTransferPrefix, setAddTransferPrefix] = useState('');
  const [addPhoneNumber, setAddPhoneNumber] = useState('');
  const [adding, setAdding] = useState(false);

  const startEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditTitle(method.title);
    setEditBankName(method.bank_name ?? '');
    setEditAccountName(method.account_name ?? '');
    setEditAccountNumber(method.account_number ?? '');
    setEditTransferPrefix(method.transfer_prefix ?? '');
    setEditPhoneNumber(method.phone_number ?? '');
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (method: PaymentMethod) => {
    setSaving(true);
    const updates: Partial<PaymentMethod> = {
      title: editTitle.trim() || method.title,
    };

    if (method.type === 'bank_transfer') {
      updates.bank_name = editBankName.trim();
      updates.account_name = editAccountName.trim();
      updates.account_number = editAccountNumber.trim();
      updates.transfer_prefix = editTransferPrefix.trim() || 'CUONLEN';
    }
    if (method.type === 'momo') {
      updates.phone_number = editPhoneNumber.trim();
    }

    await updateMethod(method.id, updates);
    setSaving(false);
    setEditingId(null);
  };

  const handleToggleEnabled = (method: PaymentMethod) => {
    updateMethod(method.id, { enabled: !method.enabled });
  };

  const handleSetDefault = (method: PaymentMethod) => {
    setDefault(method.id);
  };

  const handleDelete = (method: PaymentMethod) => {
    Alert.alert('Xóa phương thức', `Bạn có chắc muốn xóa "${method.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => deleteMethod(method.id),
      },
    ]);
  };

  const handleAddMethod = async () => {
    if (!addTitle.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.');
      return;
    }

    setAdding(true);
    const input: Parameters<typeof addMethod>[0] = {
      type: addType,
      title: addTitle.trim(),
      enabled: true,
      is_default: false,
    };

    if (addType === 'bank_transfer') {
      input.bank_name = addBankName.trim();
      input.account_name = addAccountName.trim();
      input.account_number = addAccountNumber.trim();
      input.transfer_prefix = addTransferPrefix.trim() || 'CUONLEN';
    }
    if (addType === 'momo') {
      input.phone_number = addPhoneNumber.trim();
    }

    await addMethod(input);
    setAdding(false);
    setShowAddModal(false);
    setAddTitle(''); setAddBankName(''); setAddAccountName(''); setAddAccountNumber(''); setAddTransferPrefix(''); setAddPhoneNumber('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/profile');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phương thức thanh toán</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Info for customer */}
        {!isAdmin && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Chọn phương thức thanh toán mặc định cho bạn. Phương thức mặc định sẽ được chọn sẵn khi thanh toán.
            </Text>
          </View>
        )}

        {/* Add New button (admin only) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}>
            <Plus size={20} color={COLORS.white} />
            <Text style={styles.addBtnText}>Thêm phương thức mới</Text>
          </TouchableOpacity>
        )}

        {/* Method list */}
        <View style={styles.section}>
          {displayMethods.map((method) => {
            const isEditing = editingId === method.id;
            const isDefault = defaultMethod?.id === method.id;

            if (isEditing && isAdmin) {
              return (
                <View key={method.id} style={styles.editCard}>
                  <Text style={styles.editCardTitle}>
                    {TYPE_ICONS[method.type]} {TYPE_LABELS[method.type]}
                  </Text>

                  <FormField label="Tên hiển thị" value={editTitle} onChangeText={setEditTitle} />

                  {method.type === 'bank_transfer' && (
                    <>
                      <FormField label="Ngân hàng" value={editBankName} onChangeText={setEditBankName} />
                      <FormField label="Chủ tài khoản" value={editAccountName} onChangeText={setEditAccountName} />
                      <FormField label="Số tài khoản" value={editAccountNumber} onChangeText={setEditAccountNumber} />
                      <FormField label="Tiền tố CK" value={editTransferPrefix} onChangeText={setEditTransferPrefix} />
                    </>
                  )}

                  {method.type === 'momo' && (
                    <FormField label="Số điện thoại" value={editPhoneNumber} onChangeText={setEditPhoneNumber} keyboardType="phone-pad" />
                  )}

                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                      <Text style={styles.cancelBtnText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                      onPress={() => handleSaveEdit(method)}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>Lưu</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            return (
              <View
                key={method.id}
                style={[
                  styles.methodCard,
                  !method.enabled && styles.methodCardDisabled,
                  isDefault && styles.methodCardDefault,
                ]}>
                <View style={styles.methodRow}>
                  <View style={styles.methodIconWrap}>
                    {TYPE_ICONS[method.type]}
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={styles.methodType}>{TYPE_LABELS[method.type]}</Text>
                    {method.type === 'bank_transfer' && method.bank_name && (
                      <Text style={styles.methodSub}>
                        {method.bank_name} - {method.account_number}
                      </Text>
                    )}
                    {method.type === 'momo' && method.phone_number && (
                      <Text style={styles.methodSub}>{method.phone_number}</Text>
                    )}
                  </View>

                  {isAdmin && (
                    <View style={styles.methodActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => startEdit(method)}>
                        <Edit3 size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDelete(method)}>
                        <Trash2 size={16} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Bottom row: toggle + default */}
                <View style={styles.methodControls}>
                  {isAdmin && (
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>
                        {method.enabled ? 'Đang bật' : 'Đã tắt'}
                      </Text>
                      <Switch
                        value={method.enabled}
                        onValueChange={() => handleToggleEnabled(method)}
                        trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                        thumbColor={method.enabled ? COLORS.primary : COLORS.lightText}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.defaultBtn, isDefault && styles.defaultBtnActive]}
                    onPress={() => handleSetDefault(method)}
                    disabled={isDefault || !method.enabled}>
                    <Star
                      size={16}
                      color={isDefault ? COLORS.starYellow : COLORS.lightText}
                      fill={isDefault ? COLORS.starYellow : 'none'}
                    />
                    <Text
                      style={[
                        styles.defaultText,
                        isDefault && styles.defaultTextActive,
                      ]}>
                      {isDefault ? 'Mặc định' : 'Đặt mặc định'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Add Method Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm phương thức mới</Text>

            <FormField label="Tên hiển thị" value={addTitle} onChangeText={setAddTitle} />

            {/* Type selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Loại</Text>
              <View style={styles.typeRow}>
                {(['bank_transfer', 'momo', 'zalopay', 'cod'] as PaymentMethodType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, addType === t && styles.typeChipActive]}
                    onPress={() => setAddType(t)}>
                    <Text style={[styles.typeChipText, addType === t && styles.typeChipTextActive]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {addType === 'bank_transfer' && (
              <>
                <FormField label="Ngân hàng" value={addBankName} onChangeText={setAddBankName} />
                <FormField label="Chủ tài khoản" value={addAccountName} onChangeText={setAddAccountName} />
                <FormField label="Số tài khoản" value={addAccountNumber} onChangeText={setAddAccountNumber} />
                <FormField label="Tiền tố CK" value={addTransferPrefix} onChangeText={setAddTransferPrefix} />
              </>
            )}

            {addType === 'momo' && (
              <FormField label="Số điện thoại" value={addPhoneNumber} onChangeText={setAddPhoneNumber} keyboardType="phone-pad" />
            )}

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, adding && styles.saveBtnDisabled]}
                onPress={handleAddMethod}
                disabled={adding}>
                {adding ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Thêm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={COLORS.lightText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText },
  infoBanner: {
    backgroundColor: COLORS.lightPurple,
    marginHorizontal: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  infoBannerText: { fontSize: 13, color: COLORS.mediumText, lineHeight: 20 },
  errorBanner: {
    backgroundColor: '#FDF0ED',
    marginHorizontal: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: COLORS.error, textAlign: 'center' },
  section: { paddingHorizontal: SPACING.lg },

  // Method card
  methodCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  methodCardDisabled: { opacity: 0.5 },
  methodCardDefault: { borderColor: COLORS.starYellow, borderWidth: 2 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  methodType: { fontSize: 13, color: COLORS.mediumText, marginTop: 2 },
  methodSub: { fontSize: 12, color: COLORS.lightText, marginTop: 2 },
  methodActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Controls
  methodControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  toggleLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  defaultBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  defaultBtnActive: {},
  defaultText: { fontSize: 13, fontWeight: '600', color: COLORS.lightText },
  defaultTextActive: { color: COLORS.starYellow },

  // Edit card
  editCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  editCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText, marginBottom: SPACING.md },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.mediumText, marginBottom: SPACING.xs },
  fieldInput: {
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.darkText,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.mediumText },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  // Add button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
    ...SHADOWS.medium,
  },
  addBtnText: { fontSize: 16, fontWeight: '800', fontStyle: 'italic', color: COLORS.white },

  // Add modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText, marginBottom: SPACING.lg, textAlign: 'center' },
  typeRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: COLORS.mediumText },
  typeChipTextActive: { color: COLORS.white },
});
