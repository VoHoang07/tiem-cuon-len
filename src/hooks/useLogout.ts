import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { PROF_LOGOUT, PROF_LOGOUT_TITLE, PROF_LOGOUT_CONFIRM } from '@/constants/strings';

export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    const performLogout = async () => {
      try {
        await logout();
      } finally {
        router.replace('/');
      }
    };

    if (Platform.OS === 'web') {
      // Trên Web & Mobile Safari/WebView (Zalo, Messenger, Chrome Mobile), window.confirm thường bị chặn làm kẹt nút Đăng xuất.
      // Thực thi đăng xuất trực tiếp ngay khi người dùng bấm nút Đăng xuất.
      void performLogout();
    } else {
      Alert.alert(PROF_LOGOUT_TITLE, PROF_LOGOUT_CONFIRM, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: PROF_LOGOUT,
          style: 'destructive',
          onPress: () => {
            void performLogout();
          },
        },
      ]);
    }
  };

  return { handleLogout };
}
