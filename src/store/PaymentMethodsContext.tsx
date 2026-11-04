import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { PaymentMethod, PaymentMethodInput, type PaymentMethodType } from '@/types/payment-method';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

const PAYMENT_CACHE_KEY = 'tcl_payment_methods_v3';
const SHIPPING_CONFIG_CACHE_KEY = 'tcl_shipping_config_v2';
const SHIPPING_CONFIG_ROW_ID = 'tcl_shipping_config_v2';
const SHIPPING_CONFIG_PARTITION = '__TCL_SHIPPING_CONFIG_V1__';
const SHIPPING_HOLDER_USER_ID = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

export interface ShippingConfig {
  hcmFee: number;
  provincialFee: number;
  freeshipEnabled: boolean;
  freeshipThreshold: number;
}

export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  hcmFee: 15000,
  provincialFee: 15000,
  freeshipEnabled: true,
  freeshipThreshold: 299000,
};

function loadCachedShippingConfig(): ShippingConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(SHIPPING_CONFIG_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            hcmFee: Number.isFinite(Number(parsed.hcmFee)) ? Math.max(0, Number(parsed.hcmFee)) : DEFAULT_SHIPPING_CONFIG.hcmFee,
            provincialFee: Number.isFinite(Number(parsed.provincialFee))
              ? Math.max(0, Number(parsed.provincialFee))
              : DEFAULT_SHIPPING_CONFIG.provincialFee,
            freeshipEnabled:
              typeof parsed.freeshipEnabled === 'boolean'
                ? parsed.freeshipEnabled
                : DEFAULT_SHIPPING_CONFIG.freeshipEnabled,
            freeshipThreshold: Number.isFinite(Number(parsed.freeshipThreshold))
              ? Math.max(0, Number(parsed.freeshipThreshold))
              : DEFAULT_SHIPPING_CONFIG.freeshipThreshold,
          };
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHIPPING_CONFIG;
}

function saveCachedShippingConfig(cfg: ShippingConfig) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHIPPING_CONFIG_CACHE_KEY, JSON.stringify(cfg));
    }
  } catch {
    // ignore
  }
}

const SEPAY_VIETINBANK_CONFIG = {
  bank_name: 'VietinBank',
  account_name: 'VO VU MINH HOANG',
  account_number: '107888618456',
  transfer_prefix: 'SEVQR CUONLEN',
  qr_image:
    'https://vietqr.app/img?bank=VietinBank&acc=107888618456&template=&showinfo=true&holder=VO%20VU%20MINH%20HOANG&store=Ti%E1%BB%87m%20Cu%E1%BB%99n%20Len',
};

