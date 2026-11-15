# HANDOFF.md — Tài Liệu Bàn Giao Kỹ Thuật & Trạng Thái Phiên Làm Việc (`tiemcuonlen.shop`)

> **Dự án:** Tiệm Cuộn Len Handmade (`VoHoang07/tiem-cuon-len`)
> **Production Domain:** `https://www.tiemcuonlen.shop`
> **Cập nhật lần cuối:** `commit a957b5b` (cùng bản cập nhật `HANDOFF.md` hiện tại trên nhánh `main`)
> **Mục tiêu kế tiếp ngay khi mở phiên Chat mới:** Triển khai kiến trúc **Tách Kho Ảnh sang Cloudflare R2 (`media.tiemcuonlen.shop` — Băng thông Egress vô hạn 0₫) + Chuyển sang 1 Project Supabase Mới chỉ lưu Text/JSON siêu nhẹ (0% Base64 trong DB)** để chấm dứt vĩnh viễn lỗi `402 exceed_egress_quota`.

---

## 1. Tóm Tắt Toàn Bộ Những Gì Đã Hoàn Thành & Đã Push Lên `main`

1. **Hồ Sơ Khách Truy Cập & Nhật Ký Bảo Mật (`src/app/privacy.tsx`, `src/utils/securityGuard.ts`, `api/security-audit.js` — `commit f06e701`):**
   - Cấp `visitorId` cố định (`vis_XXXX`), nối danh tính tự động (Identity Stitching) với Tên, SĐT, Gmail khi khách đăng nhập/chat/đặt hàng.
   - Ghi nhận hành trình mua sắm chi tiết: xem sản phẩm nào (`PRODUCT_VIEW`), đứng xem bao lâu (`PRODUCT_ENGAGED`), thêm/xoá giỏ hàng (`CART_ADD_ITEM`), mở chat, vào thanh toán (`CHECKOUT_STARTED`), đặt đơn (`CHECKOUT_ORDER_CREATED`).
   - Tự động lọc bỏ lượt truy cập của Admin khỏi thống kê khách thật.

2. **Tính Giá Động Combo + Khóa Chống Lỗ Voucher + Thưởng Khui Hàng 60k Qua Chat (`commit 8c08ac3` & `53ebe6d`):**
   - **Giá động theo cặp mẫu thực tế (`src/utils/comboPricing.ts`, `src/data/comboCatalog.ts`, `api/_securityCore.js`, `api/orders-guard.js`):** Mọi gói Combo 2 mẫu (Twinkle 179k vs 249k, Hoa Hồng 159k/279k/359k, Cừu Bông, Donut...) tự tính tổng từ đúng giá lẻ `slot1 + slot2` rồi giảm ưu đãi Combo (~7.5%), đồng bộ cả 4 tầng (Trang SP, Giỏ hàng, Mua ngay, Server).
   - **Chặn cộng dồn Voucher lên Combo (`computeRetailEligibleSubtotal`):** Mọi mã giảm giá chỉ tính trên phần sản phẩm mua lẻ nguyên giá (`eligibleRetailSubtotal`), không trừ chồng lên gói Combo.
   - **Bộ Voucher Hướng 2 khóa 1 lần:**
     - `TIEMLEN10K`: `-10.000₫` cho đơn lẻ đầu tiên `>= 159.000₫` (chỉ khách mới chưa từng có đơn hoàn tất).
     - Mốc `>= 299.000₫`: Chỉ hưởng Freeship `0₫`, không trừ chồng thêm tiền mặt.
     - `VIP20K`: `-20.000₫` cho đơn lẻ `>= 399.000₫` (mỗi khách dùng 1 lần).
   - **2 Mục Nhận Thưởng Sau Khi Nhận Hàng (`/orders/[id].tsx` + `ShopChatWidget.tsx`):**
     - **Mục 1 (`VD25-XXXXXX` — Gói Quà 60.000₫):** Quay Video/Story khui hàng đăng FB/IG/TikTok kèm tên & link `tiemcuonlen.shop` -> Gửi đánh giá + ảnh màn hình vào Chat -> Admin bấm duyệt 1 chạm -> Cấp mã riêng khóa `HMAC-SHA256` 1-1 theo tài khoản (vừa giảm `-25.000₫` vừa mở thanh chọn `01` sản phẩm `<= 35.000₫` của shop giá `0₫`, tự nhắc Admin bỏ quà trên phiếu đóng hàng).
     - **Mục 2 (`FB15-XXXXXX` — Voucher `-15.000₫`):** Follow Fanpage FB + Share bài công khai -> Gửi ảnh màn hình vào Chat -> Admin bấm duyệt cấp mã riêng `-15.000₫` (đơn lẻ `>= 119.000₫`).

