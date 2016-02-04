var util = require('../util/util')
var editRulesUtil = require('./editRulesUtil')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')
var semanticChecks = require('./semanticChecks')
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
	// Map of symbols to arrays of inserted symbol sequences.
	var insertions = {}

	// Find all terminal rules with insertion costs or `<empty>`.
	findTerminalRuleInsertions(ruleSets, insertions, stopAmbiguity)

	// Recursively remove nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result. Invoke after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`, and before `createInsertionRules()` which would otherwise create insertion rules using the nonterminal rules this removes.
	removeNullNonterminalSymbols(ruleSets)

	// Define if each nonterminal rule's RHS symbols can produce a semantic. This can be determined before adding edit rules because any semantics in edit rules will be found in the original rules from which they are derived. Invoke after removing unused rules in `removeNullNonterminalSymbols()`.
	assignSemanticPotentials(ruleSets)

	// Check for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Throws an exception if finds any. Invoke after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`.
	checkForMissingSemantics(ruleSets)

	// Find sequences of symbols that can be inserted.
	findNonterminalRuleInsertions(ruleSets, insertions, stopAmbiguity)

	// Add new rules to the grammar created by sequences of inserted terminal symbols in `insertions`.
	createInsertionRules(ruleSets, insertions, stopAmbiguity)

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
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function findTerminalRuleInsertions(ruleSets, insertions, stopAmbiguity) {
	grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
		if (rule.isTerminal) {
			var termSym = rule.rhs[0]

			if (termSym === g.emptySymbol) {
				editRulesUtil.addInsertion(insertions, nontermSym, {
					cost: rule.cost,
					text: [],
					tree: [ { symbol: termSym } ],
				}, stopAmbiguity)
			} else if (rule.insertionCost !== undefined) {
				editRulesUtil.addInsertion(insertions, nontermSym, {
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
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function findNonterminalRuleInsertions(ruleSets, insertions, stopAmbiguity) {
	// Iterate until no longer finding new insertions.
	do {
		var insertionAdded = false

		for (var nontermSym in ruleSets) {
			ruleSets[nontermSym].forEach(function (rule) {
				// Temporarily prevent insertions with rules from which transpositions are created.
				if (rule.transpositionCost !== undefined) return

				if (rhsCanBeInserted(insertions, rule)) {
					rule.rhs.map(function (sym) {
						// Map the insertions for each RHS symbol to new insertions with an extended tree.
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								personNumber: insertion.personNumber,
								semantic: insertion.semantic,
								restrictInsertion: insertion.restrictInsertion,
								tree: [ { symbol: sym, children: insertion.tree } ],
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
						if (editRulesUtil.addInsertion(insertions, nontermSym, newInsertion, stopAmbiguity)) {
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
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {Object} rule The rule to examine.
 * @returns {boolean} Returns `true` if every `rule.rhs` can be inserted, else `false`.
 */
function rhsCanBeInserted(insertions, rule) {
	if (rule.isTerminal) {
		return false
	}

	if (rule.noInsert || rule.noInsertionIndexes !== undefined) {
		return false
	}

	return rule.rhs.every(function (sym) {
		return insertions.hasOwnProperty(sym)
	})
}

/**
 * Adds new rules to the grammar created by sequences of inserted terminal symbols in `insertions`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {boolean} [stopAmbiguity] Specify throwing an exception for a pair of ambiguous edit rules, else save the cheapest of the two rules to the grammar.
 */
function createInsertionRules(ruleSets, insertions, stopAmbiguity) {
	// The nonterminal symbol used in the second position of insertion rules where the inserted segment is in the right (second) position of its original binary rule and includes the `[1-sg]` symbol in the insertion.
	// Add this symbol to the grammar here to prevent `removeNullNonterminalSymbols()` from removing it earlier.
	var blankInsertedSymbol = g.newSymbol('blank', 'inserted').addRule({
		isTerminal: true,
		rhs: g.blankSymbol,
		isPlaceholder: true,
	})

	for (var nontermSym in ruleSets) {
		ruleSets[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var rhs = rule.rhs

			if (rhs.length > 1) {
				rhs.forEach(function (sym, insertedSymIdx) {
					// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
					if (rule.noInsertionIndexes && rule.noInsertionIndexes.indexOf(insertedSymIdx) !== -1) return

					// The other RHS symbol not being inserted.
					var otherSym = rhs[Number(!insertedSymIdx)]

					if (insertions.hasOwnProperty(sym) && otherSym !== nontermSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								// Rules where the inserted segment is in the right (second) position of a binary rule and includes terminal rules where `restrictInsertion` is `true` can only occur at the end of an input query.
								// 1. This reduces the number of semantically ambiguous suggestions otherwise created by inserting the same query segment (e.g., "liked by me") at multiple positions in the input query.
								// 2. More importantly, this prioritizes suggestions that are easier for the user to read by only inserting at the end. In contrast, arbitrarily positioning edits anywhere in the query disorients the user as they must discern the suggestion's differences from input.
								// The `Parser` inputs the `<blank>` symbol at the end of parsing the input query to only allow these binary insertion rules with `<blank>` to match at the end of the query.
								// Check `rule.restrictInsertion` for nonterminal rules created from regex-style terminal rules.
								rhs: insertedSymIdx === 1 && (rule.restrictInsertion || insertion.restrictInsertion) ? [ otherSym, blankInsertedSymbol.name ] : [ otherSym ],
								// The total cost of this rule and the insertion.
								cost: rule.cost + insertion.cost,
								// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject). If the second symbol, the property is for when this rule becomes a child rule.
								personNumber: insertedSymIdx === 0 ? (rule.personNumber || insertion.personNumber) : rule.personNumber,
								// Specify an insertion created using a rule that was originally a regex-style substitution, whose RHS `pfsearch` should not traverse because it produces no text.
								isSubstitution: rule.isSubstitution,
								// Specify an insertion created using a rule that was originally a regex-style stop word, whose RHS `pfsearch` should not traverse because it produces no text.
								isStopWord: rule.isStopWord,
								// Temporarily save trees, even if `includeTrees` is `false`, for `ruleIsUnique()` errors in `editRulesUtil`.
								tree: [ { symbol: sym, children: insertion.tree } ],
							}

							// Save only the original rule's grammatical properties applicable to the non-inserted symbol. All other properties only apply to the inserted symbol, which are used in its conjugation below. This is ensured because new rules are verified to only include grammatical properties if the RHS produces accepting terminal rules.
							// If no properties are added to `newRule.gramProps`, then `removeEmptyGramProps()` later removes this property.
							newRule.gramProps = {}
							for (var propName in rule.gramProps) {
								var gramProp = rule.gramProps[propName]

								// If the non-inserted symbol accepts this grammatical property, then add the property to the new rule.
								if (rhsAcceptsGramProp(newRule.rhs, gramProp)) {
									newRule.gramProps[propName] = gramProp
								}
							}

							// Define whether `newRule.rhs` can produce a semantic. If `false`, then `newRule.semantic` can be reduced with a parse tree's preceding LHS semantic before parsing `newRule.rhs`. This enables finding and discarding semantically illegal parses earlier than otherwise.
							newRule.rhsCanProduceSemantic = semanticChecks.symCanProduceSemantic(ruleSets, otherSym)

							// Append the insertion's semantic, if any, to the existing rule. Perform semantic reduction or semantic RHS merging if possible. Throw an exception if semantically illegal.
							appendSemantic(rule, newRule, insertion.semantic)

							// Discard `newRule` if lacks and cannot produce a reduced semantic required for itself or an ancestor rule.
							if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, newRule)) return

							if (rule.rhsDoesNotProduceText) {
								// The display text for multi-token terminal strings using nonterminal rules created from regex-style terminal rules (including substitutions) and nonterminal stop-words (which lack `text`).
								newRule.text = rule.text
								newRule.tense = rule.tense
								newRule.rhsDoesNotProduceText = true

								// Flatten `newRule`, the insertion rule created from a nonterminal rule derived from a multi-token terminal symbol in `splitRegexTerminalSymbols`, into several insertion rules, and adds those rules to the grammar. The flattening, which merges `newRule` with the rules `newRule.rhs[0]` produces, enables `ruleIsUnique()` in `editRulesUtil` to properly discard ambiguous rules. E.g., X -> "x" vs. X -> Y -> "x".
								// FIXME: Though this implementation correctly avoids ambiguity, should move this operation to after adding all insertion rules because other rules might still be added to the rhs symbol rules that this function reduces.
								if (newRule.rhs.length === 1) {
									addMultiTokenTerminalInsertion(ruleSets, newRule, nontermSym, stopAmbiguity)
									return
								}
							} else if (insertion.text[0]) {
								// Only save `insertedSymIdx` for rules with text, otherwise the new rule (produced via `<empty>`) is an ordinary unary nonterminal rule.
								newRule.insertedSymIdx = insertedSymIdx

								// Conjugate text using the original rule's grammatical properties and the most recent person-number property.
								var text = conjugateText(insertion.text, rule.gramProps, newRule.personNumber)

								// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
								newRule.text = text.length === 1 ? text[0] : text
							}

							// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
							editRulesUtil.addRule(symRules, newRule, nontermSym, stopAmbiguity)
						})
					}
				})
			}
		})
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
 * Defines if each nonterminal rule's RHS symbols can produce a semantic. If `false`, then the rule's semantic can be reduced with a parse tree's preceding LHS semantic before parsing the RHS symbols because no semantics can follow that particular node/branch.
 *
 * Defines if each binary nonterminal rule's second RHS symbol can produce a semantic. If `false`, then there will never be a semantic down the second branch of the binary rule, and a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before the rule. Else, prevents the first branch's RHS semantic(s) from reducing with LHS semantics found before the rule until parsing the second branch's semantic(s).
 *
 * These values enable finding and discarding semantically illegal parses earlier than otherwise.
 *
 * Invoked after removing unused rules in `removeNullNonterminalSymbols()`.
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
	for (nontermSym in ruleSets) {
		ruleSets[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			if (rule.transpositionCost !== undefined) {
				var newRule = {
					rhs: rule.rhs.slice().reverse(),
					cost: rule.cost + rule.transpositionCost,
					semantic: rule.semantic,
					semanticIsReduced: rule.semanticIsReduced,
					rhsCanProduceSemantic: rule.rhsCanProduceSemantic,
					secondRHSCanProduceSemantic: rule.secondRHSCanProduceSemantic,
					isTransposition: true,
				}

				// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
				editRulesUtil.addRule(symRules, newRule, nontermSym, stopAmbiguity)
			}
		})
	}
}

/**
 * Recursively removes nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result.
 *
 * Invoked after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`, and before `createInsertionRules()` which would otherwise create insertion rules using the nonterminal rules this removes.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeNullNonterminalSymbols(ruleSets) {
	// Iterate until no new rule-less symbols are found.
	do {
		var ruleOrSymRemoved = false

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]

			if (rules.length === 0) {
				// Delete nonterminal symbol without rules.
				delete ruleSets[nontermSym]
				ruleOrSymRemoved = true
			} else {
				for (var r = 0; r < rules.length; ++r) {
					var rule = rules[r]
					if (rule.isTerminal) {
						// Remove rules that produce the `<empty>`. Will only find any on the first iteration through `ruleSets`.
						if (rule.rhs[0] === g.emptySymbol) {
							rules.splice(r, 1)
							--r
							ruleOrSymRemoved = true
						}
					} else {
						for (var s = 0, rhs = rule.rhs, rhsLen = rhs.length; s < rhsLen; ++s) {
							// Nonterminal RHS contains previously deleted symbol which had no rules.
							if (!ruleSets.hasOwnProperty(rhs[s])) {
								rules.splice(r, 1)
								--r
								ruleOrSymRemoved = true
								break
							}
						}
					}
				}
			}
		}
	} while (ruleOrSymRemoved)
}

/**
 * Checks for default (non-edit) rules that lack and cannot produce a reduced semantic required for themselves or ancestor rules. Throws an exception if found.
 *
 * Invoked after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`.
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
			if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, rule, true)) {
				throw new Error('Semantic error')
			}
		}
	})

	// Second, check for rules that lack and cannot produce a reduced semantic required by an ancestor rule. Separate the checks to distinguish instances of semantics that always fail (above) from those that only fail for certain descendant rules.
	grammarUtil.forEachRule(ruleSets, function (rule, nontermSym) {
		// Examine non-edit rules without LHS semantics (checked above).
		if (!(rule.semantic && !rule.semanticIsReduced) && rule.insertedSymIdx === undefined) {
			if (semanticChecks.ruleMissingReducedSemantic(ruleSets, nontermSym, rule, true)) {
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
 * Invoked at the conclusion of `createEditRules` when `includeTrees` is falsey.
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