const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) { 
      results = results.concat(walk(file));
    } else { 
      if(file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('C:/Users/PC/Downloads/lemisphere/src');
const tables = [
  'workout_logs', 'body_metrics', 'fitness_programs', 'fitness_program_days', 'fitness_exercises', 'workout_exercise_logs',
  'game_series', 'games', 'game_sessions', 'gp_transactions',
  'bird_profiles', 'care_events', 'training_sessions', 'trick_progress', 'training_blueprints',
  'habits', 'habit_completions', 'skills', 'skill_entries', 'goals'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  tables.forEach(table => {
    // Replace `db.table.toArray()` with `db.table.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()`
    const toArrayRegex = new RegExp(`db\\.${table}\\.toArray\\(\\)`, 'g');
    if (toArrayRegex.test(content)) {
      content = content.replace(toArrayRegex, `db.${table}.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()`);
      changed = true;
    }

    // Replace `db.table.reverse().toArray()`
    const reverseToArrayRegex = new RegExp(`db\\.${table}\\.reverse\\(\\)\\.toArray\\(\\)`, 'g');
    if (reverseToArrayRegex.test(content)) {
      content = content.replace(reverseToArrayRegex, `db.${table}.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).reverse().toArray()`);
      changed = true;
    }

    // Replace `db.table.where(...).toArray()`
    // We can just look for .toArray() that comes after db.table... but it's hard with regex.
    // Let's replace `.where(X).equals(Y).toArray()` with `.where(X).equals(Y).filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()`
    // Actually, we can replace `.toArray()` with `.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()` if the line contains `db.${table}`
    
  });

  if (changed) {
    if (!content.includes("useAppStore")) {
      const importIndex = content.lastIndexOf('import ');
      const endOfLine = content.indexOf('\n', importIndex);
      content = content.slice(0, endOfLine + 1) + "import { useAppStore } from '@/stores/appStore';\n" + content.slice(endOfLine + 1);
    }
    fs.writeFileSync(file, content);
    console.log('Updated: ' + file);
  }
});
