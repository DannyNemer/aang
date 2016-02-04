var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


/**
 * Checks if `rule` lacks and cannot produce a reduced semantic required for itself or an ancestor rule in `ruleSets`.
 *
 * First, checks if `rule` has a reduced semantic. If not, checks if `rule.rhs` can produce a reduced semantic. (Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced.) If not, neither has nor can produce a reduced semantic, checks if `rule` or an ancestor rule has a non-reduced semantic (which requires a semantic), and returns `true` if found.
 *
 * @static
 * @memberOf semanticChecks
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The LHS (nonterminal) symbol of the rule to check.
 * @param {Object} rule The rule produced by `nontermSym` to check.
 * @param {boolean} [printFailedParsePath] Specify printing a graph representation of the parse tree path if a required semantic is missing.
 * @returns {boolean} Returns `true` if `rule` lacks and cannot produce a reduced semantic required for itself or an ancestor rule, else `false`.
 */
exports.ruleMissingReducedSemantic = function (ruleSets, nontermSym, rule, printFailedParsePath) {
	// Return `false` if `rule` has a reduced semantic and can satisfy any LHS semantic requirement.
	if (ruleHasReducedSemantic(rule)) return false

	// Return `false` if `rule.rhs` can produce a reduced semantic and can satisfy any LHS semantic requirement.
	// Note: It would be better to check for any semantic, instead of only reduced semantics, because if there is a series of rules with LHS semantics, but only the last semantic is missing its RHS semantic, then only that semantic's rule should be reported. But this would miss pairs of recursive rules that never produce reduced semantics:
	//   X -> Y func()   Y -> X func()
	//     -> Z func()   Z -> X func()
	//     -> 'x'
	if (!rule.isTerminal) {
		var rhs = rule.rhs
		for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
			if (symCanProduceReducedSemantic(ruleSets, rhs[s])) return false
		}
	}

	// `rule` neither has nor can produce a reduced semantic. Check. if `rule` or an ancestor rule has a non-reduced semantic (which requires a semantic).
	var failedParsePath = getAncestorWithLHSSemantic(ruleSets, nontermSym, rule)
	if (failedParsePath) {
		if (printFailedParsePath) {
			util.logError('Rule can not produce required reduced semantic semantic:', grammarUtil.stringifyRule(nontermSym, rule))
			util.dir(failedParsePath)
			util.log()
		}

		return true
	}

	return false
}

/**
 * Gets a rule that produces `nontermSym` (either in as a RHS symbol or as a descendant of a RHS symbol), has a LHS semantic, and the path from that rule to `nontermSym` lacks the required reduced semantic.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to check.
 * @returns {Object[]|boolean} Returns the graph representation of the parse tree path from the rule requiring the reduced semantic to `rule`, if any, else `false`.
 */
function getAncestorWithLHSSemantic(ruleSets, nontermSym, rule, _symsSeen) {
	var isBaseRule = !_symsSeen

	// Track visited symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	// If `rule` has a LHS semantic, which requires a reduced semantic in a descendant, then return a graph representation of the parse tree path from `rule` to the base rule.
	if (rule.semantic) {
		return createNode(nontermSym, rule, isBaseRule)
	}

	// Examine rules with `nontermSym` as a RHS symbol to determine if `nontermSym` has an ancestor rule with a LHS semantic which requires `nontermSym` to produce a reduced semantic.
	for (var parentNontermSym in ruleSets) {
		var rules = ruleSets[parentNontermSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var parentRule = rules[r]

			// Skip edit rules because any semantics they have will be found in the original rule from which they derive.
			if (parentRule.insertedSymIdx !== undefined) continue

			// Skip if `parentRule` has a reduced semantic and can satisfy any LHS semantic requirement.
			if (ruleHasReducedSemantic(parentRule)) continue

			var parRHS = parentRule.rhs
			var isBinary = parRHS.length === 2
			var rhsIdx = parRHS.indexOf(nontermSym)

			// `parentRule` contains `nontermSym`.
			if (rhsIdx !== -1) {
				// Skip if a (required) reduced semantic can be found in the other branch of a binary reduction.
				var otherSym = parRHS[Number(!rhsIdx)]
				if (isBinary && symCanProduceReducedSemantic(ruleSets, otherSym)) continue

				// Check if `parentRule` or its ancestors has a LHS semantic (which requires `nontermSym` to produce a reduced semantic).
				var ancestorNode = getAncestorWithLHSSemantic(ruleSets, parentNontermSym, parentRule, _symsSeen)
				if (ancestorNode) {
					// Get the last node added to the parse tree path, which is the parent node of `node`.
					var lastNode = ancestorNode.lastNode || ancestorNode

					// Create a node formatted for printing in a parse tree path graph representation.
					var node = createNode(nontermSym, rule, isBaseRule)

					// Add child nodes to parse tree path.
					if (isBinary) {
						var otherNode = { symbol: otherSym }
						lastNode.children = rhsIdx === 0 ? [ node, otherNode ] : [ otherNode, node ]
					} else {
						lastNode.children = [ node ]
					}

					if (isBaseRule) {
						// No more rules to follow the base rule.
						delete ancestorNode.lastNode
					} else {
						// Save `node` as the last node added to `ancestorNode` and the node to append the next child nodes.
						ancestorNode.lastNode = node
					}

					return ancestorNode
				}
			}
		}
	}

	return false
}

