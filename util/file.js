const fs = require('fs');

const deleteFile = filePath => {
  fs.unlink(filePath, err => {
    if (err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return error;
    }
  });
};

exports.deleteFile = deleteFile;
