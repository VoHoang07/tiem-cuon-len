-- ============================================
-- Tiệm Cuộn Len – Supabase SQL Schema
-- Chạy trong SQL Editor của Supabase
-- ============================================

-- 1. Bảng profiles (tự động tạo bởi Supabase Auth)
-- Không cần tạo, Supabase đã có bảng auth.users

-- 2. Bảng products
CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL CHECK (price > 0),
  image       TEXT,
  category    TEXT NOT NULL DEFAULT 'Crochet',
  material    TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '',
  quantity    INTEGER NOT NULL DEFAULT 1,
  rating      REAL NOT NULL DEFAULT 0,
  reviews     JSONB NOT NULL DEFAULT '[]',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cho phép mọi người đọc sản phẩm
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ai cũng đọc được" ON products FOR SELECT USING (true);
CREATE POLICY "Admin thêm/sửa/xoá" ON products FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- 3. Bảng cart
CREATE TABLE cart_items (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User quản lý cart của mình" ON cart_items FOR ALL
  USING (auth.uid() = user_id);

-- 4. Bảng favorites
CREATE TABLE favorites (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User quản lý favorites của mình" ON favorites FOR ALL
  USING (auth.uid() = user_id);

-- 5. Bảng orders
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items           JSONB NOT NULL,
  total           INTEGER NOT NULL,
  shipping_address JSONB NOT NULL,
  payment_method  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Đang xử lý',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User xem đơn của mình" ON orders FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "User tạo đơn" ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin xem tất cả đơn" ON orders FOR SELECT
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));
CREATE POLICY "Admin cập nhật trạng thái" ON orders FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- 6. Bảng addresses
CREATE TABLE addresses (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  city            TEXT NOT NULL,
  district        TEXT NOT NULL DEFAULT '',
  ward            TEXT NOT NULL DEFAULT '',
  detail_address  TEXT NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User quản lý địa chỉ của mình" ON addresses FOR ALL
  USING (auth.uid() = user_id);

-- 7. Bảng payment_methods
CREATE TABLE payment_methods (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('bank_transfer', 'momo', 'zalopay', 'cod')),
  title           TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  bank_name       TEXT,
  account_name    TEXT,
  account_number  TEXT,
  qr_image        TEXT,
  transfer_prefix TEXT,
  phone_number    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

-- Admin toàn quyền quản lý, user chỉ đọc các method được bật
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ai cũng đọc được payment methods đã bật" ON payment_methods FOR SELECT
  USING (enabled = true);
CREATE POLICY "Admin quản lý payment methods" ON payment_methods FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));

-- 8. Storage bucket cho ảnh sản phẩm
-- Vào Storage trong dashboard Supabase, tạo bucket tên "products"
-- Chọn "Public bucket"
