var util = require('../util/util')
var editRulesUtil = require('./editRulesUtil')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')
var semanticPotential = require('./semanticPotential')
var isSemanticlessClauseInsertion = require('./isSemanticlessClauseInsertion')
var isFutileGramProp = require('./NSymbol').isFutileGramProp


/**
 * Adds new rules to `ruleSets` created from sequences of inserted terminal symbols or empty symbols.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
module.exports = function (ruleSets, stopAmbiguity) {
	// Map of nonterminal symbols to arrays of inserted symbol sequences.
	var insertionSets = Object.create(null)

	// Find all terminal rules with insertion costs or `<empty>`.
	findTerminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity)

	// Find sequences of symbols that can be inserted.
	findNonterminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity)

	// Add new rules to the grammar created from sequences of inserted terminal symbols or empty symbols in `insertionSets`.
	createInsertionRules(ruleSets, insertionSets, stopAmbiguity)
}

/**
 * Finds all terminal rules with insertion costs or `<empty>`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
function findTerminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity) {
	grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
		if (rule.isTerminal) {
			var termSym = rule.rhs[0]

			if (termSym === g.emptySymbol) {
				editRulesUtil.addInsertion(insertionSets, nontermSym, {
					cost: rule.cost,
					text: [],
					tree: [ { symbol: termSym } ],
				}, stopAmbiguity)
			} else if (rule.insertionCost !== undefined) {
				editRulesUtil.addInsertion(insertionSets, nontermSym, {
					cost: rule.cost + rule.insertionCost,
					text: [ rule.text ],
					semantic: rule.semantic,
					restrictInsertion: rule.restrictInsertion,
					tree: [ { symbol: termSym, insertionCost: rule.insertionCost } ],
				}, stopAmbiguity)
			}
		}
	})
}

/**
 * Finds sequences of symbols that can be inserted.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
function findNonterminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity) {
	// Iterate until no longer finding new insertions.
	do {
		var insertionAdded = false

		grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
			if (canInsertRule(insertionSets, rule)) {
				rule.rhs.map(function (insertedRHSSym) {
					// Map the insertions for each RHS symbol to new insertions with an extended tree.
					return insertionSets[insertedRHSSym].map(function (insertion) {
						return {
							cost: insertion.cost,
							text: insertion.text,
							personNumber: insertion.personNumber,
							semantic: insertion.semantic,
							restrictInsertion: insertion.restrictInsertion,
							tree: [ { symbol: insertedRHSSym, children: insertion.tree } ],
						}
					})
				})
				// When `rule` is binary and both RHS symbols have insertions, merge every possible pair of insertions the RHS symbols produces.
				.reduce(mergeInsertionSets.bind(null, ruleSets, nontermSym, rule))
				.forEach(function (insertion) {
					// Create new insertion by merging this rule with insertions for its RHS symbols.
					var newInsertion = {
						cost: rule.cost + insertion.cost,
						text: undefined,
						// The parent person-number property takes precedence.
						personNumber: rule.personNumber || insertion.personNumber,
						// Check `rule` because of nonterminal rules created from regex-style terminal rules which defined `restrictInsertion`.
						restrictInsertion: insertion.restrictInsertion || rule.restrictInsertion,
						semantic: undefined,
						tree: insertion.tree,
					}

					// Conjugate text using the rule's grammatical properties and the most recent person-number property. Use `rule.text`, if defined, for nonterminal rules created from regex-style terminal rules.
					var text = rule.text ? [ rule.text ] : insertion.text
					newInsertion.text = conjugateText(text, rule.gramProps, newInsertion.personNumber)

					// Reduce rule's LHS semantic, if any, with the RHS insertions' semantic.
					if (rule.semantic && insertion.semantic) {
						newInsertion.semantic = semantic.reduce(rule.semantic, insertion.semantic)

						if (newInsertion.semantic === -1) {
							util.logError('Insertion produces illegal semantic reduction:')
							util.dir(rule, insertion)
							throw new Error('Semantic error')
						}
					} else if (rule.semantic) {
						// Check for a semantic function without arguments; currently can only be intersect(). E.g., "issues opened by people".
						if (!rule.semanticIsReduced) return

						newInsertion.semantic = rule.semantic
					} else {
						newInsertion.semantic = insertion.semantic
					}

					// Add insertion if unique (i.e., unambiguous) and below the cost upper bound.
					if (editRulesUtil.addInsertion(insertionSets, nontermSym, newInsertion, stopAmbiguity)) {
						insertionAdded = true
					}
				})
			}
		})
	} while (insertionAdded)
}

/**
 * Checks if every symbol in `rule.rhs` is a terminal symbol with an insertion cost, `<empty>`, or a nonterminal symbol that produces a sequence of these.
 *
 * @private
 * @static
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {Object} rule The rule to examine.
 * @returns {boolean} Returns `true` if every `rule.rhs` can be inserted, else `false`.
 */
