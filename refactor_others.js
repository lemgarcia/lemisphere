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

  let lines = content.split('\n');
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('db.') && lines[i].includes('.count()') && !lines[i].includes('.filter(')) {
       lines[i] = lines[i].replace(/\.count\(\)/g, `.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).count()`);
       changed = true;
    }
    // Only refactor .first() for db queries, exclude filter(x => ...).first() which is already safe, but if we do db.auth_users it doesn't need filter...
    if (lines[i].includes('db.') && lines[i].includes('.first()') && !lines[i].includes('.filter(') && !lines[i].includes('auth_users')) {
       lines[i] = lines[i].replace(/\.first\(\)/g, `.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).first()`);
       changed = true;
    }
    // Look for toArray() on .where(...).anyOf(...).toArray()
    if (lines[i].includes('db.') && lines[i].includes('.toArray()') && !lines[i].includes('.filter(') && !lines[i].includes('auth_users')) {
       lines[i] = lines[i].replace(/\.toArray\(\)/g, `.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).toArray()`);
       changed = true;
    }
    // Same for sortBy
    if (lines[i].includes('db.') && lines[i].includes('.sortBy(') && !lines[i].includes('.filter(') && !lines[i].includes('auth_users')) {
       lines[i] = lines[i].replace(/\.sortBy\(/g, `.filter(x => x.user_id === (useAppStore.getState().userId || 'default')).sortBy(`);
       changed = true;
    }
  }

  if (changed) {
    content = lines.join('\n');
    fs.writeFileSync(file, content);
    console.log('Updated: ' + file);
  }
});
