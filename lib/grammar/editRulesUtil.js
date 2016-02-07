var util = require('../util/util')
var semantic = require('./semantic')
var semanticChecks = require('./semanticChecks')


/**
 * The maximum cost for grammar rules.
 *
 * This complexity bound, which reduces the possible insertions, is necessary because when only the k-best parse results are output, then having > k insertions will construct paths that are never output.
 *
 * @type {number}
 */
var MAX_COST = 6

/**
 * Adds a new rule to the grammar if it is unique (i.e., unambiguous), below the cost upper bound, and satisfies any semantic requirement (i.e., has or can produce a reduced semantic required for itself or an ancestor rule, if any).
 *
 * @static
 * @memberOf editRulesUtil
 * @param {Object[]} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} newRule The new rule to append.
 * @param {string} nontermSym The nonterminal symbol that produces `newRule`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 * @returns {boolean} Returns `true` if `newRule` is added, else `false`.
 */
exports.addRule = function (ruleSets, newRule, nontermSym, stopAmbiguity) {
	var rules = ruleSets[nontermSym]
	if (ruleIsUnique(rules, newRule, nontermSym, stopAmbiguity) && newRule.cost < MAX_COST) {
		// Discard `newRule` if lacks and can not produce a reduced semantic required for itself or an ancestor rule.
		if (!semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, newRule)) {
			rules.push(newRule)
			return true
		}
	}

	return false
}

/**
 * Adds a new insertion if it is unique (i.e., unambiguous) and below the cost upper bound.
 *
 * @static
 * @memberOf editRulesUtil
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {Object} newInsertion The new insertion.
 * @param {string} nontermSym The LHS nonterminal symbol that produces `newInsertion`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 * @returns {boolean} Returns `true` if `newInsertion` is added, else `false`.
 */
exports.addInsertion = function (insertions, nontermSym, newInsertion, stopAmbiguity) {
	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	// Add new insertion if unique.
	if (insertionIsUnique(symInsertions, newInsertion, nontermSym, stopAmbiguity) && newInsertion.cost < MAX_COST) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

/**
 * Checks if `newRule` is semantically and textually unique compared to existing rules (including other insertions). Prints an error and throws an exception if `newRule` has identical RHS symbols and identical display text or semantics as an other rule, which would create ambiguity.
 *
 * @private
 * @static
 * @param {Object[]} rules The existing set of rules to compare.
 * @param {Object} newRule The new rule to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `rules`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 * @returns {boolean} Returns `true` if `newRule` is unique, `true` if `newRule` is cheaper than an ambiguous (and is to replace it) when `stopAmbiguity` if `false`, else `false`.
 */
function ruleIsUnique(rules, newRule, nontermSym, stopAmbiguity) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		// Check if output for identical RHS symbols is ambiguous.
		if (util.arraysEqual(existingRule.rhs, newRule.rhs)) {
			// Determine if the semantics and/or display texts are identical. If so, and `stopAmbiguity` is `false`, then save the cheapest rule to the grammar.
			if (rulesAreAmbiguous(existingRule, newRule, nontermSym, stopAmbiguity)) {
				if (newRule.cost < existingRule.cost) {
					rules.splice(r, 1)
					return true
				} else {
					return false
				}
			}
		}
	}

	return true
}

/**
 * Checks if `newInsertion` is semantically and textually unique compared to existing insertions. Prints an error and throws an exception if `newInsertion` has identical display text or semantics as an other other, which would create ambiguity.
 *
 * @private
 * @static
 * @param {Object[]} symInsertions The existing set of insertions to compare.
 * @param {Object} newInsertion The new insertion to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `symInsertions`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 * @returns {boolean} Returns `true` if `newInsertion` is unique, `false` if `stopAmbiguity` is `true`, else throws an exception.
 */
function insertionIsUnique(symInsertions, newInsertion, nontermSym, stopAmbiguity) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// Check if insertions are identical because `findNonterminalRuleInsertions()` iterates through the grammar multiple times (until it stops finding new insertions), which can cause the same insertion to be created (but not added) on successive iterations. This prevents reporting the identical insertions as distinct ambiguous insertions.
		if (util.arraysEqual(newInsertion.tree, existingInsertion.tree, util.objectsEqual)) return false

		// Determine if the semantics and/or display texts are identical. If so, and `stopAmbiguity` is `true`, then save the cheapest insertion, else print an error and throw an exception.
		if (rulesAreAmbiguous(existingInsertion, newInsertion, nontermSym, stopAmbiguity)) {
			if (newInsertion.cost < existingInsertion.cost) {
				symInsertions.splice(s, 1)
				return true
			} else {
				return false
			}
		}
	}

	return true
}

/**
 * Checks if two rules or insertions are semantically and/or textually identical. If so, then prints an error and throws an exception.
 *
 * @private
 * @static
 * @param {Object} ruleA The rule or insertion to compare.
 * @param {Object} ruleB The other rule or insertion to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `ruleA` and `ruleB`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 * @returns {boolean} Returns `false` if `ruleA` and `ruleB` are distinguishable, else throws an exception.
 */
function rulesAreAmbiguous(ruleA, ruleB, nontermSym, stopAmbiguity) {
	// Check if semantic trees are identical, even if both are `undefined`.
	var semanticsEquivalent = semantic.arraysEqual(ruleA.semantic, ruleB.semantic) && semantic.arraysEqual(ruleA.insertedSemantic, ruleB.insertedSemantic)

	// Check if display texts, including yet-to-conjugate text objects, are identical.
	var textsEquivalent = textsEqual(ruleA.text, ruleB.text)

	// A pair of paths is ambiguous when their rightmost symbols are identical and their semantics and/or identical display texts are identical.
	if (semanticsEquivalent || textsEquivalent) {
		if (ruleA.insertedSymIdx === undefined ? ruleB.insertedSymIdx !== undefined : ruleB.insertedSymIdx == undefined) {
			// Throw an exception regardless of `stopAmbiguity`.
			util.logError('Insertion rule is ambiguous with a non-insertion rule')
		} else if (!stopAmbiguity) {
			// Do not throw an exception to allow the cheapest of the two to be saved.
			return true
		} else {
			util.logError('Ambiguity created by insertion:')
		}

		nontermSym = util.stylize(nontermSym)
		util.dir(nontermSym, ruleA)
		util.log()
		util.dir(nontermSym, ruleB)
		util.log()
		throw new Error('Ambiguous insertion')
	}

	return false
}

/**
 * Performs a comparison between two rules' texts to determine if they are equivalent.
 *
 * The provided arguments are either a rule's text object to conjugate, array of text strings and objects to conjugate, or text string not needing conjugation.
 *
 * @private
 * @static
 * @param {Object|Array|string} a The rule's text to compare.
 * @param {Object|Array|string} b The other rule's text to compare.
 * @returns {boolean} Returns `true` if the text `a` and `b` are equivalent, else `false`.
 */
function textsEqual(a, b) {
	// Text items are identical strings, object or array references, or both `undefined`.
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var constructorA = a.constructor
	var constructorB = b.constructor

	// Perform deep comparison of text objects.
	if (constructorA === Object && constructorB === Object) {
		return util.objectsEqual(a, b)
	}

	// Compare contents of insertion text arrays (containing text objects and strings).
	if (constructorA === Array && constructorB === Array) {
		return util.arraysEqual(a, b, textsEqual)
	}

	// Input texts are of different type or are different strings.
	return false
}