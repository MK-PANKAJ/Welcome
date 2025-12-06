const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer to be inside the project folder
    // This ensures it persists and is found during runtime on Render
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