function normalizeBankMethod(m: PaymentMethod): PaymentMethod {
  if (
    m.type === 'bank_transfer' &&
    (!m.account_number ||
      m.account_number === '3387966507' ||
      m.account_number === '1029384756')
  ) {
    return {
      ...m,
      ...SEPAY_VIETINBANK_CONFIG,
    };
  }
  return m;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: '8aac533d-cbf5-4dc4-8b02-6823834f6083',
    type: 'bank_transfer',
    title: 'Chuyển khoản ngân hàng',
    enabled: true,
    is_default: true,
    ...SEPAY_VIETINBANK_CONFIG,
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: '1123a83c-e6b5-4ae4-9a13-88033d8d5ad0',
    type: 'cod',
    title: 'Thanh toán khi nhận hàng',
    enabled: true,
    is_default: false,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function loadCachedMethods(): PaymentMethod[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(PAYMENT_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return (parsed as PaymentMethod[]).map(normalizeBankMethod);
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PAYMENT_METHODS;
}

function saveCachedMethods(items: PaymentMethod[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PAYMENT_CACHE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore
  }
}

interface PaymentMethodsContextType {
  methods: PaymentMethod[];
  enabledMethods: PaymentMethod[];
  defaultMethod: PaymentMethod | undefined;
  loading: boolean;
  error: string | null;
  shippingConfig: ShippingConfig;
  updateShippingConfig: (patch: Partial<ShippingConfig>) => Promise<void>;
  addMethod: (input: PaymentMethodInput) => Promise<void>;
  updateMethod: (id: string, data: Partial<PaymentMethod>) => Promise<void>;
  deleteMethod: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  getMethodByType: (type: PaymentMethodType) => PaymentMethod | undefined;
}

const PaymentMethodsContext = createContext<PaymentMethodsContextType | null>(null);

export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>(() => loadCachedMethods());
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig>(() =>
    loadCachedShippingConfig()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShippingConfig = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('addresses')
        .select('detailAddress')
        .eq('id', SHIPPING_CONFIG_ROW_ID)
        .maybeSingle();

      if (data && data.detailAddress) {
        const parsed = JSON.parse(data.detailAddress);
        if (parsed && typeof parsed === 'object') {
          const next: ShippingConfig = {
            hcmFee: Number.isFinite(Number(parsed.hcmFee))
              ? Math.max(0, Number(parsed.hcmFee))
              : DEFAULT_SHIPPING_CONFIG.hcmFee,
            provincialFee: Number.isFinite(Number(parsed.provincialFee))
              ? Math.max(0, Number(parsed.provincialFee))
              : DEFAULT_SHIPPING_CONFIG.provincialFee,
            freeshipEnabled:
              typeof parsed.freeshipEnabled === 'boolean'
                ? parsed.freeshipEnabled
                : DEFAULT_SHIPPING_CONFIG.freeshipEnabled,
            freeshipThreshold: Number.isFinite(Number(parsed.freeshipThreshold))
              ? Math.max(0, Number(parsed.freeshipThreshold))
              : DEFAULT_SHIPPING_CONFIG.freeshipThreshold,
          };
          setShippingConfig(next);
          saveCachedShippingConfig(next);
        }
      }
    } catch {
      // keep cached/default
    }
  }, []);

  const updateShippingConfig = useCallback(
    async (patch: Partial<ShippingConfig>) => {
      if (role !== 'admin') return;
      let updated: ShippingConfig = DEFAULT_SHIPPING_CONFIG;
      setShippingConfig((prev) => {
        updated = { ...prev, ...patch };
        saveCachedShippingConfig(updated);
        return updated;
      });
      try {
        await supabase.from('addresses').upsert(
          {
            id: SHIPPING_CONFIG_ROW_ID,
            userId: SHIPPING_HOLDER_USER_ID,
            fullName: SHIPPING_CONFIG_PARTITION,
            phone: '0387966507',
            city: 'TP.HCM',
            district: new Date().toISOString(),
            ward: 'SHIPPING_CONFIG',
            detailAddress: JSON.stringify(updated),
            isDefault: false,
          },
          { onConflict: 'id' }
        );
      } catch {
        // keep local update
      }
    },
    [role]
  );

  const fetchMethods = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('payment_methods')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) {
        if (__DEV__) console.error('[PAYMENT] Fetch error:', fetchError.message);
      } else if (data && data.length > 0) {
        const rawRows = data as PaymentMethod[];
        const rows = rawRows.map(normalizeBankMethod);
        setMethods(rows);
        saveCachedMethods(rows);

        // Auto-sync legacy bank row on Supabase when authenticated Admin session is active
        const legacyRow = rawRows.find(
          (r) => r.type === 'bank_transfer' && r.account_number === '3387966507'
        );
        if (legacyRow) {
          supabase
            .from('payment_methods')
            .update({
              ...SEPAY_VIETINBANK_CONFIG,
              updated_at: new Date().toISOString(),
            })
            .eq('id', legacyRow.id)
            .then(() => {}, () => {});
        }
      }
    } catch {
      // keep cached/default methods
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
    fetchShippingConfig();
  }, [fetchMethods, fetchShippingConfig]);

  const enabledMethods = methods.filter((m) => m.enabled === true);
  const defaultMethod = methods.find((m) => m.is_default === true) ?? enabledMethods[0];

  const addMethod = useCallback(async (input: PaymentMethodInput) => {
    if (role !== 'admin') return;
    const optimistic: PaymentMethod = {
      ...input,
      id: `pm_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setMethods((prev) => {
      const next = [...prev, optimistic];
      saveCachedMethods(next);
      return next;
    });

    try {
      const { data, error: insertError } = await supabase
        .from('payment_methods')
        .insert(input)
        .select()
        .single();

      if (!insertError && data) {
        setMethods((prev) => {
          const next = prev.map((m) => (m.id === optimistic.id ? (data as PaymentMethod) : m));
          saveCachedMethods(next);
          return next;
        });
      }
    } catch {
      // keep optimistic
    }
  }, [role]);

  const updateMethod = useCallback(async (id: string, data: Partial<PaymentMethod>) => {
    if (role !== 'admin') return;
    const payload = { ...data, updated_at: new Date().toISOString() };
    setMethods((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...data } : m));
      saveCachedMethods(next);
      return next;
    });

    try {
      await supabase.from('payment_methods').update(payload).eq('id', id);
    } catch {
      // ignore
    }
  }, [role]);

  const deleteMethod = useCallback(async (id: string) => {
    if (role !== 'admin') return;
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveCachedMethods(next);
      return next;
    });

    try {
      await supabase.from('payment_methods').delete().eq('id', id);
    } catch {
      // ignore
    }
  }, [role]);

  const setDefault = useCallback(async (id: string) => {
    if (role !== 'admin') return;
    setMethods((prev) => {
      const next = prev.map((m) => ({ ...m, is_default: m.id === id }));
      saveCachedMethods(next);
      return next;
    });

    try {
      await supabase
        .from('payment_methods')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .neq('id', id);
      await supabase
        .from('payment_methods')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch {
      // ignore
    }
  }, [role]);

  const getMethodByType = useCallback(
    (type: PaymentMethodType) =>
      methods.find((m) => m.type === type && m.enabled === true),
    [methods],
  );

  const contextValue = useMemo(
    () => ({
      methods,
      enabledMethods,
      defaultMethod,
      loading,
      error,
      shippingConfig,
      updateShippingConfig,
      addMethod,
      updateMethod,
      deleteMethod,
      setDefault,
      getMethodByType,
    }),
    [
      methods,
      enabledMethods,
      defaultMethod,
      loading,
      error,
      shippingConfig,
      updateShippingConfig,
      addMethod,
      updateMethod,
      deleteMethod,
      setDefault,
      getMethodByType,
    ]
  );

  return (
    <PaymentMethodsContext.Provider value={contextValue}>
      {children}
    </PaymentMethodsContext.Provider>
  );
}

export function usePaymentMethods() {
  const ctx = useContext(PaymentMethodsContext);
  if (!ctx) {
    throw new Error('usePaymentMethods must be used within PaymentMethodsProvider');
  }
  return ctx;
}
