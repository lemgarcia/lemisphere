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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace user_id: 'default' with user_id: useAppStore.getState().userId || 'default'
  if (content.includes("user_id: 'default'")) {
    content = content.replace(/user_id:\s*'default'/g, "user_id: useAppStore.getState().userId || 'default'");
    changed = true;
  }

  // Refactor queries
  if (content.includes('useLiveQuery(')) {
    // Check if the component imports useAppStore. We will inject `const userId = useAppStore(s => s.userId) || 'default';`
    // And add userId to useLiveQuery dependencies.
    // This is hard to do via regex precisely.
    // Let's at least replace db.*.toArray() with db.*.where('user_id').equals(useAppStore.getState().userId || 'default').toArray() for simple queries?
    // No, useLiveQuery is reactive. It needs the component state.
    // We will do `db.table.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()`
    // Actually, useAppStore.getState().userId is NOT reactive inside useLiveQuery if it's not in the deps array!
  }

  if (changed) {
    // Ensure useAppStore is imported
    if (!content.includes("useAppStore")) {
      const importIndex = content.lastIndexOf('import ');
      const endOfLine = content.indexOf('\n', importIndex);
      content = content.slice(0, endOfLine + 1) + "import { useAppStore } from '@/stores/appStore';\n" + content.slice(endOfLine + 1);
    }
    fs.writeFileSync(file, content);
    console.log('Updated: ' + file);
  }
});
