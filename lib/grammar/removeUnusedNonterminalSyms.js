var util = require('../util/util')
var g = require('./grammar')
var symbolCreationLines = require('./NSymbol')._creationLines


/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less or unreachable (via the start symbol) nonterminal symbols that result.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output for symbols unreachable via the start symbol.
 */
module.exports = function (ruleSets, supressWarnings) {
	// Iterate until no new rule-less symbols remain.
	// Iterate until no difference are found instead of recursively searching the grammar after deleting a symbol for rules that produce that symbol, and repeating, because the latter yields more iterations of the grammar.
	do {
		// Remove nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
		var ruleOrSymRemoved = removeRulelessNonterminalSyms(ruleSets)

		// Remove nonterminal symbols unreachable via the start symbol.
		// Always check for nonterminal symbols unreachable from the start symbol, not just on the first iteration, because it is possible the removal of a rule-less symbol forces the removal of a binary rule whose other RHS symbol was that symbol's only path to the start symbol.
		ruleOrSymRemoved = removeUnreachableNonterminalSyms(ruleSets, supressWarnings) || ruleOrSymRemoved
	} while (ruleOrSymRemoved)
}

/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols or rules.
 */
function removeRulelessNonterminalSyms(ruleSets) {
	var iterationsCount = 0

	do {
		++iterationsCount
		var ruleOrSymRemoved = false

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]
			var rulesLen = rules.length

			if (rulesLen === 0) {
				// Delete rule-less nonterminal symbol.
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

	// Return `true` if removed any nonterminal symbols or rules.
	return iterationsCount > 1
}

/**
 * Removes nonterminal symbols unreachable via the start symbol.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output for symbols unreachable via the start symbol.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols.
 */
function removeUnreachableNonterminalSyms(ruleSets, supressWarnings) {
	var startSymbol = g.startSymbol.name
	var iterationsCount = 0

	do {
		++iterationsCount
		var symRemoved = false

		for (var nontermSym in ruleSets) {
			if (nontermSym !== startSymbol && !reachesSymbol(ruleSets, startSymbol, nontermSym)) {
				if (!supressWarnings) {
					util.logWarning('Unreachable symbol:', util.stylize(nontermSym))
					util.log('  ' + symbolCreationLines[nontermSym])
				}

				// Delete nonterminal symbol unreachable via the start symbol.
				delete ruleSets[nontermSym]
				symRemoved = true
			}
		}
	} while (symRemoved)

	// Return `true` if removed any nonterminal symbols.
	return iterationsCount > 1
}

/**
 * Recursively checks if `symbol` reaches (i.e., can be produced by) `lhsSymbol`, such as the start symbol.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} lhsSymbol The nonterminal symbol to check if it can produce `symbol`.
 * @param {string} symbol The symbol to check.
 * @returns {boolean} Returns `true` if `symbol` reaches `lhsSymbol`, else `false`.
 */
function reachesSymbol(ruleSets, lhsSymbol, symbol, _symsSeen) {
	// Track visited symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ lhsSymbol ]
	} else if (_symsSeen.indexOf(lhsSymbol) === -1) {
		_symsSeen.push(lhsSymbol)
	} else {
		return false
	}

	var rules = ruleSets[lhsSymbol]
	if (!rules) return false
	var rulesLen = rules.length

	// Check if `lhsSymbol` produces a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		if (rules[r].rhs.indexOf(symbol) !== -1) {
			return true
		}
	}

	// Recursively check if the RHS symbols of `lhsSymbol`'s rules produce a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (!rule.isTerminal) {
			var rhs = rule.rhs

			for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
				if (reachesSymbol(ruleSets, rhs[s], symbol, _symsSeen)) {
					return true
				}
			}
		}
	}

	return false
}