const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/main.ts', // Nest entry point
  target: 'node',
  mode: 'production', // or 'development' for dev
  externals: [nodeExternals()], // ignore node_modules
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
    extensions: ['.ts', '.js'], // supports extension-less imports
    alias: {
      '@textile/shared': path.resolve(__dirname, '../../packages/shared/src/'),
      '@textile/validators': path.resolve(__dirname, '../../packages/validators/src/'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js',
    clean: true,
  },
};
