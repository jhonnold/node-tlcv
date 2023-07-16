import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import autoprefixer from 'autoprefixer';
import path from 'path';
import webpack from 'webpack';

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

export default {
  entry: {
    main: [
      'reset-css',
      'mini.css',
      'chessboardjs/www/css/chessboard.css',
      './public/js/main.js',
      './public/css/main.css',
    ],
    admin: ['reset-css', 'mini.css', './public/js/admin.js', './public/css/main.css'],
    ['dark-theme']: ['./public/css/dark-theme.css'],
  },
  output: {
    path: path.resolve('./build/public'),
    filename: '[name].bundle.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
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
          chunks,
        }),
    ),
  ],
};
