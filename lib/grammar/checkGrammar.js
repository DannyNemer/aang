var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


/**
 * Checks `ruleSets` for errors after constructing all rules and edit-rules. Such errors occur across multiple rules and therefore are only evident after rule construction completes.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to inspect.
 */
module.exports = function (ruleSets) {
	for (var nontermSym in ruleSets) {
		isUnaryRecursive(ruleSets, nontermSym)
	}
}

/**
 * Checks if `nontermSym` can produce itself via a recursive sequence of unary rules. Prints an error and throws an exception if found.
 *
 * Prohibits recursive sequences of unary rules in the grammar, which enables recursive parse nodes, because `calcHeuristicCosts` has not been extended to calculate the minimum cost of a subtree in a parse forest when a nonterminal parse node can produce itself. Such a calculation is possible, though difficult to design due to the complexity of the interdependence of the minimum costs. In addition, such complexity might decrease the operation's performance disproportionately for an obscure edge case. Moreover, no implementation exists because its difficulty overwhelmed the designer.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to inspect.
 * @returns {boolean} Throws an exception if `nontermSym` can produce itself via a recursive sequence of unary rules, else returns `false`.
 */
function isUnaryRecursive(ruleSets, nontermSym, _rules) {
	if (!_rules) {
		_rules = []
	}

	// Check if `nontermSym` produces a unary nonterminal rule already in `_rules`.
	grammarUtil.forEachSymRule(ruleSets, nontermSym, function (rule) {
		if (!rule.isTerminal && rule.rhs.length === 1) {
			if (_rules.indexOf(rule) !== -1) {
				unaryRecursiveRulesError(_rules, rule)
			} else {
				isUnaryRecursive(ruleSets, rule.rhs[0], _rules.concat(rule))
			}
		}
	})

	return false
}

/**
 * Prints an error and throws an exception for a recursive sequence of unary rules. For use by `isUnaryRecursive()`.
 *
 * @private
 * @static
 * @param {Object[]} rules The set of unary rules.
 * @param {Object} duplicateRule The recursive rule produced by the last rule in `rules` and already in `rules`.
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