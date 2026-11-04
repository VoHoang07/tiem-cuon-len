-- =============================================================================
-- Tiệm Cuộn Len (tiemcuonlen.shop) — Migration Cấu Hình Row Level Security (RLS)
-- File: supabase/migrations/20261104_rls_security_hardening.sql
-- Cách chạy: Mở Supabase Dashboard -> SQL Editor -> Dán toàn bộ nội dung và ấn RUN
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. HÀM KIỂM TRA QUYỀN ADMIN AN TOÀN (SECURITY DEFINER)
--    Kiểm tra chính xác email Admin từ JWT hoặc metadata mà không lộ bảng auth.users
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
-- 2. GỠ BỎ KHÓA NGOẠI CỨNG TRÊN CART_ITEMS & FAVORITES (NẾU CÓ)
--    Giúp lưu được cả sản phẩm danh mục tĩnh (id '1'..'25') lẫn sản phẩm tạo mới ('user_*')
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.favorites
  DROP CONSTRAINT IF EXISTS favorites_product_id_fkey,
  DROP CONSTRAINT IF EXISTS "favorites_productId_fkey";

ALTER TABLE IF EXISTS public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey,
  DROP CONSTRAINT IF EXISTS "cart_items_productId_fkey";

-- -----------------------------------------------------------------------------
-- 3. BẢNG PRODUCTS (Danh mục sản phẩm)
--    - Ai cũng có thể xem danh sách sản phẩm (SELECT)
--    - Ràng buộc dữ liệu hợp lệ (price > 0, tên không rỗng) khi thêm/sửa
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ai cũng đọc được" ON public.products;
DROP POLICY IF EXISTS "Admin thêm/sửa/xoá" ON public.products;
DROP POLICY IF EXISTS "tcl_products_select_public" ON public.products;
DROP POLICY IF EXISTS "tcl_products_write_admin" ON public.products;

CREATE POLICY "tcl_products_select_public"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

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
-- 4. BẢNG ORDERS (Đơn đặt hàng)
--    - Khách hàng xem/tạo đơn của chính mình ("userId" = auth.uid()::text)
--    - Admin xem/cập nhật/xoá toàn bộ đơn hàng
--    - Cho phép đọc/cập nhật trạng thái đơn chờ thanh toán QR (SePay Webhook)
-- -----------------------------------------------------------------------------
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
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR id LIKE 'CUONLEN-%'
  );

CREATE POLICY "tcl_orders_insert"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    total > 0
    AND jsonb_typeof(items) = 'array'
    AND length(trim(id)) > 0
  );

CREATE POLICY "tcl_orders_update"
  ON public.orders
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR status = 'pending_payment'
  )
  WITH CHECK (total > 0);

CREATE POLICY "tcl_orders_delete"
  ON public.orders
  FOR DELETE
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
  );

-- -----------------------------------------------------------------------------
-- 5. BẢNG CART_ITEMS (Giỏ hàng cá nhân)
--    - Chỉ chủ sở hữu tài khoản hoặc Admin mới được đọc/ghi giỏ hàng của mình
-- -----------------------------------------------------------------------------
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User quản lý cart của mình" ON public.cart_items;
DROP POLICY IF EXISTS "tcl_cart_items_owner" ON public.cart_items;

CREATE POLICY "tcl_cart_items_owner"
  ON public.cart_items
  FOR ALL
  TO authenticated
  USING (
    "userId"::text = auth.uid()::text
    OR public.is_shop_admin()
  )
  WITH CHECK (
    ("userId"::text = auth.uid()::text OR public.is_shop_admin())
    AND quantity > 0
  );

-- -----------------------------------------------------------------------------
-- 6. BẢNG FAVORITES (Sản phẩm yêu thích)
--    - Chỉ chủ sở hữu tài khoản hoặc Admin mới được đọc/ghi danh sách yêu thích
-- -----------------------------------------------------------------------------
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User quản lý favorites của mình" ON public.favorites;
DROP POLICY IF EXISTS "tcl_favorites_owner" ON public.favorites;

