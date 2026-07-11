-- Extended Schema for Advanced Features

-- Job Queue for Background Processing
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  delay_until TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics History for Historical Tracking
CREATE TABLE IF NOT EXISTS analytics_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  spend DECIMAL(10,2) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Automation Executions
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  trigger_data JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform Sync History
CREATE TABLE IF NOT EXISTS platform_sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_date DATE NOT NULL,
  platforms TEXT[] NOT NULL,
  campaigns_count INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alerts and Notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Settings for Platform Integrations
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign Management
CREATE TABLE IF NOT EXISTS created_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  objective TEXT,
  budget DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id TEXT NOT NULL
);

-- Reports History
CREATE TABLE IF NOT EXISTS reports_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id TEXT NOT NULL,
  type TEXT NOT NULL,
  date_range JSONB NOT NULL,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  user_id TEXT NOT NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_delay_until ON job_queue(delay_until);

CREATE INDEX IF NOT EXISTS idx_analytics_history_date ON analytics_history(date);
CREATE INDEX IF NOT EXISTS idx_analytics_history_platform ON analytics_history(platform);
CREATE INDEX IF NOT EXISTS idx_analytics_history_date_platform ON analytics_history(date, platform);

CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_executions_created_at ON automation_executions(created_at);

CREATE INDEX IF NOT EXISTS idx_platform_sync_history_date ON platform_sync_history(sync_date);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_created_campaigns_platform ON created_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_created_campaigns_user_id ON created_campaigns(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_history_user_id ON reports_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_history_generated_at ON reports_history(generated_at);

-- Row Level Security (RLS)
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE created_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own job queue" ON job_queue
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own analytics history" ON analytics_history
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own automation executions" ON automation_executions
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own sync history" ON platform_sync_history
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own alerts" ON alerts
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own settings" ON user_settings
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own campaigns" ON created_campaigns
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own reports" ON reports_history
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Triggers and Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup Function for Old Data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete old job queue entries (older than 30 days)
  DELETE FROM job_queue 
  WHERE created_at < now() - interval '30 days'
  AND status IN ('completed', 'failed');

  -- Delete old analytics history (older than 1 year)
  DELETE FROM analytics_history 
  WHERE date < current_date - interval '1 year';

  -- Delete old alerts (older than 90 days)
  DELETE FROM alerts 
  WHERE created_at < now() - interval '90 days';

  -- Delete old reports (older than 6 months)
  DELETE FROM reports_history 
  WHERE generated_at < now() - interval '6 months';

  -- Delete old sync history (older than 3 months)
  DELETE FROM platform_sync_history 
  WHERE sync_date < current_date - interval '3 months';
END;
$$ language plpgsql;

-- Schedule Cleanup Job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- Views for Common Queries
CREATE OR REPLACE VIEW queue_status AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total
FROM job_queue;

CREATE OR REPLACE VIEW daily_analytics AS
SELECT 
  date,
  SUM(spend) as total_spend,
  SUM(revenue) as total_revenue,
  SUM(conversions) as total_conversions,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(leads) as total_leads,
  COUNT(*) as platform_count
FROM analytics_history
GROUP BY date
ORDER BY date DESC;

CREATE OR REPLACE VIEW automation_performance AS
SELECT 
  a.name,
  a.trigger,
  COUNT(e.id) as execution_count,
  COUNT(e.id) FILTER (WHERE e.status = 'completed') as successful_executions,
  COUNT(e.id) FILTER (WHERE e.status = 'failed') as failed_executions,
  ROUND(
    (COUNT(e.id) FILTER (WHERE e.status = 'completed')::decimal / NULLIF(COUNT(e.id), 0)) * 100, 2
  ) as success_rate,
  MAX(e.completed_at) as last_execution
FROM automations a
LEFT JOIN automation_executions e ON a.id = e.automation_id
GROUP BY a.id, a.name, a.trigger
ORDER BY success_rate DESC;