function canInsertRule(insertionSets, rule) {
	if (rule.isTerminal) {
		return false
	}

	if (rule.noInsert || rule.noInsertionIndexes !== undefined) {
		return false
	}

	return rule.rhs.every(function (sym) {
		return !!insertionSets[sym]
	})
}

/**
 * Creates a set of insertions formed from the merger of every possible pair of insertions in sets `insertionsA` and `insertionsB`. For use by `findNonterminalRuleInsertions()` when creating an insertion for `nontermSym` from a binary rule it produces, `rule`, for which both RHS symbols have insertions.
 *
 * Discards insertions that `isSemanticlessClauseInsertion()` determines produce a meaningless (i.e., semantic-less) clause.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol that produces `rule`.
 * @param {Object} rule The binary nonterminal rule whose two RHS symbols produce `insertionsA` and `insertionsB`, in that order.
 * @param {Object[]} insertionsA The set of insertions to merge.
 * @param {Object[]} insertionsB The other set of insertions to merge.
 * @returns {Object[]} Returns a set of insertions formed from the merger of every possible pair of insertions in `insertionsA` and `insertionsB`.
 */
function mergeInsertionSets(ruleSets, nontermSym, rule, insertionsA, insertionsB) {
	var mergedInsertions = []

	insertionsA.forEach(function (a) {
		insertionsB.forEach(function (b) {
			/**
			 * Discard insertion if produces a meaningless (i.e., semantic-less) clause.
			 *
			 * Stop these insertions here, in addition to `createInsertionRules()`, to prevent their inclusion in larger insertions for which the logic in `isSemanticlessClauseInsertion()` can not detect their meaninglessness.
			 * For example, the following meaningless clause insertion would not be caught:
			 * • "repos" -> "repos (that are repos)"
			 *
			 * Prevention of the following insertion prevents the previous example.
			 *  • "repos that are" -> "repos that are (repos)"
			 */
			if (isSemanticlessClauseInsertion(ruleSets, a, a.tree[0].symbol, nontermSym, rule, true)) {
				return
			}

			if (isSemanticlessClauseInsertion(ruleSets, b, b.tree[0].symbol, nontermSym, rule, true)) {
				return
			}

			// Merge binary rule's reduced semantic functions into a single reduced semantic.
			var newSemantic
			if (a.semantic && b.semantic) {
				newSemantic = semantic.mergeRHS(a.semantic, b.semantic)

				// Discard if semantically illegal parse.
				if (newSemantic === -1) return

				// Sort RHS to correctly detect identical semantic arrays in `rulesAreAmbiguous()` in `editRulesUtil`.
				newSemantic.sort(semantic.compare)
			} else {
				newSemantic = a.semantic || b.semantic
			}

			mergedInsertions.push({
				cost: a.cost + b.cost,
				text: a.text.concat(b.text),
				// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject).
				personNumber: a.personNumber,
				restrictInsertion: a.restrictInsertion || b.restrictInsertion,
				semantic: newSemantic,
				tree: a.tree.concat(b.tree),
			})
		})
	})

	return mergedInsertions
}

