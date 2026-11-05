# Hướng Dẫn Cấu Hình Bảo Mật Cloudflare Cho Tiệm Cuộn Len (`tiemcuonlen.shop`)

Tài liệu này hướng dẫn chi tiết từng thông số cần bật trên bảng điều khiển **Cloudflare Dashboard** để bảo vệ tên miền `tiemcuonlen.shop` và `www.tiemcuonlen.shop` trước các cuộc tấn công DDoS, Bot tự động, AI Scraper và dò quét lỗ hổng.

---

## 1. Cấu Hình DNS Proxy (Ẩn IP Máy Chủ Gốc)

Vào **Cloudflare Dashboard** → chọn tên miền **`tiemcuonlen.shop`** → mục **DNS** → **Records**:

| Loại (Type) | Tên (Name) | Giá trị (Target / Content) | Trạng thái Proxy (Proxy status) | TTL |
| :--- | :--- | :--- | :--- | :--- |
| `A` | `@` | `76.76.21.21` (IP Vercel) | **Proxied (Đám mây màu cam 🟠)** | Auto |
| `CNAME` | `www` | `cname.vercel-dns.com` | **Proxied (Đám mây màu cam 🟠)** | Auto |

> **Lưu ý quan trọng**: Khi bật đám mây màu cam (**Proxied**), toàn bộ lưu lượng truy cập sẽ đi qua tường lửa biên của Cloudflare trước khi tới Vercel, giúp ẩn IP thực và tự động lọc tấn công Layer 3/4/7.

---

## 2. Cấu Hình SSL/TLS & HSTS

Vào mục **SSL/TLS**:

1. **Overview**:
   - Chọn chế độ mã hóa: **`Full (strict)`** *(Tuyệt đối không chọn `Flexible` vì sẽ gây lỗi vòng lặp chuyển hướng với Vercel)*.
2. **Edge Certificates**:
   - **Always Use HTTPS**: `ON` (Bật)
   - **HTTP Strict Transport Security (HSTS)**:
     - Status: `Enable HSTS`
     - Max Age Header (`max-age`): `12 months`
     - Apply HSTS policy to subdomains (`includeSubDomains`): `ON`
     - Preload: `ON`
     - No-Sniff Header: `ON`
   - **Minimum TLS Version**: `TLS 1.2`
   - **TLS 1.3**: `ON`
   - **Automatic HTTPS Rewrites**: `ON`

---

## 3. Cấu Hình Chống Bot & Đảm Bảo Google Search Console Hoạt Động 100% (Security → Bots)

Vào mục **Security** → **Bots** (hoặc **Configure Super Bot Fight Mode**):

| Thông số | Giá trị bắt buộc | Lý do |
| :--- | :--- | :--- |
| **Bot Fight Mode** | **OFF (Tắt)** | Trên gói Free, `Bot Fight Mode` không thể bị bỏ qua bởi Custom WAF Rules và sẽ chặn công cụ **Kiểm tra URL / Yêu cầu lập chỉ mục** cũng như trình nạp `sitemap.xml` của Google Search Console |
| **Block AI Bots** | **OFF (Tắt)** | Nếu bật, Cloudflare sẽ chặn luôn `GoogleOther` / `Google-InspectionTool` của Google |
| **Instruct AI bot traffic with robots.txt (Managed robots.txt)** | **OFF (Tắt)** | Nếu bật, Cloudflare tự động chèn `User-agent: GoogleOther Disallow: /` và dòng `Content-Signal:` không chuẩn vào đầu file `/robots.txt`, làm Google Search Console báo lỗi `Không thể tìm nạp` `sitemap.xml` |
| **JavaScript Detections** | **OFF (Tắt)** | Tránh chặn trình thu thập dữ liệu không chạy JS đầy đủ |

---

## 4. Cấu Hình WAF Custom Rules (Security → WAF → Custom rules)

Vào **Security** → **WAF** → tab **Custom rules** → nhấn **Create rule** để tạo 3 quy tắc bảo vệ sau:

