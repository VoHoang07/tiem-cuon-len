-- =============================================================================
-- Tiệm Cuộn Len (tiemcuonlen.shop) — Migration: Hardened Products RLS & DB Indexes
-- File: supabase/migrations/20261105_indexes_and_rls_fix.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. KHÓA ĐIỂM MÙ RLS TRÊN BẢNG PRODUCTS (Gỡ bỏ mệnh đề 'OR id IS NOT NULL')
--    - Ai cũng xem được danh sách sản phẩm (SELECT)
--    - Chỉ Admin mới được thêm mới (INSERT) hoặc xóa (DELETE) sản phẩm
--    - Chỉ Admin hoặc tài khoản đã đăng nhập (gửi đánh giá) mới được UPDATE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. ĐÁNH INDEX TỐI ƯU TỐC ĐỘ TRUY VẤN SUPABASE & SEPAY WEBHOOK
-- -----------------------------------------------------------------------------

-- Tăng tốc đối soát đơn chờ thanh toán QR của SePay Webhook & lọc đơn theo trạng thái
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, "createdAt" DESC);

-- Tăng tốc tải lịch sử đơn hàng của khách & kiểm tra quyền sở hữu RLS
CREATE INDEX IF NOT EXISTS idx_orders_userid_created
  ON public.orders ("userId", "createdAt" DESC);

-- Tăng tốc lọc sản phẩm theo danh mục & sắp xếp sản phẩm mới nhất
CREATE INDEX IF NOT EXISTS idx_products_category_created
  ON public.products (category, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_products_created_desc
  ON public.products ("createdAt" DESC);

-- Tăng tốc truy vấn phân vùng hệ thống (Chat, SePay Log, SIEM Audit Log, Shop Config)
CREATE INDEX IF NOT EXISTS idx_addresses_fullname_district
  ON public.addresses ("fullName", district DESC);

-- Tăng tốc tải sổ địa chỉ giao hàng theo người dùng
CREATE INDEX IF NOT EXISTS idx_addresses_userid
  ON public.addresses ("userId");

-- Tăng tốc tải giỏ hàng & danh sách yêu thích theo người dùng
CREATE INDEX IF NOT EXISTS idx_cart_items_userid
  ON public.cart_items ("userId");

CREATE INDEX IF NOT EXISTS idx_favorites_userid
  ON public.favorites ("userId");

COMMIT;
