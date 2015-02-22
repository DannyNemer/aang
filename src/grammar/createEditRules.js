// Add edit-rules

var util = require('../util')


module.exports = function (grammar) {
	// Symbols that produce the terminal sysmbols with insertion costs or empty-strings
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
					insertions[nontermSym] = {
						cost: rule.cost,
						insertedSyms: [ { symbol: termSym } ]
					}

					// Remove empty-string term syms from grammar
					symRules.splice(ruleIdx, 1)
				} else if (rule.hasOwnProperty('insertionCost')) {
					insertions[nontermSym] = {
						cost: rule.cost + rule.insertionCost,
						insertedSyms: [ { symbol: termSym } ],
						text: termSym
					}
				}
			}
		})
	})
}

// Find sequences of syms that produce inserted terminal symbols or empty-strings
function findNontermRulesProducingInsertions(grammar, insertions) {
	var insertionsAdded

	do { // Loop until no longer finding new productions
		insertionsAdded = false
		Object.keys(grammar).forEach(function (nontermSym) {
			grammar[nontermSym].forEach(function (rule) {
				if (!rule.terminal && RHSCanBeInserted(insertions, rule.RHS)) {
					var newInsertion = rule.RHS.map(function (sym) {
						var insertion = insertions[sym]

						return {
							cost: insertion.cost,
							text: insertion.text,
							insertedSyms: [ { symbol: sym, children: insertion.insertedSyms } ]
						}
					}).reduce(function (A, B) { // Only run for rule with 2 RHS syms
						return {
							cost: A.cost + B.cost,
							text: A.text && B.text ? A.text + ' ' + B.text : A.text || B.text,
							insertedSyms: A.insertedSyms.concat(B.insertedSyms)
						}
					})

					// If unseen production, or cheaper than previously found production
					if (!insertions.hasOwnProperty(nontermSym) || insertions[nontermSym].cost > newInsertion.cost) {
						insertionsAdded = true
						insertions[nontermSym] = {
							cost: rule.cost + newInsertion.cost,
							text: newInsertion.text,
							insertedSyms: newInsertion.insertedSyms
						}
					}
				}
			})
		})
	} while (insertionsAdded)
}

// Every sym in production is a terminal symbol with an insetion cost, an empty-string, or a nonterminal symbol that produces a sequence of the these
function RHSCanBeInserted(insertions, RHS) {
	return RHS.every(function (sym) {
		return insertions.hasOwnProperty(sym)
	})
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
						var insertion = insertions[sym]

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
					}
				})
			}
		})
	})
}

// Add new rules from tranpositions to grammar
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

		if (util.arraysMatch(existingRule.RHS, newRule.RHS)) {
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