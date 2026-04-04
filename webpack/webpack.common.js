import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import autoprefixer from 'autoprefixer';
import path from 'path';
const PAGES = [
  {
    page: 'index.ejs',
    chunks: ['main'],
  },
  {
    page: 'admin.ejs',
    chunks: ['admin'],
  },
  {
    page: 'broadcasts.ejs',
    chunks: ['broadcasts'],
  },
];

export default {
  entry: {
    main: [
      'reset-css',
      'mini.css',
      'chessboardjs/www/css/chessboard.css',
      './public/js/index.ts',
      './public/css/main.scss',
    ],
    admin: ['reset-css', 'mini.css', './public/js/admin.ts', './public/css/main.scss'],
    broadcasts: ['reset-css', 'mini.css', './public/js/broadcasts.ts', './public/css/main.scss'],
    ['dark-theme']: ['./public/css/dark-theme.scss'],
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
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.frontend.json',
          },
        },
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
      {
        test: /\.scss$/,
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
          { loader: 'sass-loader' },
        ],
      },
    ],
  },
  plugins: [
    // Required for chessboardjs which expects jQuery on window.$
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: './public/img', to: './img' },
        { from: './public/audio', to: './audio' },
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
