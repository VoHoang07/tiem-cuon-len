---
name: full-sync-responsive
description: >-
  Đồng bộ toàn diện giữa Client (Khách hàng) và Admin (Quản trị), đồng thời tối ưu
  responsive giao diện trên cả Web Máy tính (Desktop) và Điện thoại (Mobile).
---

# Quy trình Đồng bộ Client ↔ Admin & Desktop ↔ Mobile

Khi thêm tính năng, sửa giao diện hoặc sửa lỗi trên Tiệm Cuộn Len, LUÔN thực hiện đồng loạt trên cả 4 chiều:

## 1. Đồng bộ Client (Khách hàng) & Admin (Chủ tiệm)
- Mọi thay đổi về dữ liệu sản phẩm (giá, phân loại màu, ảnh từng màu, phụ kiện kèm giá, trạng thái `Sản phẩm Order` / `Có sẵn`), đơn hàng, giỏ hàng và tin nhắn phải cập nhật tức thời trên cả giao diện Admin lẫn Client qua Supabase & Context.
- Giao diện Admin cần có bố cục tương đồng trực quan với trang hiển thị của Client (WYSIWYG), tránh form nhập liệu rời rạc.

## 2. Đồng bộ Web Máy tính (Desktop >= 768px) & Điện thoại (Mobile < 640px)
- **Căn lề chuẩn trên điện thoại**:
  - Container ngoài trên điện thoại dùng `paddingHorizontal: 12` (không dùng lề kép 20px + 20px gây hẹp nội dung).
  - Khoảng đệm đáy (`paddingBottom: 110`) để không bao giờ bị thanh `BottomNav` hoặc nút Chat nổi che khuất.
- **Chống tràn ngang (Zero Horizontal Overflow)**:
  - Mọi hàng nút thao tác (`actionsRow`, `headerActions`, `pillWrap`, `priceRow`) trên điện thoại phải có `flexWrap: 'wrap'` hoặc giới hạn số nút để không bị cắt mất nút ở mép phải.
  - Ô nhập liệu (`TextInput`) nằm trong `flexDirection: 'row'` phải có `flex: 1, minWidth: 0`.
  - Tiêu đề trang (`headerTitle`) trên điện thoại dùng cỡ chữ gọn (`15px–17px`), `numberOfLines={1}` để không bị rớt dòng làm lệch thanh điều hướng.
