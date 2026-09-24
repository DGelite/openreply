const fs = require('fs');
const path = require('path');

function searchFiles(dir, queries) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        searchFiles(fullPath, queries);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        for (const q of queries) {
          if (line.includes(q)) {
            console.log(`${fullPath}:${i + 1}: ${line.trim()}`);
          }
        }
      });
    }
  }
}

searchFiles('i:/Desktop/openreply-main', ['keywords', 'publicReplyMessages']);
