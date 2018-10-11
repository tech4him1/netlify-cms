const path = require('path');
const webpack = require('webpack');
const pkg = require('./package.json');
const { getConfig, rules } = require('../../scripts/webpack.js');

const isProduction = process.env.NODE_ENV === 'production';

const baseConfig = getConfig();

module.exports = {
  ...baseConfig,
  context: path.join(__dirname, 'src'),
  entry: ['./index.js'],
  module: {
    rules: [
      ...baseConfig.module.rules,
      {
        test: /\.css$/,
        include: [/(redux-notifications|react-datetime)/],
        use: ['to-string-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.DefinePlugin({
      NETLIFY_CMS_VERSION: null,
      NETLIFY_CMS_CORE_VERSION: JSON.stringify(`${pkg.version}${isProduction ? '' : '-dev'}`),
    }),
  ],
};
