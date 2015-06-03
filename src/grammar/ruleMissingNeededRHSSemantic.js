var util = require('../util')
var grammar = require('./symbol').grammar


// Checks if rule lacks and cannot produce a RHS semantic needed by this rule or an ancestor
// If true, returns an parsing stack array: starts at the rule with a LHS semantic, ends with passed rule
module.exports = function ruleMissingNeededRHSSemantic(rule, lhsSym, symsSeen) {
	// Rule has no RHS semantic
	if (!ruleHasRHSSemantic(rule)) {
		if (!rule.terminal && !symsSeen) {
			// Root function call - check if RHS produces a RHS semantic
			for (var s = rule.RHS.length; s-- > 0;) {
				if (symProducesRHSSemantic(rule.RHS[s])) return false
			}
		}

		// Rule has a LHS semantic (and no RHS semantic)
		if (rule.semantic) {
			// Format parsing stack for printing and debugging
			var production = {}
			production[lhsSym] = rule
			return [ production ]
		}

		var symsSeen = symsSeen || []
		if (symsSeen.indexOf(lhsSym) === -1) {
			symsSeen.push(lhsSym)

			// Check if 'lhsSym' has ancestor rule with a LHS semantic, requiring 'lhsSym' to produce a RHS semantic
			// Find rules where 'lhsSym' is used in the RHS
			for (var nontermSym in grammar) {
				var rules = grammar[nontermSym]
				for (var r = rules.length; r-- > 0;) {
					var parentRule = rules[r]
					var parRHS = parentRule.RHS
					var rhsIdx = parRHS.indexOf(lhsSym)
					// parentRule contains 'lhsSym'
					if (rhsIdx !== -1) {
						// Check if a (needed) RHS semantic can be found in the other branch of a binary reduction
						var otherSym = parRHS[+!rhsIdx]
						if (otherSym && symProducesRHSSemantic(otherSym)) return false

						var demandingRule = ruleMissingNeededRHSSemantic(parentRule, nontermSym, symsSeen)
						if (demandingRule) {
							// Format parsing stack for printing and debugging
							var production = {}
							production[lhsSym] = rule
							return demandingRule.concat(production)
						}
					}
				}
			}
		}
	}
}

// Returns true if lhsSym has a RHS semantic, or its RHS symbols produce a rule with a RHS semantic
function symProducesRHSSemantic(lhsSym, symsSeen) {
	var symsSeen = symsSeen || []
	symsSeen.push(lhsSym)

	// Check all productions of the lhsSym
	return grammar[lhsSym].some(function (rule) {
		if (ruleHasRHSSemantic(rule)) {
			return true // Rule has a RHS semantic
		}

		if (!rule.terminal) {
			// Check if RHS produces any rules with a RHS semantic
			return rule.RHS.some(function (sym) {
				if (symsSeen.indexOf(sym) === -1) {
					return symProducesRHSSemantic(sym, symsSeen)
				}
			})
		}
	})
}

// Return true if rule contains a RHS semantic, has an inserted (RHS) semantic, or RHS
// is <int> or an entity category which becomes a semantic argument
function ruleHasRHSSemantic(rule) {
	return rule.semanticIsRHS || (rule.terminal && rule.semantic) || rule.insertedSemantic || rule.RHSIsPlaceholder
}