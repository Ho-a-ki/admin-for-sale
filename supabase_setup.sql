-- ============================================
-- Supabase 테이블 생성 + RLS 설정
-- Supabase Dashboard → SQL Editor에서 실행
-- ============================================

-- 1. plans 테이블
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  person TEXT DEFAULT '',
  from_date TEXT DEFAULT '',
  to_date TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  status TEXT DEFAULT '진행예정',
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. incoming 테이블
CREATE TABLE IF NOT EXISTS incoming (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  name TEXT DEFAULT '',
  qty INTEGER DEFAULT 0,
  date TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS 활성화
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming ENABLE ROW LEVEL SECURITY;

-- 4. 인증된 사용자만 접근 가능
CREATE POLICY "auth_select_plans" ON plans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_plans" ON plans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_plans" ON plans FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_plans" ON plans FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "auth_select_incoming" ON incoming FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_incoming" ON incoming FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_update_incoming" ON incoming FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_incoming" ON incoming FOR DELETE USING (auth.role() = 'authenticated');

-- 5. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
