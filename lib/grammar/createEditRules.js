var util = require('../util/util')
var g = require('./grammar')
var semantic = require('./semantic')

/**
 * The maximum cost for grammar rules.
 *
 * This complexity bound, which reduces the possible insertions, is necessary because when only the k-best parse results are output, then having > k insertions will construct paths that are never output.
 *
 * @type number
 */
var MAX_COST = 6

/**
 * Adds new rules to grammar based on edit properties in existing rules:
 *   Empty strings - rules that produce empty strings (i.e., optional).
 *   Insertions - inserting terminal symbols.
 *   Transposition - swapped RHS of nonterminal rules.
 *
 * Recursively removes nonterminal symbols with no rules, rules whose RHS containing those symbols or the `<empty>` symbol, and any rule-less nonterminal symbols that result.
 *
 * Checks non-edit rules for semantic errors; i.e., fail to produce a needed RHS semantic.
 * - Also avoids creating edit rules with semantic errors.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the grammar.
 * @param {boolean} [ignoreAmbiguity] Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception. This is used to create the `ambiguityCheck` test rules.
 */
module.exports = function (ruleSets, includeTrees, ignoreAmbiguity) {
	// Map of symbols to arrays of inserted symbol sequences.
	var insertions = {}

	// Find all terminal rules with insertion costs or `<empty>`.
	findTerminalRuleInsertions(ruleSets, insertions, ignoreAmbiguity)

	// Define if each nonterminal rule's RHS symbols can produce a semantic. This can be determined before adding edit rules because any semantics in edit rules will be found in the original rules from which they are derived.
	assignSemanticPotentials(ruleSets)

	// Recursively remove nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result. Called after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`, and before `createInsertionRules()` which would otherwise create insertion rules using the nonterminal rules this removes.
	removeNullNonterminalSymbols(ruleSets)

	// Check for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Throws an exception if finds any. Called after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`
	checkForMissingSemantics(ruleSets)

	// Find sequences of symbols that can be inserted.
	findNonterminalRuleInsertions(ruleSets, insertions, ignoreAmbiguity)

	// Add new rules to the grammar created by sequences of inserted terminal symbols in `insertions`.
	createInsertionRules(ruleSets, insertions, ignoreAmbiguity)

	// Add new rules to the grammar created by transposition edits to binary rules.
	createTranspositionRules(ruleSets, ignoreAmbiguity)

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
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 */
function findTerminalRuleInsertions(ruleSets, insertions, ignoreAmbiguity) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		ruleSets[nontermSym].forEach(function (rule) {
			if (rule.isTerminal) {
				var termSym = rule.RHS[0]

				if (termSym === g.emptySymbol) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost,
						text: [],
						tree: [ { symbol: termSym } ],
					}, ignoreAmbiguity)
				} else if (rule.insertionCost !== undefined) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost + rule.insertionCost,
						text: [ rule.text ],
						semantic: rule.semantic,
						tree: [ { symbol: termSym, insertionCost: rule.insertionCost } ],
					}, ignoreAmbiguity)
				}
			}
		})
	})
}

/**
 * Finds sequences of symbols that can be inserted.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 */
