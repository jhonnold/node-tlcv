const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const autoprefixer = require('autoprefixer');
const path = require('path');
const webpack = require('webpack');

const PAGES = [
  {
    page: 'index.ejs',
    chunks: ['main'],
  },
  {
    page: 'admin.ejs',
    chunks: ['admin'],
  },
];

module.exports = {
  entry: {
    main: [
      'reset-css',
      'mini.css',
      'chessboardjs/www/css/chessboard.css',
      './public/ts/main.ts',
      './public/css/main.css',
    ],
    admin: ['reset-css', 'mini.css', './public/ts/admin.ts', './public/css/main.css'],
    ['dark-theme']: ['./public/css/dark-theme.css'],
  },
  output: {
    path: path.resolve('./build/public'),
    filename: '[name].bundle.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader' },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                ident: 'postcss',
                plugins: [autoprefixer],
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({ $: 'jquery' }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: './public/img', to: './img' },
        { from: './views/partials', to: '../views/partials' },
      ],
    }),
    ...PAGES.map(
      ({ page, chunks }) =>
        new HtmlWebpackPlugin({
          template: `!!raw-loader!./views/pages/${page}`,
          filename: `../views/pages/${page}`,
          favicon: './public/favicon.ico',
          chunks,
        }),
    ),
  ],
};
