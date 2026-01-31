-- ============================================
-- CRM Agent Database Schema
-- ============================================
-- This schema sets up everything your AI agent needs to manage leads.
-- Run this in your Supabase SQL Editor (Database > SQL Editor)

-- ============================================
-- STEP 1: Create the leads table
-- ============================================
-- This is where all your potential customers live.
-- The agent will read from here to answer questions like 
-- "Show me all hot leads" or "What's the status of TechCorp?"

CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic info
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    
    -- Lead qualification
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    source TEXT, -- e.g., 'website', 'referral', 'linkedin'
    
    -- Deal info
    estimated_value DECIMAL(10,2),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_contacted_at TIMESTAMPTZ
);

-- ============================================
-- STEP 2: Create the interactions table
-- ============================================
-- Every time the agent does something (sends email, updates status),
-- we log it here. This is your audit trail.

CREATE TABLE IF NOT EXISTS interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- What happened
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('email_sent', 'status_change', 'note_added', 'agent_action', 'human_approval')),
    description TEXT NOT NULL,
    
    -- Who/what did it
    performed_by TEXT NOT NULL, -- 'agent' or 'human'
    
    -- For agent actions that needed approval
    required_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN,
    approved_by TEXT,
    
    -- Metadata (store any extra info as JSON)
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Auto-update timestamps
-- ============================================
-- When you update a lead, we want updated_at to change automatically

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 4: Row Level Security (RLS)
-- ============================================
-- In production, you'd lock this down properly.
-- For learning, we'll allow authenticated users full access.

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can do everything
-- (In real apps, you'd scope this to user's organization)
CREATE POLICY "Authenticated users can manage leads"
    ON leads FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can manage interactions"
    ON interactions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Also allow service role (for Edge Functions)
CREATE POLICY "Service role has full access to leads"
    ON leads FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to interactions"
    ON interactions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- STEP 5: Sample data
-- ============================================
-- Some leads to play with. These are the people your agent will help manage.

INSERT INTO leads (company_name, contact_name, contact_email, status, score, source, estimated_value, notes) VALUES
    ('TechCorp Solutions', 'Sophie Martin', 'sophie@techcorp.io', 'qualified', 85, 'website', 45000.00, 'Very interested in enterprise plan. Decision maker. Wants demo next week.'),
    ('StartupXYZ', 'Marcus Chen', 'marcus@startupxyz.com', 'new', 40, 'linkedin', 5000.00, 'Early stage startup, limited budget but growing fast.'),
    ('GlobalRetail Inc', 'Amanda Rodriguez', 'a.rodriguez@globalretail.com', 'proposal', 92, 'referral', 120000.00, 'Enterprise deal. Legal review in progress. HIGH PRIORITY.'),
    ('LocalCafe', 'Tom Wilson', 'tom@localcafe.co', 'contacted', 25, 'website', 500.00, 'Small business, might not be a fit for our pricing.'),
    ('MegaBank Financial', 'Dr. James Wright', 'jwright@megabank.com', 'qualified', 78, 'conference', 80000.00, 'Met at FinTech Summit. Interested but slow procurement process.');

-- Add some interaction history
INSERT INTO interactions (lead_id, interaction_type, description, performed_by, metadata) 
SELECT 
    id,
    'note_added',
    'Initial contact made via website form',
    'human',
    '{"channel": "website"}'
FROM leads WHERE company_name = 'TechCorp Solutions';

INSERT INTO interactions (lead_id, interaction_type, description, performed_by, required_approval, approved, approved_by, metadata)
SELECT 
    id,
    'status_change',
    'Status changed from new to qualified after discovery call',
    'human',
    false,
    null,
    null,
    '{"previous_status": "new", "new_status": "qualified"}'
FROM leads WHERE company_name = 'TechCorp Solutions';

-- ============================================
-- DONE! Your database is ready.
-- ============================================
-- You should see:
-- - 5 leads in the leads table
-- - 2 interactions logged
-- 
-- Test it: SELECT * FROM leads ORDER BY score DESC;
