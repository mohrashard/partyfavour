-- ============================================================
--  Party Favour — Production Cleanup Script
--  Run this in: Supabase Dashboard → SQL Editor → New Query
--  This script clears all test data while keeping the structure.
-- ============================================================

-- 1. Clear Sales (Depends on items and shifts)
TRUNCATE TABLE public.sales CASCADE;

-- 2. Clear Payouts (Depends on shifts)
TRUNCATE TABLE public.payouts CASCADE;

-- 3. Clear Shifts
TRUNCATE TABLE public.shifts CASCADE;

-- 4. Clear Customers
TRUNCATE TABLE public.customers CASCADE;

-- 5. Clear Inventory
TRUNCATE TABLE public.inventory CASCADE;

-- 6. Clear Staff Profiles
-- WARNING: This will remove all staff accounts including admins.
-- You will need to sign up again or create a new admin.
TRUNCATE TABLE public.profiles CASCADE;

-- NOTE: The 'settings' table is NOT cleared to preserve store info.

-- Reset sequences (optional, for clean IDs)
-- ALTER SEQUENCE inventory_id_seq RESTART WITH 1;
-- ALTER SEQUENCE sales_id_seq RESTART WITH 1;
