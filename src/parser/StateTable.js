module.exports = StateTable

function StateTable(inputGrammar) {
	this.symbolTab = {}
	this.shifts = []

	Object.keys(inputGrammar.nonterminals).forEach(function (leftSymName) {
		var LHS = this.lookUp(leftSymName)

		inputGrammar.nonterminals[leftSymName].forEach(function (rule) {
			var newRuleRHS = rule.RHS.map(function (rightSymName) {
				return this.lookUp(rightSymName)
			}, this)

			insertRule(LHS, newRuleRHS, rule.cost)
		}, this)
	}, this)

	Object.keys(inputGrammar.terminals).forEach(function (leftSymName) {
		var symBuf = [ this.lookUp(leftSymName) ]

		inputGrammar.terminals[leftSymName].forEach(function (rule) {
			insertRule(this.lookUp(rule.RHS[0], true), symBuf, rule.cost)
		}, this)
	}, this)

	this.generate(this.lookUp(inputGrammar.startSymbol))
}

StateTable.prototype.lookUp = function (name, isLiteral) {
	var sym = this.symbolTab[name]
	if (sym && sym.isLiteral === isLiteral && sym.name === name)
		return sym

	return this.symbolTab[name] = {
		name: name,
		isLiteral: isLiteral,
		index: Object.keys(this.symbolTab).length,
		rules: []
	}
}

function insertRule(sym, symBuf, cost) {
	var existingRules = sym.rules

	for (var i = 0; i < existingRules.length; i++) {
		var existingRuleRHS = existingRules[i].syms
		var diff

		for (var j = 0; symBuf[j] && existingRuleRHS[j]; j++) {
			diff = symBuf[j].index - existingRuleRHS[j].index
			if (diff) break
		}

		if (diff === 0 && !existingRuleRHS[j]) {
			if (!symBuf[j]) return
			else break
		} else if (diff > 0) {
			break
		}
	}

	existingRules.splice(i, 0, {
		syms: symBuf,
		cost: cost
	})
}

function compItems(A, B) {
	var diff = A.LHS ? (B.LHS ? A.LHS.index - B.LHS.index : 1) : (B.LHS ? -1 : 0)
	if (diff) return diff

	diff = A.RHSIdx - B.RHSIdx
	if (diff) return diff

	var ARHSSyms = A.RHS.syms
	var BRHSSyms = B.RHS.syms

	for (var i = 0; ARHSSyms[i] && BRHSSyms[i]; ++i) {
		diff = ARHSSyms[i].index - BRHSSyms[i].index
		if (diff) break
	}

	return ARHSSyms[i] ? (BRHSSyms[i] ? diff : 1) : (BRHSSyms[i] ? -1 : 0)
}

function addState(ruleSets, newRuleSet) {
	for (var S = 0; S < ruleSets.length; S++) {
		var existingRuleSet = ruleSets[S]
		if (existingRuleSet.length !== newRuleSet.length) continue

		for (var i = 0; i < existingRuleSet.length; ++i) {
			if (compItems(existingRuleSet[i], newRuleSet[i]) !== 0) break
		}

		if (i >= existingRuleSet.length) {
			return S
		}
	}

	return ruleSets.push(newRuleSet) - 1
}

function addRule(items, rule) {
	for (var i = 0; i < items.list.length; i++) {
		var diff = compItems(items.list[i], rule)

		if (diff === 0) return
		if (diff > 0) break
	}

	items.list.splice(i, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		RHSIdx: rule.RHSIdx
	})
}

StateTable.prototype.generate = function (startSym) {
	var ruleSets = []

	var startRule = { syms: [ startSym ] }
	addState(ruleSets, [ { RHS: startRule, RHSIdx: 0 } ])

	for (var S = 0; S < ruleSets.length; S++) {
		var ruleSet = ruleSets[S].slice()
		var XTab = []
		var newState = { reds: [] }

		for (var r = 0; r < ruleSet.length; r++) {
			var rule = ruleSet[r]

			if (!rule.RHS.syms[rule.RHSIdx]) {
				if (!rule.LHS) newState.isFinal = true
			} else {
				var RHSSym = rule.RHS.syms[rule.RHSIdx]
				var items = null

				for (var x = XTab.length; x-- > 0;) {
					var xItems = XTab[x]
					if (xItems.sym === RHSSym) {
						items = xItems
						break
					}
				}

				if (!items) {
					items = { sym: RHSSym, list: [] }
					XTab.push(items)

					// RHS rules from grammar
					RHSSym.rules.forEach(function (rule) {
						ruleSet.push({ LHS: RHSSym, RHS: rule, RHSIdx: 0 })
					})
				}

				// Duplicate rule, saving RHSIdx
				// Add rule to list of rules that produce RHSSym
				rule.RHSIdx++
				addRule(items, rule)
				rule.RHSIdx--
			}
		}

		ruleSet.forEach(function (rule) {
			if (!rule.RHS.syms[rule.RHSIdx] && rule.LHS) {
				newState.reds.push({
					LHS: rule.LHS,
					RHS: rule.RHS
				})
			}
		})

		newState.shifts = XTab.map(function (shift) {
			return { sym: shift.sym, stateIdx: addState(ruleSets, shift.list) }
		})

		this.shifts.push(newState)
	}
}

StateTable.prototype.print = function () {
	this.shifts.forEach(function (state, S) {
		console.log(S + ':')

		if (state.isFinal) console.log('\taccept')

		state.reds.forEach(function (red) {
			var toPrint = '\t[' + red.LHS.name + ' ->'

			red.RHS.syms.forEach(function (sym) {
				toPrint += ' ' + sym.name
			})

			console.log(toPrint + ']')
		})

		state.shifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})
	})
}