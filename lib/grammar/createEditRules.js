var util = require('../util/util')
var g = require('./grammar')
var semantic = require('./semantic')

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
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the grammar.
 */
module.exports = function (ruleSets, includeTrees) {
	// Map of symbols to arrays of inserted symbol sequences.
	var insertions = {}

	findTerminalRuleInsertions(ruleSets, insertions)

	// Define if each nonterminal rule's RHS symbols can produce a semantic. This can be determined before adding edit rules because any semantics in edit rules will be found in the original rules from which they are derived.
	assignSemanticPotentials(ruleSets)

	findNonterminalRulesProducingInsertions(ruleSets, insertions)

	createInsertionRules(ruleSets, insertions, includeTrees)

	createTranspositionRules(ruleSets)

	// Recursively remove nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result. Called after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`.
	removeNullNonterminalSymbols(ruleSets)

	// Check for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Called after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`
	checkForMissingSemantics(ruleSets)

	removeEmptyGramProps(ruleSets)
}

/**
 * Finds all terminal rules with insertion costs or `<empty>`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 */
function findTerminalRuleInsertions(ruleSets, insertions) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		ruleSets[nontermSym].forEach(function (rule) {
			if (rule.isTerminal) {
				var termSym = rule.RHS[0]

				if (termSym === g.emptySymbol) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost,
						// Yet to use an `<empty>` with text.
						text: rule.text ? [ rule.text ] : [],
						// Yet to be used.
						semantic: rule.semantic,
						tree: [ { symbol: termSym } ],
					})
				} else if (rule.insertionCost !== undefined) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost + rule.insertionCost,
						text: [ rule.text ],
						semantic: rule.semantic,
						tree: [ { symbol: termSym, insertionCost: rule.insertionCost } ],
					})
				}
			}
		})
	})
}

/**
 * Finds sequences of symbols that produce inserted symbols.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 */
function findNonterminalRulesProducingInsertions(ruleSets, insertions) {
	var curInsertionsSerial = JSON.stringify(insertions)
	var prevInsertionsSerial

	// Loop until no longer finding new rules.
	do {
		prevInsertionsSerial = curInsertionsSerial

		Object.keys(ruleSets).forEach(function (nontermSym) {
			ruleSets[nontermSym].forEach(function (rule) {
				if (rule.RHS.length === 2 && /\+/.test(nontermSym)) return // TEMP
				if (rule.transpositionCost !== undefined) return

				if (rhsCanBeInserted(insertions, rule)) {
					rule.RHS.map(function (sym) {
						// Create an array of every insertion for each RHS symbol.
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								gramProps: insertion.gramProps,
								semantic: insertion.semantic,
								tree: [ { symbol: sym, children: insertion.tree } ],
							}
						})
					}).reduce(function (insertionsA, inertionsB) {
						// RHS has 2 symbols - create every permutation of symbols.
						var mergedInsertions = []

						insertionsA.forEach(function (a) {
							inertionsB.forEach(function (b) {
								var newSemantic
								if (a.semantic && b.semantic) {
									newSemantic = semantic.mergeRHS(a.semantic, b.semantic)

									if (newSemantic === -1) {
										util.logError('Insertion produces illegal RHS semantic merge:')
										util.dir(a, b)
										throw 'Semantic error'
									}
								} else {
									newSemantic = a.semantic || b.semantic
								}

								var newInsertion = {
									cost: a.cost + b.cost,
									text: a.text.concat(b.text),
									semantic: newSemantic,
									tree: a.tree.concat(b.tree),
								}

								var gramPropsA = a.gramProps || {}
								var gramPropsB = b.gramProps || {}
								newInsertion.gramProps = {
									// Yet to use `gramCase` on a binary reduction.
									gramCase: gramPropsA.gramCase || gramPropsB.gramCase,
									verbForm: gramPropsA.verbForm || gramPropsB.verbForm,
									// Person-number is only needed for the first symbol in a binary rule: nominative case (verb precedes subject).
									personNumber: gramPropsA.personNumber,
								}

								mergedInsertions.push(newInsertion)
							})
						})

						// Function only run once because is array of length 2.
						return mergedInsertions
					}).forEach(function (insertion) {
						// Add each insertion that can be produced from the RHS.

						var newInsertion = {
							cost: rule.cost + insertion.cost,
							tree: insertion.tree,
						}

						// Grammatical properties traverse up tree, and are deleted from the object when used in conjugation.
						// Always create new `gramProps` objects because `conjugateText` deletes used properties.
						var insertionGramProps = insertion.gramProps || {}
						newInsertion.gramProps = {
							gramCase: rule.gramProps.gramCase || insertionGramProps.gramCase,
							verbForm: rule.gramProps.verbForm || insertionGramProps.verbForm,
							personNumber: rule.gramProps.personNumber || insertionGramProps.personNumber,
						}

						// Define and conjugate text after determining grammatical properties above.
						newInsertion.text = conjugateText(insertion.text, newInsertion.gramProps)

						if (rule.semantic && insertion.semantic) {
							newInsertion.semantic = semantic.reduce(rule.semantic, insertion.semantic)
						} else if (rule.semantic) {
							newInsertion.semantic = rule.semantic

							// Only needed if allowing insertions through `<empty>` in transpositions.
							// A function without an argument - currently can only be intersect(); E.g., "issues opened by people".
							if (!rule.semanticIsRHS) return
						} else {
							newInsertion.semantic = insertion.semantic
						}

						addInsertion(insertions, nontermSym, newInsertion)
					})
				}
			})
		})
	} while (prevInsertionsSerial !== (curInsertionsSerial = JSON.stringify(insertions)))
}

