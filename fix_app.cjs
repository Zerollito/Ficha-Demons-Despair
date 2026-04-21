const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
let lines = content.split('\n');

// 1. Remove the stray block
let count = 0;
let foundIndex = -1;
for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('compVolume.toFixed(1)')) {
        count++;
        if (count === 2) {
            foundIndex = i;
            break;
        }
    }
}
if (foundIndex !== -1) {
    console.log('Found second volume display at line ' + (foundIndex + 1));
    // Remove span start line, current line, span end line, and the extra div closure
    lines.splice(foundIndex - 1, 4);
}

// 2. Remove bottom buttons (they are at the end of the compartment loop)
// Find the SubSection title="Itens" end and look for the flex buttons
let newContent = lines.join('\n');
newContent = newContent.replace(/<\/SubSection>([\s\S]*?)<div className="flex gap-2">[\s\S]*?<\/div>([\s\S]*?\{clipboard &&)/, '</SubSection>$1$2');

// 3. Fix colors
newContent = newContent.replace(/(value=\{item\.nome\}[\s\S]*?text-)amber-500/g, '$1zinc-100');

fs.writeFileSync('src/App.tsx', newContent);
console.log('Done');