/**
 * Adds new rules to the grammar created from sequences of inserted terminal symbols or empty symbols in `insertionSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
function createInsertionRules(ruleSets, insertionSets, stopAmbiguity) {
	grammarUtil.forEachRule(ruleSets, function (origRule, nontermSym) {
		var rhs = origRule.rhs
		var rhsLen = rhs.length

		if (rhsLen === 1) return

		for (var insertedSymIdx = 0; insertedSymIdx < rhsLen; ++insertedSymIdx) {
			var insertedRHSSym = rhs[insertedSymIdx]
			var nonInsertedRHSSym = rhs[Number(!insertedSymIdx)]

			// Prevent insertion rules for RHS symbols forbidden by `origRule.noInsertionIndexes`, if specified.
			if (origRule.noInsertionIndexes && origRule.noInsertionIndexes.indexOf(insertedSymIdx) !== -1) {
				continue
			}

			// Avoid recursive insertion rules.
			if (nonInsertedRHSSym === nontermSym) {
				continue
			}

			var insertions = insertionSets[insertedRHSSym]
			if (insertions) {
				for (var i = 0, insertionsLen = insertions.length; i < insertionsLen; ++i) {
					var insertion = insertions[i]

					// Discard insertion if produces a meaningless (i.e., semantic-less) clause.
					if (isSemanticlessClauseInsertion(ruleSets, insertion, insertedRHSSym, nontermSym, origRule, true)) {
						continue
					}

					var newRule = {
						/**
						 * Rules where the inserted segment is in the right (second) position of a binary rule and includes terminal rules where `restrictInsertion` is `true` can only occur at the end of an input query.
						 *
						 * 1. This reduces the number of semantically ambiguous suggestions otherwise created by inserting the same query segment (e.g., "liked by me") at multiple positions in the input query.
						 *
						 * 2. More importantly, this prioritizes suggestions that are easier for the user to read by only inserting at the end. In contrast, arbitrarily positioning edits anywhere in the query disorients the user as they must discern the suggestion's differences from input.
						 *
						 * The `Parser` inputs the `[blank-inserted]` symbol at the end of parsing the input query to only allow these binary insertion rules with `[blank-inserted]` to match at the end of the query.
						 *
						 * Check `origRule.restrictInsertion` for nonterminal rules created from regex-style terminal rules.
						 */
						rhs: insertedSymIdx === 1 && (origRule.restrictInsertion || insertion.restrictInsertion) ? [ nonInsertedRHSSym, g.blankInsertedSymbol.name ] : [ nonInsertedRHSSym ],
						// The total cost of this rule and the insertion.
						cost: origRule.cost + insertion.cost,
						// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject). If the second symbol, the property is for when this rule becomes a child rule.
						personNumber: insertedSymIdx === 0 ? (origRule.personNumber || insertion.personNumber) : origRule.personNumber,
						// Create a new grammatical properties object for an insertion rule containing only the original rule's grammatical properties applicable to the insertion rule's non-inserted symbol, `nonInsertedRHSSym`.
						gramProps: genGramProps(nonInsertedRHSSym, origRule.gramProps),
						// Define whether `newRule.rhs` can produce a semantic. If `false`, then `newRule.semantic` can be reduced with a parse tree's preceding LHS semantic before parsing `newRule.rhs`. This enables finding and discarding semantically illegal parses earlier than otherwise.
						rhsCanProduceSemantic: semanticPotential.symCanProduceSemantic(ruleSets, nonInsertedRHSSym),
						// Save parse trees graph for `isUniqueRule()` errors in `editRulesUtil`. `removeTempRulesAndProps` removes this property at the end of grammar generation if `buildGrammar` was invoked without '--trees'.
						tree: [ { symbol: insertedRHSSym, children: insertion.tree } ],
					}

					// Append the insertion's semantic, if any, to the existing rule. Perform semantic reduction or semantic RHS merging if possible. Throw an exception if semantically illegal.
					appendSemantic(origRule, newRule, insertion.semantic)

					/**
					 * If `origRule` is a binary term set has `text`, then `origRule` is a multi-token nonterminal substitution.
					 *
					 * `pfsearch` uses the `origRule.text` instead of the `text` of the matched terminal rules `origRule.rhs` produces. For example:
					 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
					 *
					 * `calcHeuristicCosts` will, however, traverse this rule's child nodes to get the input tense of any matched verb terminal rules to maintain tense for any verb substitutions whose parent rule has matching `acceptedTense` (i.e., maintain the tense if input, but do not conjugate to the tense if otherwise). For example:
					 *   `[contribute-to]` -> "worked" (input) -> `[work]` `[on]`, text: `[ "contributed to" "to" ]`
					 */
					if (origRule.text && origRule.rhsIsBinaryTermSet) {
						newRule.text = origRule.text
						origRule.rhsIsBinaryTermSet = true
					}

					else if (origRule.rhsDoesNotProduceText) {
						// The display text for multi-token terminal strings using nonterminal rules created from regex-style terminal rules (including substitutions) and nonterminal stop-words (which lack `text`).
						newRule.text = origRule.text
						// Save tense for multi-token terminal strings with tense. E.g., "contributed to".
						newRule.tense = origRule.tense

						// Do not need `isSubstitution` or `isStopWord` because the property `rhsDoesNotProduceText` handles both cases.
						newRule.rhsDoesNotProduceText = origRule.rhsDoesNotProduceText

						/**
						 * Flatten `newRule`, the insertion rule created from a nonterminal rule derived from a multi-token terminal symbol in `splitRegexTerminalSymbols`, into several insertion rules, and add those rules to the grammar. The flattening, which merges `newRule` with the rules `newRule.rhs[0]` produces, enables `isUniqueRule()` in `editRulesUtil` to properly discard ambiguous rules. E.g., X -> "x" vs. X -> Y -> "x".
						 *
						 * FIXME: Though this implementation correctly avoids ambiguity, should move this operation to after adding all insertion rules because other rules might still be added to the RHS symbol rules that this function reduces.
						 */
						if (origRule.rhsDoesNotProduceText && newRule.rhs.length === 1) {
							addMultiTokenTerminalInsertion(ruleSets, nontermSym, newRule, stopAmbiguity)

							// Terminate iteration execution because `addMultiTokenTerminalInsertion()` added the (flattened) insertion rules.
							continue
						}
					} else if (insertion.text[0]) {
						// Only save `insertedSymIdx` for rules with text, otherwise the new rule (produced via `<empty>`) is an ordinary unary nonterminal rule.
						newRule.insertedSymIdx = insertedSymIdx

						// Conjugate text using the original rule's grammatical properties and the most recent person-number property.
						var text = conjugateText(insertion.text, origRule.gramProps, newRule.personNumber)

						// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
						newRule.text = text.length === 1 ? text[0] : text

						/**
						 * If `origRule` is a binary term set without `text`, mark it as `rhsIsBinaryTermSet`.@async
						 *
						 * This instructs `calcHeuristicCosts` to traverse the single child node `origRule` produces to get the matched terminal rule `text`. `calcHeuristicCosts` merges this `text` with the insertion `text` according to `newRule.insertedSymIdx`. For example:
						 *   `[contribute-to]` -> `[contribute]`, text: "to"
						 *                     -> "contribute" (input), text: `{contribute-verb-forms}`
						 *                     -> text: `[ {contribute-verb-forms}, "to" ]` (merged text values)
						 *
						 * `calcHeuristicCosts` also gets the input tense of any verb terminal rule its single child node (i.e., `newRule.rhs`) produces to maintain optional tense if the parent rule of `newRule` has matching `acceptedTense`. For example:
						 *   `[contribute-to]` -> `[contribute]`, text: "to"
						 *                     -> "contributed" (input), text: `{contribute-verb-forms}`
						 *                     -> text: "contributed to" (merged text values)
						 */
						if (origRule.rhsIsBinaryTermSet) {
							newRule.rhsIsBinaryTermSet = true
						}
					}

					// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
					editRulesUtil.addRule(ruleSets, nontermSym, newRule, stopAmbiguity)
				}
			}
		}
	})
}

