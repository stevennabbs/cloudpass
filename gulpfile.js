var fs = require("fs");
var gulp = require('gulp');
var deb = require('gulp-deb');
var rename = require("gulp-rename");
var merge = require('merge-stream');
var pkg = require('./package.json');
 
gulp.task('deb', function () {
 
  return merge(
        gulp.src(
            [
                'src/**',
                'swagger/**',
                'migrations/**',
                'package.json'
            ],
            { base: process.cwd() }
        )
        .pipe(rename(function(path){
            path.dirname = '/usr/share/cloudpass/'+path.dirname;
         })),
        gulp.src(['deb/data/**']),
        gulp.src(["config/default.yaml"]).pipe(rename({dirname: "/etc/cloudpass"}))
    )
    .pipe(deb(pkg.name+'_'+pkg.version+'_all.deb', {
        name: pkg.name,
        version: pkg.version,
        maintainer: {
          name: pkg.author.name,
          email: pkg.author.email
        },
        architecture: 'all',
        depends: [
          'nodejs('+pkg.engines.node+')',
          'postgresql'
        ],
        section: 'misc',
        priority: 'extra',
        homepage: pkg.homepage,
        short_description: pkg.description,
        long_description: pkg.description,
        scripts:{
            preinst: fs.readFileSync("deb/control/preinst", "utf8"),
            postinst: fs.readFileSync("deb/control/postinst", "utf8"),
            prerm: fs.readFileSync("deb/control/prerm", "utf8"),
            postrm: fs.readFileSync("deb/control/postrm", "utf8")
        }
    }))
    .pipe(gulp.dest('build/'));
});