const path = require('node:path');
const fs = require('node:fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
module.exports = (_, argv = {}) => {
  const production = argv.mode !== 'development';
  const widgets = fs.readdirSync('./src/widgets').filter(f => f.endsWith('.tsx'));
  return {
    mode: production ? 'production' : 'development',
    entry: Object.fromEntries(widgets.flatMap(f => {
      const name = path.basename(f, '.tsx');
      return [[name, './src/widgets/' + f], [name + '-sandbox', './src/widgets/' + f]];
    })),
    output: { path: path.resolve('dist'), filename: '[name].js', publicPath: '', clean: true },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'] },
    module: { rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, loader: 'esbuild-loader', options: { loader: 'tsx', target: 'es2020' } },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] }
    ] },
    plugins: [
      new HtmlWebpackPlugin({ filename: 'index.html', inject: false, template: 'public/sandbox.html' }),
      new webpack.BannerPlugin({ banner: f => f.chunk.name.endsWith('-sandbox') ? '' : 'const IMPORT_META=import.meta;', raw: true }),
      new CopyPlugin({ patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' }, { from: 'README.md' },
        { from: 'LICENSE' }, { from: 'docs', to: 'docs', globOptions: { ignore: ['**/screenshots/**', '**/APP_ACCEPTANCE_*.md', '**/REVIEW_UI_REFRESH_*.md'] } },
        { from: 'public/dictionary', to: 'dictionary' }
      ] })
    ],
    performance: { hints: false }, devtool: production ? false : 'source-map'
  };
};
