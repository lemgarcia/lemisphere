create table public.user_preferences (
  id uuid primary key,
  user_id uuid references auth.users not null,
  dashboard_layout jsonb not null default '[]',
  quick_nav_order jsonb not null default '[]',
  hidden_quick_nav jsonb not null default '[]',
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data." ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data." ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data." ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own data." ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
