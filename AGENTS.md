# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# QUY TẮC ĐỒNG BỘ TOÀN DIỆN (CLIENT + ADMIN & DESKTOP + MOBILE)

Khi thực hiện bất kỳ chỉnh sửa nào trong dự án Tiệm Cuộn Len:
1. **Đồng bộ cả Client và Admin**: Luôn cập nhật đồng bộ cả luồng Khách hàng (`customer`) và Quản trị (`admin`) trong cùng 1 lần sửa.
2. **Đồng bộ cả Web Máy tính và Điện thoại**:
   - Kiểm tra và tối ưu bố cục cho cả màn hình Desktop (`>= 768px`) lẫn Mobile (`< 640px`, chiều rộng `360px–430px`).
   - Trên Mobile: căn lề chuẩn (`paddingHorizontal: 12`), dùng `flexWrap: 'wrap'` hoặc thu gọn các hàng nút (`actionsRow`, `priceRow`, `headerActions`), dùng `minWidth: 0` cho `TextInput` trong hàng ngang, và đảm bảo không có phần tử nào bị tràn mép phải hoặc bị `BottomNav` che khuất.
