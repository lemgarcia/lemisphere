-- Add goal linking columns to fitness_program_days
ALTER TABLE public.fitness_program_days
ADD COLUMN IF NOT EXISTS linked_goal_id UUID,
ADD COLUMN IF NOT EXISTS linked_milestone_id UUID,
ADD COLUMN IF NOT EXISTS linked_task_id UUID,
ADD COLUMN IF NOT EXISTS linked_task_name TEXT,
ADD COLUMN IF NOT EXISTS sync_direction TEXT;

-- Drop goal linking columns from fitness_exercises (if desired)
ALTER TABLE public.fitness_exercises
DROP COLUMN IF EXISTS linked_goal_id,
DROP COLUMN IF EXISTS linked_milestone_id,
DROP COLUMN IF EXISTS linked_task_id,
DROP COLUMN IF EXISTS linked_task_name,
DROP COLUMN IF EXISTS sync_direction;