/**
 * Checks if every symbol in `rule.RHS` is a terminal symbol with an insertion cost, `<empty>`, or a nonterminal symbol that produces a sequence of the these.
 *
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
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
 * Adds a new insertion if it is unique.
 *
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 * @param {string} nontermSym The LHS nonterminal symbol that produces `newInsertion`.
 * @param {Object} newInsertion The new insertion to add.
 * @returns {boolean} Returns `true` if `newInsertion` is added, else `false`.
 */
function addInsertion(insertions, nontermSym, newInsertion) {
	if (newInsertion.cost >= 6) return

	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	// Add new insertion if unique.
	if (insertionIsUnique(symInsertions, newInsertion, nontermSym)) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

/**
 * Checks if `newInsertion` is semantically and textually unique compared to existing insertions. Prints an error and throws an exception if `newInsertion` has identical display text or semantics as an other other, which would create ambiguity.
 *
 * @param {Object[]} symInsertions The existing set of insertions to compare.
 * @param {Object} newInsertion The new insertion to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `symInsertions`.
 * @returns {boolean} Returns `true` if `newInsertion` is unique, else throws an exception.
 */
function insertionIsUnique(symInsertions, newInsertion, nontermSym) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// Check if semantic trees are identical, even if both are `undefined`.
		var semanticsEquivalent = semantic.arraysEqual(existingInsertion.semantic, newInsertion.semantic) && semantic.arraysEqual(existingInsertion.insertedSemantic, newInsertion.insertedSemantic)

		// Check if display texts, including yet-to-conjugate text objects, are identical.
		var textsEquivalent = textsEqual(existingInsertion.text, newInsertion.text)

		// A pair of insertions would create ambiguity if they produce identical semantics and/or identical display texts.
		if (semanticsEquivalent || textsEquivalent) {
			util.logError('Ambiguity created by insertion:')
			util.dir(util.stylize(nontermSym), existingInsertion, newInsertion, '\n')
			throw 'Ambiguous insertion'
		}
	}

	return true
}

/**
 * Adds new rules to the grammar from sequences of inserted terminal symbols in `insertions`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the grammar.
 */
