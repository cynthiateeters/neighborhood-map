var onError = function (err) {
    console.log(err);
};

var gulp = require('gulp'),
    gutil = require('gulp-util'),
    htmllint = require('gulp-htmllint'),
    rename = require('gulp-rename'),
    plumber = require('gulp-plumber'),
    browserify = require('gulp-browserify'),
    compass = require('gulp-compass'),
    connect = require('gulp-connect'),
    jshint = require('gulp-jshint'),
    stylish = require('jshint-stylish'),
    csslint = require('gulp-csslint'),
    uncss = require('gulp-uncss'),
    cssnano = require('gulp-cssnano'),
    gulpif = require('gulp-if'),
    uglify = require('gulp-uglify'),
    htmlmin = require('gulp-htmlmin'),
    imagemin = require('gulp-imagemin'),
    pngcrush = require('imagemin-pngcrush'),
    imageResize = require('gulp-image-resize'),
    sourcemaps = require('gulp-sourcemaps'),
    runSequence = require('run-sequence'),
    del = require('del'),
    concat = require('gulp-concat');

var env,
    jsSources,
    jsHintSources,
    scriptSources,
    cssLintSources,
    sassSources,
    htmlSources,
    imageSources,
    fontSources,
    outputDir,
    sassStyle;

env = process.env.NODE_ENV || 'dev';

env = 'dist';

if (env === 'dev') {
    outputDir = 'dev/';
    sassStyle = 'expanded';
} else {
    outputDir = 'dist/';
    sassStyle = 'compressed';
}

htmlSources = [
    'dev/index.html'
];

jsSources = [
    'dev/js/flowtype.js',
    'dev/js/infobubble-mod.js',
    'dev/js/lscache.js',
    'dev/js/jquery-3.3.1.min.js',
    'dev/js/knockout-3.2.0.js',
    'dev/js/knockout.mapping-latest.js',
    'dev/js/mapapp.js',
    'dev/js/jquery.navgoco.js',
    'dev/js/offline.js',
    'dev/js/gdropdown.js'
];

jsHintSources = [
    'dev/js/mapapp.js'
];

cssLintSources = [
    'dev/css/main.css',
    'dev/css/off-canvas.css',
    'dev/css/gdropdown.css'
];

sassSources = [];

imageSources = [
    'dev/images/*'
];

fontSources = [
    'dev/fonts/*'
];

gulp.task('htmllint', function () {
    return gulp.src('dev/index.html')
        .pipe(htmllint({}, htmllintReporter));
});

function htmllintReporter(filepath, issues) {
    if (issues.length > 0) {
        issues.forEach(function (issue) {
            gutil.log(gutil.colors.cyan('[gulp-htmllint] ') + gutil.colors.white(filepath + ' [' + issue.line + ',' + issue.column + ']: ') + gutil.colors.red('(' + issue.code + ') ' + issue.msg));
        });

        process.exitCode = 1;
    }
}

gulp.task('jshint', function () {
    del('jshint-output.html');
    return gulp.src(jsHintSources)
        .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('gulp-jshint-html-reporter', {
            filename: 'jshint-output.html',
            createMissingFolders: false
        }));
});

gulp.task('csslint', function () {
    gulp.src(cssLintSources)
        .pipe(csslint())
        .pipe(csslint.reporter());
});

gulp.task('js', function () {
    gulp.src(jsSources)
        .pipe(gulpif(env === 'dist', uglify()))
        .pipe(gulp.dest(outputDir + 'js'))
        .pipe(connect.reload());
});

gulp.task('html', function () {
    gulp.src(htmlSources)
        .pipe(gulpif(env === 'dist', htmlmin({
            collapseWhitespace: true
        })))
        .pipe(gulpif(env === 'dist', gulp.dest(outputDir)))
        .pipe(connect.reload());
});

gulp.task('compass', function () {
    gulp.src(sassSources)
        .pipe(compass({
                sass: 'dev/sass',
                image: outputDir + 'images',
                css: outputDir + 'css',
                style: sassStyle
            })
            .on('error', gutil.log))
        .pipe(gulp.dest(outputDir + 'css'))
        .pipe(connect.reload());
});

gulp.task('minify-css', function () {
    gulp.src('dev/css/*.css')
        .pipe(gulpif(env === 'dist', cssnano()))
        .pipe(gulpif(env === 'dist', gulp.dest('dist/css')))
        .pipe(connect.reload());
});

gulp.task('thumbnail', function () {
    gulp.src('dev/images/**/*.*')
        .pipe(imageResize({
            width: 100
        }))
        .pipe(rename(function (path) {
            path.basename += '-thumbnail';
        }))
        .pipe(gulp.dest(outputDir + '/images'));
});

gulp.task('images', function () {
    gulp.src(imageSources)
        .pipe(gulpif(env === 'dist', gulp.dest(outputDir + 'images')))
        .pipe(connect.reload());
});

gulp.task('fonts', function () {
    gulp.src(fontSources)
        .pipe(gulpif(env === 'dist', gulp.dest(outputDir + 'fonts')))
        .pipe(connect.reload());
});

gulp.task('watch', function () {
    gulp.watch(jsSources, ['js']);
    gulp.watch('components/sass/*.scss', ['compass']);
    gulp.watch('dev/*.html', ['html']);
});

gulp.task('connect', function () {
    connect.server({
        root: outputDir,
        livereload: true
    });
});

gulp.task('clean', function () {
    return del([
        'dist/**/*',
    ]);
});

// Use connect and watch when developing code for instant update to browser
//gulp.task('default', ['html', 'build-css', 'js', 'images', 'connect', 'watch']);

gulp.task('default', ['html', 'minify-css', 'js', 'images']);