/**
 * Conjugates text objects in `insertionText`, each of which contain a term's different inflected forms, to the accepted form using the grammatical properties in the insertion's parent rule and the most recent person-number property (from the paths forming the insertion or its parent rule). Also concatenates adjacent strings in `insertionText`.
 *
 * @private
 * @static
 * @param {(Object|string)[]} insertionText The array of text strings and text objects to conjugate.
 * @param {Object} gramProps The insertion's parent rule's grammatical properties (`form` and `acceptedTense`) for conjugating text objects in `insertionText`.
 * @param {string} personNumber The most recent person-number property, from the paths forming the insertion or its parent rule, for conjugating text objects in `insertionText`.
 * @returns {Array} Returns an array of conjugated strings and yet-to-conjugate text objects (which rely on yet-to-parse person-number properties).
 */
function conjugateText(insertionText, gramProps, personNumber) {
	return insertionText.reduce(function (textArray, text) {
		// Already conjugated, or no conjugation needed (e.g., noun, preposition).
		if (text.constructor === String) {
			// Concatenate string to previous element if also a string.
			var lastIdx = textArray.length - 1
			if (lastIdx !== -1 && textArray[lastIdx].constructor === String) {
				textArray[lastIdx] += ' ' + text
			} else {
				textArray.push(text)
			}
		}

		// Conjugate for required verb tense (e.g., "(repos I have) liked") and grammatical case (e.g,, "(repos) I (like)".
		// Must occur before person-number check, otherwise "[have] [like]" yields "have like" instead of "have liked".
		else if (text[gramProps.form]) {
			textArray.push(text[gramProps.form])
		}

		// First-person-singular, vs. third-person-singular, vs. plural.
		else if (text[personNumber]) {
			textArray.push(text[personNumber])
		}

		// Text can not yet be conjugated. Occurs when invoked via `createInsertionRules()` and only conjugating the text of one of the branches, where there exists a verb dependent on the person-number property to be defined in the other branch.
		else {
			textArray.push(text)
		}

		return textArray
	}, [])
}

