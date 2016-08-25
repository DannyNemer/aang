var util = require('../util/util')
var editRulesUtil = require('./editRulesUtil')
var grammarUtil = require('./grammarUtil')
var semanticPotential = require('./semanticPotential')
var createInsertionRules = require('./createInsertionRules')


/**
 * Adds new rules to grammar based on edit properties in existing rules:
 *   Empty strings - rules that produce empty strings (i.e., optional rules).
 *   Insertions - inserting terminal symbols.
 *   Transposition - swapped RHS of nonterminal rules.
 *
 * The edits exist to enable `pfsearch` to return results that expand on an input query and handle ill-formed input, and not to offer alternatives to an input query.
 *
 * Eventually, costs will be improved via machine learning using feedback data of what users continue typing or which suggestion uses select versus the actual generated suggestions.
 *
 * Invoke this module after invoking `removeIllFormedRulesAndSyms()` to remove ill-formed nonterminal rules and symbols.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
module.exports = function (ruleSets, stopAmbiguity) {
	// Define if each nonterminal rule's RHS symbols can produce a semantic. Invoke after removing ill-formed nonterminal symbols and rules in `removeIllFormedRulesAndSyms()`, and before adding edit-rules which inherit the semantic properties of their original (non-edit) rules.
	semanticPotential.assignSemanticPotentials(ruleSets)

	// Add new rules to the grammar created from sequences of inserted terminal symbols or empty symbols.
	createInsertionRules(ruleSets, stopAmbiguity)

	// Add new rules to the grammar created from transposition edits to binary rules.
	createTranspositionRules(ruleSets, stopAmbiguity)
}

/**
 * Adds new rules to the grammar created from transposition edits to binary rules.
 *
 * When reducing matched transposition rules, `Parser.prototype.reduce()` flips the child nodes of the binary node, and the resulting node and `ruleProps` are indistinguishable from non-transposition binary rules.
 *
 * Note: Transposition rules slow the test suite by 3.5x by significantly increasing the parse table size. `Parser` accounts for nearly all of this added time. Transposition edits provide little benefit because they rarely offer superior query suggestions for which no other edit rules provide semantically equivalent suggestions (i.e., ambiguous suggestions). Ergo, transposition rules may be removed from the grammar.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
function createTranspositionRules(ruleSets, stopAmbiguity) {
	grammarUtil.forEachRule(ruleSets, function (origRule, nontermSym) {
		if (origRule.transpositionCost !== undefined) {
			var newRule = {
				// Flip RHS symbols.
				rhs: origRule.rhs.slice().reverse(),
				// Sum rule base cost and transposition cost penalty.
				cost: origRule.cost + origRule.transpositionCost,
				// Need not flip the RHS indexes to which `origRule.gramProps` applies because `Parser` reverses matched transposition rules to their original order before `pfsearch` conjugates.
				// Yet to have a transposition rule with `gramProps`.
				gramProps: origRule.gramProps,
				// Yet to have a transposition rule with `personNumber`.
				personNumber: origRule.personNumber,
				semantic: origRule.semantic,
				semanticIsReduced: origRule.semanticIsReduced,
				rhsCanProduceSemantic: origRule.rhsCanProduceSemantic,
				secondRHSCanProduceSemantic: origRule.secondRHSCanProduceSemantic,
				rhsNoTextIndexes: origRule.rhsNoTextIndexes,
				rhsTermSequenceIndexes: origRule.rhsTermSequenceIndexes,
				isTransposition: true,
			}

			// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
			editRulesUtil.addRule(ruleSets, nontermSym, newRule, stopAmbiguity)
		}
	})
}