var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semanticPotential = require('./semanticPotential')


/**
 * Iterates over rules in `ruleSets`, invoking `semanticChecks.isRuleMissingReducedSemantic()` on each rule, removing non-edit rules that lack and can not produce a reduced semantic if required for themselves or their ancestor rules.
 *
 * While checking ancestor rules for a non-reduced semantic, if finds a parent rule this method has yet to evaluate, recursively evaluates that rule first and removes it from the grammar if necessary. Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
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
 * @param {boolean} [printWarnings] Specify printing warnings for rules that can not produce a required reduced semantic.
 * @returns {boolean} Returns `true` if any rules were removed, else `false`.
 */
exports.removeRulesMissingRequiredSemantics = function (ruleSets, printWarnings) {
	// Check if rules are removed by comparing rule count because cannot monitor if `semanticChecks.isRuleMissingReducedSemantic()` removes ancestor rules (which are not the rules passed here).
	var initRuleCount = grammarUtil.getRuleCount(ruleSets)

	// Iterate through rules normally, checking if each can produce a reduced semantic if required. Despite `semanticChecks.isRuleMissingReducedSemantic()` checking parent rules before each individual rule, optimization attempts via breadth-first iteration (beginning with the start symbol and checking each child rule) would be immaterial because a parent symbol can be further from the start symbol than a symbol it produces that has another, shorter path to the start symbol.
	grammarUtil.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		// Do not cache `rules.length` because the array can change when removing problematic parent rules (for recursive rules) in recursive `semanticChecks.isRuleMissingReducedSemantic()` invocations. Will never remove rules that precede index `r` because those have already been checked and removed if necessary.
		for (var r = 0; r < rules.length; ++r) {
			if (exports.isRuleMissingReducedSemantic(ruleSets, nontermSym, rules[r], printWarnings, true)) {
				// Decrement index after removing `rules[r]`.
				--r
			}
		}
	})

	// Preserve the `semanticSafe` properties that `semanticChecks.isRuleMissingReducedSemantic()` added because they are necessary to discard new edit-rules that can not produce a reduced semantic if required.

	// Return `true` if any rules were removed to notify `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result.
	return initRuleCount !== grammarUtil.getRuleCount(ruleSets)
}

/**
 * Checks if `rule` lacks and can not produce a reduced semantic if required for itself or its ancestor rules in `ruleSets`. If so, removes `rule` from the grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule).
 *
 * First, checks if `rule` has a reduced semantic. If not, checks if `rule.rhs` can produce a reduced semantic. (Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced.) If neither has nor can produce a reduced semantic, checks if `rule` or all ancestor rules has a non-reduced semantic (which requires a semantic). If all do (i.e., `rule` fails in every possible path), then removes `rule` from grammar if it exists in `ruleSets` (i.e., `rule` is a non-edit rule), and returns `true` for all rules (i.e., edit- and non-edit-rules).
 *
 * If at least one path can incorporate `rule` properly, i.e., the path does not require `rule` produce a reduced semantic, then returns `false`. Only rules that always fail are excluded from the output grammar.
 *
 * For example, consider the following CFG:
 *   S -> A B | A, intersect()
 *   A -> C D | D
 *   C -> "my", `objects(me)`
 *   D -> "objects"
 *   B -> "with property x", objects-property(x)
 *
 * The following parse trees constructed from the grammar are semantically legal:
 *   S -> A -> C -> "my"      => objects(me)
 *          -> D -> "objects"
 *   S -> A -> D -> "objects"    => objects-property(x)
 *     -> B -> "with property x"
 *
 * The following parse tree constructed from the grammar is semantically legal:
 *   S -> A -> D -> "object" => null
 *
 * As shown, `S -> A` and `A -> D` can both be used in semantically legal parse trees, though also fail to produce required semantics in other parse trees. Hence, only remove semantics if they can not produce a reduced semantic but are already required to by ancestor rules.
 *
 * While checking ancestor rules for a non-reduced semantic, if finds a parent rule this module has yet to evaluate for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary (i.e., if can not produce a required reduced semantic). Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
 *
 * Invoke method within `removeIllFormedRulesAndSyms` to remove any rule-less or unreachable nonterminal symbols that result from the removal of rules here.
 *
 * @static
 * @memberOf semanticChecks
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The LHS (nonterminal) symbol of the rule to check.
 * @param {Object} rule The rule `nontermSym` produces to check.
 * @param {boolean} [printWarnings] Specify printing warnings if `rule` (or ancestor rules) can not produce a required reduced semantic.
 * @param {boolean} [printFailedPaths] If `printWarnings` is truthy and `rule` (or ancestor rules) can not produce a reduced semantic, specify printing graph representations of the parse tree paths that require `rule` (or ancestor rules) to produce a reduced semantic, if any.
 * @returns {boolean} Returns `true` if `rule` lacks and can not produce a reduced semantic required for itself or its ancestor rules, else `false`.
 */
