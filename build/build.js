var fs = require("fs"),
    sys = require("sys"),
    path = require("path"),
    os = require("os"),
    themes = require("./themes"),
    kendoBuild = require("./kendo-build"),
    cssmin = require("./lib/cssmin").cssmin,
    examples = require("./examples"),
    spawn = require('child_process').spawn,

    date = new Date(),
    STAT = fs.statSync("./"),
    VERSION = process.argv[2] || generateVersion(),
    KENDOCDN = process.argv[3] || "http://cdn.kendostatic.com/" + VERSION,
    RELEASE = "release",
    DEPLOY = "deploy",
    PATH = path.join(DEPLOY, "kendoUI"),
    JS = path.join(PATH, "js"),
    STYLES = path.join(PATH, "styles"),
    SOURCE = path.join(PATH, "source"),
    SOURCEJS = path.join(SOURCE, "js"),
    SOURCESTYLES = path.join(SOURCE, "styles"),
    ONLINEEXAMPLES = path.join(DEPLOY, "onlineExamples"),
    count = 0;

var cssRegExp = /\.css$/;

var scripts = [
    "kendo.core.js",
    "kendo.fx.js",
    "kendo.data.odata.js",
    "kendo.data.xml.js",
    "kendo.model.js",
    "kendo.data.js",
    "kendo.draganddrop.js",
    "kendo.groupable.js",
    "kendo.resizable.js",
    "kendo.sortable.js",
    "kendo.selectable.js",
    "kendo.scroller.js",
    "kendo.pageable.js",
    "kendo.popup.js",
    "kendo.list.js",
    "kendo.calendar.js",
    "kendo.datepicker.js",
    "kendo.autocomplete.js",
    "kendo.dropdownlist.js",
    "kendo.combobox.js",
    "kendo.chart.js",
    "kendo.grid.js",
    "kendo.menu.js",
    "kendo.panelbar.js",
    "kendo.tabstrip.js",
    "kendo.treeview.js",
    "kendo.slider.js",
    "kendo.splitter.js",
    "kendo.upload.js",
    "kendo.window.js"
];

function generateVersion() {
    var day = date.getDate();
    if (day < 10) {
        day = "0" + day;
    }
    return date.getFullYear() + ".2." + (date.getMonth() + 1) + "" + day;
}

function mkdir(newDir) {
    try {
        fs.statSync(newDir)
    } catch(e) {
        fs.mkdirSync(newDir, STAT.mode);
    }
}

function zip(name, filesPath) {
    var zipCommand = os.type() == "Linux" ? "7z" : path.resolve("./build/lib/7z/7z"),
    archive = spawn(zipCommand, ["a", "-tzip", name, '*'], {cwd: filesPath});

    archive.stderr.on('data', function (data) {
        sys.print('stderr: ' + data);
    });

    archive.on('exit', function (code) {
        if (code !== 0) {
            console.log("zip errro: " + code);
        }

        console.log("package " + name + " created.");

        if (count === 1) {
            console.log("Time elapsed: " + ((new Date() - date) / 1000) + " seconds");
        }

        count++;
    });
}

function createDirectories() {
    mkdir(DEPLOY);
    mkdir(RELEASE);
    mkdir(PATH);
    mkdir(SOURCE);
    mkdir(ONLINEEXAMPLES)
}

function processScripts() {
    mkdir(JS);
    mkdir(SOURCEJS);

    var all = "";

    scripts.forEach(function(file, key) {
        var data = fs.readFileSync(path.join("src", file), "utf8");

        if (data.charCodeAt(0) == 0xfeff) {
            data = data.substring(1);
        }

        fs.writeFileSync(path.join(SOURCEJS, file), data);

        all += data;

        data = kendoBuild.minifyJs(data);

        fs.writeFileSync(path.join(JS, file.replace(".js", ".min.js")), data);

    });

    all = kendoBuild.minifyJs(all);

    fs.writeFileSync(path.join(JS, "kendo.all.min.js"), all);
}

function processStyles() {
    kendoBuild.copyDirSyncRecursive("styles", SOURCESTYLES, false, /\.(css|png|jpg|jpeg|gif)$/i);
    kendoBuild.copyDirSyncRecursive("styles", STYLES, false, /\.(css|png|jpg|jpeg|gif)$/i);

    fs.readdirSync(STYLES).forEach(function(file) {
        if (cssRegExp.test(file)) {
            file = path.join(STYLES, file);

            var data = fs.readFileSync(file, "utf8");
            var minified = cssmin(data);

            fs.writeFileSync(file, minified);
            fs.renameSync(file, file.replace(".css", ".min.css"));
        }
    });
}

function buildExamplesIndex() {
    var navigation = kendoBuild.readText("demos/examples/js/kendo.examples.nav.js");
    eval(navigation);

    var indexTemplate = kendoBuild.template(
        kendoBuild.readText("build/templates/simple-index.html")
    );

    delete categories.overview;

    fs.writeFileSync(PATH + "/examples/index.html", indexTemplate(categories));
}

function buildExamples() {
    kendoBuild.copyDirSyncRecursive("demos/examples", path.join(PATH, "/examples"));
    kendoBuild.copyTextFile("src/jquery.js", path.join(PATH, "/examples/js/jquery.js"));
    kendoBuild.processFilesRecursive(PATH + "/examples", /\.html$/, function(name) {
        var data = fs.readFileSync(name, "utf8");
        data = data.replace(/..\/..\/..\/styles/g, "../../source/styles");
        data = data.replace(/..\/..\/..\/src\/jquery.js/g, "../js/jquery.js");
        data = data.replace(/..\/..\/..\/src/g, "../../source/js");
        fs.writeFileSync(name, data);
    });

    buildExamplesIndex();
}

console.log("build initiated.");
createDirectories();

//processing
console.log("processing scripts...");
processScripts();

console.log("building themes...");
themes.build();

console.log("processing styles...");
processStyles();

console.log("copying culture js files...");
kendoBuild.copyDirSyncRecursive("src/cultures", path.join(JS, "cultures"));

console.log("copying license agreement...");
var data = fs.readFileSync("resources/Kendo\ Beta\ EULA.pdf");
fs.writeFileSync(PATH + "/Kendo\ Beta\ EULA.pdf", data);

console.log("building examples...");
buildExamples();

console.log("building online examples...");
examples.build(PATH, ONLINEEXAMPLES, KENDOCDN);

//archives
console.log("packaging distribution...");
zip(path.resolve(path.join(RELEASE, "KendoUI_" + VERSION + ".zip")), PATH);

console.log("packaging online examples...");
zip(path.resolve(path.join(RELEASE, "OnlineExamples_" + VERSION + ".zip")), ONLINEEXAMPLES);
