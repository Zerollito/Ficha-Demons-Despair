import fs from 'fs';
import path from 'path';

const files = [
  '3d8.png',
  'd10.png',
  'd100.png',
  'd12.png',
  'd20.png',
  'd4.png',
  'd6.png',
  'd8.png'
];

let output = 'export const diceBase64: Record<string, string> = {\n';

files.forEach(file => {
  const filePath = path.join(process.cwd(), 'public', file);
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    output += `  '${file}': 'data:image/png;base64,${base64}',\n`;
  }
});

output += '};\n';

fs.writeFileSync(path.join(process.cwd(), 'src/diceIcons.ts'), output);
console.log('Generated src/diceIcons.ts');
