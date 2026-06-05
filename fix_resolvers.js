const fs = require('fs');

let content = fs.readFileSync('src/infrastructure/graphql/resolvers.ts', 'utf8');

if (content.includes('Math.random().toString(36).substring(2, 15)')) {
    content = content.replace(/Math\.random\(\)\.toString\(36\)\.substring\(2, 15\)/g, 'crypto.randomUUID()');
    if (!content.includes('import crypto from \'crypto\';')) {
        content = "import crypto from 'crypto';\n" + content;
    }
    fs.writeFileSync('src/infrastructure/graphql/resolvers.ts', content);
    console.log('Fixed resolvers.ts');
} else {
    console.log('No Math.random() found in resolvers.ts, the code snippet in task description was likely a simplification or different version, but the issue actually describes fixing insecure randomness in the project overall.');
}
