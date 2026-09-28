-- ============================================================================
-- Calling CRM - PostgreSQL Database Schema & Initial Data
-- Compatible with Neon PostgreSQL, AWS RDS, Render, Supabase, and Self-Hosted
-- ============================================================================

-- Ensure UTF8 encoding
SET client_encoding = 'UTF8';

-- ----------------------------------------------------------------------------
-- 1. ROLES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- ----------------------------------------------------------------------------
-- 2. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    shift VARCHAR(50) NOT NULL DEFAULT 'SHIFT_1000_1900',
    firebase_uid VARCHAR(128),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- ----------------------------------------------------------------------------
-- 3. PROJECTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. LEADS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    source VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    business_outcome VARCHAR(30),
    additional_info TEXT,
    last_contacted_at TIMESTAMP WITHOUT TIME ZONE,
    last_call_id BIGINT,
    last_call_status VARCHAR(30),
    last_call_duration INT,
    total_call_count INT NOT NULL DEFAULT 0,
    connected_call_count INT NOT NULL DEFAULT 0,
    missed_call_count INT NOT NULL DEFAULT 0,
    rejected_call_count INT NOT NULL DEFAULT 0,
    failed_call_count INT NOT NULL DEFAULT 0,
    short_call_count INT NOT NULL DEFAULT 0,
    junk_call_count INT NOT NULL DEFAULT 0,
    follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
    next_follow_up_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_project_phone UNIQUE(project_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_leads_project_outcome ON leads(project_id, business_outcome);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

-- ----------------------------------------------------------------------------
-- 5. LEAD ASSIGNMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_assignments (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMP WITHOUT TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_user ON lead_assignments(user_id);

-- ----------------------------------------------------------------------------
-- 6. CALLS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calls (
    id BIGSERIAL PRIMARY KEY,
    telephony_call_id VARCHAR(100),
    lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(30),
    is_connected BOOLEAN DEFAULT FALSE,
    call_direction VARCHAR(20) DEFAULT 'OUTBOUND',
    call_lifecycle_status VARCHAR(30) DEFAULT 'ENDED',
    started_at TIMESTAMP WITHOUT TIME ZONE,
    connected_at TIMESTAMP WITHOUT TIME ZONE,
    ended_at TIMESTAMP WITHOUT TIME ZONE,
    duration_seconds INT NOT NULL DEFAULT 0,
    call_status VARCHAR(30) NOT NULL,
    business_outcome VARCHAR(30),
    automatic_classification VARCHAR(30),
    final_classification VARCHAR(30),
    classification_changed_manually BOOLEAN DEFAULT FALSE,
    classification_changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    classification_changed_at TIMESTAMP WITHOUT TIME ZONE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date TIMESTAMP WITHOUT TIME ZONE,
    follow_up_id BIGINT,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_lead ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_telephony_id ON calls(telephony_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_lifecycle_status ON calls(call_lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_calls_final_classification ON calls(final_classification);

-- ----------------------------------------------------------------------------
-- 7. FOLLOW-UPS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follow_ups (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_time);

-- ----------------------------------------------------------------------------
-- 8. NOTES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id);

-- ----------------------------------------------------------------------------
-- 9. SALES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_value NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    converted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_lead ON sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_converted ON sales(converted_at);

-- ----------------------------------------------------------------------------
-- 10. ATTENDANCE TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in_time TIMESTAMP WITHOUT TIME ZONE,
    clock_out_time TIMESTAMP WITHOUT TIME ZONE,
    duration_minutes INT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENT',
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_attendance_user_date UNIQUE(user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);

-- ----------------------------------------------------------------------------
-- 11. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ----------------------------------------------------------------------------
-- 12. AUDIT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id BIGINT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 13. ADMIN ACCESS REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_access_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_role VARCHAR(50) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 14. SHIFT CHANGE REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_change_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_shift VARCHAR(50) NOT NULL,
    requested_shift VARCHAR(50) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 15. GOOGLE SHEETS SYNC LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_sheets_sync_logs (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
    sync_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    records_pulled INT DEFAULT 0,
    records_pushed INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEED INITIAL DATA (Roles & Standard Accounts)
-- Password for admin & agents is: admin123 / agent123
-- (Bcrypt hash: $2a$10$wK1q7e8zV2R1nC7x3X3qge3mYwXlYv1z6wD8s5p9a4f2c8d3e5b7a)
-- ============================================================================

INSERT INTO roles (id, name) VALUES 
    (1, 'ROLE_ADMIN'),
    (2, 'ROLE_USER')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for roles
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));
