// ════════════════════════════════════════════════════════════════════════════
// LEMISPHERE — MODULE TYPES
// ════════════════════════════════════════════════════════════════════════════

import type { BaseRecord } from './index';

// ── Fitness ──────────────────────────────────────────────────────────────────

export interface FitnessProgram extends BaseRecord {
  name: string;
  target_sets: number;
  current_set: number;
  status: 'active' | 'completed' | 'archived';
}

export interface FitnessProgramDay extends BaseRecord {
  program_id: string;
  name: string; // e.g. "Push Day", "Pull Day"
  order: number; // Order within the week

  // Cross-module linking
  linked_goal_id?: string;
  linked_milestone_id?: string;
  linked_task_id?: string;
  linked_task_name?: string;
  sync_direction?: 'one-way' | 'two-way';
}

export interface FitnessExercise extends BaseRecord {
  program_day_id: string;
  name: string;
  sets: string;
  target_reps: string; // e.g. "3x10" or "8-12"
  rest_sec: number;
  muscle_group?: string;
  order: number;
}

export interface WorkoutLog extends BaseRecord {
  program_id: string;
  program_day_id: string;
  set_number: number;
  date: string; // YYYY-MM-DD
  completed: boolean; // True when all exercises are checked
  duration?: number; // minutes
}

export interface WorkoutExerciseLog extends BaseRecord {
  workout_log_id: string;
  exercise_id: string;
  weight: number | string; // Carried over weight (can be text like "BW" or "Bodyweight")
  completed: boolean; // Checkbox state
}

export interface BodyMetric extends BaseRecord {
  date: string; // YYYY-MM-DD
  weight: number;  // kg
  notes?: string;
}

// ── Gaming ───────────────────────────────────────────────────────────────────

export type GameStatus = 'playwish' | 'playing' | 'played' | 'completed' | 'mastered' | 'skipped' | 'pardoned';
export type GamePlatform = 'PC' | 'PS5' | 'PS4' | 'Switch' | 'Xbox' | 'Mobile' | 'Other';

export interface GameSeries extends BaseRecord {
  name: string;
  description?: string;
  cover_url?: string;
  is_favorite?: boolean;
}

export interface GameLink {
  id: string;
  title: string;
  url: string;
}

export interface Game extends BaseRecord {
  title: string;
  series_id?: string;
  platform: GamePlatform;
  status: GameStatus;
  cover_url?: string;
  genre?: string;
  release_year?: number;
  chronological_order?: number; // For lore-wise sorting within a series
  personal_rating?: number; // 1-10
  notes?: string;
  links?: GameLink[];
  pardon_reason?: string;
  gp_earned: number;        // GP earned from this game
  started_at?: string;
  completed_at?: string;
  hours_played: number;
  is_favorite?: boolean;
}

export interface GameSession extends BaseRecord {
  game_id: string;
  date: string; // YYYY-MM-DD
  duration: number; // minutes
  notes?: string;
  gp_gained: number;
}

export interface GPTransaction extends BaseRecord {
  game_id?: string;
  amount: number;           // positive = gain, negative = loss
  reason: string;
  type: 'started' | 'completed' | 'achievement' | 'hundred_percent' | 'milestone' | 'bonus' | 'played' | 'skipped';
}

// ── Budgie ───────────────────────────────────────────────────────────────────

export type BudgieGender = 'male' | 'female' | 'unknown';

export interface BirdProfile extends BaseRecord {
  name: string;
  species: string;
  color_mutation: string;
  gender: BudgieGender;
  hatch_date?: string; // YYYY-MM-DD
  adopt_date?: string; // YYYY-MM-DD
  photo_url?: string;
  ring_number?: string;
  notes?: string;
  is_active: boolean;
  linked_bird_id?: string;
}

export type CareEventType =
  | 'feeding'
  | 'water'
  | 'weight_check'
  | 'vet_visit'
  | 'medication'
  | 'bath'
  | 'nail_trim'
  | 'health_note';

