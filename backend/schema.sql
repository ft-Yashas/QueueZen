-- QueueZen PostgreSQL Schema
-- Run this script to initialize the database

-- Create database (run as superuser if needed)
-- CREATE DATABASE queuezen;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Organizations Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    service_center VARCHAR(100) NOT NULL,
    logo_url VARCHAR(500) DEFAULT '',
    org_type VARCHAR(20) NOT NULL CHECK (org_type IN ('college', 'business', 'government', 'hospital')),
    official_email_domain VARCHAR(255) DEFAULT '',
    is_queue_open BOOLEAN DEFAULT true,
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    token_counter INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_organizations_username ON organizations(LOWER(username));

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(LOWER(email));

-- ─── Staff Table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    counter_name VARCHAR(50) NOT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for org lookup
CREATE INDEX IF NOT EXISTS idx_staff_org_id ON staff(org_id);

-- ─── Tokens Table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    phone VARCHAR(50) DEFAULT '',
    token_number INTEGER NOT NULL,
    token_display VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed', 'skipped')),
    served_at TIMESTAMP,
    completed_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'senior', 'emergency', 'authorized')),
    priority_status VARCHAR(20) DEFAULT 'none' CHECK (priority_status IN ('none', 'pending', 'approved', 'rejected')),
    -- Verification data (stored as JSON in PostgreSQL)
    verification_data JSONB DEFAULT '{}',
    counter VARCHAR(50),
    feedback JSONB DEFAULT '{}',
    note VARCHAR(200) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for queue lookups
CREATE INDEX IF NOT EXISTS idx_tokens_org_status ON tokens(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tokens_org_created ON tokens(org_id, created_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at
    BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tokens_updated_at ON tokens;
CREATE TRIGGER update_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sequence for token numbers (per organization)
-- We manage this in application code for simplicity