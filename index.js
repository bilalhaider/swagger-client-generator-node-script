var fs = require('fs-extra');
var mv = require('mv');
var request = require('request');
var extract = require('extract-zip')

// inputs
var swaggerFileUri = "https://win.fortresslab.uk/passfort/v2/api-docs";
var clientOutputPath = "..\\generated\\apiClient"
var clientType = "typescript-angular";

var generatorUri = `https://generator.swagger.io/api/gen/clients/${clientType}`;
var cwd = process.cwd();
var tempFolder = cwd + "\\sgtemp";
var zipDownloadPath = tempFolder + "\\temp.zip";
var extractedPath = tempFolder + `\\${clientType}-client`;

var deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

request({
    method: "GET",
    uri: swaggerFileUri
}, function (err1, res1, body1) {

    // response from swagger file request

    console.log(`Response from ${swaggerFileUri}, ${err1}, ${res1.statusCode}, ${res1.statusMessage}`);

    if (err1 || res1.statusCode != 200) {
        return;
    }

    var spec = JSON.parse(body1);

    // requesting client generation
    request({
        method: "POST",
        uri: generatorUri,
        body: {
            spec: spec
        },
        json: true
    }, function (err2, res2, body2) {

        // response from client generation request

        console.log(`Response from ${generatorUri}, ${err2}, ${res2.statusCode}, ${res2.statusMessage}`);

        if (err2 || res2.statusCode != 200) {
            return;
        }

        var download = function (url, dest, callback) {
            var file = fs.createWriteStream(dest);
            var sendReq = request.get(url);

            // verify response code
            sendReq.on('response', function (response) {
                if (response.statusCode !== 200) {
                    return callback('Response status was ' + response.statusCode);
                }
            });

            // check for request errors
            sendReq.on('error', function (err) {
                fs.unlink(dest);
                return callback(err.message);
            });

            sendReq.pipe(file);

            file.on('finish', function () {
                file.close(callback);  // close() is async, call cb after close completes.
            });

            file.on('error', function (err) { // Handle errors
                fs.unlink(dest); // Delete the file async. (But we don't check the result)
                return callback(err.message);
            });
        };

        deleteFolderRecursive(tempFolder);
        fs.mkdirSync(tempFolder);

        download(body2.link, zipDownloadPath, function (errorMessage) {

            var cleanup = function () {
                fs.remove(tempFolder);
            }

            if (errorMessage) {
                console.error(errorMessage);
                cleanup();
            }
            else {
                extract(zipDownloadPath, { dir: tempFolder }, function (err) {
                    // extraction is complete. make sure to handle the err

                    if (err) {
                        console.error(err);
                        cleanup();
                    }
                    else {

                        deleteFolderRecursive(clientOutputPath);

                        mv(extractedPath, clientOutputPath, { mkdirp: true }, function (err) {

                            if (err) {
                                console.error(err);
                            }
                            else {
                                console.log("Process completed");
                            }

                            cleanup();
                        });
                    }
                })
            }
        });

    });

    console.log(`Fetching from ${generatorUri}`);

});

console.log(`Fetching from ${swaggerFileUri}`);