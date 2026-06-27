-- Migration: Add series completion fields to game_series
-- Run this in your Supabase SQL editor if you have an existing database

ALTER TABLE public.game_series 
  ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
