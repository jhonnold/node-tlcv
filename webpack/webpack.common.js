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
      './src/client/main.js',
      './public/css/main.css',
    ],
    admin: ['reset-css', 'mini.css', './src/client/admin.js', './public/css/main.css'],
    ['dark-theme']: ['./public/css/dark-theme.css'],
  },
  output: {
    path: path.resolve('./build/public'),
    filename: 'js/[name].bundle.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: ['babel-loader'],
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
      filename: 'css/[name].css',
      chunkFilename: 'css/[id].css',
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
