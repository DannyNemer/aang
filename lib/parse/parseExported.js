// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
var util = require('../util/util')
util.prettifyStackTrace()

var Parser = require('./Parser')
var pfsearch = require('./pfsearch')

var stateTable = require('./buildStateTable')('../grammar.json')
var parser = new Parser(stateTable)

/**
 * Parses `query` and returns the `k`-best parse trees. Does not report parse errors. In contrast to `parse`, this module is not a command line program and is available for other internal modules to import.
 *
 * @param {query} query The input query to parse.
 * @param {number} k The maximum number of parse trees to find.
 * @returns {Object[]|undefined} Returns the `k`-best parse trees if the parse succeeds, else `undefined`.
 */
module.exports = function (query, k) {
	// Parse `query`.
	var startNode = parser.parse(query)

	if (startNode) {
		// Find `k`-best parse trees.
		return pfsearch(startNode, k)
	}
}