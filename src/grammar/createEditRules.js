// Add new rules to grammar based on edit properties in existing rules:
//   Empty-string - rules that produce empty-strings (i.e., optional)
//   Insertions - inserting terminal symbols
//   Transposition - swapped RHS of nonterminal rules

var util = require('../util')
var insertSemantic = require('./Semantic.js').insertSemantic
var mergeRHS = require('./Semantic.js').mergeRHS


module.exports = function (grammar) {
	// Symbols that produce terminal symbols with insertion costs or empty-strings
	var insertions = {}

	findTermRuleInsertions(grammar, insertions)

	findNontermRulesProducingInsertions(grammar, insertions)

	createRulesFromInsertions(grammar, insertions)

	createRulesFromTranspositions(grammar)
}

// Find all terminal rules with insertion costs or blanks
function findTermRuleInsertions(grammar, insertions) {
	var emptyTermSym = require('./grammar').emptyTermSym

	Object.keys(grammar).forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			if (rule.terminal) {
				var termSym = rule.RHS[0]
				if (termSym === emptyTermSym) { // Empty-string
					addInsertion(insertions, nontermSym, {
						cost: rule.cost,
						insertedSyms: [ { symbol: termSym } ],
						// [1-sg-poss-omissible] uses a blank to achieve an insertion cost of 0 on a base cost of 0
						text: rule.text ? [ rule.text ] : []
					})

					// Remove empty-string term syms from grammar
					symRules.splice(ruleIdx, 1)
				} else if (rule.hasOwnProperty('insertionCost')) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost + rule.insertionCost,
						insertedSyms: [ { symbol: termSym } ],
						text: [ rule.text || termSym ],
						semantic: rule.semantic
					})
				}
			}
		})
	})
}

// Find sequences of syms that produce inserted terminal symbols or empty-strings
function findNontermRulesProducingInsertions(grammar, insertions) {
	var prevInsertionsSerial

	do { // Loop until no longer finding new productions
		prevInsertionsSerial = JSON.stringify(insertions)

		Object.keys(grammar).forEach(function (nontermSym) {
			grammar[nontermSym].forEach(function (rule) {
				if (rule.RHS.length === 2 && /\+/.test(nontermSym)) return // TEMP
				// if (rule.RHS.indexOf(nontermSym) !== -1) return
				if (rule.hasOwnProperty('transpositionCost')) return

				if (!rule.terminal && RHSCanBeInserted(insertions, rule.RHS)) {
					rule.RHS.map(function (sym) {
						// Create an array of every insertion for each RHS symbol
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								semantic: insertion.semantic,
								personNumber: insertion.personNumber,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ]
							}
						})
					}).reduce(function (AInsertions, BInsertions) {
						// RHS has 2 syms - create every combination of insertions
						var mergedInsertions = []

						AInsertions.forEach(function (A) {
							BInsertions.forEach(function (B) {
								if (A.semantic && B.semantic) {
									var semantic = mergeRHS(A.semantic, B.semantic)
									if (semantic === -1) throw 'duplicate semantic'
								} else {
									var semantic = A.semantic || B.semantic
								}

								mergedInsertions.push({
									cost: A.cost + B.cost,
									text: A.text.concat(B.text),
									semantic: semantic,
									// Person-number only needed for 1st for 2 RHS syms: nominative case (verb precedes subject)
									// Only used for conjugation of current rule
									personNumber: A.personNumber,
									insertedSyms: A.insertedSyms.concat(B.insertedSyms)
								})
							})
						})

						// Function only run once because array of length 2
						return mergedInsertions
					}).forEach(function (insertion) {
						// Add each insertion the can be produced from the RHS

						// TEMP
						// FIX: not checking for an insertect (or any open ended) on right
						// no problems currently, but need checks
						if (rule.semantic && insertion.semantic) {
							var semantic = insertSemantic(rule.semantic, insertion.semantic)
						} else {
							var semantic = rule.semantic || insertion.semantic
						}

						// Temp hack:
						var noConjugation = insertion.text.join(' ') === conjugateText(rule, insertion).join(' ')

						addInsertion(insertions, nontermSym, {
							cost: rule.cost + insertion.cost,
							text: conjugateText(rule, insertion),
							semantic: semantic,
							// Person-number only traverses up for 1-to-1; person-number used on first 1-to-2
							personNumber: rule.RHS.length === 1 ? (rule.personNumber || insertion.personNumber) : (noConjugation ? rule.personNumber : undefined),
							insertedSyms: insertion.insertedSyms
						})
					})
				}
			})
		})
	} while (JSON.stringify(insertions) !== prevInsertionsSerial)
}

// Every sym in production is a terminal symbol with an insertion cost, an empty-string, or a nonterminal symbol that produces a sequence of the these
function RHSCanBeInserted(insertions, RHS) {
	return RHS.every(function (sym) {
		return insertions.hasOwnProperty(sym)
	})
}

// Add new insertion if does not already exist
// Return true if new insertion is added
function addInsertion(insertions, nontermSym, newInsertion) {
	var symInsertions = insertions[nontermSym] || (insertions[nontermSym] = [])

	if (!insertionExists(symInsertions, newInsertion)) {
		symInsertions.push(newInsertion)
		return true
	}

	return false
}

