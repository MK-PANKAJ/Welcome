
const PImage = require('pureimage');
const fs = require('fs');
const path = require('path');

async function check() {
    const templatePath = path.join(__dirname, 'template.jpg');
    const stream = fs.createReadStream(templatePath);
    const img = await PImage.decodeJPEGFromStream(stream);
    console.log(`Width: ${img.width}, Height: ${img.height}`);
}

check().catch(console.error);
