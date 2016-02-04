/**
 * Recursively removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result from `ruleSets`.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	// Iterate until no new rule-less symbols are found.
	// Iterate until no difference are found instead of recursively searching the grammar after deleting a symbol for rules that produce that symbol, and repeating, because the latter yields more iterations of the grammar.
	do {
		var ruleOrSymRemoved = false

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]
			var rulesLen = rules.length

			if (rulesLen === 0) {
				// Delete nonterminal symbol without rules.
				delete ruleSets[nontermSym]
				ruleOrSymRemoved = true
			} else {
				for (var r = 0; r < rulesLen; ++r) {
					var rule = rules[r]
					if (!rule.isTerminal) {
						for (var s = 0, rhs = rule.rhs, rhsLen = rhs.length; s < rhsLen; ++s) {
							// Delete nonterminal rule with RHS that contains previously deleted symbol (which had no rules).
							if (!ruleSets.hasOwnProperty(rhs[s])) {
								rules.splice(r, 1)
								--r
								--rulesLen
								ruleOrSymRemoved = true
								break
							}
						}
					}
				}
			}
		}
	} while (ruleOrSymRemoved)
}