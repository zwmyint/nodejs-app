const fs = require('fs');

const deleteFile = filePath => {
  setTimeout(function() {
    fs.unlink(filePath, err => {
      if (err) {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return error;
      }
    });
  }, 63000);
};

exports.deleteFile = deleteFile;
