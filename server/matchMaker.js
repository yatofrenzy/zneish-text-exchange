const { joinQuickMatch } = require("./roomManager");

function quickMatch(socketId, name) {
  return joinQuickMatch(socketId, name);
}

module.exports = {
  quickMatch
};
