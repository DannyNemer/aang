var util = require('../util/util')


/**
 * Checks `ruleSets` for errors after constructing all rules and edit-rules. Such errors occur across multiple rules and therefore are only evident after rule construction completes.
 *
 * Invoke this module at the conclusion of grammar generation.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to inspect.
 */
module.exports = function (ruleSets) {
}