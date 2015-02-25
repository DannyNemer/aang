var util = require('../util')

module.exports = StateTable

function StateTable(grammar, startSymName) {
	if (!startSymName) throw 'no start symbol'

	this.symbolTable = {}
	this.states = []

	Object.keys(grammar).forEach(function (nontermSymName) {
		var nontermSym = this.lookUp(nontermSymName)

		grammar[nontermSymName].forEach(function (rule) {
			var newRuleRHS = rule.RHS.map(function (RHSSymName) {
				return this.lookUp(RHSSymName, rule.terminal) // won't work if one sym is term and other nonterm
			}, this)

			this.insertRule(nontermSym, newRuleRHS, rule.cost)
		}, this)

	}, this)

	this.generate(grammar, startSymName)
}

StateTable.prototype.lookUp = function (symName, terminal) {
	var sym = this.symbolTable[symName]

	if (sym && sym.terminal === terminal && sym.name === symName) {
		return sym
	}

	sym = this.symbolTable[symName] = {
		name: symName,
		index: Object.keys(this.symbolTable).length,
		rules: [] // not needed for literals
	}

	if (terminal) {
		sym.terminal = terminal
	}

	return sym
}

StateTable.prototype.insertRule = function (nontermSym, newRuleRHS, cost) {
	var existingRules = nontermSym.rules // Rules from LHS nonterm sym

	for (var i = 0; i < existingRules.length; ++i) {
		var existingRuleRHS = existingRules[i].syms
		var diff = 0

		for (var j = 0; j < newRuleRHS.length && j < existingRuleRHS.length; ++j) {
			diff = newRuleRHS[j].index - existingRuleRHS[j].index
			if (diff) break // difference in index -> difference syms
		}

		if (!diff && j >= existingRuleRHS.length) {
			if (j >= newRuleRHS.length) return // traversed and match
			else break // newRuleRHS is longer than existingRuleRHS
		} else if (diff > 0) {
			break
		}
	}

	var rule = {
		syms: newRuleRHS,
		cost: cost
	}

	if (newRuleRHS.length === 2) {
		rule.oneToTwo = true
	}

	existingRules.splice(i, 0, rule) // unsure why this cannot be pushed to end, or what happens above
}

StateTable.prototype.generate = function (grammar, startSymName) {
	var startSym = this.lookUp(startSymName)
	startSym.isStart = true

	var startRule = { RHS: { syms: [ startSym ] }, RHSIdx: 0 }
	var ruleSets = [ [ startRule ] ]

	for (var s = 0; s < ruleSets.length; ++s) {
		var rules = ruleSets[s]
		var XTable = []
		var newState = { termShifts: [], nontermShifts: [] }

		for (var r = 0; r < rules.length; ++r) {
			var rule = rules[r]

			if (rule.RHSIdx < rule.RHS.syms.length) {
				// sym from original grammar with name, index in symbol table, and its RHS rules (cost, RHS_syms)
				var RHSSym = rule.RHS.syms[rule.RHSIdx]
				var items = null

				for (var x = 0; x < XTable.length; ++x) {
					var xItems = XTable[x]
					if (xItems.sym === RHSSym) {
						items = xItems
						break
					}
				}

				if (!items) {
					items = { sym: RHSSym, rules: [] }
					XTable.push(items)

					// RHS rules from grammar
					RHSSym.rules.forEach(function (rule) {
						rules.push({ LHS: RHSSym, RHS: rule, RHSIdx: 0 })
					})
				}

				rule.RHSIdx++

				// Duplicate rule, saving RHSIdx
				// Add rule to list of rules that produce RHSsym
				this.addRule(items.rules, rule)

				rule.RHSIdx--
			} else if (!rule.LHS) {
				newState.isFinal = true
			}
		}


		newState.reductions = rules.filter(function (rule) {
			// Have iterated through RHS
			// Is not the start rule (no LHS)
			return rule.RHSIdx >= rule.RHS.syms.length && rule.LHS
		}).map(function (rule) {
			return {
				LHS: rule.LHS,
				RHS: rule.RHS
			}
		})

		XTable.forEach(function (items) {
			var shift = {
				sym: items.sym,
				stateIdx: this.addState(ruleSets, items.rules)
			}

			var terminal = shift.sym.rules.some(function (rule) { return rule.syms[0].terminal })
			if (terminal) newState.termShifts.push(shift)

			var nonterminal = shift.sym.rules.some(function (rule) { return !rule.syms[0].terminal })
			if (nonterminal) newState.nontermShifts.push(shift)
		}, this)

		this.states.push(newState)
	}
}

StateTable.prototype.addRule = function (symRules, rule) {
	for (var i = 0; i < symRules.length; ++i) {
		var diff = this.compItems(symRules[i], rule)
		if (diff === 0) return
		if (diff > 0) break
	}

	// Add copy of rule
	symRules.splice(i, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		RHSIdx: rule.RHSIdx
	})
}

StateTable.prototype.addState = function (ruleSets, rules) {
	for (var stateIdx = 0; stateIdx < ruleSets.length; ++stateIdx) {
		var oldList = ruleSets[stateIdx]
		if (oldList.length === rules.length) {
			var match = oldList.every(function (item, i) {
				return this.compItems(item, rules[i]) === 0
			}, this)

			if (match) return stateIdx
		}
	}

	// Return new index of rules
	return ruleSets.push(rules) - 1
}

StateTable.prototype.compItems = function (A, B) {
	// startRule doesn't have LHS
	var diff = A.LHS ? (B.LHS ? A.LHS.index - B.LHS.index : 1) : (B.LHS ? -1 : 0)
	if (diff) return diff

	diff = A.RHSIdx - B.RHSIdx
	if (diff) return diff

	var ARHSSyms = A.RHS.syms
	var BRHSSyms = B.RHS.syms

	for (var RHSIdx = 0; RHSIdx < ARHSSyms.length && RHSIdx < BRHSSyms.length; ++RHSIdx) {
		diff = ARHSSyms[RHSIdx].index - BRHSSyms[RHSIdx].index
		if (diff) break
	}

	return ARHSSyms[RHSIdx] ? (BRHSSyms[RHSIdx] ? diff : 1) : (BRHSSyms[RHSIdx] ? -1 : 0)
}

StateTable.prototype.print = function () {
	this.states.forEach(function (state, stateIdx) {
		console.log(stateIdx + ':')

		if (state.isFinal) console.log('\taccept')

		state.reductions.forEach(function (reduction) {
			var toPrint = '\t[' + reduction.LHS.name + ' ->'

			reduction.RHS.syms.forEach(function (sym) {
				toPrint += ' ' + sym.name
			})

			console.log(toPrint + ']')
		})

		state.nontermShifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})

		state.termShifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})
	})
}