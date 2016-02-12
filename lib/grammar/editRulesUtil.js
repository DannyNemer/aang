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
 * Adds a new rule to the grammar if it is unique (i.e., semantically and textually distinguishable from existing rules, which would otherwise yield ambiguity), below the complexity cost upper bound, and satisfies any semantic requirement (i.e., has or can produce a reduced semantic if required for itself or its ancestor rules).
 *
 * @static
 * @memberOf editRulesUtil
 * @param {Object[]} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol that produces `newRule`.
 * @param {Object} newRule The new rule to add.
 * @param {boolean} [stopAmbiguity] Specify printing and error and throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 * @returns {boolean} Returns `true` if `newRule` is added, else `false`.
 */
exports.addRule = function (ruleSets, nontermSym, newRule, stopAmbiguity) {
	// Discard `newRule` if lacks and can not produce a reduced semantic required for itself or its ancestor rule; i.e., if `newRule` fails to produce semantically legal paths.
	// Do not check transposition rules because if their original rules passed the semantic test, then they will too. All original rules that failed were removed before invoking `createEditRules`.
	// Perform `semanticChecks.ruleMissingReducedSemantic()` check before the ambiguity check, which could otherwise throw exceptions for ambiguity with rules that would be discarded anyway for failing to produce a required semantic.
	if (newRule.isTransposition || !semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, newRule)) {
		// Add `newRule` if unique and below the complexity cost upper bound.
		var rules = ruleSets[nontermSym]
		if (ruleIsUnique(rules, nontermSym, newRule, stopAmbiguity) && newRule.cost < MAX_COST) {
			rules.push(newRule)
			return true
		}
	}

	return false
}

/**
 * Adds a new insertion if it is unique (i.e., semantically and textually distinguishable from existing insertions, which would otherwise yield ambiguity) and the complexity cost upper bound
 *
 * @static
 * @memberOf editRulesUtil
 * @param {Object} insertions The map of symbol names to insertions.
 * @param {string} nontermSym The nonterminal symbol that produces `newInsertion`.
 * @param {Object} newInsertion The new insertion to add.
 * @param {boolean} [stopAmbiguity] Specify printing and error and throwing an exception for a pair of ambiguous insertions, else save the cheapest of the two.
 * @returns {boolean} Returns `true` if `newInsertion` is added, else `false`.
 */
