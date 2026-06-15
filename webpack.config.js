const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          use: [
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
            'css-loader',
            { loader: 'sass-loader', options: { api: 'modern', sassOptions: { silenceDeprecations: ['legacy-js-api'] } } },
          ],
        },
      ],
    },
    plugins: [
      new Dotenv({ silent: true }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: './public/favicon.svg',
      }),
      ...(isDev ? [] : [new MiniCssExtractPlugin({ filename: 'styles.[contenthash].css' })]),
    ],
    devServer: {
      static: './dist',
      hot: true,
      port: 3000,
      open: true,
    },
    devtool: isDev ? 'inline-source-map' : false,
  };
};
