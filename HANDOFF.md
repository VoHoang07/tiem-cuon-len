# HANDOFF.md — Tài Liệu Bàn Giao Kỹ Thuật & Trạng Thái Phiên Làm Việc (`tiemcuonlen.shop`)

> **Dự án:** Tiệm Cuộn Len Handmade (`VoHoang07/tiem-cuon-len`)
> **Production Domain:** `https://www.tiemcuonlen.shop`
> **Cập nhật lần cuối:** Đã hoàn tất chuyển đổi kiến trúc **Cloudflare R2 (`api/media-upload.js` + `https://media.tiemcuonlen.shop`) + Supabase Mới Zero-Base64 + Zero-Hardcoded-Secret** trên nhánh `main`.
> **Trạng thái hiện tại:** Toàn bộ 8 biến môi trường (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`) đã được cấu hình trực tiếp trên Vercel Dashboard và kết nối thành công.

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

4. **Khôi Phục Đơn Hàng Cũ Đa UUID + Tab "Đánh Giá" Sau "Hoàn Thành" + Bảng Màu TMĐT Gọn Mắt (`commit 17984c0`, `d8173a7`, `8389864`):**
   - **Tự động giải cứu đơn hàng cũ (`src/store/OrderContext.tsx`, `api/orders-guard.js`):** Quét toàn bộ kho lưu trữ trình duyệt (`tcl_orders_cache_v2_*`, `tcl_orders_permanent_vault_v1`, `tcl_guest_tracked_orders_v1`, `tcl_security_audit_logs_v1`) qua mọi UUID cũ và tự đẩy lên Supabase mới (`action: 'rescue_orders'`), kèm nút nhập file CSV/JSON cho Admin.
   - **Tối giản khu vực Nhận thưởng & Tab "Đánh giá" riêng (`src/app/orders/index.tsx`, `src/app/orders/[id].tsx`):** Bỏ phần chấm sao/chạm từ khóa rườm rà trong thẻ nhận quà, dùng bảng màu TMĐT hiện đại (`#FFFFFF`, `#F8FAFC`, `#EE4D2D`, `#059669`), và tách riêng mục **"Đánh giá"** nằm ngay sau **"Hoàn thành"** trên cả thanh lọc `/orders` lẫn tiến trình 5 bước `/orders/[id]`.

5. **Thẻ Chia Sẻ Sản Phẩm Động OpenGraph (`og:image`, `og:title`) + Đồng Bộ Email `tiemcuonlen@gmail.com` + Hotline `0775111750` + Sửa Lỗi Chuyển Trạng Thái Đơn Hàng (`commit 6597392`, `7a52419`, `71730a6`, `adb5e54`, `49490d3`):**
   - **OpenGraph động theo từng sản phẩm & phân loại (`vercel.json`, `api/_securityCore.js`, `api/media-upload.js`, `src/app/product/[id].tsx`):** Khi chia sẻ link `/product/[id]?s=...` lên Facebook, Zalo, Messenger, bot MXH đọc đúng ảnh `1200x1200`, tên sản phẩm/phân loại và giá tiền thực tế thay vì ảnh logo chung của shop.
   - **Đồng bộ Gmail & Hotline/Zalo chính thức (`tiemcuonlen@gmail.com` & `0775111750`):** Thêm `tiemcuonlen@gmail.com` làm email Quản trị viên & nhận thông báo đơn hàng chính; thiết kế lại trang `/help` gọn mắt theo đúng quy trình mới và bổ sung mục **Tuyên bố quyền sở hữu & quyền tác giả** tại `/privacy` để dán vào Fanpage Facebook.
   - **Sửa triệt để lỗi chuyển trạng thái đơn hàng (`commit 49490d3`):** Ngăn `syncedPatchesMap` / `syncedOrderPatch` từ Goship ghi đè trạng thái vừa bấm chuyển, tự động duy trì Server Admin JWT (`ensureServerAdminJwt`) trong `api/_securityCore.js`, và tự động cầu nối GoTrue session (`ensureClientSupabaseAuthHeaders`) + khóa `recentStatusOverridesRef` trong `OrderContext.tsx`.

---

## 2. Kiến Trúc Tách Kho Ảnh Cloudflare R2 + Supabase Zero-Base64 (ĐÃ TRIỂN KHAI HOÀN TẤT)

### 2.1. Nguyên nhân sự cố cũ đã xử lý dứt điểm
- Project Supabase cũ từng bị giới hạn `402 exceed_egress_quota` do lưu chuỗi ảnh `data:image/...;base64` nhiều MB trực tiếp vào PostgreSQL.

### 2.2. Kiến trúc mới đang chạy Production (ZERO-SECRET & ZERO-BASE64)
> **🛡️ QUY TẮC BẢO MẬT ZERO-SECRET:** Toàn bộ URL & Secret Key được quản lý trực tiếp trên **Vercel Dashboard → Settings → Environment Variables** (tuyệt đối không gán cứng vào mã nguồn hay dán lên khung Chat).

1. **Kho Ảnh Đám Mây Cloudflare R2 (`https://media.tiemcuonlen.shop` — `api/media-upload.js`):**
   - Lưu trữ miễn phí `10GB`, **băng thông tải ảnh ra (Egress) = MIỄN PHÍ VÔ HẠN (`0₫`)**.
   - `api/media-upload.js` bọc đầy đủ `withGlobalErrorHandler`, `stripUnknownFieldsServer`, `sanitizeTextServer`, CSRF check, Rate Limit, kiểm tra Magic Bytes nhị phân và ký AWS Signature V4 S3-compatible bằng `crypto` chuẩn của Node.js:
     - Ảnh sản phẩm Admin (`ProductStudioForm.tsx`, `ProductContext.tsx`) -> Upload WebP lên `products/<uuid>.webp` -> Trả về URL ngắn `https://media.tiemcuonlen.shop/products/<uuid>.webp`.
     - Ảnh chụp màn hình nhận thưởng Voucher (`src/app/orders/[id].tsx`) -> Upload lên `proofs/<uuid>.jpg` -> Trả về URL ngắn `https://media.tiemcuonlen.shop/proofs/<uuid>.jpg`.
   - `Content-Security-Policy` (`img-src`, `connect-src`) trong `vercel.json` đã mở cho `https://media.tiemcuonlen.shop` và `https://*.supabase.co`.
2. **Project Supabase Mới — 100% Đọc Từ `process.env` & Chỉ Lưu Chữ Siêu Nhẹ (Zero Base64):**
   - Đã gỡ bỏ hoàn toàn các chuỗi fallback URL/Key cứng cũ trong `src/services/supabase.ts` và `api/_securityCore.js`.
   - Đã chặn tuyệt đối việc ghi bất kỳ chuỗi `data:image/` Base64 nào vào `public.products`, `public.addresses` (`tcl_rescue_*`, `__TCL_CHAT_V2__`) và `public.orders`.

### 2.3. Tên Đúng Của 8 Biến Môi Trường (Người Dùng Tự Nhập Trên Vercel Dashboard — KHÔNG GỬI LÊN CHAT)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (điền: `tiemcuonlen-media`)
- `R2_PUBLIC_BASE_URL` (điền: `https://media.tiemcuonlen.shop`)
