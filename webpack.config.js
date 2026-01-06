const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      'service-worker': './src/background/service-worker.ts',
      'content-script': './src/content/content-script.ts',
      'popup': './src/popup/popup.ts',
      'offscreen': './src/offscreen/offscreen.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/popup/popup.css', to: 'popup.css' },
          { from: 'src/styles/overlay.css', to: 'overlay.css' },
          { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
          { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
        ],
      }),
    ],
    devtool: isProduction ? false : 'inline-source-map',
    optimization: {
      minimize: isProduction,
    },
  };
};