/**
 * Appends an insertion's semantic, if any, to an existing rule. Performs semantic reduction or semantic RHS merging if possible. Throws an exception if semantically illegal.
 *
 * @private
 * @static
 * @param {Object} existingRule The existing rule to which the insertion is being applied.
 * @param {Object} newRule The new rule being created from `existingRule` and the insertion.
 * @param {Object[]} [insertionSemantic] The insertion's semantic.
 */
function appendSemantic(existingRule, newRule, insertionSemantic) {
	// Check if insertion has a semantic (which is always reduced).
	if (insertionSemantic) {
		// Merge existing rule's RHS semantic with inserted (reduced) semantic.
		if (existingRule.semanticIsReduced) {
			newRule.semantic = semantic.mergeRHS(existingRule.semantic, insertionSemantic)

			if (newRule.semantic === -1) {
				util.logError('Insertion produces illegal RHS semantic merge:')
				util.dir(existingRule, insertionSemantic)
				throw new Error('Semantic error')
			}

			// Sort RHS to correctly detect identical semantic arrays in `rulesAreAmbiguous()` in `editRulesUtil`.
			newRule.semantic.sort(semantic.compare)
			newRule.semanticIsReduced = true
		}

		// Existing rule has a LHS semantic.
		else if (existingRule.semantic) {
			// If the other symbol does not produce a semantic, then reduce the existing rule's LHS semantic with the inserted (reduced) semantic.
			if (!newRule.rhsCanProduceSemantic) {
				newRule.semantic = semantic.reduce(existingRule.semantic, insertionSemantic)

				if (newRule.semantic === -1) {
					util.logError('Insertion produces illegal semantic reduction:')
					util.dir(existingRule, insertionSemantic)
					throw new Error('Semantic error')
				}

				newRule.semanticIsReduced = true
			}

			// Else save the existing semantic and inserted semantic separately.
			else {
				// When `newRule.semantic` and `newRule.insertedSemantic` are both defined, the former is a LHS semantic and the latter is a reduced semantic.
				newRule.semantic = existingRule.semantic
				newRule.insertedSemantic = insertionSemantic
			}
		}

		// Rule lacks a semantic; save inserted (reduced) semantic.
		else {
			newRule.semantic = insertionSemantic
			newRule.semanticIsReduced = true
		}
	}

	// Insertion lacks a semantic.
	else {
		newRule.semantic = existingRule.semantic
		newRule.semanticIsReduced = existingRule.semanticIsReduced
	}
}