function createInsertionRules(ruleSets, insertions, includeTrees) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		// true for all except: [nom-users-or-author-pages+] [obj-users-penalize-1+] [user-filter+]
		if (/\+/.test(nontermSym)) return
		// if (/lhs]/.test(nontermSym)) return

		ruleSets[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS

			if (RHS.length > 1) {
				RHS.forEach(function (sym, symIdx) {
					if (rule.noInsertionIndexes && rule.noInsertionIndexes.indexOf(symIdx) !== -1) return

					var otherSym = RHS[Number(!symIdx)]

					// if (/\+/.test(nontermSym) && /\+/.test(sym)) return

					if (insertions.hasOwnProperty(sym) && otherSym !== nontermSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								RHS: [ otherSym ],
								cost: rule.cost + insertion.cost,
								tree: [ { symbol: sym, children: insertion.tree } ],
							}

							// Define whether `newRule.RHS` can produce a semantic. If `false`, then `newRule.semantic` can be reduced with a parse tree's preceding LHS semantic before parsing `newRule.RHS`. This enables finding and discarding semantically illegal parses earlier than otherwise.
							newRule.rhsCanProduceSemantic = symCanProduceSemantic(ruleSets, otherSym)

							// Append the insertion's semantic, if any, to the existing rule. Perform semantic reduction or semantic RHS merging if possible.
							appendSemantic(rule, newRule, insertion.semantic)

							// Discard rule if lacks and cannot produce a RHS semantic needed by this rule or an ancestor.
							var parsingStack = g.ruleMissingRHSSemantic(nontermSym, newRule)
							if (parsingStack) {
								// util.logError('Rule will not produce needed RHS semantic:')
								// util.dir(parsingStack)
								return
							}

							// Grammatical properties traverse up tree, and are deleted from object when used in conjugation.
							// Always create new `gramProps` objects because `conjugateText` deletes used properties.
							var insertionGramProps = insertion.gramProps || {}
							newRule.gramProps = {
								// Yet to use `gramCase` on a binary reduction.
								gramCase: rule.gramProps.gramCase || insertionGramProps.gramCase,
								verbForm: rule.gramProps.verbForm || insertionGramProps.verbForm,
								// Person-number is only needed for the first symbol in a binary rule: nominative case (verb precedes subject).Otherwise, the property is for when `nontermSym` is used in a reduction (not this text).
								personNumber: symIdx === 0 ? (rule.gramProps.personNumber || insertionGramProps.personNumber) : rule.gramProps.personNumber,
							}

							// Empty strings do not produce text.
							if (insertion.text[0]) {
								newRule.insertionIdx = symIdx

								var text = conjugateText(insertion.text, newRule.gramProps)

								// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
								newRule.text = text.length === 1 ? text[0] : text
							}

							// Add new rule to grammar if it is unique (i.e., unambiguous) and below the cost upper bound. This complexity bound, which reduces the possible insertions, is necessary because when only the k-best parse results are output, then having > k insertions will construct paths that are never output.
							if (ruleIsUnique(symRules, newRule, nontermSym) && newRule.cost < 6) {
								if (!includeTrees) {
									// Add `tree` above and delete here so that it may be printed for `ruleIsUnique()` errors.
									delete newRule.tree
								}

								symRules.push(newRule)
							}
						})
					}
				})
			}
		})
	})
}

/**
 * Conjugates text objects in `insertionText`, which contain different inflections or synonyms of a word, to the accepted form using the grammatical properties defined in `gramProps`:
 * - Grammatical case -> Check parent rule.
 * - Tense -> Check parent rule.
 * - Person-number -> Check insertion of preceding branch (1st of two RHS branches).
 * - Other -> Replace unaccepted synonyms.
 *
 * Concatenates adjacent strings in `insertionText`. Delete grammatical properties from `gramProps` when used.
 *
 * @param {*[]} insertionText The display text as an array of text objects to conjugate and strings.
 * @param {Object} gramProps The parent rule's grammatical properties instructing the conjugation of `insertionText`.
 * @returns {Array} Returns an array of conjugated strings and objects of any terms yet to be conjugated.
 */
function conjugateText(insertionText, gramProps) {
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

		// Past tense.
		// - Precedes person number: "I have liked" vs. "I have like".
		// - Does not fail when text cannot conjugate - does not have to apply to every verb it sees:
		// --- "[have] liked" - past-tense applies to "liked", not [have].
		// --- ^^ This is why `verbForm` and `personNumber` cannot be combined.
		else if (gramProps.verbForm && text[gramProps.verbForm]) {
			textArray.push(text[gramProps.verbForm])
			delete gramProps.verbForm
		}

		// First-person-singular, vs. third-person-singular, vs. plural.
		else if (gramProps.personNumber && text[gramProps.personNumber]) {
			textArray.push(text[gramProps.personNumber])
			delete gramProps.personNumber
		}

		// Objective vs. nominative case; e.g., "me" vs. "I".
		else if (gramProps.gramCase && text[gramProps.gramCase]) {
			textArray.push(text[gramProps.gramCase])
			delete gramProps.gramCase
		}

		// Text cannot yet be conjugated:
		// - One of two RHS in new rule -> dependent on other RHS branch; e.g., "[have] liked".
		else {
			textArray.push(text)
		}

		return textArray
	}, [])
}

