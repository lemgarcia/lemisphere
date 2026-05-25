const Dexie = require('dexie');
const { indexedDB } = require('fake-indexeddb');

async function test() {
  const db = new Dexie('lemisphere-fitness', { indexedDB: indexedDB });
  db.version(1).stores({
    fitness_programs: 'id, status',
    fitness_program_days: 'id, program_id, order',
    fitness_exercises: 'id, program_day_id, order',
    workout_logs: 'id, program_id, program_day_id, week_number',
    workout_exercise_logs: 'id, workout_log_id, exercise_id'
  });
  const logs = await db.workout_logs.toArray();
  console.log(JSON.stringify(logs, null, 2));
}
test();
