const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const presets = () => ([
  '@babel/preset-react',
  [
    '@babel/preset-env',
    {
      modules: (isTest ? true : false),
    },
  ],
]);

const plugins = () => ([
  'macros',
  'lodash',
  [
    'babel-plugin-transform-builtin-extend',
    {
      globals: ['Error'],
    },
  ],
  '@babel/plugin-proposal-class-properties',
  '@babel/plugin-proposal-object-rest-spread',
  '@babel/plugin-proposal-export-default-from',
  '@babel/plugin-proposal-export-namespace-from',
  [
    'emotion',
    (isProduction ? { hoist: true } : {
      sourceMap: true,
      autoLabel: true,
    }),
  ],
]);

module.exports = {
  presets: presets(),
  plugins: plugins(),
};
