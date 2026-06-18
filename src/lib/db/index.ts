import Dexie, { type Table } from 'dexie';
import type {
  WorkoutLog,
  BodyMetric,
  FitnessProgram,
  FitnessProgramDay,
  FitnessExercise,
  WorkoutExerciseLog,
  GameSeries,
  Game,
  GameSession,
  GPTransaction,

  Habit,
  HabitCompletion,
  Skill,
  SkillEntry,
  Goal,
  AuthUser,
  Todo,
  UserPreferences,
} from '@/types/modules';
import type { RoutineItem } from '@/types';

export class LemisphereDB extends Dexie {
  // Auth
  auth_users!: Table<AuthUser, string>;

  // Fitness
  workout_logs!: Table<WorkoutLog, string>;
  body_metrics!: Table<BodyMetric, string>;
  fitness_programs!: Table<FitnessProgram, string>;
  fitness_program_days!: Table<FitnessProgramDay, string>;
  fitness_exercises!: Table<FitnessExercise, string>;
  workout_exercise_logs!: Table<WorkoutExerciseLog, string>;

  // Gaming
  game_series!: Table<GameSeries, string>;
  games!: Table<Game, string>;
  game_sessions!: Table<GameSession, string>;
  gp_transactions!: Table<GPTransaction, string>;



  // Habits & Skills
  habits!: Table<Habit, string>;
  habit_completions!: Table<HabitCompletion, string>;
  skills!: Table<Skill, string>;
  skill_entries!: Table<SkillEntry, string>;

  // Goals
  goals!: Table<Goal, string>;

  // Todos
  todos!: Table<Todo, string>;

  // User Preferences
  user_preferences!: Table<UserPreferences, string>;

  // Sync tracking
  sync_deletions!: Table<{ id: string; table_name: string; record_id: string; created_at: string }, string>;
  calendar_events!: Table<RoutineItem, string>;

  constructor() {
    super('LemisphereDB');

    // Define schema
    // The keys listed here become indexes. We index id, sync fields, and common lookup fields.
    this.version(1).stores({
      workout_logs: 'id, user_id, date, sync_status, updated_at',
      body_metrics: 'id, user_id, date, sync_status, updated_at',

      fitness_programs: 'id, user_id, status, sync_status, updated_at',
      fitness_program_days: 'id, user_id, program_id, sync_status, updated_at',
      fitness_exercises: 'id, user_id, program_day_id, sync_status, updated_at',
      workout_exercise_logs: 'id, user_id, workout_log_id, exercise_id, sync_status, updated_at',

      games: 'id, user_id, status, platform, sync_status, updated_at',
      game_sessions: 'id, user_id, game_id, date, sync_status, updated_at',
      gp_transactions: 'id, user_id, game_id, type, sync_status, updated_at',

      bird_profiles: 'id, user_id, is_active, sync_status, updated_at',
      care_events: 'id, user_id, bird_id, type, date, sync_status, updated_at',
      training_sessions: 'id, user_id, bird_id, date, sync_status, updated_at',
      trick_progress: 'id, user_id, bird_id, status, sync_status, updated_at',

      habits: 'id, user_id, category, is_active, sync_status, updated_at',
      habit_completions: 'id, user_id, habit_id, date, sync_status, updated_at',
      skills: 'id, user_id, category, sync_status, updated_at',
      skill_entries: 'id, user_id, skill_id, date, sync_status, updated_at',

      goals: 'id, user_id, status, category, sync_status, updated_at',
    });

    this.version(2).stores({
      workout_templates: null,
      fitness_programs: 'id, user_id, status, sync_status, updated_at',
      fitness_program_days: 'id, user_id, program_id, sync_status, updated_at',
      fitness_exercises: 'id, user_id, program_day_id, sync_status, updated_at',
      workout_exercise_logs: 'id, user_id, workout_log_id, exercise_id, sync_status, updated_at',
      workout_logs: 'id, user_id, program_id, program_day_id, date, sync_status, updated_at',
    });

    this.version(3).stores({
      game_series: 'id, user_id, sync_status, updated_at',
      games: 'id, user_id, series_id, status, platform, sync_status, updated_at',
    });

    this.version(4).stores({
      training_blueprints: 'id, user_id, bird_id, sync_status, updated_at',
    });

    this.version(5).stores({
      auth_users: 'id, username, email',
    });

    this.version(6).stores({
      todos: 'id, user_id, sync_status, updated_at',
    });

    this.version(7).stores({
      sync_deletions: 'id, table_name, record_id',
    });

    this.version(8).stores({
      calendar_events: 'id, user_id, date, day, sync_status, updated_at',
    });

    this.version(9).stores({
      user_preferences: 'id, user_id, sync_status, updated_at',
    });

    this.version(10).stores({
      bird_profiles: null,
      care_events: null,
      training_sessions: null,
      trick_progress: null,
      training_blueprints: null,
    });
  }
}

export const db = new LemisphereDB();
