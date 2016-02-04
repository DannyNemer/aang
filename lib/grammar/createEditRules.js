var util = require('../util/util')
var editRulesUtil = require('./editRulesUtil')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')
var semanticChecks = require('./semanticChecks')
var removeUnusedNonterminalSymbols = require('./removeUnusedNonterminalSymbols')
var rhsAcceptsGramProp = require('./NSymbol').rhsAcceptsGramProp


/**
 * Adds new rules to grammar based on edit properties in existing rules:
 *   Empty strings - rules that produce empty strings (i.e., optional).
 *   Insertions - inserting terminal symbols.
 *   Transposition - swapped RHS of nonterminal rules.
 *
 * The edits exist to return results that expand on an input query and handle ill-formed input, but not to offer alternatives to an input query.
 *
 * Recursively removes nonterminal symbols with no rules, rules whose RHS containing those symbols or the `<empty>` symbol, and any rule-less nonterminal symbols that result.
 *
 * Checks non-edit rules for semantic errors; i.e., fail to produce a needed RHS semantic.
 * - Also avoids creating edit rules with semantic errors.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the grammar.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
module.exports = function (ruleSets, includeTrees, stopAmbiguity) {
	// Map of nonterminal symbols to arrays of inserted symbol sequences.
	var insertionSets = {}

	// Find all terminal rules with insertion costs or `<empty>`.
	findTerminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity)

	// Removes rules from that produce the empty symbol, `<empty>`. Invoke this function after finding and saving insertions for rules with `<empty>` in `findTerminalRuleInsertions()`.
	removeBlankSymbolRules(ruleSets)

	// Recursively remove nonterminal symbols with no rules, rules whose RHS symbols include those symbols, and any rule-less nonterminal symbols that result. Invoke this function before `createInsertionRules()`, which would otherwise create insertion rules using the nonterminal rules this removes.
	removeUnusedNonterminalSymbols(ruleSets)

	// Define if each nonterminal rule's RHS symbols can produce a semantic. This can be determined before adding edit rules because any semantics in edit rules will be found in the original rules from which they are derived. Invoke after removing unused rules in `removeUnusedNonterminalSymbols()`.
	assignSemanticPotentials(ruleSets)

	// Check for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Throws an exception if finds any. Invoke after removing rules with rule-less symbols in `removeUnusedNonterminalSymbols()`.
	checkForMissingSemantics(ruleSets)

	// Find sequences of symbols that can be inserted.
	findNonterminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity)

	// Add new rules to the grammar created by sequences of inserted terminal symbols in `insertionSets`.
	createInsertionRules(ruleSets, insertionSets, stopAmbiguity)

	// Add new rules to the grammar created by transposition edits to binary rules.
	createTranspositionRules(ruleSets, stopAmbiguity)

	// Remove instances of `rule.gramProps` with no defined values.
	removeEmptyGramProps(ruleSets)

	// Remove instances of `rule.tree` created for debugging insertion rule generation.
	if (!includeTrees) removeTrees(ruleSets)
}

/**
 * Finds all terminal rules with insertion costs or `<empty>`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
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
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function findNonterminalRuleInsertions(ruleSets, insertionSets, stopAmbiguity) {
	// Iterate until no longer finding new insertions.
	do {
		var insertionAdded = false

		for (var nontermSym in ruleSets) {
			ruleSets[nontermSym].forEach(function (rule) {
				// Temporarily prevent insertions with rules from which transpositions are created.
				if (rule.transpositionCost !== undefined) return

				if (rhsCanBeInserted(insertionSets, rule)) {
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
					}).reduce(function (insertionsA, insertionsB) {
						// RHS has 2 symbols - create every permutation of symbols.
						var mergedInsertions = []

						insertionsA.forEach(function (a) {
							insertionsB.forEach(function (b) {
								// Merge binary rule's reduced semantic functions into a single RHS semantic.
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

						// Function only run once because is array of length 2.
						return mergedInsertions
					}).forEach(function (insertion) {
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
							newInsertion.semantic = rule.semantic

							// Check for a semantic function without arguments; currently can only be intersect(); E.g., "issues opened by people". This check is only needed if allowing insertions through `<empty>` in transpositions.
							if (!rule.semanticIsReduced) return
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
		}
	} while (insertionAdded)
}

/**
 * Checks if every symbol in `rule.rhs` is a terminal symbol with an insertion cost, `<empty>`, or a nonterminal symbol that produces a sequence of the these.
 *
 * @private
 * @static
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {Object} rule The rule to examine.
 * @returns {boolean} Returns `true` if every `rule.rhs` can be inserted, else `false`.
 */
