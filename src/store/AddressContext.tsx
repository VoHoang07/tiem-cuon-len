import { supabase } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { Address } from '@/types/address';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

const ADDRESSES_CACHE_PREFIX = 'tcl_addresses_v1_';
const ADDRESS_TAGS_CACHE_KEY = 'tcl_address_tags_v1';

function loadAddressTagsMap(): Record<string, 'home' | 'office'> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ADDRESS_TAGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function saveAddressTag(id: string, tag?: 'home' | 'office') {
  if (!id || !tag) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const map = loadAddressTagsMap();
      map[id] = tag;
      window.localStorage.setItem(ADDRESS_TAGS_CACHE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

function loadCachedAddresses(userId: string): Address[] {
  const keyId = userId || 'guest';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`${ADDRESSES_CACHE_PREFIX}${keyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const tagsMap = loadAddressTagsMap();
        if (Array.isArray(parsed)) {
          return (parsed as Address[])
            .filter((a) => !String(a.fullName || '').startsWith('__TCL_'))
            .map((a) => ({
              ...a,
              addressTag: a.addressTag || tagsMap[a.id] || 'home',
            }));
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCachedAddresses(userId: string, items: Address[]) {
  const keyId = userId || 'guest';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${ADDRESSES_CACHE_PREFIX}${keyId}`,
        JSON.stringify(items)
      );
    }
  } catch {
    // ignore
  }
}