exports.isRuleMissingReducedSemantic = function (ruleSets, nontermSym, rule, printWarnings, printFailedPaths) {
	// Track checked rules while recursively evaluating parent rules.
	rule.semanticSafe = true

	// Return `false` if `rule` has a reduced semantic and can satisfy any LHS semantic requirement.
	if (semanticPotential.ruleHasReducedSemantic(rule)) return false

	// Return `false` if `rule.rhs` can produce a reduced semantic and can satisfy any LHS semantic requirement.
	// Must check for a reduced semantic, instead of any semantic, otherwise would not detect pairs of recursive rules that can never be reduced:
	//   X -> Y func()   Y -> X func()
	//     -> Z func()   Z -> X func()
	//     -> 'x'
	if (semanticPotential.rhsCanProduceReducedSemantic(ruleSets, rule)) return false

	// Cache `ruleSets` keys for faster iterations.
	var nontermSyms = Object.keys(ruleSets)

	// `rule` neither has nor can produce a reduced semantic.
	// Check if every ancestor path that produces `rule` has a LHS semantic that requires `rule` produce a reduced semantic. I.e., check if there are no semantically legal paths that incorporate `rule`.
	var failedParsePaths = getAncestorsWithLHSSemantic(ruleSets, nontermSyms, nontermSym, rule, printWarnings, printFailedPaths)
	if (failedParsePaths) {
		var rules = ruleSets[nontermSym]
		var ruleIdx = rules.indexOf(rule)

		// Remove problematic rule if already in grammar.
		if (ruleIdx !== -1) {
			rules.splice(ruleIdx, 1)
		}

		if (printWarnings) {
			printWarning(nontermSym, rule, failedParsePaths, printFailedPaths)
		}

		return true
	}

	return false
}

/**
 * Gets parse tree paths that produce `rule` (either with `nontermSym` as a RHS symbol or as a descendant of a RHS symbol), of which every path has a LHS semantic that requires `rule` produce a reduced semantic.
 *
 * If at least one path can incorporate `rule` properly, i.e., the path does not require `rule` produce a reduced semantic, then returns `false`. Only rules that always fail are excluded from the output grammar.
 *
 * If finds a parent rule this module has yet to evaluate for producing any required semantic, recursively evaluates that rule first and removes it from the grammar if necessary (i.e., if can not produce a required reduced semantic). Must check parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets` cached for faster iterations.
 * @param {string} nontermSym The nonterminal symbol for which to get ancestor paths.
 * @param {Object} rule The rule `nontermSym` produces to check.
 * @param {boolean} [printWarnings] Specify printing warnings in recursive `semanticChecks.isRuleMissingReducedSemantic()` invocations if `rule` (or ancestor rules) can not produce a required reduced semantic.
 * @param {boolean} [printFailedPaths] If `printWarnings` is truthy and `rule` (or ancestor rules) can not produce a reduced semantic, specify printing graph representations, in recursive `semanticChecks.isRuleMissingReducedSemantic()` invocations, of the parse tree paths that require `rule` (or ancestor rules) to produce a reduced semantic, if any.
 * @returns {Object[]|boolean} Returns the parse tree paths of ancestor rules if all require `rule` produce a reduced semantic, else `false`.
 */
