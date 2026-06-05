const fs = require('fs');
let code = fs.readFileSync('src/infrastructure/graphql/resolvers.ts', 'utf8');

if (code.includes('Math.random()')) {
  console.log('Math.random() found in resolvers.ts');
} else {
  console.log('Math.random() NOT found in resolvers.ts');
}

const lines = code.split('\n');
lines.forEach((line, index) => {
  if (line.includes('submitOpeningBalance:')) {
    console.log(`Found submitOpeningBalance at line ${index + 1}`);
    for(let i = index; i < index + 15; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
  }
});