function findNonterminalRuleInsertions(ruleSets, insertions, ignoreAmbiguity) {
	// Iterate until no longer finding new insertions.
	do {
		var insertionAdded = false

		Object.keys(ruleSets).forEach(function (nontermSym) {
			ruleSets[nontermSym].forEach(function (rule) {
				// Prevent insertions (temporarily) with binary rules produced by symbols with '+' in the name. Otherwise far more ambiguity exists in the grammar.
				if (rule.RHS.length === 2 && /\+/.test(nontermSym)) return
				// Prevent insertions (temporarily) with rules from which transpositions are created.
				if (rule.transpositionCost !== undefined) return

				if (rhsCanBeInserted(insertions, rule)) {
					rule.RHS.map(function (sym) {
						// Map the insertions for each RHS symbol to new insertions with an extended tree.
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								personNumber: insertion.personNumber,
								semantic: insertion.semantic,
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

									if (newSemantic === -1) {
										util.logError('Insertion produces illegal RHS semantic merge:')
										util.dir(a, b)
										throw new Error('Semantic error')
									}

									// Sort RHS to correctly detect identical semantic arrays in `areAmbiguous()`.
									newSemantic.sort(semantic.compare)
								} else {
									newSemantic = a.semantic || b.semantic
								}

								mergedInsertions.push({
									cost: a.cost + b.cost,
									text: a.text.concat(b.text),
									// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject).
									personNumber: a.personNumber,
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
							semantic: undefined,
							tree: insertion.tree,
						}

						// Conjugate text using the rule's grammatical properties and the most recent person-number property.
						newInsertion.text = conjugateText(insertion.text, rule.gramProps, newInsertion.personNumber)

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
							if (!rule.semanticIsRHS) return
						} else {
							newInsertion.semantic = insertion.semantic
						}

						// Add insertion if unique (i.e., unambiguous) and below the cost upper bound.
						if (addInsertion(insertions, nontermSym, newInsertion, ignoreAmbiguity)) {
							insertionAdded = true
						}
					})
				}
			})
		})
	} while (insertionAdded)
}

/**
 * Checks if every symbol in `rule.RHS` is a terminal symbol with an insertion cost, `<empty>`, or a nonterminal symbol that produces a sequence of the these.
 *
 * @private
 * @static
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {Object} rule The rule to examine.
 * @returns {boolean} Returns `true` if every `rule.RHS` can be inserted, else `false`.
 */
function rhsCanBeInserted(insertions, rule) {
	if (rule.isTerminal) {
		return false
	}

	if (rule.noInsertionIndexes !== undefined) {
		return false
	}

	return rule.RHS.every(function (sym) {
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
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 */
function createInsertionRules(ruleSets, insertions, ignoreAmbiguity) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		// Prevent insertions (temporarily) with rules produced by symbols with '+' in the name.
		if (/\+/.test(nontermSym)) return

		ruleSets[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS

			if (RHS.length > 1) {
				RHS.forEach(function (sym, insertedSymIdx) {
					// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
					if (rule.noInsertionIndexes && rule.noInsertionIndexes.indexOf(insertedSymIdx) !== -1) return

					// The other RHS symbol not being inserted.
					var otherSym = RHS[Number(!insertedSymIdx)]
					if (insertions.hasOwnProperty(sym) && otherSym !== nontermSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								RHS: [ otherSym ],
								// The total cost of this rule and the insertion.
								cost: rule.cost + insertion.cost,
								// Person-number is only needed for the first symbol in a binary rule; person-number conjugation occurs for the nominative case, which relies on the person-number of the first branch (verb precedes subject). If the second symbol, the property is for when this rule becomes a child rule.
								personNumber: insertedSymIdx === 0 ? (rule.personNumber || insertion.personNumber) : rule.personNumber,
								// Temporarily save trees, even if `includeTrees` is `false`, for `ruleIsUnique()` errors.
								tree: [ { symbol: sym, children: insertion.tree } ],
							}

							// Save only the original rule's grammatical properties applicable to the non-inserted symbol. All other properties only apply to the inserted symbol, which are used in its conjugation below. This is ensured because new rules are verified to only include grammatical properties if the RHS produces accepting terminal rules.
							// If no properties are added to `newRule.gramProps`, then `removeEmptyGramProps()` later removes the property from the rule.
							newRule.gramProps = {}
							for (var prop in rule.gramProps) {
								var gramPropName = rule.gramProps[prop]

								var otherSymRules = ruleSets[otherSym]
								for (var r = 0, rulesLen = otherSymRules.length; r < rulesLen; ++r) {
									var rhsRule = otherSymRules[r]

									// If the non-inserted symbol accepts this grammatical property, then add the property to the new rule.
									if (rhsRule.isTerminal && rhsRule.text && rhsRule.text[gramPropName]) {
										newRule.gramProps[prop] = gramPropName
										break
									}
								}
							}

							// Define whether `newRule.RHS` can produce a semantic. If `false`, then `newRule.semantic` can be reduced with a parse tree's preceding LHS semantic before parsing `newRule.RHS`. This enables finding and discarding semantically illegal parses earlier than otherwise.
							newRule.rhsCanProduceSemantic = symCanProduceSemantic(ruleSets, otherSym)

							// Append the insertion's semantic, if any, to the existing rule. Perform semantic reduction or semantic RHS merging if possible. Throw an exception if semantically illegal.
							appendSemantic(rule, newRule, insertion.semantic)

							// Discard rule if lacks and cannot produce a RHS semantic needed by this rule or an ancestor.
							var failedParsePath = g.ruleMissingRHSSemantic(nontermSym, newRule)
							if (failedParsePath) {
								// util.logError('Insertion rule will not produce needed RHS semantic:', util.stylize(nontermSym), '->', newRule.RHS)
								// util.dir(failedParsePath)
								return
							}

							// Empty strings do not produce text.
							if (insertion.text[0]) {
								// Only save `insertedSymIdx` for rules with text, otherwise the new rule (produced via `<empty>`) is an ordinary unary nonterminal rule.
								newRule.insertedSymIdx = insertedSymIdx

								// Conjugate text using the original rule's grammatical properties and the most recent person-number property.
								var text = conjugateText(insertion.text, rule.gramProps, newRule.personNumber)

								// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
								newRule.text = text.length === 1 ? text[0] : text
							}

							// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
							addRule(symRules, newRule, nontermSym, ignoreAmbiguity)
						})
					}
				})
			}
		})
	})
}

