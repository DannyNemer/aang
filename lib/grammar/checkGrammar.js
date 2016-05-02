var util = require('../util/util')
var grammarUtil = require('./grammarUtil')
var semanticPotential = require('./semanticPotential')


/**
 * Checks `ruleSets` for errors after constructing all rules and edit-rules. Such errors occur across multiple rules and therefore are only evident after rule construction completes.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to inspect.
 */
module.exports = function (ruleSets) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		// Alert if `rule` can produce itself via a recursive sequence of unary rules.
		isUnaryRecursive(ruleSets, rule)

		// Alert if `rule` is a term sequence and `rule.rhs` can produce a semantic.
		termSeqRHSCanProduceSemantic(ruleSets, rule)
	})
}

/**
 * Checks if `rule` can produce itself via a recursive sequence of unary rules. If so, prints an error and throws an exception.
 *
 * Prohibits recursive sequences of unary rules in the grammar, which enables recursive parse nodes, because `calcHeuristicCosts` has not been extended to calculate the minimum cost of a subtree in a parse forest when a nonterminal parse node can produce itself. Such a calculation is possible, though difficult to design due to the complexity of the interdependence of the minimum costs. See "Recursive Node Restriction" in `calcHeuristicCosts` for a detailed explanation.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {rule} rule The rule to inspect.
 * @returns {boolean} Throws an exception if `rule` can produce itself via a recursive sequence of unary rules, else returns `false`.
 */
function isUnaryRecursive(ruleSets, rule, _rules) {
	if (rule.isTerminal || rule.rhs.length > 1 || rule.notRecursive) {
		return false
	}

	if (!_rules) {
		_rules = [ rule ]
	} else if (_rules.indexOf(rule) === -1) {
		_rules = _rules.concat(rule)
	} else {
		// Throw an exception for finding a recursive sequence of unary rules.
		unaryRecursiveRulesError(_rules, rule)
	}

	grammarUtil.forEachSymRule(ruleSets, rule.rhs[0], function (subRule) {
		isUnaryRecursive(ruleSets, subRule, _rules)
	})

	// After traversing `rule` (via `rule.rhs[0]`) in the recursive `isUnaryRecursive()` invocation, and proving `rule` can not produce itself via a recursive sequence of unary rules (because otherwise an exception would have been thrown), mark `rule` as `notRecursive` to avoid checking it again. (`removeTempRulesAndProps` later removes the `notRecursive` property from the output grammar.)
	rule.notRecursive = true

	return false
}

/**
 * Prints an error and throws an exception for a recursive sequence of unary rules. For use by `isUnaryRecursive()`.
 *
 * @private
 * @static
 * @param {Object[]} rules The set of unary rules.
 * @param {Object} duplicateRule The recursive rule produced by the last rule in `rules` and already contained in `rules`.
 */
function unaryRecursiveRulesError(rules, duplicateRule) {
	util.logError('Grammar has sequence of unary recursive rules:')

	// The nonterminal symbol that produces the first instance of `duplicateRule`. Manually get this symbol because if it was the first symbol in `isUnaryRecursive()`, then it will only be seen at the end of `rules`.
	util.log('  ' + rules[rules.length - 1].rhs[0])

	// Print every rule in the recursive sequence of unary rules, beginning with first instance of `duplicateRule`.
	var existingIdx = rules.indexOf(duplicateRule)
	rules.push(duplicateRule)
	for (var r = existingIdx, rulesLen = rules.length; r < rulesLen; ++r) {
		util.log('  ' + grammarUtil.stringifyRuleRHS(rules[r]))
	}

	throw 'Grammar has sequence of unary recursive rules'
}

/**
 * Checks if `rule` is a term sequence and `rule.rhs` can produce a semantic. If so, prints an error and throws an exception.
 *
 * Term sequences can not produce semantics because `calcHeuristicCosts` does not check for semantics in sub-nodes when flattening term sequence nodes.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {rule} rule The rule to inspect.
 * @returns {boolean} Throws an exception if `rule` is a term sequence and `rule.rhs` can produce a semantic, else returns `false`.
 */
function termSeqRHSCanProduceSemantic(ruleSets, rule) {
	if (rule.isTermSequence && semanticPotential.rhsCanProduceSemantic(ruleSets, rule)) {
		util.logError('Term sequence RHS produces semantic:', rule)
		throw new Error('Ill-formed term sequence')
	}

	return false
}