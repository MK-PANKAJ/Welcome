require('dotenv').config();
const PImage = require('pureimage');
const path = require('path');
const fs = require('fs');

async function testGeneration() {
    console.log('--- Testing PureImage Certificate Generation ---');

    // 1. Load Font
    console.log('1. Loading Font...');
    const fontPath = path.join(__dirname, 'fonts', 'OpenSans-Regular.ttf');
    try {
        const font = PImage.registerFont(fontPath, 'Open Sans');
        await new Promise(r => font.load(r));
        console.log('   Font loaded successfully.');
    } catch (e) {
        console.error('   FAIL: Font load error (Check if fonts/OpenSans-Regular.ttf exists):', e.message);
        return;
    }

    // 2. Decode Template
    console.log('2. Decoding Template...');
    const templatePath = path.join(__dirname, 'template.jpg');
    let templateImage;
    try {
        const templateStream = fs.createReadStream(templatePath);
        templateImage = await PImage.decodeJPEGFromStream(templateStream);
        console.log('   Template loaded. Size:', templateImage.width, 'x', templateImage.height);
    } catch (e) {
        console.error('   FAIL: Template load error:', e.message);
        return;
    }

    let canvas;
    // 3. Draw
    console.log('3. Drawing...');
    try {
        canvas = PImage.make(templateImage.width, templateImage.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(templateImage, 0, 0);

        ctx.fillStyle = '#000000';
        ctx.font = "80pt 'Open Sans'";
        ctx.textAlign = 'center';
        ctx.fillText('Test User', canvas.width / 2, canvas.height / 2 - 50);

        console.log('   Drawing operations completed no-op check.');
    } catch (e) {
        console.error('   FAIL: Drawing error:', e.message);
        return;
    }

    // 4. Encode (Test output)
    console.log('4. Encoding to file (test-output.png)...');
    try {
        const outStream = fs.createWriteStream(path.join(__dirname, 'test-output.png'));
        // Encode
        await PImage.encodePNGToStream(canvas, outStream);

        await PImage.encodePNGToStream(canvas, outStream);
        console.log('   Success! test-output.png created.');
    } catch (e) {
        console.error('   FAIL: Encoding error:', e.message);
    }

    console.log('--- Done ---');
}

testGeneration();
