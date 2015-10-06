var util = require('../util/util')


module.exports = ruleMissingNeededRHSSemantic

/**
 * Determines if `rule` lacks and cannot produce a RHS semantic needed by itself or an ancestor rule in `ruleSets`. If true, returns an parsing stack array: starts at the rule with a LHS semantic, ends with passed rule
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} rule The rule to inspect.
 * @param {string} lhsSym The rule's LHS nonterminal symbol.
 * @param {string[]} [symsSeen] The array of seen symbols.
 * @returns {undefined|Object[]} Returns the stack demonstrating the missing needed semantic, if found.
 */
function ruleMissingNeededRHSSemantic(ruleSets, rule, lhsSym, symsSeen) {
	// Rule has no RHS semantic
	if (!ruleHasRHSSemantic(rule)) {
		if (!rule.isTerminal && !symsSeen) {
			// Root function call - check if RHS produces a RHS semantic
			for (var s = 0, RHS = rule.RHS, RHSLen = RHS.length; s < RHSLen; ++s) {
				if (symProducesRHSSemantic(ruleSets, RHS[s])) return false
			}
		}

		// Rule has a LHS semantic (and no RHS semantic)
		if (rule.semantic) {
			// Format parsing stack for printing and debugging
			var node = {}
			node[lhsSym] = rule
			return [ node ]
		}

		var symsSeen = symsSeen || []
		if (symsSeen.indexOf(lhsSym) === -1) {
			symsSeen.push(lhsSym)

			// Check if `lhsSym` has ancestor rule with a LHS semantic, requiring `lhsSym` to produce a RHS semantic
			// Find rules where `lhsSym` is used in the RHS
			for (var nontermSym in ruleSets) {
				var rules = ruleSets[nontermSym]
				for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
					var parentRule = rules[r]
					var parRHS = parentRule.RHS
					var rhsIdx = parRHS.indexOf(lhsSym)

					// `parentRule` contains `lhsSym`
					if (rhsIdx !== -1) {
						// Check if a (needed) RHS semantic can be found in the other branch of a binary reduction
						var otherSym = parRHS[Number(!rhsIdx)]
						if (otherSym && symProducesRHSSemantic(ruleSets, otherSym)) return false

						var demandingRule = ruleMissingNeededRHSSemantic(ruleSets, parentRule, nontermSym, symsSeen)
						if (demandingRule) {
							// Format parsing stack for printing and debugging
							var node = {}
							node[lhsSym] = rule
							return demandingRule.concat(node)
						}
					}
				}
			}
		}
	}
}

/**
 * Checks if `lhsSym` has a RHS semantic, or its RHS symbols produce a rule with a RHS semantic.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} lhsSym [description]
 * @param {string[]} symsSeen The array of seen symbols.
 * @returns {boolean} Returns `true` if `lhsSym` has a RHS semantic, or its RHS symbols produce a rule with a RHS semantic, else `false`.
 */
function symProducesRHSSemantic(ruleSets, lhsSym, symsSeen) {
	var symsSeen = symsSeen || []
	symsSeen.push(lhsSym)

	// Check all rules of the `lhsSym`
	return ruleSets[lhsSym].some(function (rule) {
		if (ruleHasRHSSemantic(rule)) {
			return true // Rule has a RHS semantic
		}

		if (!rule.isTerminal) {
			// Check if RHS produces any rules with a RHS semantic
			return rule.RHS.some(function (sym) {
				if (symsSeen.indexOf(sym) === -1) {
					return symProducesRHSSemantic(ruleSets, sym, symsSeen)
				}
			})
		}
	})
}

/**
 * Determines if `rule` contains a RHS semantic, has an inserted (RHS) semantic, or RHS is <int> or an entity category which becomes a semantic argument.
 *
 * @param {Object} rule The rule to inspect.
 * @returns {boolean} Returns `true` if `rule` has a RHS semantic, else `false`.
 */
function ruleHasRHSSemantic(rule) {
	return rule.semanticIsRHS || (rule.isTerminal && rule.semantic) || rule.insertedSemantic || rule.isPlaceholder
}