exports.addInsertion = function (insertions, nontermSym, newInsertion, stopAmbiguity) {
	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	// Add `newInsertion` if unique and below the complexity cost upper bound.
	if (insertionIsUnique(symInsertions, nontermSym, newInsertion, stopAmbiguity) && newInsertion.cost < MAX_COST) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

/**
 * Checks if `newRule` is semantically and textually unique compared to existing rules in `rules` (i.e., unambiguous).
 *
 * If `newInsertion` is ambiguous with an existing insertion and `newInsertion` is cheaper, remove the existing insertion and returns `true` so that the parent function may keep the cheaper insertion.
 *
 * Checks if `newRule` is semantically and textually unique compared to existing rules (including other insertions). Prints an error and throws an exception if `newRule` has identical RHS symbols and identical display text or semantics as an other rule, which would create ambiguity.
 *
 * @private
 * @static
 * @param {Object[]} rules The existing set of rules to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `rules`.
 * @param {Object} newRule The new rule to compare.
 * @param {boolean} [stopAmbiguity] Specify printing an error and throwing an exception if `newRule` is ambiguous with an existing rule.
 * @returns {boolean} Returns `true` if `newRule` is unique, else `false`.
 */
function ruleIsUnique(rules, nontermSym, newRule, stopAmbiguity) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		// Check for ambiguity with the pair of rules have the same RHS symbols.
		if (util.arraysEqual(existingRule.rhs, newRule.rhs)) {
			// Check if the semantics and/or display texts are identical. If so, and `stopAmbiguity` is `false`, and `newRule` is cheaper, then remove the existing rule so that the parent function may keep the cheaper rule.
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
 * Checks if `newInsertion` is semantically and textually unique compared to existing insertions in `symInsertions` (i.e., unambiguous).
 *
 * If `newInsertion` is ambiguous with an existing insertion and `newInsertion` is cheaper, remove the existing insertion and returns `true` so that the parent function may keep the cheaper insertion.
 *
 * @private
 * @static
 * @param {Object[]} symInsertions The existing set of insertions to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `symInsertions`.
 * @param {Object} newInsertion The new insertion to compare.
 * @param {boolean} [stopAmbiguity] Specify printing an error and throwing an exception if `newInsertion` is ambiguous with an existing insertion.
 * @returns {boolean} Returns `true` if `newInsertion` is unique, else `false`.
 */
function insertionIsUnique(symInsertions, nontermSym, newInsertion, stopAmbiguity) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// Check if insertions are identical because `findNonterminalRuleInsertions()` iterates through the grammar multiple times (until it stops finding new insertions), which can cause the same insertion to be created (but not added) on successive iterations. This prevents reporting the identical insertions as distinct ambiguous insertions.
		if (util.arraysEqual(newInsertion.tree, existingInsertion.tree, util.objectsEqual)) {
			return false
		}

		// Check if the semantics and/or display texts are identical. If so, and `stopAmbiguity` is `false`, and `newInsertion` is cheaper, then remove the existing insertion so that the parent function may keep the cheaper insertion.
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
 * Checks if `ruleA` and `ruleB` (edit- or non-edit rules) are semantically and/or textually identical.
 *
 * The parent function is responsible for saving the cheaper of the two to: either discard the new rule if more expensive, or replace the existing rule if cheaper.
 *
 * @private
 * @static
 * @param {Object} ruleA The rule to compare.
 * @param {Object} ruleB The other rule to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `ruleA` and `ruleB`.
 * @param {boolean} [stopAmbiguity] Specify printing an error and throwing an exception if `ruleA` and `ruleB` are ambiguous.
 * @returns {boolean} Returns `true` if `ruleA` and `ruleB` are ambiguous, else `true`.
 */
function rulesAreAmbiguous(ruleA, ruleB, nontermSym, stopAmbiguity) {
	// Check if semantic trees are identical, even if both are `undefined`.
	var semanticsEquivalent = semantic.arraysEqual(ruleA.semantic, ruleB.semantic) && semantic.arraysEqual(ruleA.insertedSemantic, ruleB.insertedSemantic)

	// Check if display texts, including yet-to-conjugate text objects, are identical.
	var textsEquivalent = textsEqual(ruleA.text, ruleB.text)

	// A pair of paths is ambiguous when their rightmost symbols are identical (checked before here, if applicable) and their semantics and/or identical display texts are identical.
	if (semanticsEquivalent || textsEquivalent) {
		// Check if one rule is an edit-rule and the other is a non-edit rule.
		// Need not account for an insertion rule being ambiguous with a transposition rule because they can not have identical RHS symbols, which `ruleIsUnique()` requires before invoking this function.
		var ruleAEditRuleBNot = (ruleA.insertedSymIdx !== undefined && ruleB.insertedSymIdx === undefined) ||
			(ruleA.isTransposition && !ruleB.isTransposition)
		var ruleBEditRuleANot = (ruleA.insertedSymIdx === undefined && ruleB.insertedSymIdx !== undefined) ||
			(!ruleA.isTransposition && ruleB.isTransposition)

		if ((ruleAEditRuleBNot && ruleA.cost < ruleB.cost) || (ruleBEditRuleANot && ruleB.cost < ruleA.cost)) {
			// Throw an exception if an edit-rule is about to replace a non-edit rule.
			util.logError('Insertion rule is ambiguous with and', util.colors.bold('cheaper than'), 'a non-insertion rule:')
		} else if (!stopAmbiguity) {
			// Do not throw an exception and allow the parent function to save the cheapest of the two.
			// Do not warn if an edit-rule is ambiguous with a non-edit rule because the edit-rule is guaranteed to be discarded because of a higher cost (which the condition above checks).
			return true
		} else if (ruleAEditRuleBNot || ruleBEditRuleANot) {
			// Stops the following insertion (first line), which is ambiguous with the non-edit rule (second line).
			// [repository-plural] -> [repository-no-relative] ([repository-relative-clause] -> "that are repos")
			// [repository-plural] -> [repository-no-relative]
			util.logError('Insertion rule is ambiguous with a non-insertion rule:')
		} else {
			util.logError('Ambiguity created by insertion:')
		}

		util.dir(util.stylize(nontermSym), ruleA, ruleB)
		util.log()
		throw new Error('Ambiguous insertion')
	}

	return false
}

/**
 * Checks if the display texts `textA` and `textB` are equivalent.
 *
 * The provided arguments are either a rule's text object to conjugate, array of text strings and objects to conjugate, or text string not needing conjugation.
 *
 * @private
 * @static
 * @param {Object|Array|string} textA The display text to compare.
 * @param {Object|Array|string} textB The other display text to compare.
 * @returns {boolean} Returns `true` if `textA` and `textB` are equivalent, else `false`.
 */
function textsEqual(textA, textB) {
	// Text items are identical strings, object or array references, or both `undefined`.
	if (textA === textB) return true

	// One of two is `undefined`.
	if (!textA || !textB) return false

	var constructorA = textA.constructor
	var constructorB = textB.constructor

	// Perform deep comparison of text objects.
	if (constructorA === Object && constructorB === Object) {
		return util.objectsEqual(textA, textB)
	}

	// Compare contents of insertion text arrays (containing text objects and strings).
	if (constructorA === Array && constructorB === Array) {
		return util.arraysEqual(textA, textB, textsEqual)
	}

	// Input texts are of different type or are different strings.
	return false
}