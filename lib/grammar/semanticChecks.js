var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


/**
 * Iterates over rules in `ruleSets`, invoking `semanticChecks.ruleMissingReducedSemantic()` on each rule, removing non-edit rules that lack and can not produce a reduced semantic required for themselves or ancestor rules.
 *
 * While checking ancestor rules for a non-reduced semantic, if finds a parent rule that has yet to be evaluated for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary. Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
 *
 * Does not check edit-rules because if an edit-rules lacks a needed semantic, then that condition will also be true for the original rule from which it was derived.
 *
 * Invoke method within `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result from the removal of rules here.
 *
 * Given this procedure, if a `Category` is created, which adds the essential base rules, but has neither entities nor rules specific to the category, then all rules and symbols for that category are removed because none can produce valid parse trees.
 *
 * @static
 * @memberOf semanticChecks
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [printWarning] Specify printing a warning when removing a rule that can not produce a required semantic.
 * @returns {boolean} Returns `true` if any rules were removed, else `false`.
 */
exports.removeRulesMissingRequiredSemantics = function (ruleSets, printWarning) {
	// Track if rule removal by rule count because cannot monitor if `semanticChecks.ruleMissingReducedSemantic()` removes ancestor rules (which are not the rules passed here).
	var initRuleCount = grammarUtil.getRuleCount(ruleSets)

	// Iterate through rules normally, checking if each can produce any required semantic. Despite `semanticChecks.ruleMissingReducedSemantic()` checking parent rules before each individual rule, optimization attempts via breadth-first iteration (beginning with the start symbol and checking each child rule) would be immaterial because a parent symbol can be further from the start symbol than a symbol it produces that has another, shorter path to the start symbol.
	grammarUtil.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		// Do not cache `rules.length` because the array can change when removing problematic parent rules (for recursive rules) in recursive `semanticChecks.ruleMissingReducedSemantic()` invocations. Will never remove rules that precede index `r` because those have already been checked and removed if necessary.
		for (var r = 0; r < rules.length; ++r) {
			if (exports.ruleMissingReducedSemantic(ruleSets, nontermSym, rules[r], printWarning)) {
				// Decrement index after removing `rules[r]`.
				--r
			}
		}
	})

	// Preserve the `semanticSafe` properties, added by `semanticChecks.ruleMissingReducedSemantic()`, they are necessary to discard new edit-rules that can not produce a required reduced semantic.

	// Return `true` if any rules were removed to notify ``removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result.
	return initRuleCount !== grammarUtil.getRuleCount(ruleSets)
}

/**
 * Checks if `rule` lacks and can not produce a reduced semantic required for itself or an ancestor rule in `ruleSets`. Removes `rule` from the grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule).
 *
 * First, checks if `rule` has a reduced semantic. If not, checks if `rule.rhs` can produce a reduced semantic. (Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced.) If neither has nor can produce a reduced semantic, checks if `rule` or an ancestor rule has a non-reduced semantic (which requires a semantic). If found, removes `rule` from grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule), and returns `true` for all rules (i.e., edit- and non-edit-rules).
 *
 * While checking ancestor rules for a non-reduced semantic, if finds a parent rule this module has yet to evaluate for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary (i.e., if can not produce a required reduced semantic). Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
 *
 * Invoke method within `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result from the removal of rules here.
 *
 * @static
 * @memberOf semanticChecks
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The LHS (nonterminal) symbol of the rule to check.
 * @param {Object} rule The rule produced by `nontermSym` to check.
 * @param {boolean} [printWarning] Specify printing a warning if `rule` can not produce a required semantic.
 * @param {boolean} [printFailedParsePath] If `printWarning` is truthy, specify printing a graph representation of the parse tree path if `rule` can not produce a required semantic.
 * @returns {boolean} Returns `true` if `rule` lacks and can not produce a reduced semantic required for itself or an ancestor rule, else `false`.
 */
exports.ruleMissingReducedSemantic = function (ruleSets, nontermSym, rule, printWarning, printFailedParsePath) {
	// Track checked rules while recursively evaluating parent rules.
	rule.semanticSafe = true

	// Return `false` if `rule` has a reduced semantic and can satisfy any LHS semantic requirement.
	if (ruleHasReducedSemantic(rule)) return false

	// Return `false` if `rule.rhs` can produce a reduced semantic and can satisfy any LHS semantic requirement.
	// Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced:
	//   X -> Y func()   Y -> X func()
	//     -> Z func()   Z -> X func()
	//     -> 'x'
	if (!rule.isTerminal) {
		var rhs = rule.rhs
		for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
			if (symCanProduceReducedSemantic(ruleSets, rhs[s])) return false
		}
	}

	// `rule` neither has nor can produce a reduced semantic.
	// Check if `rule` or an ancestor rule has a non-reduced semantic (which requires a semantic).
	var failedParsePath = getAncestorWithLHSSemantic(ruleSets, nontermSym, rule, printWarning, printFailedParsePath)
	if (failedParsePath) {
		var rules = ruleSets[nontermSym]
		var ruleIdx = rules.indexOf(rule)

		// Remove and report problematic rule if already in grammar (i.e., only non-edit rules).
		if (ruleIdx !== -1) {
			rules.splice(ruleIdx, 1)

			if (printWarning) {
				util.logWarning('Rule can not produce required reduced semantic:')
				util.log('  ' + grammarUtil.stringifyRule(nontermSym, rule))
				util.log('  ' + rule.line)

				if (printFailedParsePath) {
					util.dir(failedParsePath)
					util.log()
				}
			}
		}

		return true
	}

	return false
}

