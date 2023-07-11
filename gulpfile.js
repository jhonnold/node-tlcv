import gulp from 'gulp';
import plugins from 'gulp-load-plugins';
import rimraf from 'rimraf';
import webpack from 'webpack';
import webpackStream from 'webpack-stream';
import named from 'vinyl-named';
import imagemin from 'gulp-imagemin';

const $ = plugins({
  config: process.env.npm_package_json,
});

function clean(done) {
  rimraf('./build/public', done);
}

function images() {
  return gulp
    .src('./public/img/**/*')
    .pipe(imagemin({ progressive: true })) // can't use imagemin with load plugins
    .pipe(gulp.dest('./build/public/img'));
}

function css() {
  return gulp
    .src('./public/css/**/*.css')
    .pipe($.cleanCss({ compatibility: 'ie11' }))
    .pipe(gulp.dest('./build/public/css'));
}

function js() {
  return gulp
    .src(['./public/js/main.js', './public/js/admin.js'])
    .pipe(named())
    .pipe($.sourcemaps.init())
    .pipe(
      webpackStream({
        mode: 'production',
        module: {
          rules: [
            {
              test: /\.m?js/,
              resolve: {
                fullySpecified: false,
              },
            },
          ],
        },
        plugins: [new webpack.ProvidePlugin({ $: 'jquery' })],
      }),
    )
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('./build/public/js'));
}

function copy() {
  return gulp.src(['./public/**/*', '!./public/{img,css,js}/**/*']).pipe(gulp.dest('./build/public'));
}

function watch() {
  gulp.watch('./public/img/**/*').on('all', gulp.series(images));
  gulp.watch('./public/css/**/*').on('all', gulp.series(css));
  gulp.watch('./public/js/**/*').on('all', gulp.series(js));
  gulp.watch(['./public/**/*', '!./public/{img,css,js}/**/*']).on('all', gulp.series(copy));
}

gulp.task('build', gulp.series(clean, gulp.parallel(images, js, css, copy)));
gulp.task('default', gulp.series('build', watch));
