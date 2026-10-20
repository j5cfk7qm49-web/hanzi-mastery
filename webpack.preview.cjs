const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const base = require('./webpack.config.cjs')({}, { mode: 'development' });
module.exports = { ...base, entry: { preview: './e2e/harness.tsx' },
  output: { ...base.output, path: path.resolve('preview-dist') },
  plugins: [new HtmlWebpackPlugin({templateContent:'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'}),
    new CopyPlugin({patterns:[{from:'dist/data',to:'data'}]})]
};
