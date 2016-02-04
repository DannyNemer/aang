/**
 * Iterates over rules in `ruleSets`, invoking `iteratee` for each rule. Invokes `iteratee` with two arguments: (rule, nontermSym).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule.
 */
exports.forEachRule = function (ruleSets, iteratee) {
	exports.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			iteratee(rules[r], nontermSym)
		}
	})
}

/**
 * Iterates over rule sets in `ruleSets`, invoking `iteratee` for each rule set. Invokes `iteratee` with two arguments: (rules, nontermSym).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule set.
 */
exports.forEachRuleSet = function (ruleSets, iteratee) {
	var nontermSyms = Object.keys(ruleSets)

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]
		iteratee(ruleSets[nontermSym], nontermSym)
	}
}