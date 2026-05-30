import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Address } from '@/types/address';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';

interface AddressContextType {
  addresses: Address[];
  userAddresses: Address[];
  addAddress: (address: Omit<Address, 'id'>) => boolean;
  updateAddress: (id: string, data: Partial<Address>) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  getDefaultAddress: () => Address | undefined;
  removeDuplicates: () => number;
}

const AddressContext = createContext<AddressContextType | null>(null);

export function AddressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    if (!user || !user.id) {
      setAddresses([]);
      return;
    }

    const loadAddresses = async () => {
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('userId', user.id);

        if (!error && data) setAddresses(data as Address[]);
      } catch {
        // Silent fail - no addresses loaded
      }
    };

    loadAddresses();
  }, [user]);

  const userAddresses = addresses;

  const addAddress = useCallback((address: Omit<Address, 'id'>) => {
    const duplicate = addresses.find(
      (a) =>
        a.userId === address.userId &&
        a.fullName === address.fullName &&
        a.phone === address.phone &&
        a.city === address.city &&
        a.district === address.district &&
        a.ward === address.ward &&
        a.detailAddress === address.detailAddress
    );
    if (duplicate) return false;

    const newAddress: Address = { ...address, id: `addr_${Date.now()}` };
    setAddresses((prev) => [...prev, newAddress]);

    supabase.from('addresses').insert(newAddress).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi thêm địa chỉ:', error.message);
    });
    return true;
  }, [addresses]);

  const updateAddress = useCallback((id: string, data: Partial<Address>) => {
    setAddresses((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));

    supabase.from('addresses').update(data).eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi sửa địa chỉ:', error.message);
    });
  }, []);

  const removeAddress = useCallback((id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));

    supabase.from('addresses').delete().eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá địa chỉ:', error.message);
    });
  }, []);

  const setDefaultAddress = useCallback((id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, isDefault: a.id === id }))
    );

    const userId = user?.id ?? '';
    supabase.from('addresses').update({ isDefault: false }).neq('id', id).eq('userId', userId).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi reset default địa chỉ:', error.message);
    });
    supabase.from('addresses').update({ isDefault: true }).eq('id', id).then(({ error }) => {
      if (error && __DEV__) console.error('[SUPABASE] Lỗi set default địa chỉ:', error.message);
    });
  }, [user]);

  const getDefaultAddress = useCallback(
    () => userAddresses.find((a) => a.isDefault) ?? userAddresses[0],
    [userAddresses]
  );

  const removeDuplicates = useCallback(() => {
    let removedCount = 0;
    setAddresses((prev) => {
      const seen = new Map<string, Address>();
      const result: Address[] = [];
      for (const addr of prev) {
        const key = `${addr.userId}::${addr.fullName}::${addr.phone}::${addr.city}::${addr.district}::${addr.ward}::${addr.detailAddress}`;
        if (seen.has(key)) {
          removedCount++;
          supabase.from('addresses').delete().eq('id', addr.id).then(({ error }) => {
            if (error && __DEV__) console.error('[SUPABASE] Lỗi xoá địa chỉ trùng:', error.message);
          }, () => {});
          continue;
        }
        seen.set(key, addr);
        result.push(addr);
      }
      return result;
    });
    return removedCount;
  }, []);

  return (
    <AddressContext.Provider
      value={{
        addresses,
        userAddresses,
        addAddress,
        updateAddress,
        removeAddress,
        setDefaultAddress,
        getDefaultAddress,
        removeDuplicates,
      }}>
      {children}
    </AddressContext.Provider>
  );
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) {
    throw new Error('useAddresses must be used within AddressProvider');
  }
  return ctx;
}
