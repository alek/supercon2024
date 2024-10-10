const path = require('path');

module.exports = {
    entry: {
        main: './src/index.js',
        content: './src/content.js',
    },
    output: {
        filename: '[name].bundle.js', // Will create main.bundle.js and content.bundle.js
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'development',
};
