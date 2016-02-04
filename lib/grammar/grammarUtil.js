/**
 * Iterates over rules in `ruleSets`, invoking `iteratee` for each rule. Invokes `iteratee` with one argument: (rule).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule.
 */
exports.forEachRule = function (ruleSets, iteratee) {
	var nontermSyms = Object.keys(ruleSets)

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var rules = ruleSets[nontermSyms[s]]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			iteratee(rules[r])
		}
	}
}