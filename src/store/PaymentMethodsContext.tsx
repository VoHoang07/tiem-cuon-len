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

const PAYMENT_CACHE_KEY = 'tcl_payment_methods_v1';

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_cod_default',
    type: 'cod',
    title: 'Thanh toán khi nhận hàng (COD)',
    enabled: true,
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '8aac533d-cbf5-4dc4-8b02-6823834f6083',
    type: 'bank_transfer',
    title: 'Chuyển khoản ngân hàng',
    enabled: true,
    is_default: true,
    bank_name: 'Vietcombank',
    account_name: 'VO VU MINH HOANG',
    account_number: '3387966507',
    transfer_prefix: 'CUONLEN',
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'pm_momo_default',
    type: 'momo',
    title: 'Ví điện tử MoMo',
    enabled: true,
    is_default: false,
    account_name: 'Tiệm Cuộn Len',
    phone_number: '0909123456',
    created_at: '2026-01-03T00:00:00Z',
  },
];

function loadCachedMethods(): PaymentMethod[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(PAYMENT_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as PaymentMethod[];
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
        const rows = data as PaymentMethod[];
        setMethods(rows);
        saveCachedMethods(rows);
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