/**
 * Conjugates text objects in `insertionText`, each of which contain a term's different inflected forms, to the accepted form using the grammatical properties in the insertion's parent rule and the most recent person-number property (from the paths forming the insertion or its parent rule). Also concatenates adjacent strings in `insertionText`.
 *
 * @private
 * @static
 * @param {*[]} insertionText The array of text strings and text objects to conjugate.
 * @param {Object} gramProps The insertion's parent rule's grammatical properties (`tense` and `gramCase`) for conjugating text objects in `insertionText`.
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

		// Conjugate for required verb tense. E.g., "(repos I have) liked".
		// Must occur before person-number check, otherwise "[have] [like]" yields "have like" instead of "have liked".
		else if (text[gramProps.tense]) {
			textArray.push(text[gramProps.tense])
		}

		// Conjugate for required grammatical case. E.g., "(repos) I (like)".
		else if (text[gramProps.gramCase]) {
			textArray.push(text[gramProps.gramCase])
		}

		// First-person-singular, vs. third-person-singular, vs. plural.
		else if (text[personNumber]) {
			textArray.push(text[personNumber])
		}

		// Text cannot yet be conjugated. Occurs when called via `createInsertionRules()` and only conjugating the text of one of the branches, where there exists a verb dependent on the person-number property to be defined in the other branch.
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
 * @param {Object[]} insertionSemantic The insertion's semantic.
 */
