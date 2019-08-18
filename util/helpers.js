exports = module.exports = {};

//Format numbers
exports.formatNumber = function(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

//Format Currency
exports.currencyFormat = function(num) {
  return '$' + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

//Format orderID
exports.sliceStr = function(str) {
  return String(str).match(/(.{5})$/)[1];
};
