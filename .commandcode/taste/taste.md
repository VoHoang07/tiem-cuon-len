# expo
- Target Expo SDK 54 (Expo Go on device is version 54.0.6). Confidence: 0.75
- Guard browser-only APIs (window/document) with `Platform.OS === "web"` check; use AppState from react-native for native app lifecycle events instead. Confidence: 0.80

# communication
- Trả lời bằng tiếng Việt. Confidence: 0.70

# layout
- Use shared constants file `src/constants/layout.ts` for layout values (e.g., TAB_BAR_CONTENT_HEIGHT, TAB_BAR_SAFE_PADDING) instead of importing from component files. Confidence: 0.70

# navigation
- Dùng Expo Router Tabs layout hoặc position BottomNav absolute thay vì render <BottomNav /> riêng trong từng màn hình để tránh tab bar render lại mỗi lần chuyển màn hình và scroll theo nội dung. Confidence: 0.70

# performance
- Dùng FlatList thay vì ScrollView cho các danh sách dài (sản phẩm, đơn hàng, địa chỉ) để có virtualization và hiệu năng native. Confidence: 0.70

# gestures
- Thêm swipe-to-delete và swipe actions cho cart items, orders để tăng native feel. Khi dùng Swipeable từ react-native-gesture-handler, cần bọc root layout bằng GestureHandlerRootView. Confidence: 0.75

# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

