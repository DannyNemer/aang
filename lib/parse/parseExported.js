// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
var util = require('../util/util')
util.prettifyStackTrace()

var StateTable = require('./StateTable')
var Parser = require('./Parser')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = new StateTable(require('../grammar.json'))
var parser = new Parser(stateTable)

/**
 * Parses `query` using the state table generated for the grammar and returns the `k`-best parse trees, along with the trees' associated semantic trees and conjugated display texts.
 *
 * @memberOf Parser
 * @param {string} query The input query to parse.
 * @param {number} [k=7] The maximum number of parse trees to find.
 * @param {Object} [options] The `pfsearch` options object.
 * @param {boolean} [options.buildTrees=false] Specify constructing parse trees for printing.
 * @param {boolean} [options.printAmbiguity=false] Specify printing instances of ambiguity.
 * @returns {ParseResults} Returns the `k`-best parse trees and associated parse statistics.
 */
module.exports = Parser.prototype.parse.bind(parser)