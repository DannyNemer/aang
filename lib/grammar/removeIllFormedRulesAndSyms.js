var util = require('../util/util')
var g = require('./grammar')
var removeRulesMissingRequiredSemantics = require('./semanticChecks').removeRulesMissingRequiredSemantics
var symbolCreationLines = require('./NSymbol')._creationLines


/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, rules that lack and can not produce a reduced semantic required for themselves or ancestor rules, and any rule-less or unreachable (via the start symbol) nonterminal symbols that result.
 *
 * Given this procedure if a `Category` were created, which adds the essential base rules, but has neither entities nor rules specific to the category, then this module (followed by `removeIllFormedRulesAndSyms`) will successfully remove all rules and symbols for that category because none can produce valid parse trees.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output for symbols unreachable via the start symbol.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols or rules, else `false`.
 */
module.exports = function (ruleSets, supressWarnings) {
	var iterationsCount = 0

	// Iterate until no new rule-less symbols remain.
	// Iterate until no difference are found instead of recursively searching the grammar after deleting a symbol for rules that produce that symbol, and repeating, because the latter yields more iterations of the grammar.
	do {
		++iterationsCount

		// Remove nonterminal symbols unreachable via the start symbol.
		// Perform this check first to report unreachable symbols due to grammar design error. Otherwise, if were invoked `removeRulelessNonterminalSyms()` first, it will remove some of the same symbols for other reasons not alerted in the console.
		// Always check for nonterminal symbols unreachable from the start symbol, not just on the first iteration, because it is possible the removal of a rule-less symbol forces the removal of a binary rule whose other RHS symbol was that symbol's only path to the start symbol.
		var ruleOrSymRemoved = removeUnreachableNonterminalSyms(ruleSets, supressWarnings)

		// Remove nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
		ruleOrSymRemoved = removeRulelessNonterminalSyms(ruleSets) || ruleOrSymRemoved

		// Remove non-edit rules that lack and can not produce a reduced semantic required for themselves or ancestor rules.
		ruleOrSymRemoved = removeRulesMissingRequiredSemantics(ruleSets, !supressWarnings) || ruleOrSymRemoved
	} while (ruleOrSymRemoved)

	return iterationsCount > 1
}

/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols or rules, else `false`.
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
	var symsToRemove = []

	for (var nontermSym in ruleSets) {
		if (nontermSym !== startSymbol && !reachesSymbol(ruleSets, startSymbol, nontermSym)) {
			// Accumulate unreachable symbols and only iterate through the grammar once instead of deleting `symbols immediately. Otherwise, some symbols might be removed here, and alerted in the console as unreachable, as a result of removing another symbol here, though the mistake needing correction originates with the initial symbol. Though all removals are due to grammar design error, and the latter case is only avoidable on the first invocation of this function, this procedure emphasizes the needed corrections by reducing console warnings for symbols removed as a consequence of the problematic symbols.
			if (symsToRemove.indexOf(nontermSym) === -1) {
				symsToRemove.push(nontermSym)
			}
		}
	}

	// Delete nonterminal symbols unreachable via the start symbol.
	for (var s = 0, symsToRemoveLen = symsToRemove.length; s < symsToRemoveLen; ++s) {
		var unreachableSym = symsToRemove[s]

		if (!supressWarnings) {
			util.logWarning('Unreachable symbol:', util.stylize(unreachableSym))
			util.log('  ' + symbolCreationLines[unreachableSym])
		}

		delete ruleSets[unreachableSym]
	}

	// Return `true` if removed any nonterminal symbols.
	return symsToRemoveLen > 0
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
	// Track checked symbols to prevent infinite recursion.
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