function getAncestorsWithLHSSemantic(ruleSets, nontermSyms, nontermSym, rule, printWarnings, printFailedPaths, _rulesSeen) {
	var isBaseRule = !_rulesSeen

	// Track checked rules to prevent infinite recursion. Track rules instead of symbols to not skip recursive rules.
	if (!_rulesSeen) {
		_rulesSeen = [ rule ]
	} else if (_rulesSeen.indexOf(rule) === -1) {
		_rulesSeen.push(rule)
	} else {
		return false
	}

	// If `rule` has a LHS semantic, then create the root node for the graph representation of the parse tree path from `rule`, which requires the base rule produce a reduced semantic, to the base rule. `rule` was checked for a reduced semantic before this check.
	if (rule.semantic) {
		// Return as array.
		return [ createNode(nontermSym, rule, isBaseRule) ]
	}

	// Do not check for rule that produce the start symbol (because there are none).
	if (nontermSym === g.startSymbol.name) {
		return false
	}

	// The parse tree ancestor paths of `rule`, all of which require a reduced semantic. Every parent rule of `rule` must contribute at least one of the paths for the base rule to determine the base rule is always semantically illegal and should be discarded.
	var ancestorPathsWithLHSSemantics = []

	// Examine rules with `nontermSym` as a RHS symbol to determine if ancestors of `nontermSym` have LHS semantics that require `nontermSym` to produce a reduced semantic.
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var parentNontermSym = nontermSyms[s]
		var parentRules = ruleSets[parentNontermSym]

		// Do not cache `rules.length` because the array can change when removing problematic parent rules (for recursive rules) in recursive `semanticChecks.isRuleMissingReducedSemantic()` invocations. Will never remove rules that precede index `p` because those have already been checked and removed if necessary.
		for (var p = 0; p < parentRules.length; ++p) {
			var parentRule = parentRules[p]

			// Skip edit-rules because any semantics they have will be found in the original rule from which they derive.
			if (parentRule.insertedSymIdx !== undefined || parentRule.isTransposition) continue

			var parRHS = parentRule.rhs
			var rhsIdx = parRHS.indexOf(nontermSym)

			// Check if `parentRule` produces `nontermSym`.
			if (rhsIdx !== -1) {
				/**
				 * Check parent rules first for being unable to produce a required reduced semantic in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
				 *
				 * Examining parent rules first does not change which rules are removed because all ancestor rules must require a reduced semantic for the base rule to qualify for removal. If a parent rule is removed, it too did not produce a required reduced semantic and would have still required this rule to produce a reduced semantic. This procedure only serves to simplify the output parse tree paths by excluding from others sets of paths those which will be removed on their own. Keep this because it (surprisingly) makes a significant difference in output; i.e., prints far few parse tree paths to enabling easier identification of the problematic rules.
				 */
				if (!parentRule.semanticSafe) {
					if (exports.isRuleMissingReducedSemantic(ruleSets, parentNontermSym, parentRule, printWarnings, printFailedPaths)) {
						// Skip problematic (and now removed) parent rule.
						--p
						continue
					}
				}

				// Exit function and accept base rule if `parentRule` has a reduced semantic and can satisfy any LHS semantic requirement that precedes it, because this demonstrates (at least) one semantically legal path that incorporates the base rule, even if other parent rules do require `rule` produce a reduced semantic.
				if (semanticPotential.ruleHasReducedSemantic(parentRule)) {
					return false
				}

				// Skip if a (required) reduced semantic can be found in the other branch of a binary reduction.
				if (parRHS.length === 2) {
					var otherSym = parRHS[Number(!rhsIdx)]
					if (semanticPotential.symCanProduceReducedSemantic(ruleSets, otherSym)) {
						// Exit function and accept base rule if this binary parent rule can produce a reduced semantic via the other RHS symbol, because `otherSym` will satisfy any LHS semantic in an ancestor rule and thereby provide a semantically legal path for the base rule. (Only exclude base rule from the grammar if it always fails.)
						return false
					}
				}

				// Get ancestor paths of `parentRule` if all have a LHS semantic, which requires `rule` produce a reduced semantic. If the `getAncestorsWithLHSSemantic()` recursive invocation returns `false`, then at least one ancestor path that produces `parentNontermSym` does not require a reduced semantic (i.e., provides a semantically legal path). If so, return `false` here because a legal path exists.
				var parAncestorPathsWithLHSSemantics = getAncestorsWithLHSSemantic(ruleSets, nontermSyms, parentNontermSym, parentRule, printWarnings, printFailedPaths, _rulesSeen)
				if (parAncestorPathsWithLHSSemantics) {
					// Append a parse tree path node for `nontermSym` and `rule` to each parse tree path returned in the recursive `getAncestorsWithLHSSemantic()` call.
					Array.prototype.push.apply(ancestorPathsWithLHSSemantics,
						appendAncestorPaths(parAncestorPathsWithLHSSemantics, nontermSym, rule, parentRule, isBaseRule))
				} else {
					// Exit function and accept base rule if `parentRule` or its ancestors do not require `rule` produce a reduced semantic, because this demonstrates (at least) one semantically legal path that incorporates the base rule, even if other parent rules do require `rule` produce a reduced semantic.
					return false
				}
			}
		}
	}

	// Return the parse tree ancestor paths of `rule`, all of which require a reduced semantic.	This function either determines all parent rules require the base rule to produce a reduce semantic, or returns `false` above if at least one parent rule does not require such, demonstrating the base rule is semantically legal within (at least) that path.
	// If `ancestorPathsWithLHSSemantics` is empty, then no parent rules remain for `nontermSym` due to recursive `semanticChecks.isRuleMissingReducedSemantic()` invocations that removed the parent rules.
	return ancestorPathsWithLHSSemantics.length > 0 ? ancestorPathsWithLHSSemantics : false
}

