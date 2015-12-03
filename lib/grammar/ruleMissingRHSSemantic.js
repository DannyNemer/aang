var util = require('../util/util')


/**
 * Checks if `rule` lacks and cannot produce a RHS semantic required for itself or an ancestor rule in `ruleSets`.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to inspect.
 * @param {boolean} [printFailedParsePath] Specify printing a graph representation of the parse tree path if the check determines a required semantic is missing.
 * @returns {boolean} Returns `true` if `rule` lacks and cannot produce a RHS semantic required for itself or an ancestor rule, else `false`.
 */
function ruleMissingRHSSemantic(ruleSets, nontermSym, rule, printFailedParsePath) {
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
	var failedParsePath = getAncestorWithLHSSemantic(ruleSets, nontermSym, rule)

	if (failedParsePath) {
		if (printFailedParsePath) {
			util.logError('Rule will not produce needed RHS semantic:', util.stylize(nontermSym), '->', rule.RHS)
			util.dir(failedParsePath)
		}

		return true
	}

	return false
}

/**
 * Gets a rule that produces `nontermSym` (either in its RHS or as a descendant of a RHS symbol), has a LHS semantic, and the path from that rule to `nontermSym` lacks the required RHS semantic.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to inspect.
 *  @returns {Object[]|boolean} Returns the graph representation of the parse tree path from the rule requiring the RHS semantic, if any, else `false`.
 */
function getAncestorWithLHSSemantic(ruleSets, nontermSym, rule, _symsSeen) {
	var isBaseRule = !_symsSeen
	_symsSeen = _symsSeen || []

	// Prevent infinite recursion.
	if (_symsSeen.indexOf(nontermSym) !== -1) return false
	_symsSeen.push(nontermSym)

	// If `rule` has a LHS semantic, which requires a RHS semantic in a descendant, then return a graph representation of the parse tree path from `rule` to the base rule.
	if (rule.semantic) {
		return createNode(nontermSym, rule)
	}

	// Examine rules with `nontermSym` in their RHS to determine if `nontermSym` has an ancestor rule with a LHS semantic which requires `nontermSym` to produce a RHS semantic.
	for (var parentNontermSym in ruleSets) {
		var rules = ruleSets[parentNontermSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var parentRule = rules[r]

			// Skip edit rules because any semantics they have will be found in the original rule from which they derive.
			if (parentRule.insertedSymIdx !== undefined) continue

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
 * Checks if `nontermSym` has a RHS semantic, or its RHS symbols produce a rule with a RHS semantic.
 *
 * @private
 * @static
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
 * @private
 * @static
 * @param {Object} rule The rule to inspect.
 * @returns {boolean} Returns `true` if `rule` has a RHS semantic, else `false`.
 */
function ruleHasRHSSemantic(rule) {
	return rule.semanticIsReduced || (rule.isTerminal && rule.semantic) || rule.insertedSemantic || rule.isPlaceholder
}

/**
 * Creates a node formatted for printing in a parse tree graph representation.
 *
 * @private
 * @static
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym`.
 * @param {boolean} isBaseRule Specify this node is the base node of this search.
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
		node.children = [ { symbol: rule.RHS[0] } ]
		node.tree = rule.tree
	}

	// Omit `undefined` properties from printed graph.
	for ( prop in node) {
		if (node[prop] === undefined) {
			delete node[prop]
		}
	}

	return node
}

// Export `ruleMissingRHSSemantic()`.
module.exports = ruleMissingRHSSemantic