CREATE POLICY "tcl_favorites_owner"
  ON public.favorites
  FOR ALL
  TO authenticated
  USING (
    "userId"::text = auth.uid()::text
    OR public.is_shop_admin()
  )
  WITH CHECK (
    "userId"::text = auth.uid()::text
    OR public.is_shop_admin()
  );

-- -----------------------------------------------------------------------------
-- 7. BẢNG ADDRESSES (Sổ địa chỉ + Phân vùng hệ thống Chat / SePay / Security Audit)
--    - Địa chỉ giao hàng cá nhân: chỉ chủ tài khoản ("userId" = auth.uid()::text) hoặc Admin truy cập
--    - Các phân vùng hệ thống (__TCL_CHAT_V2__, __TCL_SEPAY_LOG_V1__,
--      __TCL_SECURITY_AUDIT_LOG_V1__, __TCL_SECURITY_BLOCKLIST_V1__, __TCL_SHOP_CONFIG_V1__):
--      cho phép đọc/ghi hợp lệ theo đúng tiền tố __TCL_
-- -----------------------------------------------------------------------------
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User quản lý địa chỉ của mình" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_select" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_insert" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_update" ON public.addresses;
DROP POLICY IF EXISTS "tcl_addresses_delete" ON public.addresses;

CREATE POLICY "tcl_addresses_select"
  ON public.addresses
  FOR SELECT
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR (
      "fullName" LIKE '__TCL_%'
      AND "fullName" NOT IN ('__TCL_SECURITY_AUDIT_LOG_V1__', '__TCL_SECURITY_BLOCKLIST_V1__')
    )
  );

CREATE POLICY "tcl_addresses_insert"
  ON public.addresses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR (
      "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__', '__TCL_SEPAY_LOG_V1__', '__TCL_SECURITY_AUDIT_LOG_V1__')
    )
  );

CREATE POLICY "tcl_addresses_update"
  ON public.addresses
  FOR UPDATE
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__')
  )
  WITH CHECK (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
    OR "fullName" IN ('__TCL_CHAT_V2__', '__TCL_CHAT_MSG_V1__')
  );

CREATE POLICY "tcl_addresses_delete"
  ON public.addresses
  FOR DELETE
  TO anon, authenticated
  USING (
    public.is_shop_admin()
    OR "userId"::text = coalesce(auth.uid()::text, '')
  );

-- -----------------------------------------------------------------------------
-- 8. BẢNG PAYMENT_METHODS (Phương thức thanh toán)
--    - Khách hàng chỉ đọc các phương thức được bật (enabled = true)
--    - Admin có toàn quyền quản lý
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ai cũng đọc được payment methods đã bật" ON public.payment_methods;
DROP POLICY IF EXISTS "Admin quản lý payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "tcl_payment_methods_select" ON public.payment_methods;
DROP POLICY IF EXISTS "tcl_payment_methods_admin_write" ON public.payment_methods;

CREATE POLICY "tcl_payment_methods_select"
  ON public.payment_methods
  FOR SELECT
  TO anon, authenticated
  USING (
    enabled = true
    OR public.is_shop_admin()
  );

CREATE POLICY "tcl_payment_methods_admin_write"
  ON public.payment_methods
  FOR ALL
  TO authenticated
  USING (public.is_shop_admin())
  WITH CHECK (public.is_shop_admin());

-- -----------------------------------------------------------------------------
-- 9. DATABASE INDEXES (Tối ưu tốc độ SePay Webhook, Đơn hàng, Sản phẩm & SIEM)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_orders_userid_created
  ON public.orders ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_products_category_created
  ON public.products (category, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_products_created_desc
  ON public.products ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_addresses_fullname_district
  ON public.addresses ("fullName", district DESC);

CREATE INDEX IF NOT EXISTS idx_addresses_userid
  ON public.addresses ("userId");

CREATE INDEX IF NOT EXISTS idx_cart_items_userid
  ON public.cart_items ("userId");

CREATE INDEX IF NOT EXISTS idx_favorites_userid
  ON public.favorites ("userId");

COMMIT;
