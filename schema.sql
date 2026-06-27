-- Drop all existing tables to cleanly recreate them with the correct schema
drop table if exists public.calendar_events cascade;
drop table if exists public.todos cascade;
drop table if exists public.goals cascade;
drop table if exists public.skill_entries cascade;
drop table if exists public.skills cascade;
drop table if exists public.habit_completions cascade;
drop table if exists public.habits cascade;
drop table if exists public.trick_progress cascade;
drop table if exists public.training_sessions cascade;
drop table if exists public.training_blueprints cascade;
drop table if exists public.care_events cascade;
drop table if exists public.bird_profiles cascade;
drop table if exists public.gp_transactions cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.games cascade;
drop table if exists public.game_series cascade;
drop table if exists public.workout_exercise_logs cascade;
drop table if exists public.workout_logs cascade;
drop table if exists public.fitness_exercises cascade;
drop table if exists public.fitness_program_days cascade;
drop table if exists public.fitness_programs cascade;
drop table if exists public.body_metrics cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Common function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- FITNESS MODULE
create table public.fitness_programs (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  target_sets integer not null,
  current_set integer not null,
  status text not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.fitness_program_days (
  id uuid primary key,
  user_id uuid references auth.users not null,
  program_id uuid references public.fitness_programs on delete cascade not null,
  name text not null,
  "order" integer not null,
  linked_goal_id uuid,
  linked_milestone_id uuid,
  linked_task_id uuid,
  linked_task_name text,
  sync_direction text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.fitness_exercises (
  id uuid primary key,
  user_id uuid references auth.users not null,
  program_day_id uuid references public.fitness_program_days on delete cascade not null,
  name text not null,
  sets text not null,
  target_reps text not null,
  rest_sec integer not null,
  muscle_group text,
  "order" integer not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.workout_logs (
  id uuid primary key,
  user_id uuid references auth.users not null,
  program_id uuid references public.fitness_programs,
  program_day_id uuid references public.fitness_program_days,
  set_number integer not null,
  date text not null,
  completed boolean not null,
  duration integer,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.workout_exercise_logs (
  id uuid primary key,
  user_id uuid references auth.users not null,
  workout_log_id uuid references public.workout_logs on delete cascade not null,
  exercise_id uuid references public.fitness_exercises,
  weight numeric not null,
  completed boolean not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.body_metrics (
  id uuid primary key,
  user_id uuid references auth.users not null,
  date text not null,
  weight numeric not null,
  notes text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- GAMING MODULE
create table public.game_series (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  cover_url text,
  is_favorite boolean default false,
  is_completed boolean default false,
  completed_at timestamp with time zone,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.games (
  id uuid primary key,
  user_id uuid references auth.users not null,
  title text not null,
  series_id uuid references public.game_series on delete set null,
  platform text not null,
  status text not null,
  cover_url text,
  genre text,
  release_year integer,
  chronological_order numeric,
  personal_rating numeric,
  notes text,
  links jsonb,
  pardon_reason text,
  gp_earned integer not null,
  started_at text,
  completed_at text,
  hours_played numeric not null,
  is_favorite boolean default false,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.game_sessions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  game_id uuid references public.games on delete cascade not null,
  date text not null,
  duration integer not null,
  notes text,
  gp_gained integer not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.gp_transactions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  game_id uuid references public.games,
  amount integer not null,
  reason text not null,
  type text not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- BUDGIE MODULE
create table public.bird_profiles (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  species text not null,
  color_mutation text not null,
  gender text not null,
  hatch_date text,
  adopt_date text,
  photo_url text,
  ring_number text,
  notes text,
  is_active boolean default true,
  linked_bird_id uuid,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.care_events (
  id uuid primary key,
  user_id uuid references auth.users not null,
  bird_id uuid references public.bird_profiles on delete cascade not null,
  type text not null,
  date text not null,
  time text,
  value numeric,
  notes text,
  food_type text,
  medication_name text,
  dose text,
  vet_name text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.training_sessions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  bird_id uuid references public.bird_profiles on delete cascade not null,
  date text not null,
  day_no integer not null,
  session_type text not null,
  training_type text not null,
  training_code text not null,
  notes text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.trick_progress (
  id uuid primary key,
  user_id uuid references auth.users not null,
  bird_id uuid references public.bird_profiles on delete cascade not null,
  trick_name text not null,
  status text not null,
  started_at text not null,
  mastered_at text,
  notes text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.training_blueprints (
  id uuid primary key,
  user_id uuid references auth.users not null,
  bird_id uuid references public.bird_profiles on delete cascade not null,
  code text not null,
  category text not null,
  training_name text not null,
  description text not null,
  next_step text not null,
  notes text,
  sort_order integer,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- HABITS & SKILLS MODULE
create table public.habits (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  icon text not null,
  color text not null,
  frequency text not null,
  frequency_days integer[],
  target_count integer not null,
  category text not null,
  is_active boolean default true,
  streak_current integer not null,
  streak_best integer not null,
  sort_order integer,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.habit_completions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  habit_id uuid references public.habits on delete cascade not null,
  date text not null,
  count integer not null,
  notes text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.skills (
  id uuid primary key,
  user_id uuid references auth.users not null,
  name text not null,
  category text not null,
  level text not null,
  xp numeric not null,
  notes text,
  description text,
  status text not null,
  checklist jsonb not null,
  icon text,
  sort_order integer,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table public.skill_entries (
  id uuid primary key,
  user_id uuid references auth.users not null,
  skill_id uuid references public.skills on delete cascade not null,
  date text not null,
  xp_gained numeric not null,
  notes text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- GOALS MODULE
create table public.goals (
  id uuid primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  category text not null,
  status text not null,
  progress numeric not null,
  is_auto_progress boolean not null,
  target_date text,
  milestones jsonb not null,
  icon text,
  color text,
  reward text,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- TODOS
create table public.todos (
  id uuid primary key,
  user_id uuid references auth.users not null,
  text text not null,
  is_completed boolean default false,
  position integer not null,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- CALENDAR EVENTS
create table public.calendar_events (
  id uuid primary key,
  user_id uuid references auth.users not null,
  day text not null,
  date text,
  time text not null,
  activity text not null,
  type text not null,
  notes text,
  repeat text,
  remind_at timestamp with time zone,
  event_notified boolean default false,
  version integer default 1,
  device_id text,
  sync_status text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

-- TRIGGERS & RLS
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t);
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('CREATE POLICY "Users can view own data." ON public.%I FOR SELECT USING (auth.uid() = user_id);', t);
        EXECUTE format('CREATE POLICY "Users can insert own data." ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id);', t);
        EXECUTE format('CREATE POLICY "Users can update own data." ON public.%I FOR UPDATE USING (auth.uid() = user_id);', t);
        EXECUTE format('CREATE POLICY "Users can delete own data." ON public.%I FOR DELETE USING (auth.uid() = user_id);', t);
    END LOOP;
END;
$$;