/**
 * Flattens `newRule`, the insertion rule created from a nonterminal rule derived from a multi-token terminal symbol in `splitRegexTerminalSymbols`, into several insertion rules, and adds those rules to the grammar. The flattening, which merges `newRule` with the rules `newRule.rhs[0]` produces, enables `isUniqueRule()` in `editRulesUtil` to properly discard ambiguous rules. E.g., X -> "x" vs. X -> Y -> "x".
 *
 * This is a temporary solution until we properly implement splitting multi-token terminal rules.
 *
 * FIXME: Amongst other problems, `splitRegexTerminalSymbols` creates ambiguity for multi-token substitutions. For example, the substitution "within this" -> "this", where a match to only "this" inserts "within", though it is then substituted by "this" is ambiguous with a match to only "this". Such rules should use a stop word instead (and throw an exception when otherwise).
 *
 * FIXME: Though this implementation correctly avoids ambiguity, should move this operation to after adding all insertion rules because other rules might still be added to the rhs symbol rules that this function reduces.
 *
 * FIXME: The grammar generator badly needs a complete redesign of its handling of multi-token terminal rules. This work has long been avoided due to frustration from not finding a perfect solution: automatically split rules (using regex-style definitions) to enable an easy developer interface vs. require the developer to manually define all terminal symbols, each limited to one token vs. both. In addition, the grammar needs a terminal rule optimizer that reduces the grammar by sharing or flattening rules.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol of `newRule`.
 * @param {Object} newRule The insertion rule created from a multi-token terminal symbol to add.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous rules, else save the cheapest of the two to the grammar.
 */
function addMultiTokenTerminalInsertion(ruleSets, nontermSym, newRule, stopAmbiguity) {
	// Avoid insertion rules with `[blank-inserted]`. Though, the same flattening procedure should still be possible. Except, only possible if the RHS rule is nonterminal. Otherwise, it would combine a terminal symbol in a binary rule (which is not possible).
	if (!newRule.rhsDoesNotProduceText || newRule.rhs.length === 2) {
		throw new Error('For now, insertion rule flattening is only allowed for rules where `rhsDoesNotProduceText` is `true` and there is no `[blank-inserted]` symbol.')
	}

	var rhsRules = ruleSets[newRule.rhs[0]]
	for (var r = 0, rhsRulesLen = rhsRules.length; r < rhsRulesLen; ++r) {
		// FIXME: It is possible additional properties must be copied, though no such properties have been seen with the current grammar.
		var rhsRule = rhsRules[r]

		// Clone rule to add a variation for each of it's RHS symbol's rules.
		var newRuleClone = util.clone(newRule)
		newRuleClone.rhs = rhsRule.rhs

		// Include cost to include epsilon value.
		newRuleClone.cost += rhsRule.cost

		if (rhsRule.isTerminal) {
			newRuleClone.isTerminal = true

			// Remove properties specific to nonterminal rules.
			delete newRuleClone.rhsDoesNotProduceText
			delete newRuleClone.rhsCanProduceSemantic
		} else {
			newRuleClone.rhsCanProduceSemantic = rhsRule.rhsCanProduceSemantic
			newRuleClone.secondRHSCanProduceSemantic = rhsRule.secondRHSCanProduceSemantic
		}

		// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
		editRulesUtil.addRule(ruleSets, nontermSym, newRuleClone, stopAmbiguity)
	}
}

/**
 * Creates a new grammatical properties object for an insertion rule containing only the original rule's grammatical properties applicable to the insertion rule's non-inserted symbol, `nonInsertedRHSSym`.
 *
 * All other properties apply only to the inserted symbol, and are used in its conjugation when later defining the insertion text. This is ensured because new rules are verified to only include grammatical properties if the RHS produces accepting terminal rules.
 *
 * If no properties apply, then returns an empty object which `removeEmptyGramProps()` later removes.
 *
 * @private
 * @static
 * @param {string} nonInsertedRHSSym The insertion rule's (non-inserted) RHS symbol for which to determine the applicable grammatical properties.
 * @param {Object} origGramProps The original rule's grammatical properties.
 * @returns {Object} Returns the grammatical properties object for the insertion rule.
 */
function genGramProps(nonInsertedRHSSym, origGramProps) {
	var newRuleRHS = [ nonInsertedRHSSym ]
	var newGramProps = {}

	for (var propName in origGramProps) {
		var gramProp = origGramProps[propName]

		// Add the `gramProp` if `nonInsertedRHSSym` can produce a conjugative rule applicable to the grammatical property.
		if (!isFutileGramProp(newRuleRHS, gramProp)) {
			newGramProps[propName] = gramProp
		}
	}

	return newGramProps
}