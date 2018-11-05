var gulp = require('gulp');
var babel = require('gulp-babel');
var bs = require('browser-sync').create();

gulp.task('js', function() {
    return gulp.src('src/*.js')
        .pipe(babel())
        .pipe(gulp.dest('dist'))
        .pipe(bs.stream());
});

gulp.task('default', function() {
    bs.watch('src/*.css', function (event, file) {
        if (event === 'change') {
            bs.reload('*.css');
        }
    });

    bs.watch('./*.html', function (event, file) {
        if (event === 'change') {
            bs.reload('*.html');
        }
    });
    
    bs.init({
        server: './'
    });

    gulp.watch('src/*.js', gulp.series('js'));
});