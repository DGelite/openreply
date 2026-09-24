const fs = require('fs');
const path = require('path');

let output = '';
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
            output += `${fullPath}:${i + 1}: ${line.trim()}\n`;
          }
        }
      });
    }
  }
}

searchFiles('i:/Desktop/openreply-main', ['queue/client', 'getDMQueue']);
fs.writeFileSync('i:/Desktop/openreply-main/search_queue.txt', output);
