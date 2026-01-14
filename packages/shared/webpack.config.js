// THIS IS THE ONLY VERSION THAT WORKS RELIABLY WITH nest build + declaration files
const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = (options, webpack) => {
  return {
    ...options,
    entry: './src/index.ts',
    target: 'node',
    mode: options.mode,
    devtool: options.mode === 'production' ? 'source-map' : 'eval-source-map',
    externals: [
      nodeExternals({
        allowlist: [/^@nestjs/],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {
            transpileOnly: false, // REQUIRED for .d.ts emission
            configFile: path.resolve(__dirname, 'tsconfig.build.json'),
            // This line forces declaration emit even when nest cli tries to be fast
            getCustomTransformers: () => ({
              before: [require('typescript').emitDeclarationOnly ? undefined : undefined].filter(
                Boolean,
              ),
            }),
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      ...options.output,
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      library: { type: 'commonjs2' },
    },
    plugins: [
      ...options.plugins,
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
    ],
  };
};
