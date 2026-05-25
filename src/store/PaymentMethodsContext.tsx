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
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('payment_methods')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[PAYMENT] Fetch error:', fetchError.message);
      setError(fetchError.message);
      setMethods([]);
    } else if (data) {
      setMethods(data as PaymentMethod[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const enabledMethods = methods.filter((m) => m.enabled === true);
  const defaultMethod = methods.find((m) => m.is_default === true) ?? enabledMethods[0];

  const addMethod = useCallback(async (input: PaymentMethodInput) => {
    const { data, error: insertError } = await supabase
      .from('payment_methods')
      .insert(input)
      .select()
      .single();

    if (insertError) {
      console.error('[PAYMENT] Add error:', insertError.message);
      return;
    }
    if (data) setMethods((prev) => [...prev, data as PaymentMethod]);
  }, []);

  const updateMethod = useCallback(async (id: string, data: Partial<PaymentMethod>) => {
    const payload = { ...data, updated_at: new Date().toISOString() };

    const { error: updateError } = await supabase
      .from('payment_methods')
      .update(payload)
      .eq('id', id);

    if (updateError) {
      console.error('[PAYMENT] Update error:', updateError.message);
      return;
    }
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  }, []);

  const deleteMethod = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[PAYMENT] Delete error:', deleteError.message);
      return;
    }
    setMethods((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const setDefault = useCallback(async (id: string) => {
    // Unset previous default
    await supabase
      .from('payment_methods')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .neq('id', id);

    // Set new default
    const { error: setDefaultError } = await supabase
      .from('payment_methods')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (setDefaultError) {
      console.error('[PAYMENT] Set default error:', setDefaultError.message);
      return;
    }

    setMethods((prev) =>
      prev.map((m) => ({ ...m, is_default: m.id === id }))
    );
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
