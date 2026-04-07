const fs = require('fs');
const files = ['d4.png', 'd6.png', 'd8.png', 'd10.png', 'd12.png', 'd20.png', 'd100.png', '3d8.png'];
files.forEach(f => {
  const content = fs.readFileSync('public/' + f);
  console.log(f + ':' + content.toString('base64'));
});