### Quy tắc 1: Cho phép (Skip) Cổng Thanh Toán SePay & Googlebot (Ưu tiên số 1)
Đảm bảo dịch vụ xác nhận chuyển khoản tự động SePay và Google Search Console luôn hoạt động thông suốt:
- **Rule name**: `Allow-SePay-Webhook-And-Googlebot`
- **Nhấn `Edit expression`** và dán:
```txt
(http.request.uri.path eq "/api/sepay-webhook" and http.request.method eq "POST") or (cf.client.bot)
```
- **Action**: `Skip` → tích chọn:
  - `All remaining custom rules`
  - `Rate limiting rules`
  - `Super Bot Fight Mode Rules`

---

### Quy tắc 2: Chặn Ngay Lập Tức Các Công Cụ Dò Quét Lỗ Hổng & Truy Cập File Nhạy Cảm
- **Rule name**: `Block-Scanners-And-Exploit-Tools`
- **Nhấn `Edit expression`** và dán (tương thích 100% gói Free):
```txt
(http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git") or (http.request.uri.path contains "/wp-admin") or (http.request.uri.path contains "/wp-login") or (http.request.uri.path contains "/phpmyadmin") or (http.request.uri.path contains ".php") or (http.request.uri.path contains ".sql") or (http.request.uri.path contains ".bak") or (http.user_agent eq "") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nuclei") or (http.user_agent contains "nmap") or (http.user_agent contains "nikto") or (http.user_agent contains "masscan")
```
- **Action**: **`Block`**

---

### Quy tắc 3: Bật Thử Thách (Managed Challenge) Với Truy Cập Nước Ngoài Vào Trang Đăng Nhập / Thanh Toán / API
- **Rule name**: `Challenge-Suspicious-Auth-And-Checkout`
- **Nhấn `Edit expression`** và dán:
```txt
(http.request.uri.path in {"/login" "/register" "/checkout" "/api/security-audit"}) and (not cf.client.bot) and (ip.src.country ne "VN")
```
- **Action**: **`Managed Challenge`** *(Khách hàng ở nước ngoài hoặc dùng VPN chỉ cần vượt qua xác thực tự động 1 giây của Cloudflare, còn script tấn công tự động sẽ bị chặn đứng)*.

---

## 5. Cấu Hình Giới Hạn Tốc Độ Truy Cập (Security → WAF → Rate limiting rules)

Vào **Security** → **WAF** → tab **Rate limiting rules** → nhấn **Create rule**:

### Rate Limit Rule: Chống Brute-Force Đăng Nhập, Spam Đơn Hàng & Flood API
- **Rule name**: `Rate-Limit-Auth-Checkout-And-API`
- **If incoming requests match** (nhấn `Edit expression`):
```txt
(http.request.uri.path in {"/login" "/register" "/checkout" "/api/security-audit"})
```
- **With the same**: `IP`
- **Requests**: **`20` requests**
- **Period**: **`10 seconds`** (hoặc `60 requests / 1 minute` tùy gói Cloudflare)
- **Then take action**: **`Block`** (hoặc `Managed Challenge`)
- **For duration**: **`10 seconds`** (hoặc `1 minute`)

---

## 6. Cấu Hình Thiết Lập Bảo Mật Chung & Giám Sát Lưu Lượng (Security → Settings & Analytics)

1. **Security → Settings**:
   - **Security Level**: `Medium` (Chuyển sang **`Under Attack!`** ngay lập tức nếu phát hiện lưu lượng DDoS đột biến).
   - **Challenge Passage**: `30 minutes`.
   - **Browser Integrity Check**: `ON` (Kiểm tra tính toàn vẹn HTTP Header của trình duyệt).
2. **Speed → Optimization**:
   - **Auto Minify**: Bật `JavaScript`, `CSS`, `HTML`.
   - **Brotli**: `ON`.
3. **Cách theo dõi & Chặn IP trực tiếp trên Web Tiệm Cuộn Len**:
   - Đăng nhập tài khoản **Quản trị viên (`vohoang1327@gmail.com`)** trên `https://www.tiemcuonlen.shop`.
   - Vào **Hồ sơ** → chọn **Trung tâm Bảo mật & Nhật ký IP (WAF / Audit Log)** (`/privacy`).
   - Tại đây bạn có thể xem chi tiết thời gian thực mọi IP truy cập, nhà mạng, vị trí địa lý, thiết bị, các cảnh báo vượt giới hạn (`RATE_LIMIT_TRIGGERED`) hoặc bẫy Bot (`BOT_TRAP_TRIGGERED`), và bấm **Chặn IP** ngay trên giao diện quản trị.
