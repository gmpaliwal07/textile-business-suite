const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/main.ts', // main-api entry point
  target: 'node',
  mode: 'production', // change to 'development' for dev builds
  externals: [nodeExternals()], // keep node_modules out of bundle
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // allows extension-less imports
    alias: {
      '@textile/shared': path.resolve(__dirname, '../../packages/shared/src/'),
      '@textile/validators': path.resolve(__dirname, '../../packages/validators/src/'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    clean: true, // cleans dist before building
  },
};
