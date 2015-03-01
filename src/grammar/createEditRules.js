// Add new rules to grammar based on edit properties in existing rules:
//   Empty-string - rules that produce empty-strings (i.e., optional)
//   Insertions - inserting terminal symbols
//   Transposition - swapped RHS of nonterminal rules

var util = require('../util')


module.exports = function (grammar) {
	// Symbols that produce terminal symbols with insertion costs or empty-strings
	var insertions = {}

	findTermRuleInsertions(grammar, insertions)

	findNontermRulesProducingInsertions(grammar, insertions)

	createsRulesFromInsertions(grammar, insertions)

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
						insertedSyms: [ { symbol: termSym } ]
					})

					// Remove empty-string term syms from grammar
					symRules.splice(ruleIdx, 1)
				} else if (rule.hasOwnProperty('insertionCost')) {
					addInsertion(insertions, nontermSym, {
						cost: rule.cost + rule.insertionCost,
						insertedSyms: [ { symbol: termSym } ],
						text: termSym
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
				if (!rule.terminal && RHSCanBeInserted(insertions, rule.RHS)) {
					rule.RHS.map(function (sym) {
						// Create an array of every insertion for each RHS symbol
						return insertions[sym].map(function (insertion) {
							return {
								cost: insertion.cost,
								text: insertion.text,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ]
							}
						})
					}).reduce(function (AInsertions, BInsertions) {
						// RHS has 2 syms - create every combination of insertions
						var mergedInsertions = []

						AInsertions.forEach(function (A) {
							BInsertions.forEach(function (B) {
								mergedInsertions.push({
									cost: A.cost + B.cost,
									text: A.text && B.text ? A.text + ' ' + B.text : A.text || B.text,
									insertedSyms: A.insertedSyms.concat(B.insertedSyms)
								})
							})
						})

						// Function only run once because array of length 2
						return mergedInsertions
					}).forEach(function (newInsertion) {
						// Add each insertion the can be produced from the RHS
						addInsertion(insertions, nontermSym, {
							cost: rule.cost + newInsertion.cost,
							text: newInsertion.text,
							insertedSyms: newInsertion.insertedSyms
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
		if (existingInsertion.text === newInsertion.text) {
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
function createsRulesFromInsertions(grammar, insertions) {
	Object.keys(grammar).forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS
			if (RHS.length > 1) {
				RHS.forEach(function (sym, symIdx) {
					var otherSym = RHS[+!symIdx]

					if (insertions.hasOwnProperty(sym) && otherSym !== nontermSym) {
						insertions[sym].forEach(function (insertion) {
							var newRule = {
								RHS: [ otherSym ],
								cost: rule.cost + insertion.cost,
								insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ],
							}

							// Empty-strings don't produce text
							if (insertion.text) {
								newRule.text = insertion.text
								newRule.textIdx = symIdx
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

// Throw err if new rule generated from insertion(s), empty-string(s), or a transposition is a duplicate of an existing rule
function ruleExists(rules, newRule) {
	for (var r = rules.length; r-- > 0;) {
		var existingRule = rules[r]

		if (util.arraysMatch(existingRule.RHS, newRule.RHS) && existingRule.text === newRule.text) {
			if (existingRule.insertedSyms) {
				console.log('Err: two identical rules produced by insertion(s)')
			} else {
				console.log('Err: new rule produced with edits identical to original rule')
			}

			console.log(existingRule)
			console.log(newRule)
			console.log()

			throw 'duplicate rule produced with edits'
		}
	}

	return false
}