var util = require('../util/util')
var g = require('./grammar')
var semantic = require('./semantic')

/**
 * Adds new rules to grammar based on edit properties in existing rules:
 *   Empty strings - rules that produce empty strings (i.e., optional).
 *   Insertions - inserting terminal symbols.
 *   Transposition - swapped RHS of nonterminal rules.
 *
 * Recursively removes nonterminal symbols with no rules, rules whose RHS containing those symbols or the <empty> symbol, and any rule-less nonterminal symbols that result.
 *
 * Checks non-edit rules for semantic errors; i.e., fail to produce a needed RHS semantic.
 * - Also avoids creating edit rules with semantic errors.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	// Map of symbols to arrays of inserted symbol sequences.
	var insertions = {}

	findTermRuleInsertions(ruleSets, insertions)

	// Recursively remove nonterminal symbols with no rules, rules whose RHS containing those symbols or the <empty> symbol, and any rule-less nonterminal symbols that result
	// Called after finding insertions from rules with '<empty>' in findTermRuleInsertions()
	removeNullNonterminalSymbols(ruleSets)

	// Check non-edit rules for semantic errors: fail to produce a needed RHS semantic
	// Called after removing rules with rule-less symbols in removeNullNonterminalSymbols()
	checkForSemanticErrors(ruleSets)

	findNontermRulesProducingInsertions(ruleSets, insertions)

	createRulesFromInsertions(ruleSets, insertions)

	createRulesFromTranspositions(ruleSets)

	removeEmptyGramProps(ruleSets)
}

/**
 * Finds all terminal rules with insertion costs or `<empty>`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 */