function appendSemantic(existingRule, newRule, insertionSemantic) {
	// Check if insertion has a semantic (which is always reduced).
	if (insertionSemantic) {
		// Merge existing rule's RHS semantic with inserted (RHS) semantic.
		if (existingRule.semanticIsRHS) {
			newRule.semantic = semantic.mergeRHS(existingRule.semantic, insertionSemantic)

			if (newRule.semantic === -1) {
				util.logError('Insertion produces illegal RHS semantic merge:')
				util.dir(existingRule, insertionSemantic)
				throw new Error('Semantic error')
			}

			// Sort RHS to correctly detect identical semantic arrays in `areAmbiguous()`.
			newRule.semantic.sort(semantic.compare)
			newRule.semanticIsRHS = true
		}

		// Existing rule has a LHS semantic.
		else if (existingRule.semantic) {
			// If the other symbol does not produce a semantic, then reduce the existing rule's LHS semantic with the inserted (RHS) semantic.
			if (!newRule.rhsCanProduceSemantic) {
				newRule.semantic = semantic.reduce(existingRule.semantic, insertionSemantic)

				if (newRule.semantic === -1) {
					util.logError('Insertion produces illegal semantic reduction:')
					util.dir(existingRule, insertionSemantic)
					throw new Error('Semantic error')
				}

				newRule.semanticIsRHS = true
			}

			// Else save the existing semantic and inserted semantic separately.
			else {
				// When `newRule.semantic` and `newRule.insertedSemantic` are both defined, the former is a LHS semantic and the latter is a RHS semantic.
				newRule.semantic = existingRule.semantic
				newRule.insertedSemantic = insertionSemantic
			}
		}

		// Rule lacks a semantic; save inserted (RHS) semantic.
		else {
			newRule.semantic = insertionSemantic
			newRule.semanticIsRHS = true
		}
	}

	// Insertion lacks a semantic.
	else {
		newRule.semantic = existingRule.semantic
		newRule.semanticIsRHS = existingRule.semanticIsRHS
	}
}

/**
 * Defines if each nonterminal rule's RHS symbols can produce a semantic. If `false`, then the rule's semantic can be reduced with a parse tree's preceding LHS semantic before parsing the RHS symbols because no semantics can follow that particular node/branch.
 *
 * Defines if each binary nonterminal rule's second RHS symbol can produce a semantic. If `false`, then there will never be a semantic down the second branch of the binary rule, and a RHS semantic in the first branch can freely reduce with any preceding LHS semantic found before the rule. Else, prevents the first branch's RHS semantic(s) from reducing with LHS semantics found before the rule until parsing the second branch's semantic(s).
 *
 * These values enable finding and discarding semantically illegal parses earlier than otherwise.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function assignSemanticPotentials(ruleSets) {
	for (var nontermSym in ruleSets) {
		ruleSets[nontermSym].forEach(function (rule) {
			if (!rule.isTerminal) {
				// Defines if the rule's RHS symbols can produce a semantic.
				rule.rhsCanProduceSemantic = rule.RHS.some(function (nontermSym) {
					return symCanProduceSemantic(ruleSets, nontermSym)
				})

				if (rule.RHS.length === 2) {
					// Defines if the binary nonterminal rule's second RHS symbol can produce a semantic.
					rule.secondRHSCanProduceSemantic = symCanProduceSemantic(ruleSets, rule.RHS[1])
				}
			}
		})
	}
}

/**
 * Checks if `nontermSym` can produce a rule with a semantic.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a semantic, else `false`.
 */
function symCanProduceSemantic(ruleSets, nontermSym, _symsSeen) {
	_symsSeen = _symsSeen || []
	_symsSeen.push(nontermSym)

	return ruleSets[nontermSym].some(function (rule) {
		if (rule.semantic || rule.isPlaceholder) {
			return true
		} else if (!rule.isTerminal) {
			return rule.RHS.some(function (symbol) {
				if (_symsSeen.indexOf(symbol) === -1) {
					return symCanProduceSemantic(ruleSets, symbol, _symsSeen)
				}
			})
		}
	})
}

/**
 * Adds new rules to the grammar created by transposition edits to binary rules.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 */
function createTranspositionRules(ruleSets, ignoreAmbiguity) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		ruleSets[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			if (rule.transpositionCost !== undefined) {
				var newRule = {
					RHS: rule.RHS.slice().reverse(),
					cost: rule.cost + rule.transpositionCost,
					semantic: rule.semantic,
					semanticIsRHS: rule.semanticIsRHS,
					rhsCanProduceSemantic: rule.rhsCanProduceSemantic,
					secondRHSCanProduceSemantic: rule.secondRHSCanProduceSemantic,
					isTransposition: true,
				}

				// Add new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
				addRule(symRules, newRule, nontermSym, ignoreAmbiguity)
			}
		})
	})
}

