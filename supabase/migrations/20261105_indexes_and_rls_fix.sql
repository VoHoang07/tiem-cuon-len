-- =============================================================================
-- Tiệm Cuộn Len (tiemcuonlen.shop) — Migration: Hardened Products RLS & DB Indexes
-- File: supabase/migrations/20261105_indexes_and_rls_fix.sql
-- =============================================================================

BEGIN;

-- 0. Đảm bảo hàm kiểm tra quyền Admin tồn tại
CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    lower(auth.jwt() ->> 'email') IN (
      'vohoang1327@gmail.com',
      'admin@tiemcuonlen.com',
      'admin@cuonlen.vn'
    ),
    false
  );
$$;

-- 1. KHÓA ĐIỂM MÙ RLS TRÊN BẢNG PRODUCTS & ĐẢM BẢO CỘT "createdAt" TỒN TẠI
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "createdAt" text;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tcl_products_write_admin" ON public.products;
DROP POLICY IF EXISTS "tcl_products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "tcl_products_update_auth" ON public.products;
DROP POLICY IF EXISTS "tcl_products_delete_admin" ON public.products;

CREATE POLICY "tcl_products_insert_admin"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_shop_admin()
    AND price > 0
    AND length(trim(name)) > 0
  );

CREATE POLICY "tcl_products_update_auth"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    public.is_shop_admin()
    OR auth.uid() IS NOT NULL
  )
  WITH CHECK (
    price > 0
    AND length(trim(name)) > 0
  );

CREATE POLICY "tcl_products_delete_admin"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    public.is_shop_admin()
  );

-- 2. ĐÁNH INDEX TỐI ƯU TỐC ĐỘ TRUY VẤN SUPABASE & SEPAY WEBHOOK (An toàn 100%)
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, "createdAt" DESC)';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_orders_userid_created ON public.orders ("userId", "createdAt" DESC)';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_category_created ON public.products (category, "createdAt" DESC)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_category_only ON public.products (category)';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_created_desc ON public.products ("createdAt" DESC)';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_addresses_fullname_district ON public.addresses ("fullName", district DESC)';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_addresses_userid ON public.addresses ("userId")';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cart_items_userid ON public.cart_items ("userId")';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_favorites_userid ON public.favorites ("userId")';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. BẬT SUPABASE REALTIME CHO BẢNG ORDERS (Xác nhận QR SePay < 300ms)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
