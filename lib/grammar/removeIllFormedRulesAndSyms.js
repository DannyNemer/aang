var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var removeRulesMissingRequiredSemantics = require('./semanticChecks').removeRulesMissingRequiredSemantics
var symboldefLines = require('./NSymbol')._defLines


/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, rules that lack and can not produce a reduced semantic required for themselves or their ancestor rules, and any rule-less or unreachable (via the start symbol) nonterminal symbols that result.
 *
 * Given this procedure, if a `Category` were created, which adds the essential base rules, but has neither entities nor rules specific to the category, then this module will successfully remove all rules and symbols for that category because none can produce valid parse trees.
 *
 * Invoke this module before `createEditRules` to avoid creating edit-rules from these rules. Invoke this module before removing any other components in `removeUnusedComponents` (e.g., semantics) because the removal of rules here can render other grammar components unused.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output for symbols unreachable via the start symbol.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols or rules from `ruleSets`, else `false`.
 */
module.exports = function (ruleSets, suppressWarnings) {
	var iterationsCount = 0

	// Iterate until no new rule-less symbols remain.
	// Iterate until no difference are found instead of recursively searching the grammar after deleting a symbol for rules that produce that symbol, and repeating, because the latter yields more iterations of the grammar.
	do {
		++iterationsCount

		// Remove nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
		// Perform this check first to distinguish unused symbols and rules, which are not logged to the console, from those unreachable via the start symbol, which are often due to grammar design error and are logged to the console. The latter is checked after removing the unused symbols and rules to avoid conflating the two.
		var ruleOrSymRemoved = removeRulelessNonterminalSyms(ruleSets, true)

		// Remove nonterminal symbols unreachable via the start symbol.
		// Always check for nonterminal symbols unreachable from the start symbol, not just on the first iteration, because it is possible the removal of a rule-less symbol forces the removal of a binary rule whose other RHS symbol was that symbol's only path to the start symbol.
		ruleOrSymRemoved = removeUnreachableNonterminalSyms(ruleSets, suppressWarnings) || ruleOrSymRemoved

		// Remove non-edit rules that lack and can not produce a reduced semantic required for themselves or their ancestor rules.
		ruleOrSymRemoved = removeRulesMissingRequiredSemantics(ruleSets, suppressWarnings) || ruleOrSymRemoved
	} while (ruleOrSymRemoved)

	return iterationsCount > 1
}

/**
 * Removes nonterminal symbols without rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output for removing rule-less nonterminal symbols.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols or rules, else `false`.
 */
function removeRulelessNonterminalSyms(ruleSets, suppressWarnings) {
	var iterationsCount = 0

	do {
		++iterationsCount
		var ruleOrSymRemoved = false

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]
			var rulesLen = rules.length

			if (rulesLen === 0) {
				if (!suppressWarnings) {
					util.logWarning('Unused symbol:', util.stylize(nontermSym))
					util.log('  ' + symboldefLines[nontermSym])
				}

				// Remove rule-less nonterminal symbol.
				delete ruleSets[nontermSym]
				ruleOrSymRemoved = true
			} else {
				for (var r = 0; r < rulesLen; ++r) {
					var rule = rules[r]
					if (!rule.isTerminal) {
						for (var s = 0, rhs = rule.rhs, rhsLen = rhs.length; s < rhsLen; ++s) {
							// Remove nonterminal rule with RHS that contains previously removed symbol (which had no rules).
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
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output for symbols unreachable via the start symbol.
 * @returns {boolean} Returns `true` if removed any nonterminal symbols.
 */
function removeUnreachableNonterminalSyms(ruleSets, suppressWarnings) {
	var startSymbol = g.startSymbol.name
	var reachableSyms = getSymbolsReachableViaSym(ruleSets, startSymbol)
	var symRemoved = false

	// Remove the nonterminal symbols in the set difference of the nonterminal symbols in `ruleSets` and the nonterminal symbols reachable via the start symbol (returned by `getSymbolsReachableViaSym()`).
	var nontermSyms = Object.keys(ruleSets)
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]

		// Skip `[blank-inserted]`, which remains unused until creating insertion rules in `createEditRules`.
		if (nontermSym === g.blankInsertedSymbol.name) {
			continue
		}

		if (reachableSyms.indexOf(nontermSym) === -1) {
			if (!suppressWarnings) {
				util.logWarning('Unreachable symbol:', util.stylize(nontermSym))
				util.log('  ' + symboldefLines[nontermSym])
			}

			// Remove nonterminal symbol unreachable via the start symbol.
			delete ruleSets[nontermSym]
			symRemoved = true
		}
	}

	// Return `true` if removed any nonterminal symbols.
	return symRemoved
}

/**
 * Gets all nonterminal symbols `nontermSym` can reach via reductions.
 *
 * For use by `removeUnreachableNonterminalSyms()` for determining all nonterminal symbols unreachable via the start symbol.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol for which to get all reachable symbols.
 * @returns {string[]} Returns the array of all nonterminal symbols `nontermSym` can reach.
 */
function getSymbolsReachableViaSym(ruleSets, nontermSym) {
	var reachableSyms = [ nontermSym ]

	// Accumulate all nonterminal symbols `nontermSym` produces, the nonterminal symbols those symbols produce, and so forth.
	for (var s = 0; s < reachableSyms.length; ++s) {
		grammarUtil.forEachSymRule(ruleSets, reachableSyms[s], function (rule) {
			if (!rule.isTerminal) {
				var rhs = rule.rhs

				for (var i = 0, rhsLen = rhs.length; i < rhsLen; ++i) {
					var rhsSym = rhs[i]

					if (reachableSyms.indexOf(rhsSym) === -1) {
						reachableSyms.push(rhsSym)
					}
				}
			}
		})
	}

	return reachableSyms
}

/**
 * Recursively checks if `symbol` reaches (i.e., can be produced by) `lhsSymbol`, such as the start symbol.
 *
 * @deprecated No longer in use because replaced by `getSymbolsReachableViaSym()`, which enables `removeUnreachableNonterminalSyms()` to accomplish the same task ~90x faster.
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