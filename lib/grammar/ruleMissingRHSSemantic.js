var util = require('../util/util')


/**
 * Checks if `rule` lacks and cannot produce a RHS semantic required for itself or an ancestor rule in `ruleSets`. If true, returns a parsing stack array: starts at the rule with a LHS semantic, ends with passed rule.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to inspect.
 * @returns {Object[]|boolean} Returns the stack demonstrating the missing required semantic, if any, else `false`.
 */
function ruleMissingRHSSemantic(ruleSets, nontermSym, rule) {
	// Return `false` if `rule` has a RHS semantic and can satisfy any LHS semantic requirement.
	if (ruleHasRHSSemantic(rule)) return false

	// Return `false` if `rule.RHS` produces a RHS semantic and can satisfy any LHS semantic requirement.
	if (!rule.isTerminal) {
		var RHS = rule.RHS
		for (var s = 0, RHSLen = RHS.length; s < RHSLen; ++s) {
			if (symProducesRHSSemantic(ruleSets, RHS[s])) return false
		}
	}

	// `rule` neither has nor produces a RHS semantic.
	// Check if `rule` or an ancestor has a LHS semantic requiring a RHS semantic.
	return getAncestorWithLHSSemantic(ruleSets, nontermSym, rule)
}

/**
 * Gets a rule that produces `nontermSym` (either in its RHS or as a descendant of a RHS symbol), has a LHS semantic, and the path from that rule to `nontermSym` lacks the required RHS semantic.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to inspect.
 *  @returns {Object[]|boolean} Returns the stack demonstrating the required semantic if any, else `false`.
 */
function getAncestorWithLHSSemantic(ruleSets, nontermSym, rule, _symsSeen) {
	var isBaseRule = !_symsSeen
	_symsSeen = _symsSeen || []

	// Prevent infinite recursion.
	if (_symsSeen.indexOf(nontermSym) !== -1) return false
	_symsSeen.push(nontermSym)

	// Return a parsing stack for `rule` if it has a LHS semantic (which requires a RHS semantic from a descendant).
	if (rule.semantic) {
		// Format parsing stack for printing and debugging.
		var node = {}
		node[nontermSym] = rule
		return [ node ]
	}

	// Examine rules with `nontermSym` in their RHS to determine if `nontermSym` has an ancestor rule with a LHS semantic which requires `nontermSym` to produce a RHS semantic.
	for (var parentNontermSym in ruleSets) {
		var rules = ruleSets[parentNontermSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var parentRule = rules[r]

			// Skip edit rules because any semantics they have will be found in the original rule from which they derive.
			if (parentRule.insertionIdx !== undefined) continue

			// Skip if `parentRule` has a RHS semantic and can satisfy any LHS semantic requirement.
			if (ruleHasRHSSemantic(parentRule)) continue

			var parRHS = parentRule.RHS
			var isBinary = parRHS.length === 2
			var rhsIdx = parRHS.indexOf(nontermSym)

			// `parentRule` contains `nontermSym`.
			if (rhsIdx !== -1) {
				// Skip if a (required) RHS semantic can be found in the other branch of a binary reduction.
				var otherSym = parRHS[Number(!rhsIdx)]
				if (isBinary && symProducesRHSSemantic(ruleSets, otherSym)) continue

				// Check if `parentRule` or its ancestors has a LHS semantic (which requires `nontermSym` to produce a RHS semantic).
				var demandingRule = getAncestorWithLHSSemantic(ruleSets, parentNontermSym, parentRule, _symsSeen)
				if (demandingRule) {
					// Format parsing stack for printing and debugging.
					var node = {}
					node[nontermSym] = rule
					return demandingRule.concat(node)
				}
			}
		}
	}

	return false
}

/**
 * Checks if `nontermSym` has a RHS semantic, or its RHS symbols produce a rule with a RHS semantic.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to inspect.
 * @returns {boolean} Returns `true` if `nontermSym` has a RHS semantic or its RHS symbols produce a rule with a RHS semantic, else `false`.
 */
function symProducesRHSSemantic(ruleSets, nontermSym, _symsSeen) {
	_symsSeen = _symsSeen || []
	_symsSeen.push(nontermSym)

	// Check all rules produced by `nontermSym`.
	return ruleSets[nontermSym].some(function (rule) {
		if (ruleHasRHSSemantic(rule)) {
			return true
		}

		if (!rule.isTerminal) {
			// Check if RHS produces any rules with a RHS semantic.
			return rule.RHS.some(function (sym) {
				if (_symsSeen.indexOf(sym) === -1) {
					return symProducesRHSSemantic(ruleSets, sym, _symsSeen)
				}
			})
		}
	})
}

/**
 * Checks if `rule` contains a RHS semantic, has an inserted (RHS) semantic, is a placeholder which generates a RHS semantic argument from input.
 *
 * @param {Object} rule The rule to inspect.
 * @returns {boolean} Returns `true` if `rule` has a RHS semantic, else `false`.
 */
function ruleHasRHSSemantic(rule) {
	return rule.semanticIsRHS || (rule.isTerminal && rule.semantic) || rule.insertedSemantic || rule.isPlaceholder
}

// Export `ruleMissingRHSSemantic()`.
module.exports = ruleMissingRHSSemantic