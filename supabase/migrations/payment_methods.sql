-- Migration: payment_methods table (corrected)
-- Run this in Supabase SQL Editor if table doesn't exist or needs updating.

-- 1. Create the table if it doesn't exist
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
  transfer_prefix TEXT DEFAULT 'CUONLEN',
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- 2. Add updated_at column if it's missing (for tables created without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.payment_methods ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "Anyone can read enabled payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Authenticated users can read all payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Admin users can insert payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Admin users can update payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Admin users can delete payment methods" ON public.payment_methods;

-- 5. Re-create policies
CREATE POLICY "Anyone can read enabled payment methods"
  ON public.payment_methods FOR SELECT
  USING (enabled = true);

CREATE POLICY "Authenticated users can read all payment methods"
  ON public.payment_methods FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin policies: check raw_user_meta_data->>'role' = 'admin'
CREATE POLICY "Admin users can insert payment methods"
  ON public.payment_methods FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admin users can update payment methods"
  ON public.payment_methods FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admin users can delete payment methods"
  ON public.payment_methods FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- 6. Seed data (idempotent: only if table is empty)
INSERT INTO public.payment_methods (type, title, enabled, is_default, bank_name, account_name, account_number, transfer_prefix, phone_number, qr_image)
SELECT * FROM (VALUES
  ('bank_transfer', 'Chuyển khoản ngân hàng', true, true, 'Vietcombank', 'NGUYEN VAN A', '0123456789', 'CUONLEN', NULL, NULL),
  ('momo', 'Ví MoMo', true, false, NULL, NULL, NULL, NULL, '0912345678', NULL),
  ('zalopay', 'Ví ZaloPay', true, false, NULL, NULL, NULL, NULL, NULL, NULL),
  ('cod', 'Thanh toán khi nhận hàng (COD)', true, false, NULL, NULL, NULL, NULL, NULL, NULL)
) AS seed(type, title, enabled, is_default, bank_name, account_name, account_number, transfer_prefix, phone_number, qr_image)
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods LIMIT 1);
