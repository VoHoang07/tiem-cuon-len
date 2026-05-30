import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { PROF_LOGOUT, PROF_LOGOUT_TITLE, PROF_LOGOUT_CONFIRM } from '@/constants/strings';

export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    const performLogout = async () => {
      await logout();
      router.replace('/login');
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // window.confirm hoạt động ổn định trên web hơn Alert.alert
      if (window.confirm(PROF_LOGOUT_CONFIRM)) {
        performLogout();
      }
    } else {
      Alert.alert(PROF_LOGOUT_TITLE, PROF_LOGOUT_CONFIRM, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: PROF_LOGOUT,
          style: 'destructive',
          onPress: performLogout,
        },
      ]);
    }
  };

  return { handleLogout };
}
