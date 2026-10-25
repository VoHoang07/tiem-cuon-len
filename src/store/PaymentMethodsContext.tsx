import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { PaymentMethod, PaymentMethodInput, type PaymentMethodType } from '@/types/payment-method';
import { supabase } from '@/services/supabase';

const PAYMENT_CACHE_KEY = 'tcl_payment_methods_v3';

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
  addMethod: (input: PaymentMethodInput) => Promise<void>;
  updateMethod: (id: string, data: Partial<PaymentMethod>) => Promise<void>;
  deleteMethod: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  getMethodByType: (type: PaymentMethodType) => PaymentMethod | undefined;
}

const PaymentMethodsContext = createContext<PaymentMethodsContextType | null>(null);

export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const [methods, setMethods] = useState<PaymentMethod[]>(() => loadCachedMethods());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [fetchMethods]);

  const enabledMethods = methods.filter((m) => m.enabled === true);
  const defaultMethod = methods.find((m) => m.is_default === true) ?? enabledMethods[0];

  const addMethod = useCallback(async (input: PaymentMethodInput) => {
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
  }, []);

  const updateMethod = useCallback(async (id: string, data: Partial<PaymentMethod>) => {
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
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
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
  }, []);

  const setDefault = useCallback(async (id: string) => {
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
  }, []);

  const getMethodByType = useCallback(
    (type: PaymentMethodType) =>
      methods.find((m) => m.type === type && m.enabled === true),
    [methods],
  );

  return (
    <PaymentMethodsContext.Provider
      value={{
        methods,
        enabledMethods,
        defaultMethod,
        loading,
        error,
        addMethod,
        updateMethod,
        deleteMethod,
        setDefault,
        getMethodByType,
      }}>
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