3. **Theo Dõi Hành Trình Đơn Hàng + Tiến Độ Đan 5–6 Ngày + Goship SPX + Khóa Chặt Đơn QR Chưa Thanh Toán (`commit a957b5b`):**
   - **Khách đã đăng nhập:** Vào `/orders` tự động hiện toàn bộ đơn ngay lập tức.
   - **Khách chưa đăng nhập:** Mở `/orders` hiện khung tra cứu nhanh bằng **Số điện thoại nhận hàng** hoặc **Mã đơn `CUONLEN-...`** (tự che bớt số nhà & họ tên để bảo mật).
   - **Giai đoạn đang đan (5–6 ngày):** Hiện thanh tiến độ xưởng đan + Ngày dự kiến gửi SPX; Admin có 4 nút bấm 1 chạm cập nhật tiến độ mà **không tự động gọi Shipper**.
   - **Giai đoạn gửi hàng (`api/shipping-tracker.js`):** Chỉ khi Admin đan xong và chủ động bấm xác nhận 2 bước mới tạo đơn SPX qua Goship API (hoặc nhận tự động qua Goship Webhook `/api/shipping-tracker?webhook=goship`), kèm hiển thị trực tiếp các trạm bưu cục SPX.
   - **Sửa 2 lỗi quan trọng:**
     1. Bổ sung đầy đủ icon `Gift` trong `src/app/orders/[id].tsx` (sửa lỗi trắng màn hình khi xem đơn `Hoàn thành`).
     2. Khóa chặt mọi đơn chuyển khoản `pending_payment`: hiển thị cảnh báo đỏ `⛔ CHƯA CHUYỂN KHOẢN`, ẩn nút Chép đơn Ship, loại khỏi CSV Goship và chặn tạo vận đơn SPX thu hộ `0₫` khi SePay chưa xác nhận tiền về.

---

## 2. Chẩn Đoán Sự Cố Hiện Tại & Kế Hoạch Chuyển Đổi Kiến Trúc Ở Phiên Chat Mới

### 2.1. Nguyên nhân gốc khiến Project Supabase cũ (`ajxvqewsqvfdpovkqqqw`) bị khóa `402`
- Đã kiểm tra trực tiếp HTTP response từ Supabase: `"Service for this project is restricted due to the following violations: exceed_egress_quota"`.
- Dung lượng lưu trữ DB thực tế rất nhỏ, nhưng các dòng `products.image`, `products.tags` (`__tcl_variants_v1__`), `addresses` (`tcl_rescue_*`) và ảnh chụp màn hình trong Chat đang lưu **chuỗi ảnh `data:image/...;base64` nặng nhiều MB** trực tiếp trong PostgreSQL -> làm cạn sạch `5GB Egress/tháng` của gói Free.

### 2.2. Kiến trúc mục tiêu cần code ngay khi người dùng gửi Keys ở phiên mới
1. **Kho Ảnh Riêng Biệt trên Cloudflare R2 (`https://media.tiemcuonlen.shop`):**
   - Lưu trữ miễn phí `10GB`, **băng thông tải ảnh ra (Egress) = MIỄN PHÍ VÔ HẠN (`0₫`)**.
   - Tạo API route mới `api/media-upload.js` (bọc `withGlobalErrorHandler`, `stripUnknownFieldsServer`, `sanitizeTextServer`, ký AWS Signature V4 S3-compatible bằng `crypto` chuẩn của Node.js không cần cài thư viện nặng) để:
     - Khi Admin đăng/sửa ảnh sản phẩm trong `ProductStudioForm.tsx` -> Upload thẳng file WebP lên R2 -> Trả về URL ngắn `https://media.tiemcuonlen.shop/products/<uuid>.webp`.
     - Khi Khách tải ảnh chụp màn hình nhận thưởng Voucher trong `/orders/[id].tsx` -> Upload lên R2 -> Trả về URL ngắn `https://media.tiemcuonlen.shop/proofs/<uuid>.jpg`.
2. **Project Supabase Mới — 100% Chỉ Lưu Chữ Siêu Nhẹ (Zero Base64 Policy):**
   - Cập nhật URL & Key mới tại `src/services/supabase.ts` và `api/_securityCore.js`.
   - Chặn tuyệt đối việc ghi bất kỳ chuỗi `data:image/` Base64 nào vào `public.products`, `public.addresses` (`tcl_rescue_*`, `__TCL_CHAT_V2__`) hay `public.orders` — mọi trường ảnh trong Supabase chỉ lưu đường dẫn URL ngắn (`< 120 bytes`).
   - File SQL khởi tạo trọn gói đã sẵn sàng 100% tại: `supabase/migrations/20261106_new_project_all_in_one.sql` (đã bao gồm RLS cho cả `__TCL_PERSONAL_VOUCHER_V1__` và `__TCL_GOSHIP_CONFIG_V1__`).

### 2.3. Danh sách Biến Môi Trường Người Dùng Sẽ Cung Cấp Ở Đầu Phiên Mới
- **Từ Supabase mới (3 giá trị):**
  1. `EXPO_PUBLIC_SUPABASE_URL`
  2. `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  3. `SUPABASE_SERVICE_ROLE_KEY`
- **Từ Cloudflare R2 (5 giá trị):**
  1. `R2_ACCOUNT_ID`
  2. `R2_ACCESS_KEY_ID`
  3. `R2_SECRET_ACCESS_KEY`
  4. `R2_BUCKET_NAME` (ví dụ: `tiemcuonlen-media`)
  5. `R2_PUBLIC_BASE_URL` (ví dụ: `https://media.tiemcuonlen.shop`)
