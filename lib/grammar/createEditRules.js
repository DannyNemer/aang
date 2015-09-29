// Add new rules to grammar based on edit properties in existing rules:
//   Empty strings - rules that produce empty strings (i.e., optional)
//   Insertions - inserting terminal symbols
//   Transposition - swapped RHS of nonterminal rules
// Recursively remove nonterminal symbols with no rules, rules whose RHS containing those symbols or the <empty> symbol, and any rule-less nonterminal symbols that result
// Check non-edit rules for semantic errors: fail to produce a needed RHS semantic
// - Also avoid creating edit rules with semantic errors

var util = require('../util')
var g = require('./grammar')
var semantic = require('./semantic')


module.exports = function (ruleSets) {
	// Symbols that produce terminal symbols with insertion costs or empty strings
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

// Finds all terminal rules with insertion costs or <empty>
function findTermRuleInsertions(ruleSets, insertions) {
	Object.keys(ruleSets).forEach(function (nontermSym) {
		ruleSets[nontermSym].forEach(function (rule) {
			if (rule.isTerminal) {
				var termSym = rule.RHS[0]
				if (termSym === g.emptySymbol) { // Empty string
					addInsertion(insertions, nontermSym, {
						cost: rule.cost,
						// Yet to use with text
						text: rule.text ? [ rule.text ] : [],
						// Yet to be used
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

// Finds sequences of syms that produce inserted terminal symbols or empty strings
function findNontermRulesProducingInsertions(ruleSets, insertions) {
	var curInsertionsSerial = JSON.stringify(insertions)
	var prevInsertionsSerial

	// Loop until no longer finding new rules
	do {
		prevInsertionsSerial = curInsertionsSerial

		Object.keys(ruleSets).forEach(function (nontermSym) {
			ruleSets[nontermSym].forEach(function (rule) {
				if (rule.RHS.length === 2 && /\+/.test(nontermSym)) return // TEMP
				if (rule.transpositionCost !== undefined) return

				if (RHSCanBeInserted(insertions, rule)) {
					rule.RHS.map(function (sym) {
						// Create an array of every insertion for each RHS symbol
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
						// RHS has 2 syms - create every combination of insertions
						var mergedInsertions = []

						AInsertions.forEach(function (A) {
							BInsertions.forEach(function (B) {
								// To reduce possible insertions, prevent semantic functions with > 1 arguments
								if (A.semantic && B.semantic) return

								mergedInsertions.push({
									cost: A.cost + B.cost,
									text: A.text.concat(B.text),
									// Yet to use gramCase on a binary reduction
									gramCase: A.gramCase || B.gramCase,
									verbForm: A.verbForm || B.verbForm,
									// Person-number only needed for 1st of 2 RHS syms: nominative case (verb precedes subject)
									personNumber: A.personNumber,
									semantic: A.semantic || B.semantic,
									insertedSyms: A.insertedSyms.concat(B.insertedSyms),
								})
							})
						})

						// Function only run once because array of length 2
						return mergedInsertions
					}).forEach(function (insertion) {
						// Add each insertion the can be produced from the RHS

						var newInsertion = {
							cost: rule.cost + insertion.cost,
							// Grammatical properties traverse up tree, and are deleted from object when used in conjugation
							gramCase: rule.gramCase || insertion.gramCase,
							verbForm: rule.verbForm || insertion.verbForm,
							personNumber: rule.personNumber || insertion.personNumber,
							insertedSyms: insertion.insertedSyms,
						}

						// Define and conjugate text after determining grammatical properties above
						newInsertion.text = conjugateText(insertion.text, newInsertion)

						if (rule.semantic && insertion.semantic) {
							newInsertion.semantic = semantic.reduce(rule.semantic, insertion.semantic)
						} else if (rule.semantic) {
							newInsertion.semantic = rule.semantic
							// Only needed if allowing insertions through <empty> in transpositions
							// A function without an argument - currently can only be intersect()
							// E.g., "issues opened by people"
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

// Every sym in `RHS` is a terminal symbol with an insertion cost, an empty string, or a nonterminal symbol that produces a sequence of the these
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

// Add new insertion if does not already exist
// Returns `true` if new insertion is added
function addInsertion(insertions, nontermSym, newInsertion) {
	// if (newInsertion.cost > 5) return false

	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	if (!insertionExists(symInsertions, newInsertion)) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

// Returns `true` if insertion exists
// If new insertion is cheaper than an existing insertion with identical text, remove existing insertion and return false
// Otherwise returns `false`
function insertionExists(symInsertions, newInsertion) {
	for (var s = 0, symInsertionsLen = symInsertions.length; s < symInsertionsLen; ++s) {
		var existingInsertion = symInsertions[s]

		// New insertion and existing insertion have identical display text
		if (util.arraysEqual(existingInsertion.text, newInsertion.text)) {
			if (existingInsertion.cost < newInsertion.cost) {
				return true
			} else {
				// New insertion is cheaper -> remove existing insertion
				symInsertions.splice(s, 1)
				return false
			}
		}
	}

	return false
}

// Add new rules from inserted terminal symbols and empty strings
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

							if (insertion.semantic) {
								if (rule.semanticIsRHS) {
									newRule.semantic = semantic.mergeRHS(rule.semantic, insertion.semantic)
									if (newRule.semantic === -1) return
									newRule.semanticIsRHS = true
								} else if (rule.semantic) {
									// `semantic` is a LHS and inserted semantics are always RHS
									newRule.semantic = rule.semantic
									newRule.insertedSemantic = insertion.semantic
								} else {
									// Inserted semantics are always RHS
									newRule.semantic = insertion.semantic
									newRule.semanticIsRHS = true
								}
							} else {
								newRule.semantic = rule.semantic
								newRule.semanticIsRHS = rule.semanticIsRHS
							}

							// Discard rule if lacks and cannot produce a RHS semantic needed by this rule or an ancestor
							var parsingStack = g.ruleMissingNeededRHSSemantic(newRule, lhsSym)
							if (parsingStack) {
								// util.logError('Rule will not produce needed RHS semantic:')
								// util.dir(parsingStack)
								return
							}

							// Grammatical properties traverse up tree, and are deleted from object when used in conjugation
							// Yet to use gramCase on a binary reduction
							newRule.gramCase = rule.gramCase || insertion.gramCase
							newRule.verbForm = rule.verbForm || insertion.verbForm
							// Person-number only needed for 1st of 2 RHS syms: nominative case (verb precedes subject)
							// Otherwise, the property is for when this lhsSym is used in a reduction (not this text)
							newRule.personNumber = symIdx === 0 ? (rule.personNumber || insertion.personNumber) : rule.personNumber

							// Empty strings do not produce text
							if (insertion.text[0]) {
								newRule.insertionIdx = symIdx

								// Save text as an array only if needs conjugations (contains Object)
								var text = conjugateText(insertion.text, newRule)
								if (text.length === 1 && text[0].constructor === String) {
									newRule.text = text[0]
								} else {
									newRule.text = text
								}
							}

							if (!ruleExists(symRules, newRule, lhsSym)) {
								symRules.push(newRule)
							}
						})
					}
				})
			}
		})
	})
}

// Add new rules from transpositions to grammar
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

				if (!ruleExists(symRules, newRule, lhsSym)) {
					symRules.push(newRule)
				}
			}
		})
	})
}

// Replace text Objects, which contain different inflections or synonyms of a word, with accepted form
// - grammatical case -> check parent rule
// - tense -> check parent rule
// - person-number -> check insertion of preceding branch (1st of two RHS branches)
// - other -> replace unaccepted synonyms
// Concatenate adjacent strings
// Delete grammatical properties from 'ruleProps' when used
function conjugateText(insertionText, ruleProps) {
	return insertionText.reduce(function (textArray, text) {
		// Already conjugated, or no conjugation needed (e.g., noun, preposition)
		if (text.constructor === String) {
			// Concatenate string to previous element if also a string
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

		// First person, vs. third person singular, vs. plural
		// - Only used on binary reudctions, where first of two branches determines person-number of second branch
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

// Throw err if new rule generated from insertion(s), empty string(s), or a transposition is a duplicate of an existing rule
// If new rule has identical semantics and RHS but is cheaper than previous new rule, remove previous rule
function ruleExists(rules, newRule, lhsSym) {
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var existingRule = rules[r]

		if (util.arraysEqual(existingRule.RHS, newRule.RHS)) {
			if (util.arraysEqual(existingRule.text, newRule.text)) {
				if (existingRule.insertedSyms) {
					util.logError('Two identical rules produced by insertion(s):')
				} else {
					util.logError('New rule produced with edits identical to original rule:')
				}

				util.dir(lhsSym, existingRule, newRule)
				throw 'duplicate rule produced with edits'
			}

			// New rule and previously created rule have identical RHS and semantics
			if (semantic.arraysEqual(existingRule.semantic, newRule.semantic) && semantic.arraysEqual(existingRule.insertedSemantic, newRule.insertedSemantic)) {
				if (existingRule.cost < newRule.cost) {
					return true
				} else {
					// New rule is cheaper -> remove existing rule
					rules.splice(r, 1)
					return false
				}
			}
		}
	}

	return false
}


// Recursively remove nonterminal symbols with no rules, rules whose RHS containing those symbols or the <empty> symbol, and any rule-less nonterminal symbols that result
// Called after finding insertions from rules with '<empty>' in findTermRuleInsertions()
function removeNullNonterminalSymbols(ruleSets) {
	var curRuleCount = g.getRuleCount(ruleSets)
	var prevRuleCount

	// Loop until no new rule-less symbols are found
	do {
		prevRuleCount = curRuleCount

		for (var nontermSym in ruleSets) {
			var rules = ruleSets[nontermSym]

			// Nonterminal symbol has no rules
			if (rules.length === 0) {
				delete ruleSets[nontermSym]
			} else {
				for (var r = 0; r < rules.length; ++r) {
					var rule = rules[r]
					if (rule.isTerminal) {
						// Remove rules that produce the <empty> symbol
						// Will only find any on first loop through ruleSets
						if (rule.RHS[0] === g.emptySymbol) {
							rules.splice(r, 1)
							r--
						}
					} else for (var s = 0, RHS = rule.RHS, RHSLen = RHS.length; s < RHSLen; ++s) {
						// Nonterminal RHS contains previously deleted symbol which had no rules
						if (!ruleSets.hasOwnProperty(RHS[s])) {
							rules.splice(r, 1)
							r--
							break
						}
					}
				}
			}
		}
	} while (prevRuleCount !== (curRuleCount = g.getRuleCount(ruleSets)))
}


// Throws an error if a default (non-edit) rule lacks and cannot produce a needed RHS semantic
function checkForSemanticErrors(ruleSets) {
	for (var nontermSym in ruleSets) {
		var rules = ruleSets[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

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