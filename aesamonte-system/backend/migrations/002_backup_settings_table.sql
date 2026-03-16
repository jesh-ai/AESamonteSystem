-- Migration 002: Replace backup_settings.json with a database table
-- Run this once against your Supabase/PostgreSQL database

CREATE TABLE IF NOT EXISTS backup_settings (
    id      INTEGER PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{}',
    -- Enforce single-row: this table always has exactly one record
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed with defaults (no-ops if the row already exists)
INSERT INTO backup_settings (id, settings)
VALUES (1, '{
    "daily":  {"enabled": false, "hour": 12, "minute": 0,  "ampm": "PM"},
    "weekly": {"enabled": false, "hour": 12, "minute": 0,  "ampm": "PM", "day": "monday"}
}')
ON CONFLICT (id) DO NOTHING;
