// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
var util = require('../util/util')
util.prettifyStackTrace()

var StateTable = require('./StateTable')
var Parser = require('./Parser')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = new StateTable(require('../grammar.json'))
var parser = new Parser(stateTable)

/**
 * Parses `query` and returns the `k`-best parse trees. Does not report parse errors. In contrast to `parse`, this module is not a command line program and is available for other internal modules to import.
 *
 * @param {query} query The input query to parse.
 * @param {number} k The maximum number of parse trees to find.
 * @returns {Object[]|undefined} Returns the `k`-best parse trees if the parse succeeds, else `undefined`.
 */
module.exports = Parser.prototype.parse.bind(parser)