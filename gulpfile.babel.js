import console from 'better-console';
import del from 'del';
import fs from 'fs';
import git from 'git-rev-sync';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';

const srcFiles = {
    server: ['src/**/*.js', '!src/public/**/*.js', '!src/public/**/vendor/*.js'],
    client: ['src/public/**/*.js', '!src/public/**/vendor/*.js'],
    clientVendor: ['src/public/**/vendor/*.js'],
    html: ['src/public/**/*.html'],
    styles: ['src/public/**/*.scss'],
    img: ['src/public/images/**/*']
};

const destFiles = {
    dir: 'build/public/'
};
destFiles.img = [`${destFiles.dir}images/**/*`, `!${destFiles.dir}images/**/*.ico`];

const DEBUG = true;
const OBFUSCATE = true;
const RENAME = true;
const STRIP_METADATA = false;
const $ = gulpLoadPlugins();

/**
 * delete files
 * @param destFdr path of the folder to be deleted.
 */
const deleteFilesDirs = (destFdr) => del(destFdr);

/**
 * eslint source files & fail on error
 * @param files
 * @returns {*}
 */
const linter = (files) => gulp.src(files)
    .pipe($.eslint())
    .pipe($.eslint.format());

/**
 * Files to be copied.
 * Reference is from root directory of gulpfile.js
 * @param files destination path of the files to be copied.
 */
const copier = (files) => gulp.src(files, { base: 'src' })
    .pipe($.plumber())
    .pipe(gulp.dest('build'));

/**
 * create git hash.js dynamically.
 */
gulp.task('git-hash', (done) => {
    const hash = `/**
 * Do not modify.
 * This file is auto-generated by VenomVendor on ${new Date()}
 * Changes will be overwritten.
 */
export default class Hash {
    static short() {
        return '${git.long().substr(0, 7)}';
    }

    static long() {
        return '${git.long()}';
    }
}
`;
    // noinspection JSDeprecatedSymbols
    fs.writeFile('./src/utils/hash.js', hash, (err) => {
        if (err) {
            throw err;
        }
        done();
    });
});

/**
 * es-lint gulpfile.js
 */
gulp.task('js-self-lint', () => linter(['*.js']));

/**
 * Start server & listen for changes.
 */
gulp.task('nodemon', (done) => {
    $.nodemon({
        script: 'server.js'
    }).on('start', () => {
        console.log('Starting...');
    }).on('restart', () => {
        console.log('Restarting...');
    });
    done();
});

/**
 * Clean build dir.
 */
gulp.task('clean', () => deleteFilesDirs('build'));

/**
 * eslint all server files.
 */
gulp.task('eslintSrc', () => linter(srcFiles.server));

/**
 * eslint all client/browser files.
 */
gulp.task('eslintClient', () => linter(srcFiles.client));

/**
 * eslint all js.
 */
gulp.task('eslint', gulp.series('eslintSrc', 'eslintClient'));

/**
 * minifies html files.
 */
gulp.task('minify-html', () => gulp.src(srcFiles.html)
    .pipe(DEBUG ? $.util.noop() : $.htmlmin({
        removeComments: true,
        removeCDATASectionsFromCDATA: true,
        collapseWhitespace: true,
        conservativeCollapse: false,
        preserveLineBreaks: false,
        collapseBooleanAttributes: true,
        useShortDoctype: false,
        removeAttributeQuotes: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        removeOptionalTags: true,
        removeIgnored: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
    }))
    .pipe(gulp.dest(destFiles.dir)));

/**
 * babelify, minify & uglify js.
 */
gulp.task('minify-js', () => gulp.src(srcFiles.client)
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel())
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest(destFiles.dir))
    .pipe(RENAME ? $.rename({ suffix: `-${git.short()}.min` }) : $.util.noop())
    .pipe(gulp.dest(destFiles.dir))
    .pipe(DEBUG ? $.util.noop() : $.uglify())
    .pipe(!DEBUG && OBFUSCATE ? $.util.noop() : $.jsObfuscator())
    .pipe(gulp.dest(destFiles.dir)));

/**
 * convert sass to css, add vendor prefix & comb css.
 */
gulp.task('styles', () => gulp.src(srcFiles.styles)
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.sass({
        outputStyle: 'expanded',
        sourceComments: DEBUG,
        sourceMap: DEBUG,
        sourceMapContents: DEBUG,
        sourceMapEmbed: DEBUG,
        indentWidth: 4
    }).on('error', $.sass.logError))
    .pipe($.sourcemaps.write())
    .pipe($.autoprefixer([
        'last 3 version',
        'Android 2.3',
        'Android >= 4',
        'Chrome >= 20',
        'Firefox >= 24',
        'Explorer >= 8',
        'iOS >= 6',
        'Opera >= 12',
        'Safari >= 5']))
    .pipe($.csscomb())
    .pipe(gulp.dest(destFiles.dir))
    .pipe(DEBUG ? $.util.noop() : $.cleanCss())
    .pipe(RENAME ? $.rename({ suffix: `-${git.short()}.min` }) : $.util.noop())
    .pipe(gulp.dest(destFiles.dir)));

/**
 * clears console in bash.
 */
gulp.task('clearConsole', (done) => {
    console.clear();
    done();
});

/**
 * copy images to build dir.
 */
gulp.task('images', () => copier(srcFiles.img));

/**
 * remove metadata in images via exiftool
 */
gulp.task('strip-metadata', () => gulp.src(destFiles.img, { read: false })
    .pipe(STRIP_METADATA ? $.shell(['exiftool -overwrite_original -all= <%= f(file.path) %>'], {
        templateData: {
            f: (s) => s
        },
        ignoreErrors: true,
        quiet: true
    }) : $.util.noop()));

/**
 * copy 3rd party js to build dir.
 */
gulp.task('vendor-js', () => copier(srcFiles.clientVendor));

/**
 * watches all tasks.
 */
gulp.task('watch', (done) => {
    gulp.watch(srcFiles.server, gulp.parallel('clearConsole', 'eslintSrc'));
    gulp.watch(srcFiles.client, gulp.parallel('clearConsole', gulp.series('eslintClient', 'minify-js')));
    gulp.watch(srcFiles.clientVendor, gulp.parallel('vendor-js'));
    gulp.watch(srcFiles.html, gulp.parallel('minify-html'));
    gulp.watch(srcFiles.styles, gulp.parallel('styles'));
    gulp.watch(srcFiles.img, gulp.parallel('images'));
    gulp.watch(destFiles.img, gulp.parallel('strip-metadata'));
    done();
});

/**
 * Gulp Travis
 */
gulp.task('travis',
    gulp.series(
        'clean',
        gulp.parallel(
            'minify-html',
            'vendor-js',
            'js-self-lint',
            'styles',
            gulp.series('git-hash', 'eslint', 'minify-js'),
            gulp.series('images', 'strip-metadata')
        )
    ));

/**
 * Initial/default task.
 */
gulp.task('default',
    gulp.series(
        'clean',
        gulp.parallel(
            'minify-html',
            'vendor-js',
            'js-self-lint',
            'styles',
            gulp.series('git-hash', 'eslint', 'minify-js'),
            gulp.series('images', 'strip-metadata')
        ),
        'watch',
        'nodemon'
    ));

export default gulp;