export interface CareEvent extends BaseRecord {
  bird_id: string;
  type: CareEventType;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  value?: number;    // e.g. weight in grams
  notes?: string;
  food_type?: string;
  medication_name?: string;
  dose?: string;
  vet_name?: string;
}

export interface TrainingSession extends BaseRecord {
  bird_id: string;
  date: string; // YYYY-MM-DD
  day_no: number;
  session_type: 'Training' | 'Mini Training';
  training_type: 'Introduction' | 'Reinforcement';
  training_code: string;
  notes?: string;
}

export interface TrickProgress extends BaseRecord {
  bird_id: string;
  trick_name: string;
  status: 'learning' | 'practicing' | 'mastered';
  started_at: string;
  mastered_at?: string;
  notes?: string;
}

export interface TrainingBlueprint extends BaseRecord {
  bird_id: string;
  code: string;
  category: string;
  training_name: string;
  description: string;
  next_step: string;
  notes?: string;
  sort_order?: number;
}

// ── Habits & Skills ──────────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type HabitCategory = 'health' | 'fitness' | 'learning' | 'creative' | 'social' | 'other';

export interface Habit extends BaseRecord {
  name: string;
  description?: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  frequency_days?: number[]; // 0=Sun..6=Sat for custom
  target_count: number;
  category: HabitCategory;
  is_active: boolean;
  streak_current: number;
  streak_best: number;
  sort_order?: number;
}

export interface HabitCompletion extends BaseRecord {
  habit_id: string;
  date: string; // YYYY-MM-DD
  count: number;
  notes?: string;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
export type SkillStatus = 'learning' | 'mastered' | 'on_hold' | 'stopped';
export type SkillCategory = 'Technical' | 'Creative' | 'Self' | 'Upskill' | 'Fun' | 'Reinforcement';

export type TaskDifficulty = 'easy' | 'mid' | 'hard' | 'extreme';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  difficulty: TaskDifficulty;
  repeats?: number; // legacy/multiplier
  target_amount?: number;
  current_amount?: number;
  
  // Cross-module linking
  linked_goal_id?: string;
  linked_milestone_id?: string;
  linked_task_id?: string;
  linked_task_name?: string;
  sync_direction?: 'one-way' | 'two-way';
}

export interface Skill extends BaseRecord {
  name: string;
  category: SkillCategory | string;
  level: SkillLevel;
  xp: number;
  notes?: string;
  description?: string;
  status: SkillStatus;
  checklist: ChecklistItem[];
  icon?: string;
  sort_order?: number;
  links?: { id: string; title: string; url: string }[];
}

export interface SkillEntry extends BaseRecord {
  skill_id: string;
  date: string; // YYYY-MM-DD
  xp_gained: number;
  notes?: string;
}

// ── Goals ────────────────────────────────────────────────────────────────────

export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned' | 'in-progress';
export type GoalCategory = 'health' | 'fitness' | 'gaming' | 'personal' | 'finance' | 'learning' | 'other';

export interface GoalTask {
  id: string;
  text: string;
  completed: boolean;
  target_amount?: number;
  current_amount?: number;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string;
  due_date?: string;
  tasks?: GoalTask[];
  reward?: string;
  target_amount?: number;
  current_amount?: number;
}

export interface Goal extends BaseRecord {
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  progress: number; // 0-100
  is_auto_progress: boolean;
  target_date?: string; // YYYY-MM-DD
  milestones: Milestone[];
  icon?: string;
  color?: string;
  reward?: string;
}

export interface Todo extends BaseRecord {
  text: string;
  is_completed: boolean;
  position: number;
}

export interface AuthUser extends BaseRecord {
  username: string;
  email: string;
  password_hash: string;
}

export interface UserPreferences extends BaseRecord {
  dashboard_layout: any[];
  quick_nav_order: string[];
  hidden_quick_nav: string[];
  budgie_food_rotation?: any[];
  budgie_daily_routine?: any[];
  monitored_habit_id?: string;
}