/**
 * Checks if `nontermSym` can produce a rule with a has reduced semantic.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a reduced semantic, else `false`.
 */
function symCanProduceReducedSemantic(ruleSets, nontermSym, _symsSeen) {
	// Track visited symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	// Check all rules `nontermSym` produces.
	return ruleSets[nontermSym].some(function (rule) {
		if (ruleHasReducedSemantic(rule)) {
			return true
		} else if (!rule.isTerminal) {
			// Check if RHS produces any rules with a reduced semantic.
			return rule.rhs.some(function (sym) {
				return symCanProduceReducedSemantic(ruleSets, sym, _symsSeen)
			})
		}
	})
}

/**
 * Checks if `nontermSym` can produce a rule with a semantic.
 *
 * @static
 * @memberOf semanticChecks
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a semantic, else `false`.
 */
exports.symCanProduceSemantic = function (ruleSets, nontermSym, _symsSeen) {
	// Track visited symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	return ruleSets[nontermSym].some(function (rule) {
		if (rule.semantic || rule.isPlaceholder || rule.anaphoraPersonNumber) {
			return true
		} else if (!rule.isTerminal) {
			return rule.rhs.some(function (symbol) {
				return exports.symCanProduceSemantic(ruleSets, symbol, _symsSeen)
			})
		}
	})
}

/**
 * Checks if `rule` has a reduced semantic.
 *
 * This is true if `rule` is defined with a reduced semantic, has an inserted (reduced) semantic, is a placeholder that generates a reduced semantic argument from input, or is anaphoric and will copy the antecedent semantic.
 *
 * @private
 * @static
 * @param {Object} rule The rule to check.
 * @returns {boolean} Returns `true` if `rule` has a reduced semantic, else `false`.
 */
function ruleHasReducedSemantic(rule) {
	return rule.semanticIsReduced || rule.insertedSemantic || rule.isPlaceholder || rule.anaphoraPersonNumber
}

/**
 * Creates a node formatted for printing in a parse tree graph representation.
 *
 * @private
 * @static
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym`.
 * @param {boolean} [isBaseRule] Specify this node is the base node of this search.
 * @returns {Object} Returns the formatted node.
 */
function createNode(nontermSym, rule, isBaseRule) {
	var node = {
		symbol: nontermSym,
		semantic: rule.semantic,
		insertedSemantic: rule.insertedSemantic,
		semanticIsReduced: rule.semanticIsReduced,
		rhsCanProduceSemantic: rule.rhsCanProduceSemantic,
		secondRHSCanProduceSemantic: rule.secondRHSCanProduceSemantic,
		text: rule.text,
	}

	// Add properties specific to the base node of this search.
	if (isBaseRule) {
		node.children = rule.rhs.map(function (rhsSym) {
			return { symbol: rhsSym }
		})

		node.tree = rule.tree
	}

	// Omit `undefined` properties from printed graph.
	util.deleteUndefinedObjectProps(node)

	return node
}