/**
 * Gets a rule that produces `nontermSym` (either in as a RHS symbol or as a descendant of a RHS symbol), has a LHS semantic, and the path from that rule to `nontermSym` lacks the required reduced semantic.
 *
 * If finds a parent rule this module has yet to evaluate for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary (i.e., if can not produce a required reduced semantic). Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule produced by `nontermSym` to check.
 * @param {boolean} [printWarning] Specify printing a warning, in recursive `semanticChecks.ruleMissingReducedSemantic()` invocations, if `rule` can not produce a required semantic.
 * @param {boolean} [printFailedParsePath] If `printWarning` is truthy, specify printing, in recursive `semanticChecks.ruleMissingReducedSemantic()` invocations, a graph representation of the parse tree path if `rule` can not produce a required semantic.
 * @returns {Object[]|boolean} Returns the graph representation of the parse tree path from the rule requiring the reduced semantic to `rule`, if any, else `false`.
 */
function getAncestorWithLHSSemantic(ruleSets, nontermSym, rule, printWarning, printFailedParsePath, _rulesSeen, _nontermSyms) {
	var isBaseRule = !_rulesSeen

	// Track checked rules to prevent infinite recursion. Track rules instead of symbols to not skip recursive rules.
	if (!_rulesSeen) {
		_rulesSeen = [ rule ]
	} else if (_rulesSeen.indexOf(rule) === -1) {
		_rulesSeen.push(rule)
	} else {
		return false
	}

	// If `rule` has a LHS semantic, which requires a reduced semantic in a descendant, then return a graph representation of the parse tree path from `rule` to the base rule.
	if (rule.semantic) {
		return createNode(nontermSym, rule, isBaseRule)
	}

	if (!_nontermSyms) {
		_nontermSyms = Object.keys(ruleSets)
	}

	// Examine rules with `nontermSym` as a RHS symbol to determine if `nontermSym` has an ancestor rule with a LHS semantic which requires `nontermSym` to produce a reduced semantic.
	for (var s = 0, nontermSymsLen = _nontermSyms.length; s < nontermSymsLen; ++s) {
		var parentNontermSym = _nontermSyms[s]
		var parentRules = ruleSets[parentNontermSym]

		// Do not cache `rules.length` because the array can change when removing problematic parent rules (for recursive rules) in recursive `semanticChecks.ruleMissingReducedSemantic()` invocations. Will never remove rules that precede index `p` because those have already been checked and removed if necessary.
		for (var p = 0; p < parentRules.length; ++p) {
			var parentRule = parentRules[p]

			// Skip edit rules because any semantics they have will be found in the original rule from which they derive.
			if (parentRule.insertedSymIdx !== undefined) continue

			// Skip if `parentRule` has a reduced semantic and can satisfy any LHS semantic requirement.
			if (ruleHasReducedSemantic(parentRule)) continue

			var parRHS = parentRule.rhs
			var isBinary = parRHS.length === 2
			var rhsIdx = parRHS.indexOf(nontermSym)

			// `parentRule` contains `nontermSym`.
			if (rhsIdx !== -1) {
				// Check parent rules first for being unable to produce a required reduced semantic in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
				if (!parentRule.semanticSafe) {
					if (exports.ruleMissingReducedSemantic(ruleSets, parentNontermSym, parentRule, printWarning, printFailedParsePath)) {
						// Skip problematic (and now removed) parent rule.
						--p
						continue
					}
				}

				// Skip if a (required) reduced semantic can be found in the other branch of a binary reduction.
				var otherSym = parRHS[Number(!rhsIdx)]
				if (isBinary && symCanProduceReducedSemantic(ruleSets, otherSym)) continue

				// Check if `parentRule` or its ancestors has a LHS semantic (which requires `nontermSym` to produce a reduced semantic).
				var ancestorNode = getAncestorWithLHSSemantic(ruleSets, parentNontermSym, parentRule, printWarning, printFailedParsePath, _rulesSeen, _nontermSyms)
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
	// Track checked symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	// Check all rules `nontermSym` produces.
	var rules = ruleSets[nontermSym]
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		if (ruleHasReducedSemantic(rule)) {
			return true
		} else if (!rule.isTerminal) {
			// Check if RHS produces any rules with a reduced semantic.
			var rhs = rule.rhs
			for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
				if (symCanProduceReducedSemantic(ruleSets, rhs[s], _symsSeen)) {
					return true
				}
			}
		}
	}

	return false
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
	// Track checked symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	var rules = ruleSets[nontermSym]
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		if (rule.semantic || rule.isPlaceholder || rule.anaphoraPersonNumber) {
			return true
		} else if (!rule.isTerminal) {
			// Check if RHS produces any rules with a semantic.
			var rhs = rule.rhs
			for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
				if (exports.symCanProduceSemantic(ruleSets, rhs[s], _symsSeen)) {
					return true
				}
			}
		}
	}

	return false
}