/**
 * Adds a new insertion if it is unique (i.e., unambiguous) and below the cost upper bound.
 *
 * @private
 * @static
 * @param {Object} insertions The map of symbol names to arrays of insertions.
 * @param {Object} newInsertion The new insertion.
 * @param {string} nontermSym The LHS nonterminal symbol that produces `newInsertion`.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 * @returns {boolean} Returns true if `newInsertion` is added, else `false`.
 */
function addInsertion(insertions, nontermSym, newInsertion, ignoreAmbiguity) {
	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	// Add new insertion if unique.
	if (insertionIsUnique(symInsertions, newInsertion, nontermSym, ignoreAmbiguity) && newInsertion.cost < MAX_COST) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

/**
 * Checks if `newInsertion` is semantically and textually unique compared to existing insertions. Prints an error and throws an exception if `newInsertion` has identical display text or semantics as an other other, which would create ambiguity.
 *
 * @private
 * @static
 * @param {Object[]} symInsertions The existing set of insertions to compare.
 * @param {Object} newInsertion The new insertion to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `symInsertions`.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 * @returns {boolean} Returns `true` if `newInsertion` is unique, `false` if `ignoreAmbiguity` is `true`, else throws an exception.
 */
function insertionIsUnique(symInsertions, newInsertion, nontermSym, ignoreAmbiguity) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// Check if insertions are identical because `findNonterminalRuleInsertions()` iterates through the grammar multiple times (until it stops finding new insertions), which can cause the same insertion to be created (but not added) on successive iterations. This prevents reporting the identical insertions as distinct ambiguous insertions.
		if (util.arraysEqual(newInsertion.tree, existingInsertion.tree, util.objectsEqual)) return false

		// Determine if the semantics and/or display texts are identical. If so, and `ignoreAmbiguity` is `true`, then save the cheapest insertion, else print an error and throw an exception.
		if (areAmbiguous(existingInsertion, newInsertion, nontermSym, ignoreAmbiguity)) {
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
 * Adds a new rule to the grammar if it is unique (i.e., unambiguous) and below the cost upper bound.
 *
 * @private
 * @static
 * @param {Object[]} rules The existing set of rules.
 * @param {Object} newRule The new rule to append.
 * @param {string} nontermSym The nonterminal symbol that produces `rules`.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 * @returns {boolean} Returns true if `newRule` is added, else `false`.
 */
function addRule(rules, newRule, nontermSym, ignoreAmbiguity) {
	if (ruleIsUnique(rules, newRule, nontermSym, ignoreAmbiguity) && newRule.cost < MAX_COST) {
		rules.push(newRule)
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
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 * @returns {boolean} Returns `true` if `newRule` is unique, `false` if `ignoreAmbiguity` is `true`, else throws an exception.
 */
function ruleIsUnique(rules, newRule, nontermSym, ignoreAmbiguity) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		// Check if output for identical RHS symbols is ambiguous.
		if (util.arraysEqual(existingRule.RHS, newRule.RHS)) {
			// Determine if the semantics and/or display texts are identical. If so, and `ignoreAmbiguity` is `true`, then save the cheapest rule to the grammar, else print an error and throw an exception.
			if (areAmbiguous(existingRule, newRule, nontermSym, ignoreAmbiguity)) {
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
 * Checks if two rules or insertions are semantically and/or textually identical. If so, then prints an error and throws an exception.
 *
 * @private
 * @static
 * @param {Object} a The rule or insertion to compare.
 * @param {Object} b The other rule or insertion to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `a` and `b`.
 * @param {boolean} ignoreAmbiguity Specify saving the cheapest of two ambiguous rules to the grammar, else print and error and throw an exception.
 * @returns {boolean} Returns `false` if `a` and `b` are distinguishable, else throws an exception.
 */
function areAmbiguous(a, b, nontermSym, ignoreAmbiguity) {
	// Check if semantic trees are identical, even if both are `undefined`.
	var semanticsEquivalent = semantic.arraysEqual(a.semantic, b.semantic) && semantic.arraysEqual(a.insertedSemantic, b.insertedSemantic)

	// Check if display texts, including yet-to-conjugate text objects, are identical.
	var textsEquivalent = textsEqual(a.text, b.text)

	// A pair of paths is ambiguous when their rightmost symbols are identical and their semantics and/or identical display texts are identical.
	if (semanticsEquivalent || textsEquivalent) {
		if (a.insertedSymIdx === undefined ? b.insertedSymIdx !== undefined : b.insertedSymIdx == undefined) {
			// Throw an exception regardless of `ignoreAmbiguity`.
			util.logError('Insertion rule is ambiguous with a non-insertion rule')
		} else if (ignoreAmbiguity) {
			// Do not throw an exception to allow the cheapest of the two to be saved.
			if (ignoreAmbiguity) return true
		} else {
			util.logError('Ambiguity created by insertion:')
		}

		nontermSym = util.stylize(nontermSym)
		util.dir(nontermSym, a)
		util.log()
		util.dir(nontermSym, b)
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

/**
 * Recursively removes nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result. Called after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`, and before `createInsertionRules()` which would otherwise create insertion rules using the nonterminal rules this removes.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeNullNonterminalSymbols(ruleSets) {
	var curRuleCount = g.getRuleCount(ruleSets)
	var prevRuleCount

	// Iterate until no new rule-less symbols are found.
	do {
		prevRuleCount = curRuleCount

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]

			if (rules.length === 0) {
				// Delete nonterminal symbol without rules.
				delete ruleSets[nontermSym]
			} else {
				for (var r = 0; r < rules.length; ++r) {
					var rule = rules[r]
					if (rule.isTerminal) {
						// Remove rules that produce the `<empty>`. Will only find any on first iteration through ruleSets.
						if (rule.RHS[0] === g.emptySymbol) {
							rules.splice(r, 1)
							--r
						}
					} else {
						for (var s = 0, RHS = rule.RHS, RHSLen = RHS.length; s < RHSLen; ++s) {
							// Nonterminal RHS contains previously deleted symbol which had no rules.
							if (!ruleSets.hasOwnProperty(RHS[s])) {
								rules.splice(r, 1)
								--r
								break
							}
						}
					}
				}
			}
		}
	} while (prevRuleCount !== (curRuleCount = g.getRuleCount(ruleSets)))
}

/**
 * Checks for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Throws an exception if finds any. Called after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function checkForMissingSemantics(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Examine non-edit rules.
			if (rule.insertedSymIdx === undefined) {
				var failedParsePath = g.ruleMissingRHSSemantic(nontermSym, rule)
				if (failedParsePath) {
					util.logError('Rule can not produce needed RHS semantic:', util.stylize(nontermSym), '->', rule.RHS)
					util.dir(failedParsePath)
					throw new Error('Semantic error')
				}
			}
		}
	}
}

/**
 * Removes instances of `gramProps` with no defined values. This is necessary because `pfsearch` must check if a rule contains any grammatical properties, and it is faster to check for only `gramProps` instead of all three.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeEmptyGramProps(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
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
		}
	}
}

/**
 * Removes instances of `rule.tree` created for debugging insertion rule generation. This is called at the conclusion of `createEditRules` when invoked with falsey `includeTrees`.
 *
 * It is necessary to always build the parse trees and then optionally save them in the output file so that the trees are included in any error messages.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeTrees(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			delete rules[r].tree
		}
	}
}