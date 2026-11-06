-- =============================================================================
-- Tiệm Cuộn Len (tiemcuonlen.shop) — Khởi Tạo Toàn Bộ Bảng + RLS + Index Cho Project Supabase Mới
-- File: supabase/migrations/20261106_new_project_all_in_one.sql
-- Cách chạy: Mở Supabase Dashboard (Project Mới) -> SQL Editor -> Dán toàn bộ và ấn RUN
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TẠO ĐẦY ĐỦ 6 BẢNG CỐT LÕI (NẾU CHƯA CÓ)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  image TEXT,
  category TEXT DEFAULT 'Keychains',
  material TEXT DEFAULT '',
  color TEXT DEFAULT '',
  quantity INTEGER DEFAULT 10,
  rating NUMERIC DEFAULT 5,
  reviews JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  "createdAt" TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Chờ xác nhận',
  "paymentMethod" TEXT DEFAULT 'cod',
  "shippingAddress" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TEXT DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  phone TEXT DEFAULT '',
  city TEXT DEFAULT '',
  district TEXT DEFAULT '',
  ward TEXT DEFAULT '',
  "detailAddress" TEXT DEFAULT '',
  "isDefault" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  product JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bank_transfer', 'momo', 'zalopay', 'cod')),
  title TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  qr_image TEXT,
  transfer_prefix TEXT DEFAULT 'SEVQR CUONLEN',
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Seed phương thức thanh toán mặc định (VietinBank SePay + COD)
INSERT INTO public.payment_methods (type, title, enabled, is_default, bank_name, account_name, account_number, transfer_prefix, qr_image)
SELECT * FROM (VALUES
  ('bank_transfer', 'Chuyển khoản ngân hàng', true, true, 'VietinBank', 'VO VU MINH HOANG', '107888618456', 'SEVQR CUONLEN', 'https://vietqr.app/img?bank=VietinBank&acc=107888618456&template=&showinfo=true&holder=VO%20VU%20MINH%20HOANG&store=Ti%E1%BB%87m%20Cu%E1%BB%99n%20Len'),
  ('cod', 'Thanh toán khi nhận hàng', true, false, NULL, NULL, NULL, NULL, NULL)
) AS seed(type, title, enabled, is_default, bank_name, account_name, account_number, transfer_prefix, qr_image)
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods LIMIT 1);

