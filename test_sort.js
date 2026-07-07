
const DELETION_ORDER = [
  'workout_exercise_logs',
  'workout_logs',
  'fitness_exercises',
  'fitness_program_days',
  'fitness_programs',
  'skill_entries',
  'habit_completions',
  'game_sessions',
  'gp_transactions',
  'games',
  'game_series'
];
const grouped = { 'habits': ['1'], 'habit_completions': ['2'] };
const tableNames = Object.keys(grouped).sort((a, b) => {
  const idxA = DELETION_ORDER.indexOf(a);
  const idxB = DELETION_ORDER.indexOf(b);
  if (idxA === -1 && idxB === -1) return a.localeCompare(b);
  if (idxA === -1) return 1;
  if (idxB === -1) return -1;
  return idxA - idxB;
});
console.log(tableNames);

