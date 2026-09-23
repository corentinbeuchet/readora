-- ==============================================================================
-- Flyway Database Migration V23: drop the subscription plans
-- PostgreSQL 16+
-- ==============================================================================
-- Premium could only be bought through payments, removed on 2026-09-23 (V22 dropped their columns). Its one
-- effect, bookmarks, is now free for every signed-in reader (LIBRARY_USE), so the plans have nothing left to
-- hold. A payments feature adds its own tables back.

DROP TABLE subscriptions;
