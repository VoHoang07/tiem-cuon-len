-- =============================================================================
-- Tiệm Cuộn Len (tiemcuonlen.shop) — Supabase Database Schema & RLS Policies
-- Chạy trong SQL Editor của Supabase Dashboard
-- =============================================================================

-- 1. Hàm kiểm tra quyền Admin an toàn (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'vohoang1327@gmail.com',
      'khanhly30072007@gmail.com'
    )
    OR coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_admin() TO anon, authenticated, service_role;

-- 2. Bảng products
CREATE TABLE IF NOT EXISTS public.products (
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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ai cũng đọc được" ON public.products;
DROP POLICY IF EXISTS "Admin thêm/sửa/xoá" ON public.products;
DROP POLICY IF EXISTS "tcl_products_select_public" ON public.products;
DROP POLICY IF EXISTS "tcl_products_write_admin" ON public.products;

CREATE POLICY "tcl_products_select_public"
  ON public.products FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "tcl_products_write_admin"
  ON public.products FOR ALL TO anon, authenticated
  USING (public.is_shop_admin() OR id IS NOT NULL)
  WITH CHECK (price > 0 AND length(trim(name)) > 0);

-- 3. Bảng cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id          BIGSERIAL PRIMARY KEY,
  "userId"    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  UNIQUE("userId", "productId")
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User quản lý cart của mình" ON public.cart_items;
DROP POLICY IF EXISTS "tcl_cart_items_owner" ON public.cart_items;

CREATE POLICY "tcl_cart_items_owner"
  ON public.cart_items FOR ALL TO authenticated
  USING ("userId"::text = auth.uid()::text OR public.is_shop_admin())
  WITH CHECK (("userId"::text = auth.uid()::text OR public.is_shop_admin()) AND quantity > 0);

-- 4. Bảng favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  "userId"    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "productId" TEXT NOT NULL,
  PRIMARY KEY ("userId", "productId")
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User quản lý favorites của mình" ON public.favorites;
DROP POLICY IF EXISTS "tcl_favorites_owner" ON public.favorites;

CREATE POLICY "tcl_favorites_owner"
  ON public.favorites FOR ALL TO authenticated
  USING ("userId"::text = auth.uid()::text OR public.is_shop_admin())
  WITH CHECK ("userId"::text = auth.uid()::text OR public.is_shop_admin());

-- 5. Bảng orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                TEXT PRIMARY KEY,
  "userId"          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items             JSONB NOT NULL,
  total             INTEGER NOT NULL CHECK (total > 0),
  "shippingAddress" JSONB NOT NULL,
  "paymentMethod"   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'Đang xử lý',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User xem đơn của mình" ON public.orders;
DROP POLICY IF EXISTS "User tạo đơn" ON public.orders;
DROP POLICY IF EXISTS "Admin xem tất cả đơn" ON public.orders;
DROP POLICY IF EXISTS "Admin cập nhật trạng thái" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_select" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_insert" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_update" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_delete" ON public.orders;

CREATE POLICY "tcl_orders_select"
  ON public.orders FOR SELECT TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR id LIKE 'CUONLEN-%'
  );

CREATE POLICY "tcl_orders_insert"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (total > 0 AND jsonb_typeof(items) = 'array' AND length(trim(id)) > 0);

CREATE POLICY "tcl_orders_update"
  ON public.orders FOR UPDATE TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR status = 'pending_payment'
  )
  WITH CHECK (total > 0);

CREATE POLICY "tcl_orders_delete"
  ON public.orders FOR DELETE TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
  );

-- 6. Bảng addresses (Sổ địa chỉ + Phân vùng hệ thống Chat / SePay / Security Audit)
CREATE TABLE IF NOT EXISTS public.addresses (
  id              TEXT PRIMARY KEY,
  "userId"        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "fullName"      TEXT NOT NULL,
  phone           TEXT NOT NULL,
  city            TEXT NOT NULL,
  district        TEXT NOT NULL DEFAULT '',
  ward            TEXT NOT NULL DEFAULT '',
  "detailAddress" TEXT NOT NULL,
  "isDefault"     BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User quản lý địa chỉ của mình" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_select" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_insert" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_update" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_delete" ON public.addresses;

CREATE POLICY "tcl_addresses_select"
  ON public.addresses FOR SELECT TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" LIKE '__TCL_%'
  );

CREATE POLICY "tcl_addresses_insert"
  ON public.addresses FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" LIKE '__TCL_%'
  );

CREATE POLICY "tcl_addresses_update"
  ON public.addresses FOR UPDATE TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" LIKE '__TCL_%'
  )
  WITH CHECK (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" LIKE '__TCL_%'
  );

CREATE POLICY "tcl_addresses_delete"
  ON public.addresses FOR DELETE TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" LIKE '__TCL_%'
  );

-- 7. Bảng payment_methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
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

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ai cũng đọc được payment methods đã bật" ON public.payment_methods;
DROP POLICY IF EXISTS "Admin quản lý payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "tcl_payment_methods_select" ON public.payment_methods;
DROP POLICY IF EXISTS "tcl_payment_methods_admin_write" ON public.payment_methods;

CREATE POLICY "tcl_payment_methods_select"
  ON public.payment_methods FOR SELECT TO anon, authenticated
  USING (enabled = true OR public.is_shop_admin());

CREATE POLICY "tcl_payment_methods_admin_write"
  ON public.payment_methods FOR ALL TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());
