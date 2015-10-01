var util = require('../util')
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
								gramCase: insertion.gramCase,
								verbForm: insertion.verbForm,
								personNumber: insertion.personNumber,
								semantic: insertion.semantic,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ],
							}
						})
					}).reduce(function (AInsertions, BInsertions) {
						// RHS has 2 symbols - create every permutation of symbols.
						var mergedInsertions = []

						AInsertions.forEach(function (A) {
							BInsertions.forEach(function (B) {
								// To reduce possible insertions, prevent semantic functions with > 1 arguments.
								if (A.semantic && B.semantic) return

								mergedInsertions.push({
									cost: A.cost + B.cost,
									text: A.text.concat(B.text),
									// Yet to use gramCase on a binary reduction.
									gramCase: A.gramCase || B.gramCase,
									verbForm: A.verbForm || B.verbForm,
									// `personNumber` only needed for 1st of 2 RHS syms: nominative case (verb precedes subject).
									personNumber: A.personNumber,
									semantic: A.semantic || B.semantic,
									insertedSyms: A.insertedSyms.concat(B.insertedSyms),
								})
							})
						})

						// Function only run once because is array of length 2.
						return mergedInsertions
					}).forEach(function (insertion) {
						// Add each insertion that can be produced from the RHS.

						var newInsertion = {
							cost: rule.cost + insertion.cost,
							// Grammatical properties traverse up tree, and are deleted from the object when used in conjugation.
							gramCase: rule.gramCase || insertion.gramCase,
							verbForm: rule.verbForm || insertion.verbForm,
							personNumber: rule.personNumber || insertion.personNumber,
							insertedSyms: insertion.insertedSyms,
						}

						// Define and conjugate text after determining grammatical properties above.
						newInsertion.text = conjugateText(insertion.text, newInsertion)

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

		// `newInsertion` and `existingInsertion` have identical display text.
		if (util.arraysEqual(existingInsertion.text, newInsertion.text)) {
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
									// `semantic` is a LHS and inserted semantics are always RHS.
									newRule.semantic = rule.semantic
									newRule.insertedSemantic = insertion.semantic
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
							// (Yet to use `gramCase` on a binary reduction.)
							newRule.gramCase = rule.gramCase || insertion.gramCase
							newRule.verbForm = rule.verbForm || insertion.verbForm
							// Person-number is only needed for 1st of 2 RHS syms: nominative case (verb precedes subject).Otherwise, the property is for when this lhsSym is used in a reduction (not this text).
							newRule.personNumber = symIdx === 0 ? (rule.personNumber || insertion.personNumber) : rule.personNumber

							// Empty strings do not produce text.
							if (insertion.text[0]) {
								newRule.insertionIdx = symIdx

								// Save text as an array only if needs conjugation (i.e., contains objects).
								var text = conjugateText(insertion.text, newRule)
								if (text.length === 1 && text[0].constructor === String) {
									newRule.text = text[0]
								} else {
									newRule.text = text
								}
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
 * Conjugates text objects in `ruleProps`, which contain different inflections or synonyms of a word, by to the accepted form:
 * - Grammatical case -> Check parent rule.
 * - Tense -> Check parent rule.
 * - Person-number -> Check insertion of preceding branch (1st of two RHS branches).
 * - Other -> Replace unaccepted synonyms.
 *
 * Concatenates adjacent strings in `insertionText`. Delete grammatical properties from `ruleProps` when used.
 *
 * @param {*[]} insertionText The display text as an array of strings and objects.
 * @param {Object[]} ruleProps The object with different inflections or synonyms of a word.
 * @returns {Array} Returns an array of conjugated strings and objects of any terms yet to be conjugated.
 */
function conjugateText(insertionText, ruleProps) {
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
		else if (ruleProps.verbForm && text[ruleProps.verbForm]) {
			textArray.push(text[ruleProps.verbForm])
			delete ruleProps.verbForm
		}

		// First-person-singular, vs. third-person-singular, vs. plural
		// - Only used on binary reductions, where first of two branches determines person-number of second branch
		else if (ruleProps.personNumber && text[ruleProps.personNumber]) {
			textArray.push(text[ruleProps.personNumber])
			delete ruleProps.personNumber
		}

		// Objective vs. nominative case: "me" vs. "I"
		else if (ruleProps.gramCase && text[ruleProps.gramCase]) {
			textArray.push(text[ruleProps.gramCase])
			delete ruleProps.gramCase
		}

		// Text cannot yet be conjugated:
		// - One of two RHS in new rule -> dependent on other RHS branch
		// - [have] liked
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
			if (util.arraysEqual(existingRule.text, newRule.text)) {
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