// Return true if insertion exists
// If new insertion is cheaper than an existing insertion with identical text, remove existing insertion and return false
// Otherwise return false
function insertionExists(symInsertions, newInsertion) {
	for (var s = symInsertions.length; s-- > 0;) {
		var existingInsertion = symInsertions[s]

		// New insertion and existing insertion have identical display text
		if (util.arraysMatch(existingInsertion.text, newInsertion.text)) {
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

// Add new rules from inserted terminal symbol productions and empty-string productions to grammar
function createRulesFromInsertions(grammar, insertions) {
	Object.keys(grammar).forEach(function (nontermSym) {
		if (/\+/.test(nontermSym)) return // TEMP

		grammar[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS
			if (RHS.length > 1) {
				RHS.forEach(function (sym, symIdx) {
					var otherSym = RHS[+!symIdx]

					// if (/\+/.test(nontermSym) && /\+/.test(sym)) return

					if (insertions.hasOwnProperty(sym) && otherSym !== nontermSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								RHS: [ otherSym ],
								cost: rule.cost + insertion.cost,
								semantic: rule.semantic,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ],
							}

							// Empty-strings don't produce text or semantics (for now)
							if (insertion.text && insertion.text[0]) {
								newRule.insertionIdx = symIdx
								newRule.insertedSemantic = insertion.semantic
								newRule.text = conjugateText(rule, insertion)
								// If insertion.personNumber or rule.personNumber exists, conjugation will occur on this rule
								// - Could conjugate now, but keep to check input (if multiple forms of inflection accepted)

								// symIdx === 1:
								// - (that) [have] been liked -> (that) have been liked
								// - (who) [follow] me -> (who) follow me
								// --- need rule.personNumber to conjugate [have]
								// symIdx === 0:
								// - [nom-users] like/likes

								// Currently needlessly saves for [have] (been) in rule above after [have] conjugated (because personNumber on a fork, and travels up 1-1)
								newRule.personNumber = symIdx === 1 ? rule.personNumber : insertion.personNumber

								// [followed] (by me) -> followed (by me)
								// Currently needlessly saves for "[have] (liked)", where verbForm already conjugated "liked"
								if (insertion.text.join(' ') === newRule.text.join(' ')) // No conjugation - temp hack
								newRule.verbForm = rule.verbForm
							}

							if (!ruleExists(symRules, newRule)) {
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
function createRulesFromTranspositions(grammar) {
	Object.keys(grammar).forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			if (rule.hasOwnProperty('transpositionCost')) {
				var newRule = {
					RHS: rule.RHS.slice().reverse(),
					cost: rule.cost + rule.transpositionCost,
					transposition: true
				}

				if (!ruleExists(symRules, newRule)) {
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
function conjugateText(rule, insertion) {
	if (rule.RHS.length === 1) {
		// Grammatical case check only occurs in 1->1 rules
		return insertion.text.reduce(function (textArray, text) {
			// Already conjugated, or no conjugation needed (e.g., noun, preposition)
			if (typeof text === 'string') {
				// Concatenate string to prev element if also a string
				var lastIdx = textArray.length - 1
				if (typeof textArray[lastIdx] === 'string') {
					textArray[lastIdx] += ' ' + text
				} else {
					textArray.push(text)
				}
			}

			// Objective vs. nominative case: "me" vs. "I"
			else if (rule.gramCase) {
				if (!text[rule.gramCase]) throw 'looking for a gram case'
				textArray.push(text[rule.gramCase])
			}

			else {
				util.log(text, rule, insertion)
				throw 'text cannot be conjugated'
			}

			return textArray
		}, [])
	} else {
		// Tense and person-number check only occurs in 1->2 rules
		return insertion.text.reduce(function (textArray, text) {
			// Already conjugated, or no conjugation needed (e.g., noun, preposition)
			if (typeof text === 'string') {
				// Concatenate string to prev element if also a string
				var lastIdx = textArray.length - 1
				if (typeof textArray[lastIdx] === 'string') {
					textArray[lastIdx] += ' ' + text
				} else {
					textArray.push(text)
				}
			}

			// Past tense
			// - Precedes person number: "I have liked" vs. "I have like" (though, now order doesn't matter)
			// - Does not fail when text cannot conjugate - does not have to apply to every verb it sees:
			// --- "[have] liked" - past-tense applies to "liked", not [have]
			else if (rule.verbForm && text[rule.verbForm]) {
				textArray.push(text[rule.verbForm])
			}

			// Could combine verbForm and personNumber because never applied at same time
			// -- But waiting until making more rules

			// First person, vs. third person singular, vs. plural
			// - Only used on 1-to-2, where first of two branches determines person-number of second branch
			// - Only applies to 2nd of 2 RHS branches
			else if (insertion.personNumber) {
				if (!text[insertion.personNumber]) throw 'looking for a personNumber'
				textArray.push(text[insertion.personNumber])
			}

			// (that) [have] been -> (that) have been
			// (who) [follow] me -> (who) follow me
			// - Only applies to 1st of 2 RHS branches
			else if (rule.personNumber) {
				if (!text[rule.personNumber]) throw 'looking for a personNumber'
				textArray.push(text[rule.personNumber])
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
}

// Throw err if new rule generated from insertion(s), empty-string(s), or a transposition is a duplicate of an existing rule
// If new rule has identical semantics and RHS but is cheaper than previous new rule, remove previous rule
function ruleExists(rules, newRule) {
	for (var r = rules.length; r-- > 0;) {
		var existingRule = rules[r]

		if (util.arraysMatch(existingRule.RHS, newRule.RHS)) {
			if (util.arraysMatch(existingRule.text, newRule.text)) {
				if (existingRule.insertedSyms) {
					console.log('Err: two identical rules produced by insertion(s)')
				} else {
					console.log('Err: new rule produced with edits identical to original rule')
				}

				util.log(existingRule, newRule)
				throw 'duplicate rule produced with edits'
			}

			// New rule and previously created rule have identical RHS and semantics
			if (existingRule.insertedSemantic && existingRule.semantic === newRule.semantic) {
				if (JSON.stringify(existingRule.insertedSemantic) === JSON.stringify(newRule.insertedSemantic)) {
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
	}

	return false
}