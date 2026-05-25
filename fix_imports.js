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
  if (content.includes('useAppStore') && !content.includes("import { useAppStore }") && !content.includes("import {useAppStore}")) {
    const importIndex = content.lastIndexOf('import ');
    if (importIndex !== -1) {
       const endOfLine = content.indexOf('\n', importIndex);
       content = content.slice(0, endOfLine + 1) + "import { useAppStore } from '@/stores/appStore';\n" + content.slice(endOfLine + 1);
       fs.writeFileSync(file, content);
       console.log('Fixed import in ' + file);
    }
  }
});
