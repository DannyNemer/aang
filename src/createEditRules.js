// Add edit-rules

var util = require('./util')
var emptyTermSym = require('./grammar').emptyTermSym

var emptyTermRules

module.exports = function (grammar) {
	// Symbols that produce the empty-string
	emptyProds = {}

	// Find all terminal rules producing empty strings
	Object.keys(grammar).forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule) {
			// The empty-string can only be in rules with 1 sym
			if (rule.RHS[0] === emptyTermSym) {

				// Each nontermSym can have up to 1 empty sym (because no duplicates)
				emptyProds[nontermSym] = {
					cost: rule.cost,
					insertedSyms: [ { symbol: emptyTermSym } ]
				}
			}
		})
	})

	var emptyProdsAdded = true
	while (emptyProdsAdded) { // Loop until no longer finding new empty-string production
		emptyProdsAdded = false
		Object.keys(grammar).forEach(function (nontermSym) {
			grammar[nontermSym].forEach(function (rule) {
				if (RHSProducesEmptyString(rule.RHS)) {
					var newEmptyProd = rule.RHS.map(function (sym) {
						var emptyProd = emptyProds[sym]

						return {
							cost: emptyProd.cost,
							insertedSyms: [ { symbol: sym, children: emptyProd.insertedSyms } ]
						}
					}).reduce(function (A, B) { // Only run for rule with 2 RHS syms
						// Two empty-strings produced by same rule (e.g., nonterm sym -> two term syms -> <empty>)
						return {
							cost: A.cost + B.cost,
							insertedSyms: A.insertedSyms.concat(B.insertedSyms)
						}
					})

					// If unseen empty-string production, or cheaper than previously found production
					if (!emptyProds.hasOwnProperty(nontermSym) || emptyProds[nontermSym].cost > newEmptyProd.cost) {
						emptyProdsAdded = true
						emptyProds[nontermSym] = {
							cost: rule.cost + newEmptyProd.cost,
							insertedSyms: newEmptyProd.insertedSyms
						}
					}
				}
			})
		})
	}

	// Add new rules from empty-string productions to grammar
	Object.keys(grammar).forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule, ruleIdx, symRules) {
			var RHS = rule.RHS
			if (RHS.length > 1) {
				RHS.forEach(function (sym, symIdx) {
					var otherSym = RHS[+!symIdx]

					if (emptyProds.hasOwnProperty(sym) && otherSym !== nontermSym) {
						var emptyProd = emptyProds[sym]

						var newRule = {
							RHS: [ otherSym ],
							cost: emptyProd.cost + rule.cost,
							insertedSyms: [ { symbol: sym, children: emptyProd.insertedSyms } ],
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

// Every sym in production is empty-string or sym that produces empty-string
function RHSProducesEmptyString(RHS) {
	return RHS.every(function (sym) {
		return emptyProds.hasOwnProperty(sym)
	})
}

// Throw err if empty-string productions produce duplicate rules
function ruleExists(rules, newRule) {
	for (var r = rules.length; r-- > 0;) {
		var existingRule = rules[r]

		if (util.arraysMatch(existingRule.RHS, newRule.RHS)) {
			if (existingRule.insertedSyms) {
				console.log('Err: two identical rules produced by empty-strings')
			} else {
				// If a rule produced with empty-string is identical to an original rule, then original should not exist
				console.log('Err: rule produced with empty-strings identical to original rule')
			}

			console.log(existingRule)
			console.log(newRule)
			console.log()

			throw 'duplicate rule produced with empty-strings'
		}
	}

	return false
}