-- -----------------------------------------------------------------------------
-- 2. HÀM KIỂM TRA QUYỀN ADMIN AN TOÀN (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. BẬT ROW LEVEL SECURITY (RLS) TOÀN DIỆN CHO TẤT CẢ 6 BẢNG
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_products_select_public" ON public.products;
DROP POLICY IF EXISTS "tcl_products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "tcl_products_update_auth" ON public.products;
DROP POLICY IF EXISTS "tcl_products_delete_admin" ON public.products;

CREATE POLICY "tcl_products_select_public" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tcl_products_insert_admin" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_shop_admin() AND price > 0 AND length(trim(name)) > 0);
CREATE POLICY "tcl_products_update_auth" ON public.products FOR UPDATE TO authenticated USING (public.is_shop_admin() OR auth.uid() IS NOT NULL) WITH CHECK (price > 0 AND length(trim(name)) > 0);
CREATE POLICY "tcl_products_delete_admin" ON public.products FOR DELETE TO authenticated USING (public.is_shop_admin());

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_orders_select" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_insert" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_update" ON public.orders;
DROP POLICY IF EXISTS "tcl_orders_delete" ON public.orders;

CREATE POLICY "tcl_orders_select" ON public.orders FOR SELECT TO anon, authenticated USING (public.is_shop_admin() OR "userId"::text = coalesce(auth.uid()::text, '') OR id LIKE 'CUONLEN-%');
CREATE POLICY "tcl_orders_insert" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (total > 0 AND jsonb_typeof(items) = 'array' AND length(trim(id)) > 0);
CREATE POLICY "tcl_orders_update" ON public.orders FOR UPDATE TO anon, authenticated USING (public.is_shop_admin() OR "userId"::text = coalesce(auth.uid()::text, '') OR status = 'pending_payment') WITH CHECK (total > 0);
CREATE POLICY "tcl_orders_delete" ON public.orders FOR DELETE TO anon, authenticated USING (public.is_shop_admin() OR "userId"::text = coalesce(auth.uid()::text, ''));

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_cart_items_owner" ON public.cart_items;
CREATE POLICY "tcl_cart_items_owner" ON public.cart_items FOR ALL TO authenticated USING ("userId"::text = auth.uid()::text OR public.is_shop_admin()) WITH CHECK (("userId"::text = auth.uid()::text OR public.is_shop_admin()) AND quantity > 0);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_favorites_owner" ON public.favorites;
CREATE POLICY "tcl_favorites_owner" ON public.favorites FOR ALL TO authenticated USING ("userId"::text = auth.uid()::text OR public.is_shop_admin()) WITH CHECK ("userId"::text = auth.uid()::text OR public.is_shop_admin());

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_addresses_select" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_insert" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_update" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_delete" ON public.addresses;

CREATE POLICY "tcl_addresses_select" ON public.addresses FOR SELECT TO anon, authenticated USING (
  public.is_shop_admin()
  OR "userId"::text = coalesce(auth.uid()::text, '')
  OR ("fullName" LIKE '__TCL_%' AND "fullName" NOT IN ('__TCL_SECURITY_AUDIT_LOG_V1__', '__TCL_SECURITY_BLOCKLIST_V1__'))
);
CREATE POLICY "tcl_addresses_insert" ON public.addresses FOR INSERT TO anon, authenticated WITH CHECK (
  public.is_shop_admin()
  OR "userId"::text = coalesce(auth.uid()::text, '')
  OR "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__', '__TCL_SEPAY_LOG_V1__', '__TCL_SECURITY_AUDIT_LOG_V1__', '__TCL_SHIPPING_CONFIG_V1__')
);
CREATE POLICY "tcl_addresses_update" ON public.addresses FOR UPDATE TO anon, authenticated USING (
  public.is_shop_admin()
  OR "userId"::text = coalesce(auth.uid()::text, '')
  OR "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__', '__TCL_SHIPPING_CONFIG_V1__')
) WITH CHECK (
  public.is_shop_admin()
  OR "userId"::text = coalesce(auth.uid()::text, '')
  OR "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__', '__TCL_SHIPPING_CONFIG_V1__')
);
CREATE POLICY "tcl_addresses_delete" ON public.addresses FOR DELETE TO anon, authenticated USING (
  public.is_shop_admin()
  OR "userId"::text = coalesce(auth.uid()::text, '')
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tcl_payment_methods_select" ON public.payment_methods;
DROP POLICY IF EXISTS "tcl_payment_methods_admin_write" ON public.payment_methods;

CREATE POLICY "tcl_payment_methods_select" ON public.payment_methods FOR SELECT TO anon, authenticated USING (enabled = true OR public.is_shop_admin());
CREATE POLICY "tcl_payment_methods_admin_write" ON public.payment_methods FOR ALL TO authenticated USING (public.is_shop_admin()) WITH CHECK (public.is_shop_admin());

-- -----------------------------------------------------------------------------
-- 4. ĐÁNH INDEX TỐI ƯU & BẬT REALTIME CHO BẢNG ORDERS
-- -----------------------------------------------------------------------------
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, "createdAt" DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_userid_created ON public.orders ("userId", "createdAt" DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_category_created ON public.products (category, "createdAt" DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_created_desc ON public.products ("createdAt" DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_addresses_fullname_district ON public.addresses ("fullName", district DESC)'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_addresses_userid ON public.addresses ("userId")'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cart_items_userid ON public.cart_items ("userId")'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_favorites_userid ON public.favorites ("userId")'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN OTHERS THEN NULL; END $$;

COMMIT;
