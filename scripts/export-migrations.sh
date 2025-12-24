#!/bin/bash
# Export all migrations as a single SQL file for easy execution

echo "-- ==========================================================================="
echo "-- CoinFlip Database Setup - Complete Migration Script"
echo "-- ==========================================================================="
echo "-- Copy and paste this entire script into Supabase SQL Editor"
echo "-- Run Date: $(date)"
echo "-- ==========================================================================="
echo ""

echo "-- Create migrations tracking table"
echo "CREATE TABLE IF NOT EXISTS _migrations ("
echo "  version TEXT PRIMARY KEY,"
echo "  filename TEXT NOT NULL,"
echo "  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
echo ");"
echo ""

# Export each migration file
for file in supabase/migrations/*.sql; do
  filename=$(basename "$file")
  echo "-- ==========================================================================="
  echo "-- Migration: $filename"
  echo "-- ==========================================================================="
  echo ""
  cat "$file"
  echo ""
  echo "-- Record migration"
  version=$(basename "$file" .sql | cut -d'_' -f1)
  echo "INSERT INTO _migrations (version, filename) VALUES ('$version', '$filename')"
  echo "ON CONFLICT (version) DO NOTHING;"
  echo ""
done

echo "-- ==========================================================================="
echo "-- Migration Complete!"
echo "-- ==========================================================================="
