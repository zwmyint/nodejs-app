const fs = require('fs');
const sharp = require('sharp');
const nodePath = require('path');

function getDestination(req, file, cb) {
  cb(null, 'images');
}

function customStorage(opts) {
  this.getDestination = opts.destination || getDestination;
}

customStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  this.getDestination(req, file, function(err, path) {
    if (err) return cb(err);

    const outStream = fs.createWriteStream(path);
    const transform = sharp().resize({
      width: 200,
      height: 200,
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy
    });

    file.stream.pipe(transform).pipe(outStream);
    outStream.on('error', cb);
    outStream.on('finish', function() {
      cb(null, {
        path: path,
        size: outStream.bytesWritten
      });
    });
  });
};

customStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  fs.unlink(file.path, cb);
};

module.exports = function(opts) {
  return new customStorage(opts);
};
