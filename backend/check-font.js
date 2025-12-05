const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
const buffer = Buffer.alloc(10);
const fd = fs.openSync(fontPath, 'r');
fs.readSync(fd, buffer, 0, 10, 0);
fs.closeSync(fd);

console.log('First 10 bytes:', buffer);
console.log('Hex:', buffer.toString('hex'));
console.log('String:', buffer.toString());