function findTermRuleInsertions(ruleSets, insertions) {
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
						insertedSyms: [ { symbol: termSym } ],
					})
				} else if (rule.insertionCost !== undefined) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost + rule.insertionCost,
						text: [ rule.text ],
						semantic: rule.semantic,
						insertedSyms: [ { symbol: termSym } ],
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
function findNontermRulesProducingInsertions(ruleSets, insertions) {
	var curInsertionsSerial = JSON.stringify(insertions)
	var prevInsertionsSerial

	// Loop until no longer finding new rules.
	do {
		prevInsertionsSerial = curInsertionsSerial

		Object.keys(ruleSets).forEach(function (nontermSym) {
			ruleSets[nontermSym].forEach(function (rule) {
				if (rule.RHS.length === 2 && /\+/.test(nontermSym)) return // TEMP
				if (rule.transpositionCost !== undefined) return

				if (RHSCanBeInserted(insertions, rule)) {
					rule.RHS.map(function (sym) {
						// Create an array of every insertion for each RHS symbol.
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								gramProps: insertion.gramProps,
								semantic: insertion.semantic,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ],
							}
						})
					}).reduce(function (insertionsA, inertionsB) {
						// RHS has 2 symbols - create every permutation of symbols.
						var mergedInsertions = []

						insertionsA.forEach(function (a) {
							inertionsB.forEach(function (b) {
								// To reduce possible insertions, prevent semantic functions with > 1 arguments.
								// However, this is an inappropriate bound for complexity; rather, should rely only on cost.
								if (a.semantic && b.semantic) return

								var newInsertion = {
									cost: a.cost + b.cost,
									text: a.text.concat(b.text),
									semantic: a.semantic || b.semantic,
									insertedSyms: a.insertedSyms.concat(b.insertedSyms),
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
							insertedSyms: insertion.insertedSyms,
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
 * Determines whether every symbol in `rule.RHS` is a terminal symbol with an insertion cost, `<empty>`, or a nonterminal symbol that produces a sequence of the these.
 *
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 * @param {Object} rule The rule to examine.
 * @returns {boolean} Returns `true` if every `rule.RHS` can be inserted, else `false`.
 */
function RHSCanBeInserted(insertions, rule) {
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
	// if (newInsertion.cost > 5) return false

	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	// Add new insertion if it is unique.
	if (insertionIsUnique(symInsertions, newInsertion)) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

/**
 * Determines whether `newInsertion` is unique compared to existing insertions. Returns `true if insertions exists`. If `newInsertion` is cheaper than an existing insertion with identical text, removes the existing insertion and returns `true`.
 *
 * @param {Object[]} symInsertions The existing insertions with the same LHS as `newInsertion`.
 * @param {Object} newInsertion The new insertion to add.
 * @returns {boolean} Returns `true` if `newInsertion` is unique compared an existing insertions, else `false`.
 */
function insertionIsUnique(symInsertions, newInsertion) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// Check if `newInsertion` and `existingInsertion` have identical display text.
		if (textsEqual(existingInsertion.text, newInsertion.text)) {
			if (existingInsertion.cost < newInsertion.cost) {
				return false
			} else {
				// `newInsertion` is cheaper than an existing insertion with identical text -> remove existing insertion.
				symInsertions.splice(s, 1)
				return true
			}
		}
	}

	return true
}

/**
 * Adds new rules to the grammar from sequences of inserted terminal symbols in `insertions`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertions The map of symbols to array of inserted symbol sequences.
 */
function createRulesFromInsertions(ruleSets, insertions) {
	Object.keys(ruleSets).forEach(function (lhsSym) {
		// true for all except: [nom-users-or-author-pages+] [obj-users-penalize-1+] [user-filter+]
		if (/\+/.test(lhsSym)) return
		// if (/lhs]/.test(lhsSym)) return

		ruleSets[lhsSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS
			if (RHS.length > 1) {
				RHS.forEach(function (sym, symIdx) {
					if (rule.noInsertionIndexes && rule.noInsertionIndexes.indexOf(symIdx) !== -1) return
					var otherSym = RHS[Number(!symIdx)]

					// if (/\+/.test(nontermSym) && /\+/.test(sym)) return

					if (insertions.hasOwnProperty(sym) && otherSym !== lhsSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								RHS: [ otherSym ],
								cost: rule.cost + insertion.cost,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ],
							}

							// Inserted semantic.
							if (insertion.semantic) {
								if (rule.semanticIsRHS) {
									newRule.semantic = semantic.mergeRHS(rule.semantic, insertion.semantic)
									if (newRule.semantic === -1) return
									newRule.semanticIsRHS = true
								} else if (rule.semantic) {
									if (!symbolProducesSemantic(ruleSets, otherSym)) {
										// If the other symbol does not produce a semantic, then reduce the rule's LHS semantic with the inserted (RHS) semantic.
										newRule.semantic = semantic.reduce(rule.semantic, insertion.semantic)
										if (newRule.semantic === -1) throw 'Illegal semantic reduction for insertion'
										newRule.semanticIsRHS = true
									} else {
										// `semantic` is a LHS and inserted semantics are always RHS.
										newRule.semantic = rule.semantic
										newRule.insertedSemantic = insertion.semantic
									}
								} else {
									// Inserted semantics are always RHS.
									newRule.semantic = insertion.semantic
									newRule.semanticIsRHS = true
								}
							} else {
								newRule.semantic = rule.semantic
								newRule.semanticIsRHS = rule.semanticIsRHS
							}

							// Discard rule if lacks and cannot produce a RHS semantic needed by this rule or an ancestor.
							var parsingStack = g.ruleMissingNeededRHSSemantic(newRule, lhsSym)
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
								// Person-number is only needed for the first symbol in a binary rule: nominative case (verb precedes subject).Otherwise, the property is for when this lhsSym is used in a reduction (not this text).
								personNumber: symIdx === 0 ? (rule.gramProps.personNumber || insertionGramProps.personNumber) : rule.gramProps.personNumber,
							}

							// Empty strings do not produce text.
							if (insertion.text[0]) {
								newRule.insertionIdx = symIdx

								var text = conjugateText(insertion.text, newRule.gramProps)

								// Save text as an array if contains multiple items (one of which is a text object requiring conjugation).
								newRule.text = text.length === 1 ? text[0] : text
							}

							// Add new rule to grammar if it is unique.
							if (ruleIsUnique(symRules, newRule, lhsSym)) {
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
 * Checks if `nontermSym` can produce a rule with a semantic.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a semantic, else `false`.
 */
function symbolProducesSemantic(ruleSets, nontermSym, _symsSeen) {
	_symsSeen = _symsSeen || []
	_symsSeen.push(nontermSym)

	return ruleSets[nontermSym].some(function (rule) {
		if (rule.semantic || rule.isPlaceholder) {
			return true
		} else if (!rule.isTerminal) {
			return rule.RHS.some(function (symbol) {
				if (_symsSeen.indexOf(symbol) === -1) {
					return symbolProducesSemantic(ruleSets, symbol, _symsSeen)
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
function createRulesFromTranspositions(ruleSets) {
	Object.keys(ruleSets).forEach(function (lhsSym) {
		ruleSets[lhsSym].forEach(function (rule, ruleIdx, symRules) {
			if (rule.transpositionCost !== undefined) {
				var newRule = {
					RHS: rule.RHS.slice().reverse(),
					cost: rule.cost + rule.transpositionCost,
					semantic: rule.semantic,
					semanticIsRHS: rule.semanticIsRHS,
					isTransposition: true,
				}

				// Add new rule to grammar if it is unique.
				if (ruleIsUnique(symRules, newRule, lhsSym)) {
					symRules.push(newRule)
				}
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

		// Past tense
		// - Precedes person number: "I have liked" vs. "I have like"
		// - Does not fail when text cannot conjugate - does not have to apply to every verb it sees:
		// --- "[have] liked" - past-tense applies to "liked", not [have]
		// --- ^^ This is why verbForm and personNumber cannot be combined
		else if (gramProps.verbForm && text[gramProps.verbForm]) {
			textArray.push(text[gramProps.verbForm])
			delete gramProps.verbForm
		}

		// First-person-singular, vs. third-person-singular, vs. plural
		else if (gramProps.personNumber && text[gramProps.personNumber]) {
			textArray.push(text[gramProps.personNumber])
			delete gramProps.personNumber
		}

		// Objective vs. nominative case; e.g., "me" vs. "I"
		else if (gramProps.gramCase && text[gramProps.gramCase]) {
			textArray.push(text[gramProps.gramCase])
			delete gramProps.gramCase
		}

		// Text cannot yet be conjugated:
		// - One of two RHS in new rule -> dependent on other RHS branch; e.g., "[have] liked"
		else {
			textArray.push(text)
		}

		return textArray
	}, [])
}

/**
 * Determines if `newRule` has unique LHS and RHS symbols compared to existing rules. Throws an exception if `newRule` has identical RHS and display text to an existing non-insertion rule. If `newRule` has identical RHS symbols, semantics, but different display text and cheaper than an other insertion rule, then removes the other insertion rule and return `true`.
 *
 * @param {Object[]} rules The existing set of rules to check for
 * @param {Object} newRule The new rule to add to `rules`.
 * @param {string} lhsSym The nonterminal symbol that produces `rules`.
 * @returns {boolean} Returns `true` if `newRule` is unique compare existing rules, else `false`.
 */
function ruleIsUnique(rules, newRule, lhsSym) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		if (util.arraysEqual(existingRule.RHS, newRule.RHS)) {
			// `newRule` and an existing non-insertion rule have identical RHS and display text.
			if (textsEqual(existingRule.text, newRule.text)) {
				if (existingRule.insertedSyms) {
					util.logError('Two identical rules produced by insertion(s):')
				} else {
					util.logError('New rule produced with edits identical to original rule:')
				}

				util.dir(lhsSym, existingRule, newRule)
				throw 'Duplicate rule produced with edits'
			}

			// `newRule` and previously created insertion rule have identical RHS and semantics.
			if (semantic.arraysEqual(existingRule.semantic, newRule.semantic) && semantic.arraysEqual(existingRule.insertedSemantic, newRule.insertedSemantic)) {
				if (existingRule.cost < newRule.cost) {
					return false
				} else {
					// `newRule` is cheaper than an existing insertion rule with identical RHS and semantics -> remove existing insertion.
					rules.splice(r, 1)
					return true
				}
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
 * Recursively removes nonterminal symbols with no rules, rules whose RHS containing those symbols or the <empty> symbol, and any rule-less nonterminal symbols that result. Called after finding insertions from rules with '<empty>' in `findTermRuleInsertions()`.
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
 * Checks for a default (non-edit) rule that lacks and cannot produce a needed RHS semantic.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function checkForSemanticErrors(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Examine non-edit rules.
			if (rule.insertionIdx === undefined) {
				var parsingStack
				if (parsingStack = g.ruleMissingNeededRHSSemantic(rule, nontermSym)) {
					util.logError('Rule will not produce needed RHS semantic:')
					util.dir(parsingStack)
					throw 'semantic error'
				}
			}
		}
	}
}

/**
 * Remove instances of `gramProps` with no defined values. This is necessary because `forestSearch()` must check if a rule contains any grammatical properties, and it is faster to check for only `gramProps` instead of all three.
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