/**
 * Appends a parse tree path node for `nontermSym` and `rule` to each parse tree path in `ancestorPaths`.
 *
 * For constructing graph representations of the ancestor paths that require `rule` produce a reduced semantic. `getAncestorsWithLHSSemantic()` invokes this function after a recursive call to `parentRule` returns `ancestorPaths`.
 *
 * **Note**: This function mutates `ancestorPaths`.
 *
 * @private
 * @static
 * @param {Object[]} ancestorPaths The parse tree paths, returned by `getAncestorsWithLHSSemantic()`, that require `nontermSym` produce a reduced semantic.
 * @param {string} nontermSym The nonterminal symbol each path in `ancestorPaths` produces, from which a reduce semantic is required.
 * @param {Object} rule The rule that `nontermSym` produces.
 * @param {Object} parentRule The rule that produces `nontermSym`, and the last node in each `ancestorPaths` path.
 * @param {boolean} [isBaseRule] Specify `rule` is the base rule invoked with `getAncestorsWithLHSSemantic()`.
 * @returns {Object[]} Returns `ancestorPaths` with a node appended to each for `nontermSym` and `rule`.
 */
function appendAncestorPaths(ancestorPaths, nontermSym, rule, parentRule, isBaseRule) {
	// A node formatted for printing in a parse tree path graph representation. Does not matter that multiple ancestor paths may share this node because the portion of the path that precedes `node` varies while the remainder (as it unwinds the recursive calls to return to the base rule) is identical.
	var node = createNode(nontermSym, rule, isBaseRule)

	// Array of `parentRule` child nodes that includes `nontermSym`.
	var childNodes = [ node ]
	var parRHS = parentRule.rhs
	if (parRHS.length === 2) {
		var otherSymIdx = Number(!parRHS.indexOf(nontermSym))
		childNodes.splice(otherSymIdx, 0, { symbol: parRHS[otherSymIdx] })
	}

	// Append `rule` as a node to the ancestor paths, all of which require a reduced semantic.
	for (var n = 0, ancestorPathsLen = ancestorPaths.length; n < ancestorPathsLen; ++n) {
		var ancestorPath = ancestorPaths[n]

		// Get the parent node of `rule`, which is the previous node added to the parse tree path.
		var parentNode = ancestorPath.parentNode || ancestorPath

		// Add child nodes to parse tree path.
		parentNode.children = childNodes

		if (isBaseRule) {
			// No more rules to follow the base rule.
			delete ancestorPath.parentNode
		} else {
			// Save `node` as the last node added to `ancestorPath` and the node to which to append the next child nodes.
			ancestorPath.parentNode = node
		}
	}

	return ancestorPaths
}

/**
 * Creates a node formatted for printing in a parse tree path graph representation.
 *
 * @private
 * @static
 * @param {string} nontermSym The nonterminal symbol.
 * @param {Object} rule The rule `nontermSym` produces.
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
		node.children = rule.rhs.map(rhsSym => ({ symbol: rhsSym }))
		node.tree = rule.tree
	}

	// Omit `undefined` properties from printed graph.
	util.deleteUndefinedObjectProps(node)

	return node
}

/**
 * Prints a warning to accompany removing `rule` for failing to produce a required semantic.
 *
 * @private
 * @static
 * @param {string} nontermSym The nonterminal symbol that produces `rule`.
 * @param {Object} rule The rule failing to produce a required semantic.
 * @param {Object[]} [failedParsePaths] The graph representation of the parse tree paths that require `rule` to produce a reduced semantic, if any, returned by `getAncestorsWithLHSSemantic()`.
 * @param {boolean} [printFailedPaths] Specify printing `failedParsePaths`, if provided.
 */
function printWarning(nontermSym, rule, failedParsePaths, printFailedPaths) {
	// Check properties `rule.tree` and `rule.isTransposition` to determine if `rule` is an edit-rule, not whether `rule` is in the grammar, in case improperly removing a parent edit-rule (i.e., not the new rule passed to the `semanticChecks.isRuleMissingReducedSemantic()`).
	util.logWarning((rule.tree || rule.isTransposition ? 'Edit-rule' : 'Rule') + ' can not produce required reduced semantic:')
	util.log('  ' + grammarUtil.stringifyRule(nontermSym, rule))
	if (rule.line) util.log('  ' + rule.line)

	if (failedParsePaths && printFailedPaths) {
		util.dir('  ', failedParsePaths)
		util.log()
	}
}