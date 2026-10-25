import React, { useState, useEffect, useCallback } from 'react';
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
  Linking,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Building2,
  Smartphone,
  Wallet,
  Truck,
  Plus,
  Trash2,
  Edit3,
  Star,
  Copy,
  CheckCheck,
  Zap,
  ExternalLink,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';

const SEPAY_WEBHOOK_URL = 'https://tiem-cuon-len.vercel.app/api/sepay-webhook';
const SEPAY_LOG_PARTITION = '__TCL_SEPAY_LOG_V1__';

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  bank_transfer: 'Chuyển khoản ngân hàng (SePay VietQR)',
  momo: 'Ví MoMo',
  zalopay: 'ZaloPay',
  cod: 'Thanh toán khi nhận hàng (COD)',
};

const TYPE_ICONS: Record<PaymentMethodType, React.ReactNode> = {
  bank_transfer: <Building2 size={22} color="#3D2B1F" />,
  momo: <Smartphone size={22} color="#A50064" />,
  zalopay: <Wallet size={22} color="#0068FF" />,
  cod: <Truck size={22} color="#2E7D32" />,
};

interface SepayWebhookLog {
  id: string;
  gateway: string;
  accountNumber: string;
  transferAmount: number;
  content: string;
  matchedOrderId: string | null;
  orderUpdated: boolean;
  createdAt: string;
}

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
  const displayMethods = isAdmin ? methods : enabledMethods;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<SepayWebhookLog[]>([]);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editTransferPrefix, setEditTransferPrefix] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<PaymentMethodType>('bank_transfer');
  const [addTitle, setAddTitle] = useState('');
  const [addBankName, setAddBankName] = useState('');
  const [addAccountName, setAddAccountName] = useState('');
  const [addAccountNumber, setAddAccountNumber] = useState('');
  const [addTransferPrefix, setAddTransferPrefix] = useState('CUONLEN');
  const [addPhoneNumber, setAddPhoneNumber] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchWebhookLogs = useCallback(async () => {
    if (!isAdmin || !supabaseUrl || !supabaseAnonKey) return;
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/addresses?fullName=eq.${SEPAY_LOG_PARTITION}&select=*&limit=10`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows)) return;

      const parsed: SepayWebhookLog[] = rows
        .map((r: any) => {
          try {
            const d =
              typeof r.detailAddress === 'string'
                ? JSON.parse(r.detailAddress)
                : r.detailAddress || {};
            return {
              id: String(r.id),
              gateway: String(d.gateway || r.phone || 'Ngân hàng'),
              accountNumber: String(d.accountNumber || ''),
              transferAmount: Number(d.transferAmount || 0),
              content: String(d.content || ''),
              matchedOrderId: d.matchedOrderId || null,
              orderUpdated: Boolean(d.orderUpdated),
              createdAt: String(r.district || new Date().toISOString()),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as SepayWebhookLog[];

      parsed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setWebhookLogs(parsed.slice(0, 5));
    } catch {
      // ignore
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchWebhookLogs();
  }, [fetchWebhookLogs]);

  const handleCopyText = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestSepayWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const bankMethod = methods.find((m) => m.type === 'bank_transfer');
      const res = await fetch('/api/sepay-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Math.floor(100000 + Math.random() * 900000),
          gateway: bankMethod?.bank_name || 'VietinBank',
          accountNumber: bankMethod?.account_number || '107888618456',
          transferType: 'in',
          transferAmount: 69000,
          code: 'CUONLEN098929',
          content: 'SEVQR CUONLEN098929 Test ket noi SePay Webhook',
          description: 'Test SePay Webhook Connection',
          transactionDate: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setWebhookTestResult(
          `✅ Kết nối Webhook hoạt động tốt! ${
            data.matchedOrderId
              ? `Đã khớp đơn ${data.matchedOrderId}`
              : 'Đã ghi nhận bản tin test từ SePay.'
          }`
        );
        fetchWebhookLogs();
      } else {
        setWebhookTestResult('⚠️ Đã gửi bản tin nhưng chưa nhận phản hồi chuẩn.');
      }
    } catch {
      setWebhookTestResult(
        'ℹ️ Endpoint /api/sepay-webhook sẽ hoạt động trực tiếp trên tên miền Vercel (tiem-cuon-len.vercel.app).'
      );
    } finally {
      setTestingWebhook(false);
    }
  };

  const startEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setEditTitle(method.title);
    setEditBankName(method.bank_name ?? '');
    setEditAccountName(method.account_name ?? '');
    setEditAccountNumber(method.account_number ?? '');
    setEditTransferPrefix(method.transfer_prefix ?? 'CUONLEN');
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
      updates.transfer_prefix = (editTransferPrefix.trim() || 'SEVQR CUONLEN')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .toUpperCase();
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
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`Bạn có chắc muốn xóa "${method.title}"?`);
      if (ok) deleteMethod(method.id);
      return;
    }
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
      input.bank_name = addBankName.trim() || 'Vietcombank';
      input.account_name = addAccountName.trim();
      input.account_number = addAccountNumber.trim();
      input.transfer_prefix = (addTransferPrefix.trim() || 'CUONLEN')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
    }
    if (addType === 'momo') {
      input.phone_number = addPhoneNumber.trim();
    }

    await addMethod(input);
    setAdding(false);
    setShowAddModal(false);
    setAddTitle('');
    setAddBankName('');
    setAddAccountName('');
    setAddAccountNumber('');
    setAddTransferPrefix('CUONLEN');
    setAddPhoneNumber('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3D2B1F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          maxWidth: 840,
          width: '100%',
          alignSelf: 'center',
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/profile');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={22} color="#3D2B1F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isAdmin ? 'Cổng Thanh Toán & SePay' : 'Phương thức thanh toán'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ADMIN: SEPAY THIRD-PARTY BANK INTEGRATION PANEL */}
        {isAdmin ? (
          <View style={styles.sepayPanel}>
            <View style={styles.sepayHeaderRow}>
              <View style={styles.sepayBadge}>
                <Zap size={13} color="#FAF5EE" />
                <Text style={styles.sepayBadgeText}>SEPAY AUTO-BANKING</Text>
              </View>
              <TouchableOpacity
                style={styles.openSepayBtn}
                onPress={() => Linking.openURL('https://my.sepay.vn/mobileapp')}
                activeOpacity={0.8}>
                <Text style={styles.openSepayBtnText}>Mở my.sepay.vn</Text>
                <ExternalLink size={13} color="#3D2B1F" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sepayTitle}>
              Tích hợp xác nhận chuyển khoản tự động qua SePay
            </Text>
            <Text style={styles.sepayDesc}>
              Khi khách quét mã QR chuyển khoản, ứng dụng SePay sẽ tự động bắn Webhook về địa chỉ dưới đây và chuyển trạng thái đơn hàng sang{' '}
              <Text style={{ fontWeight: '800' }}>"Đang xử lý"</Text> chỉ sau 3–5 giây.
            </Text>

            {/* Copyable Webhook URL Box */}
            <View style={styles.webhookBox}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.webhookLabel}>
                  1. URL WEBHOOK (Dán vào mục Tích hợp Webhooks trên SePay):
                </Text>
                <Text style={styles.webhookUrl} selectable numberOfLines={1}>
                  {SEPAY_WEBHOOK_URL}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyWebhookBtn}
                onPress={() => handleCopyText(SEPAY_WEBHOOK_URL, 'webhook')}
                activeOpacity={0.8}>
                {copiedKey === 'webhook' ? (
                  <>
                    <CheckCheck size={14} color="#FAF5EE" />
                    <Text style={styles.copyWebhookText}>Đã chép</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#FAF5EE" />
                    <Text style={styles.copyWebhookText}>Sao chép URL</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Copyable Payment Code Prefix */}
            <View style={styles.webhookBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.webhookLabel}>
                  2. CẤU TRÚC MÃ THANH TOÁN (Cấu hình công ty → Cấu trúc mã TT):
                </Text>
                <Text style={styles.webhookUrl}>Tiền tố: CUONLEN</Text>
              </View>
              <TouchableOpacity
                style={styles.copyPrefixBtn}
                onPress={() => handleCopyText('CUONLEN', 'prefix')}
                activeOpacity={0.8}>
                {copiedKey === 'prefix' ? (
                  <CheckCheck size={14} color="#3D2B1F" />
                ) : (
                  <Copy size={14} color="#3D2B1F" />
                )}
                <Text style={styles.copyPrefixText}>
                  {copiedKey === 'prefix' ? 'Đã chép' : 'Chép tiền tố'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Step-by-step Setup Guide */}
            <View style={styles.stepsBox}>
              <Text style={styles.stepsTitle}>
                📋 3 bước cài đặt trên https://my.sepay.vn/mobileapp:
              </Text>
              <Text style={styles.stepItem}>
                • <Text style={{ fontWeight: '800' }}>Bước 1:</Text> Liên kết tài khoản ngân hàng của bạn trên{' '}
                <Text style={{ fontWeight: '700' }}>my.sepay.vn</Text> (hoặc bật thông báo biến động số dư qua App SePay trên điện thoại).
              </Text>
              <Text style={styles.stepItem}>
                • <Text style={{ fontWeight: '800' }}>Bước 2:</Text> Vào mục{' '}
                <Text style={{ fontWeight: '700' }}>Tích hợp Webhooks → Thêm Webhook</Text>, dán URL{' '}
                <Text style={{ fontWeight: '700' }}>{SEPAY_WEBHOOK_URL}</Text>, chọn sự kiện{' '}
                <Text style={{ fontWeight: '700' }}>"Có tiền vào"</Text>, kiểu chứng thực{' '}
                <Text style={{ fontWeight: '700' }}>"Không cần chứng thực"</Text>, kiểu dữ liệu{' '}
                <Text style={{ fontWeight: '700' }}>application/json</Text> rồi bấm Lưu.
              </Text>
              <Text style={styles.stepItem}>
                • <Text style={{ fontWeight: '800' }}>Bước 3:</Text> Kiểm tra đúng Tên Ngân hàng & Số tài khoản ở thẻ{' '}
                <Text style={{ fontWeight: '700' }}>"Chuyển khoản ngân hàng"</Text> bên dưới (bấm icon ✏️ để sửa nếu bạn đổi ngân hàng).
              </Text>
            </View>

            {/* Test Webhook Button & Live Logs */}
            <View style={styles.testRow}>
              <TouchableOpacity
                style={styles.testWebhookBtn}
                onPress={handleTestSepayWebhook}
                disabled={testingWebhook}
                activeOpacity={0.85}>
                {testingWebhook ? (
                  <ActivityIndicator size="small" color="#FAF5EE" />
                ) : (
                  <>
                    <Zap size={15} color="#FAF5EE" />
                    <Text style={styles.testWebhookBtnText}>
                      Gửi thử bản tin Webhook SePay
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshLogBtn}
                onPress={fetchWebhookLogs}
                activeOpacity={0.8}>
                <RefreshCw size={14} color="#3D2B1F" />
                <Text style={styles.refreshLogText}>Làm mới nhật ký</Text>
              </TouchableOpacity>
            </View>

            {webhookTestResult && (
              <View style={styles.testResultBox}>
                <Text style={styles.testResultText}>{webhookTestResult}</Text>
              </View>
            )}

            {webhookLogs.length > 0 && (
              <View style={styles.logsBox}>
                <Text style={styles.logsTitle}>
                  Nhật ký giao dịch SePay Webhook gần đây:
                </Text>
                {webhookLogs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logItemTop}>
                        +{formatVND(log.transferAmount)} • {log.gateway}
                      </Text>
                      <Text style={styles.logItemSub} numberOfLines={1}>
                        ND: {log.content}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.logStatusBadge,
                        log.orderUpdated && styles.logStatusBadgeMatched,
                      ]}>
                      <Text style={styles.logStatusText}>
                        {log.matchedOrderId
                          ? `✓ ${log.matchedOrderId}`
                          : 'Đã nhận'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Hỗ trợ thanh toán chuyển khoản ngân hàng tự động 24/7 qua mã{' '}
              <Text style={{ fontWeight: '800', color: '#3D2B1F' }}>
                SePay VietQR
              </Text>{' '}
              (tự động duyệt đơn trong 3–5 giây) hoặc thanh toán khi nhận hàng (COD).
            </Text>
          </View>
        )}

        {/* Add New button (admin only) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}>
            <Plus size={19} color="#FAF5EE" />
            <Text style={styles.addBtnText}>Thêm tài khoản / phương thức mới</Text>
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
                    Cấu hình: {TYPE_LABELS[method.type]}
                  </Text>

                  <FormField
                    label="Tên hiển thị"
                    value={editTitle}
                    onChangeText={setEditTitle}
                  />

                  {method.type === 'bank_transfer' && (
                    <>
                      <FormField
                        label="Tên Ngân hàng (VD: Vietcombank, MBBank, ACB, Techcombank...)"
                        value={editBankName}
                        onChangeText={setEditBankName}
                      />
                      <FormField
                        label="Chủ tài khoản (Viết hoa không dấu)"
                        value={editAccountName}
                        onChangeText={setEditAccountName}
                      />
                      <FormField
                        label="Số tài khoản (Hoặc số TK ảo VA trên SePay)"
                        value={editAccountNumber}
                        onChangeText={setEditAccountNumber}
                      />
                      <FormField
                        label="Tiền tố mã thanh toán SePay (Mặc định: CUONLEN)"
                        value={editTransferPrefix}
                        onChangeText={setEditTransferPrefix}
                      />
                    </>
                  )}

                  {method.type === 'momo' && (
                    <FormField
                      label="Số điện thoại ví MoMo"
                      value={editPhoneNumber}
                      onChangeText={setEditPhoneNumber}
                      keyboardType="phone-pad"
                    />
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
                        <Text style={styles.saveBtnText}>Lưu cấu hình</Text>
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
                        {method.bank_name} • STK: {method.account_number} ({method.account_name})
                      </Text>
                    )}
                    {method.type === 'momo' && method.phone_number && (
                      <Text style={styles.methodSub}>SĐT: {method.phone_number}</Text>
                    )}
                  </View>

                  {isAdmin && (
                    <View style={styles.methodActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => startEdit(method)}>
                        <Edit3 size={16} color="#3D2B1F" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDelete(method)}>
                        <Trash2 size={16} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.methodControls}>
                  {isAdmin && (
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>
                        {method.enabled ? 'Đang bật' : 'Đã tắt'}
                      </Text>
                      <Switch
                        value={method.enabled}
                        onValueChange={() => handleToggleEnabled(method)}
                        trackColor={{
                          false: COLORS.border,
                          true: '#D8C3AD',
                        }}
                        thumbColor={method.enabled ? '#3D2B1F' : COLORS.lightText}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.defaultBtn, isDefault && styles.defaultBtnActive]}
                    onPress={() => handleSetDefault(method)}
                    disabled={isDefault || !method.enabled}>
                    <Star
                      size={16}
                      color={isDefault ? '#C88A2E' : COLORS.lightText}
                      fill={isDefault ? '#C88A2E' : 'none'}
                    />
                    <Text
                      style={[
                        styles.defaultText,
                        isDefault && styles.defaultTextActive,
                      ]}>
                      {isDefault ? 'Mặc định khi thanh toán' : 'Đặt làm mặc định'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Add Method Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm phương thức mới</Text>

            <FormField
              label="Tên hiển thị"
              value={addTitle}
              onChangeText={setAddTitle}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Loại phương thức</Text>
              <View style={styles.typeRow}>
                {(['bank_transfer', 'momo', 'zalopay', 'cod'] as PaymentMethodType[]).map(
                  (t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeChip,
                        addType === t && styles.typeChipActive,
                      ]}
                      onPress={() => setAddType(t)}>
                      <Text
                        style={[
                          styles.typeChipText,
                          addType === t && styles.typeChipTextActive,
                        ]}>
                        {t === 'bank_transfer'
                          ? 'Ngân hàng (SePay)'
                          : t === 'cod'
                          ? 'COD'
                          : t.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {addType === 'bank_transfer' && (
              <>
                <FormField
                  label="Tên Ngân hàng (VD: Vietcombank, MBBank, ACB...)"
                  value={addBankName}
                  onChangeText={setAddBankName}
                />
                <FormField
                  label="Chủ tài khoản (Viết hoa không dấu)"
                  value={addAccountName}
                  onChangeText={setAddAccountName}
                />
                <FormField
                  label="Số tài khoản"
                  value={addAccountNumber}
                  onChangeText={setAddAccountNumber}
                />
                <FormField
                  label="Tiền tố mã thanh toán SePay"
                  value={addTransferPrefix}
                  onChangeText={setAddTransferPrefix}
                />
              </>
            )}

            {addType === 'momo' && (
              <FormField
                label="Số điện thoại"
                value={addPhoneNumber}
                onChangeText={setAddPhoneNumber}
                keyboardType="phone-pad"
              />
            )}

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, adding && styles.saveBtnDisabled]}
                onPress={handleAddMethod}
                disabled={adding}>
                {adding ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Thêm mới</Text>
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
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2C1E14' },

  /* SePay Admin Panel */
  sepayPanel: {
    backgroundColor: '#D8C3AD',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    gap: 12,
    ...SHADOWS.small,
  },
  sepayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sepayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sepayBadgeText: {
    color: '#FAF5EE',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  openSepayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  openSepayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  sepayTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
  },
  sepayDesc: {
    fontSize: 12.5,
    color: '#4A3525',
    lineHeight: 19,
  },
  webhookBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FAF5EE',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  webhookLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7A5C44',
    marginBottom: 3,
  },
  webhookUrl: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2C1E14',
  },
  copyWebhookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
  },
  copyWebhookText: {
    color: '#FAF5EE',
    fontSize: 12,
    fontWeight: '700',
  },
  copyPrefixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFE5D8',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  copyPrefixText: {
    color: '#3D2B1F',
    fontSize: 12,
    fontWeight: '700',
  },
  stepsBox: {
    backgroundColor: 'rgba(250,245,238,0.65)',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  stepsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2C1E14',
    marginBottom: 2,
  },
  stepItem: {
    fontSize: 12,
    color: '#4A3525',
    lineHeight: 18,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  testWebhookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 13,
  },
  testWebhookBtnText: {
    color: '#FAF5EE',
    fontSize: 12.5,
    fontWeight: '800',
  },
  refreshLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  refreshLogText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  testResultBox: {
    backgroundColor: '#F0FFF4',
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#A3D9A5',
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E5620',
  },
  logsBox: {
    backgroundColor: '#FAF5EE',
    borderRadius: 14,
    padding: 12,
    gap: 7,
  },
  logsTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#5C4332',
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#EFE5D8',
  },
  logItemTop: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2C1E14',
  },
  logItemSub: {
    fontSize: 11,
    color: '#7A6252',
  },
  logStatusBadge: {
    backgroundColor: '#EFE5D8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  logStatusBadgeMatched: {
    backgroundColor: '#E1F5E4',
  },
  logStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2C1E14',
  },

  infoBanner: {
    backgroundColor: '#F3ECE2',
    marginHorizontal: SPACING.lg,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: '#3D2B1F',
  },
  infoBannerText: { fontSize: 13, color: '#4A3525', lineHeight: 20 },
  errorBanner: {
    backgroundColor: '#FDF0ED',
    marginHorizontal: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  section: { paddingHorizontal: SPACING.lg },

  methodCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    ...SHADOWS.small,
  },
  methodCardDisabled: { opacity: 0.5 },
  methodCardDefault: { borderColor: '#3D2B1F', borderWidth: 1.5 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 15.5, fontWeight: '800', color: '#2C1E14' },
  methodType: { fontSize: 12.5, color: '#5C4332', marginTop: 2 },
  methodSub: { fontSize: 12, color: '#7A6252', marginTop: 3, fontWeight: '600' },
  methodActions: { flexDirection: 'row', gap: SPACING.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  methodControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0E6DA',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  toggleLabel: { fontSize: 13, color: '#4A3525', fontWeight: '600' },
  defaultBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  defaultBtnActive: {},
  defaultText: { fontSize: 13, fontWeight: '600', color: COLORS.lightText },
  defaultTextActive: { color: '#C88A2E', fontWeight: '800' },

  editCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: '#3D2B1F',
    ...SHADOWS.small,
  },
  editCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2C1E14',
    marginBottom: SPACING.md,
  },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4A3525',
    marginBottom: SPACING.xs,
  },
  fieldInput: {
    backgroundColor: '#FAF5EE',
    borderRadius: 11,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#2C1E14',
    borderWidth: 1,
    borderColor: '#D8C3AD',
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
    borderColor: '#D8C3AD',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#4A3525' },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#3D2B1F',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FAF5EE' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#3D2B1F',
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: SPACING.lg,
    ...SHADOWS.small,
  },
  addBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FAF5EE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    maxHeight: '90%',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#2C1E14',
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  typeRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  typeChipActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  typeChipText: { fontSize: 12.5, fontWeight: '700', color: '#3D2B1F' },
  typeChipTextActive: { color: '#FAF5EE' },
});