function toSupabaseAddressRow(addr: Address) {
  return {
    id: addr.id,
    userId: addr.userId,
    fullName: addr.fullName,
    phone: addr.phone,
    city: addr.city,
    district: addr.district,
    ward: addr.ward,
    detailAddress: addr.detailAddress,
    isDefault: Boolean(addr.isDefault),
  };
}

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
    const activeUserId = user?.id || '';
    const cached = loadCachedAddresses(activeUserId);
    if (cached.length > 0) {
      setAddresses(cached);
    } else if (!activeUserId) {
      setAddresses([]);
      return;
    }

    if (!activeUserId) return;

    const loadAddresses = async () => {
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('id,userId,fullName,phone,city,district,ward,detailAddress,isDefault')
          .eq('userId', activeUserId)
          .neq('fullName', '__TCL_CHAT_V2__');

        if (!error && data) {
          const tagsMap = loadAddressTagsMap();
          const filtered = (data as Address[])
            .filter((a) => !String(a.fullName || '').startsWith('__TCL_'))
            .map((a) => ({
              ...a,
              addressTag: a.addressTag || tagsMap[a.id] || 'home',
            }));

          if (filtered.length > 0 || cached.length === 0) {
            setAddresses(filtered);
            saveCachedAddresses(activeUserId, filtered);
          }
        }
      } catch {
        // Silent fail - keep cached addresses
      }
    };

    loadAddresses();
  }, [user]);

  const userAddresses = addresses;

  const addAddress = useCallback(
    (address: Omit<Address, 'id'>) => {
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

      const newId = `addr_${Date.now()}`;
      const newAddress: Address = {
        ...address,
        id: newId,
        addressTag: address.addressTag || 'home',
      };
      saveAddressTag(newId, newAddress.addressTag);

      setAddresses((prev) => {
        const baseList = newAddress.isDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : prev;
        const next = [...baseList, newAddress];
        saveCachedAddresses(address.userId, next);
        return next;
      });

      if (address.userId) {
        if (newAddress.isDefault) {
          supabase
            .from('addresses')
            .update({ isDefault: false })
            .neq('id', newId)
            .eq('userId', address.userId)
            .then(() => {}, () => {});
        }
        supabase
          .from('addresses')
          .insert(toSupabaseAddressRow(newAddress))
          .then(({ error }) => {
            if (error && __DEV__)
              console.error('[SUPABASE] Lỗi thêm địa chỉ:', error.message);
          }, () => {});
      }
      return true;
    },
    [addresses]
  );

  const updateAddress = useCallback(
    (id: string, data: Partial<Address>) => {
      const activeUserId = user?.id ?? '';
      if (data.addressTag) {
        saveAddressTag(id, data.addressTag);
      }

      setAddresses((prev) => {
        const next = prev.map((a) => {
          if (a.id === id) return { ...a, ...data };
          if (data.isDefault) return { ...a, isDefault: false };
          return a;
        });
        saveCachedAddresses(activeUserId, next);
        return next;
      });

      if (activeUserId) {
        const dbPatch: Record<string, unknown> = {};
        const allowedCols = [
          'fullName',
          'phone',
          'city',
          'district',
          'ward',
          'detailAddress',
          'isDefault',
        ] as const;
        for (const col of allowedCols) {
          if (data[col] !== undefined) {
            dbPatch[col] = data[col];
          }
        }
        if (data.isDefault) {
          supabase
            .from('addresses')
            .update({ isDefault: false })
            .neq('id', id)
            .eq('userId', activeUserId)
            .then(() => {}, () => {});
        }
        if (Object.keys(dbPatch).length > 0) {
          supabase
            .from('addresses')
            .update(dbPatch)
            .eq('id', id)
            .eq('userId', activeUserId)
            .then(({ error }) => {
              if (error && __DEV__)
                console.error('[SUPABASE] Lỗi sửa địa chỉ:', error.message);
            }, () => {});
        }
      }
    },
    [user]
  );

  const removeAddress = useCallback(
    (id: string) => {
      const activeUserId = user?.id ?? '';
      setAddresses((prev) => {
        const next = prev.filter((a) => a.id !== id);
        saveCachedAddresses(activeUserId, next);
        return next;
      });

      if (activeUserId) {
        supabase
          .from('addresses')
          .delete()
          .eq('id', id)
          .eq('userId', activeUserId)
          .then(({ error }) => {
            if (error && __DEV__)
              console.error('[SUPABASE] Lỗi xoá địa chỉ:', error.message);
          }, () => {});
      }
    },
    [user]
  );

  const setDefaultAddress = useCallback(
    (id: string) => {
      const activeUserId = user?.id ?? '';
      setAddresses((prev) => {
        const next = prev.map((a) => ({ ...a, isDefault: a.id === id }));
        saveCachedAddresses(activeUserId, next);
        return next;
      });

      if (activeUserId) {
        supabase
          .from('addresses')
          .update({ isDefault: false })
          .neq('id', id)
          .eq('userId', activeUserId)
          .then(({ error }) => {
            if (error && __DEV__)
              console.error('[SUPABASE] Lỗi reset default địa chỉ:', error.message);
          }, () => {});
        supabase
          .from('addresses')
          .update({ isDefault: true })
          .eq('id', id)
          .then(({ error }) => {
            if (error && __DEV__)
              console.error('[SUPABASE] Lỗi set default địa chỉ:', error.message);
          }, () => {});
      }
    },
    [user]
  );

  const getDefaultAddress = useCallback(
    () => userAddresses.find((a) => a.isDefault) ?? userAddresses[0],
    [userAddresses]
  );

  const removeDuplicates = useCallback(() => {
    let removedCount = 0;
    const activeUserId = user?.id ?? '';
    setAddresses((prev) => {
      const seen = new Map<string, Address>();
      const result: Address[] = [];
      for (const addr of prev) {
        const key = `${addr.userId}::${addr.fullName}::${addr.phone}::${addr.city}::${addr.district}::${addr.ward}::${addr.detailAddress}`;
        if (seen.has(key)) {
          removedCount++;
          if (activeUserId) {
            supabase
              .from('addresses')
              .delete()
              .eq('id', addr.id)
              .then(({ error }) => {
                if (error && __DEV__)
                  console.error('[SUPABASE] Lỗi xoá địa chỉ trùng:', error.message);
              }, () => {});
          }
          continue;
        }
        seen.set(key, addr);
        result.push(addr);
      }
      saveCachedAddresses(activeUserId, result);
      return result;
    });
    return removedCount;
  }, [user]);

  const contextValue = useMemo(
    () => ({
      addresses,
      userAddresses,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      getDefaultAddress,
      removeDuplicates,
    }),
    [
      addresses,
      userAddresses,
      addAddress,
      updateAddress,
      removeAddress,
      setDefaultAddress,
      getDefaultAddress,
      removeDuplicates,
    ]
  );

  return (
    <AddressContext.Provider value={contextValue}>
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