function rhsCanBeInserted(insertionSets, rule) {
	if (rule.isTerminal) {
		return false
	}

	if (rule.noInsert || rule.noInsertionIndexes !== undefined) {
		return false
	}

	return rule.rhs.every(function (sym) {
		return insertionSets.hasOwnProperty(sym)
	})
}

/**
 * Adds new rules to the grammar created by sequences of inserted terminal symbols in `insertionSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertionSets The map of nonterminal symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function createInsertionRules(ruleSets, insertionSets, stopAmbiguity) {
	// The nonterminal symbol used in the second position of insertion rules where the inserted segment is in the right (second) position of its original binary rule and includes the `[1-sg]` symbol in the insertion.
	// Add this symbol to the grammar here to prevent `removeUnusedNonterminalSymbols()` from removing it earlier.
	var blankInsertedSymbol = g.newSymbol('blank', 'inserted').addRule({
		isTerminal: true,
		rhs: g.blankSymbol,
		isPlaceholder: true,
	})

	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var origRule = rules[r]
			var rhs = origRule.rhs
			var rhsLen = rhs.length

			if (rhsLen === 1) continue

			for (var insertedSymIdx = 0; insertedSymIdx < rhsLen; ++insertedSymIdx) {
				var insertedRHSSym = rhs[insertedSymIdx]
				var nonInsertedRHSSym = rhs[Number(!insertedSymIdx)]

				// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
				if (origRule.noInsertionIndexes && origRule.noInsertionIndexes.indexOf(insertedSymIdx) !== -1) {
					continue
				}

				// Avoid recursive insertion rules.
				var insertions = insertionSets[insertedRHSSym]
				if (insertions && nonInsertedRHSSym !== nontermSym) {
					for (var i = 0, insertionsLen = insertions.length; i < insertionsLen; ++i) {
						var insertion = insertions[i]

						var newRule = {
							// Rules where the inserted segment is in the right (second) position of a binary rule and includes terminal rules where `restrictInsertion` is `true` can only occur at the end of an input query.
							// 1. This reduces the number of semantically ambiguous suggestions otherwise created by inserting the same query segment (e.g., "liked by me") at multiple positions in the input query.
							// 2. More importantly, this prioritizes suggestions that are easier for the user to read by only inserting at the end. In contrast, arbitrarily positioning edits anywhere in the query disorients the user as they must discern the suggestion's differences from input.
							// The `Parser` inputs the `<blank>` symbol at the end of parsing the input query to only allow these binary insertion rules with `<blank>` to match at the end of the query.
							// Check `rule.restrictInsertion` for nonterminal rules created from regex-style terminal rules.
							rhs: insertedSymIdx === 1 && (origRule.restrictInsertion || insertion.restrictInsertion) ? [ nonInsertedRHSSym, blankInsertedSymbol.name ] : [ nonInsertedRHSSym ],
							// The total cost of this rule and the insertion.
							cost: origRule.cost + insertion.cost,
							// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject). If the second symbol, the property is for when this rule becomes a child rule.
							personNumber: insertedSymIdx === 0 ? (origRule.personNumber || insertion.personNumber) : origRule.personNumber,
							// Specify an insertion created using a rule that was originally a regex-style substitution, whose RHS `pfsearch` should not traverse because it produces no text.
							isSubstitution: origRule.isSubstitution,
							// Specify an insertion created using a rule that was originally a regex-style stop word, whose RHS `pfsearch` should not traverse because it produces no text.
							isStopWord: origRule.isStopWord,
							// Create a new grammatical properties object for an insertion rule containing only the original rule's grammatical properties applicable to the insertion rule's non-inserted symbol, `nonInsertedRHSSym`.
							gramProps: genGramProps(nonInsertedRHSSym, origRule.gramProps),
							// Define whether `newRule.rhs` can produce a semantic. If `false`, then `newRule.semantic` can be reduced with a parse tree's preceding LHS semantic before parsing `newRule.rhs`. This enables finding and discarding semantically illegal parses earlier than otherwise.
							rhsCanProduceSemantic: semanticChecks.symCanProduceSemantic(ruleSets, nonInsertedRHSSym),
							// Temporarily save trees, even if `includeTrees` is `false`, for `ruleIsUnique()` errors in `editRulesUtil`.
							tree: [ { symbol: insertedRHSSym, children: insertion.tree } ],
						}

						// Append the insertion's semantic, if any, to the existing rule. Perform semantic reduction or semantic RHS merging if possible. Throw an exception if semantically illegal.
						appendSemantic(origRule, newRule, insertion.semantic)

						// Discard `newRule` if lacks and cannot produce a reduced semantic required for itself or an ancestor rule.
						if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, newRule)) {
							continue
						}

						if (origRule.rhsDoesNotProduceText) {
							// The display text for multi-token terminal strings using nonterminal rules created from regex-style terminal rules (including substitutions) and nonterminal stop-words (which lack `text`).
							newRule.text = origRule.text
							newRule.tense = origRule.tense
							newRule.rhsDoesNotProduceText = true

							// Flatten `newRule`, the insertion rule created from a nonterminal rule derived from a multi-token terminal symbol in `splitRegexTerminalSymbols`, into several insertion rules, and adds those rules to the grammar. The flattening, which merges `newRule` with the rules `newRule.rhs[0]` produces, enables `ruleIsUnique()` in `editRulesUtil` to properly discard ambiguous rules. E.g., X -> "x" vs. X -> Y -> "x".
							// FIXME: Though this implementation correctly avoids ambiguity, should move this operation to after adding all insertion rules because other rules might still be added to the rhs symbol rules that this function reduces.
							if (newRule.rhs.length === 1) {
								addMultiTokenTerminalInsertion(ruleSets, newRule, nontermSym, stopAmbiguity)
								continue
							}
						} else if (insertion.text[0]) {
							// Only save `insertedSymIdx` for rules with text, otherwise the new rule (produced via `<empty>`) is an ordinary unary nonterminal rule.
							newRule.insertedSymIdx = insertedSymIdx

							// Conjugate text using the original rule's grammatical properties and the most recent person-number property.
							var text = conjugateText(insertion.text, origRule.gramProps, newRule.personNumber)

							// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
							newRule.text = text.length === 1 ? text[0] : text
						}

						// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
						editRulesUtil.addRule(rules, newRule, nontermSym, stopAmbiguity)
					}
				}
			}
		}
	}
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

		// Text cannot yet be conjugated. Occurs when invoked via `createInsertionRules()` and only conjugating the text of one of the branches, where there exists a verb dependent on the person-number property to be defined in the other branch.
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
 * Flattens `newRule`, the insertion rule created from a nonterminal rule derived from a multi-token terminal symbol in `splitRegexTerminalSymbols`, into several insertion rules, and adds those rules to the grammar. The flattening, which merges `newRule` with the rules `newRule.rhs[0]` produces, enables `ruleIsUnique()` in `editRulesUtil` to properly discard ambiguous rules. E.g., X -> "x" vs. X -> Y -> "x".
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
 * @param {Object} newRule The insertion rule created from a multi-token terminal symbol to add.
 * @param {string} nontermSym The LHS nonterminal symbol of `newRule`.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function addMultiTokenTerminalInsertion(ruleSets, newRule, nontermSym, stopAmbiguity) {
	// Avoid insertion rules with `[blank-inserted]`. Though, the same flattening procedure should still be possible. Except, only possible if the RHS rule is nonterminal. Otherwise, it would combine a terminal symbol in a binary rule (which is not possible).
	if (!newRule.rhsDoesNotProduceText || newRule.rhs.length === 2) {
		throw new Error('For now, insertion rule flattening is only allowed for rules where `rhsDoesNotProduceText` is `true` and there is no `[blank-inserted]` symbol.')
	}

	var symRules = ruleSets[nontermSym]
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

			// Delete properties specific to nonterminal rules.
			delete newRuleClone.rhsDoesNotProduceText
			delete newRuleClone.rhsCanProduceSemantic
		} else {
			newRuleClone.rhsCanProduceSemantic = rhsRule.rhsCanProduceSemantic
			newRuleClone.secondRHSCanProduceSemantic = rhsRule.secondRHSCanProduceSemantic
		}

		// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
		editRulesUtil.addRule(symRules, newRuleClone, nontermSym, stopAmbiguity)
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

		// Add the grammatical property if it can conjugate `nonInsertedRHSSym`.
		if (rhsAcceptsGramProp(newRuleRHS, gramProp)) {
			newGramProps[propName] = gramProp
		}
	}

	return newGramProps
}

/**
 * Defines if each nonterminal rule's RHS symbols can produce a semantic. If `false`, then the rule's semantic can be reduced with a parse tree's preceding LHS semantic before parsing the RHS symbols because no semantics can follow that particular node/branch.
 *
 * Defines if each binary nonterminal rule's second RHS symbol can produce a semantic. If `false`, then there will never be a semantic down the second branch of the binary rule, and a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before the rule. Else, prevents the first branch's RHS semantic(s) from reducing with LHS semantics found before the rule until parsing the second branch's semantic(s).
 *
 * These values enable finding and discarding semantically illegal parses earlier than otherwise.
 *
 * Invoke this function after removing unused rules in `removeUnusedNonterminalSymbols()`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function assignSemanticPotentials(ruleSets) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		if (!rule.isTerminal) {
			// Defines if the rule's RHS symbols can produce a semantic.
			rule.rhsCanProduceSemantic = undefined

			if (rule.rhs.length === 2) {
				// Defines if the binary nonterminal rule's second RHS symbol can produce a semantic.
				rule.secondRHSCanProduceSemantic = semanticChecks.symCanProduceSemantic(ruleSets, rule.rhs[1])
			}

			rule.rhsCanProduceSemantic = rule.secondRHSCanProduceSemantic || semanticChecks.symCanProduceSemantic(ruleSets, rule.rhs[0])
		}
	})
}

/**
 * Adds new rules to the grammar created by transposition edits to binary rules.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function createTranspositionRules(ruleSets, stopAmbiguity) {
	grammarUtil.forEachRule(ruleSets, function (origRule, nontermSym, rules) {
		if (origRule.transpositionCost !== undefined) {
			var newRule = {
				rhs: origRule.rhs.slice().reverse(),
				cost: origRule.cost + origRule.transpositionCost,
				semantic: origRule.semantic,
				semanticIsReduced: origRule.semanticIsReduced,
				rhsCanProduceSemantic: origRule.rhsCanProduceSemantic,
				secondRHSCanProduceSemantic: origRule.secondRHSCanProduceSemantic,
				isTransposition: true,
			}

			// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
			editRulesUtil.addRule(rules, newRule, nontermSym, stopAmbiguity)
		}
	})
}

/**
 * Removes rules from `ruleSets` that produce the empty symbol, `<empty>`.
 *
 * Invoke this function after finding and saving insertions for rules with `<empty>` in `findTerminalRuleInsertions()`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeBlankSymbolRules(ruleSets) {
	grammarUtil.forEachRuleSet(ruleSets, function (rules) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.rhs[0] === g.emptySymbol) {
				rules.splice(r, 1)
				--r
				--rulesLen
			}
		}
	})
}

/**
 * Checks for default (non-edit) rules that lack and cannot produce a reduced semantic required for themselves or ancestor rules. Throws an exception if found.
 *
 * Invoke this function after removing rules with rule-less symbols in `removeUnusedNonterminalSymbols()`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function checkForMissingSemantics(ruleSets) {
	// First check for rules with a LHS semantic that cannot produce any rules with a reduced semantic.
	grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
		// Examine non-edit rules with LHS semantics.
		if (rule.semantic && !rule.semanticIsReduced && rule.insertedSymIdx === undefined) {
			// If `rule` lacks and cannot produce a reduced semantic required for itself or an ancestor rule, then print a graph representation of the parse tree path from the rule requiring LHS semantic to `rule`, and throw an exception.
			if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, rule, true, true)) {
				throw new Error('Semantic error')
			}
		}
	})

	// Second, check for rules that lack and cannot produce a reduced semantic required by an ancestor rule. Separate the checks to distinguish instances of semantics that always fail (above) from those that only fail for certain descendant rules.
	grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
		// Examine non-edit rules without LHS semantics (checked above).
		if (!(rule.semantic && !rule.semanticIsReduced) && rule.insertedSymIdx === undefined) {
			if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, rule, true, true)) {
				throw new Error('Semantic error')
			}
		}
	})
}

/**
 * Removes instances of `gramProps` with no defined values. This is necessary because `pfsearch` must check if a rule contains any grammatical properties, and it is faster to check for only `gramProps` instead of all three.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeEmptyGramProps(ruleSets) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		var ruleGramProps = rule.gramProps

		if (ruleGramProps) {
			var containsDefinedProperty = false

			for (var gramPropName in ruleGramProps) {
				if (ruleGramProps[gramPropName] !== undefined) {
					containsDefinedProperty = true
					break
				}
			}

			if (!containsDefinedProperty) {
				delete rule.gramProps
			}
		}
	})
}

/**
 * Removes instances of `rule.tree` created for debugging insertion rule generation.
 *
 * Invoke this function at the conclusion of `createEditRules` when `includeTrees` is falsey.
 *
 * It is necessary to always build the parse trees and then optionally save them in the output file so that the trees are included in any error messages.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeTrees(ruleSets) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		delete rule.tree
	})
}