/**
 * Appends an insertion's semantic, if any, to an existing rule. Performs semantic reduction or semantic RHS merging if possible.
 *
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
			newRule.semanticIsRHS = true

			if (newRule.semantic === -1) {
				util.logError('Insertion produces illegal RHS semantic merge:')
				util.dir(existingRule, insertionSemantic)
				throw 'Semantic error'
			}
		}

		// Existing rule has a LHS semantic.
		else if (existingRule.semantic) {
			// If the other symbol does not produce a semantic, then reduce the existing rule's LHS semantic with the inserted (RHS) semantic.
			if (!newRule.rhsCanProduceSemantic) {
				newRule.semantic = semantic.reduce(existingRule.semantic, insertionSemantic)
				newRule.semanticIsRHS = true

				if (newRule.semantic === -1) {
					util.logError('Insertion produces illegal semantic reduction:')
					util.dir(existingRule, insertionSemantic)
					throw 'Semantic error'
				}
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
 * Adds new rules to the grammar for transposition edits to binary rules.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function createTranspositionRules(ruleSets) {
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

				// Add new rule to grammar if it is unique.
				if (ruleIsUnique(symRules, newRule, nontermSym)) {
					symRules.push(newRule)
				}
			}
		})
	})
}

/**
 * Checks if `newRule` is semantically and textually unique compared to existing rules (including other insertions). Prints an error and throws an exception if `newRule` has identical RHS symbols and identical display text or semantics as an other rule, which would create ambiguity.
 *
 * @param {Object[]} rules The existing set of rules to compare.
 * @param {Object} newRule The new rule to compare.
 * @param {string} nontermSym The nonterminal symbol that produces `rules`.
 * @returns {boolean} Returns `true` if `newRule` is unique, else throws an exception.
 */
function ruleIsUnique(rules, newRule, nontermSym) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		// Check if output for identical RHS symbols is ambiguous.
		if (util.arraysEqual(existingRule.RHS, newRule.RHS)) {
			// Check if semantic trees are identical, even if both are `undefined`.
			var semanticsEquivalent = semantic.arraysEqual(existingRule.semantic, newRule.semantic) && semantic.arraysEqual(existingRule.insertedSemantic, newRule.insertedSemantic)

			// Check if display texts, including yet-to-conjugate text objects, are identical.
			var textsEquivalent = textsEqual(existingRule.text, newRule.text)

			// A pair of rules is ambiguous when their rightmost symbols are identical and their semantics and/or identical display texts are identical.
			if (semanticsEquivalent || textsEquivalent) {
				util.logError('Ambiguity created by insertion:')
				util.dir(util.stylize(nontermSym), existingRule, newRule, '\n')
				throw 'Ambiguous insertion'
			}
		}
	}

	return true
}

/**
 * Performs a comparison between two rules' texts to determine if they are equivalent.
 *
 * The provided arguments are either a rule's text object to conjugate, array of text strings and objects to conjugate, or text string not needing conjugation.
 *
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
 * Recursively removes nonterminal symbols with no rules, rules whose RHS contains those symbols or `<empty>`, and any rule-less nonterminal symbols that result. Called after finding and creating insertions from rules with `<empty>` in `findTerminalRuleInsertions()`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeNullNonterminalSymbols(ruleSets) {
	var curRuleCount = g.getRuleCount(ruleSets)
	var prevRuleCount

	// Loop until no new rule-less symbols are found.
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
						// Remove rules that produce the `<empty>`.
						// Will only find any on first loop through ruleSets.
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
 * Checks for default (non-edit) rules that lack and cannot produce a needed RHS semantic. Called after removing rules with rule-less symbols in `removeNullNonterminalSymbols()`
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function checkForMissingSemantics(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Examine non-edit rules.
			if (rule.insertionIdx === undefined) {
				var parsingStack
				if (parsingStack = g.ruleMissingRHSSemantic(nontermSym, rule)) {
					util.logError('Rule can not produce needed RHS semantic:')
					util.dir(parsingStack)
					throw 'Semantic error'
				}
			}
		}
	}
}

/**
 * Remove instances of `gramProps` with no defined values. This is necessary because `pfsearch` must check if a rule contains any grammatical properties, and it is faster to check for only `gramProps` instead of all three.
 *
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