module.exports = StateTable

function StateTable(grammar, startSymName) {
	if (!startSymName) throw 'no start symbol'

	this.symbolTable = {}
	this.states = []

	Object.keys(grammar).forEach(function (nontermSymName) {
		var LHSSym = this.lookUp(nontermSymName)

		grammar[nontermSymName].forEach(function (rule) {
			var RHSBuf = rule.RHS.map(function (RHSSymName) {
				return this.lookUp(RHSSymName, rule.terminal)
			}, this)

			this.insertRule(LHSSym, RHSBuf, rule.cost)
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

StateTable.prototype.insertRule = function (LHSSym, RHSBuf, cost) {
	var LHSSymRules = LHSSym.rules

	for (var i = 0; i < LHSSymRules.length; ++i) {
		var LHSSymRuleSyms = LHSSymRules[i].syms
		var diff = 0

		for (var j = 0; j < RHSBuf.length && j < LHSSymRuleSyms.length; ++j) {
			diff = RHSBuf[j].index - LHSSymRuleSyms[j].index
			if (diff) break
		}

		if (!diff && !LHSSymRuleSyms[j]) {
			if (!RHSBuf[j]) return
			else break
		} else if (diff > 0) {
			break
		}
	}

	var rule = {
		syms: RHSBuf,
		cost: cost
	}

	if (RHSBuf.length === 2) {
		rule.oneToTwo = true
	}

	LHSSym.rules.splice(i, 0, rule) // unsure why this cannot be pushed to end, or what happens above
}

StateTable.prototype.generate = function (grammar, startSymName) {
	var startSym = this.lookUp(startSymName)
	startSym.isStart = true

	var listTable = [ [ { RHS: { syms: [ startSym ] }, RHSIdx: 0 } ] ]

	for (var s = 0; s < listTable.length; ++s) {
		var ruleBuf = listTable[s]
		var XTable = []
		var newState = { termShifts: [], nontermShifts: [] }

		for (var r = 0; r < ruleBuf.length; ++r) {
			var rule = ruleBuf[r]

			if (rule.RHSIdx < rule.RHS.syms.length) {
				var sym = rule.RHS.syms[rule.RHSIdx]
				var items = null

				for (var x = 0; x < XTable.length; ++x) {
					var xItems = XTable[x]
					if (xItems.sym === sym) {
						items = xItems
						break
					}
				}

				if (!items) {
					items = { sym: sym, rules: [] }
					XTable.push(items)

					sym.rules.forEach(function (rule) {
						ruleBuf.push({ LHS: sym, RHS: rule, RHSIdx: 0 })
					})
				}

				rule.RHSIdx++
				this.addRule(items.rules, rule)
				rule.RHSIdx-- // could just add 1 in addRule: rule.RHSIdx + 1
			} else if (!rule.LHS) {
				newState.isFinal = true
			}
		}

		newState.reductions = ruleBuf.filter(function (rule) {
			return !rule.RHS.syms[rule.RHSIdx] && rule.LHS
		}).map(function (rule) {
			return {
				LHS: rule.LHS,
				RHS: rule.RHS
			}
		})

		XTable.forEach(function (items) {
			var shift = {
				sym: items.sym,
				stateIdx: this.addState(listTable, items.rules)
			}

			var terminal = shift.sym.rules.some(function (rule) { return rule.syms[0].terminal })
			var nonterminal = shift.sym.rules.some(function (rule) { return !rule.syms[0].terminal })

			if (terminal) newState.termShifts.push(shift)
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

	symRules.splice(i, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		RHSIdx: rule.RHSIdx
	})
}

StateTable.prototype.compItems = function (A, B) {
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

StateTable.prototype.addState = function (listTable, rules) {
	for (var stateIdx = 0; stateIdx < listTable.length; ++stateIdx) {
		var oldList = listTable[stateIdx]
		if (oldList.length === rules.length) {
			var match = oldList.some(function (item, i) {
				return this.compItems(item, rules[i])
			}, this)

			if (!match) return stateIdx
		}
	}

	// Return new index of rules
	return listTable.push(rules) - 1
}

StateTable.prototype.print = function () {
	this.states.forEach(function (state, stateIdx) {
		console.log(stateIdx + ':')

		if (state.isFinal) console.log('\taccept')

		state.reductions.forEach(function (reduction) {
			var toPrint = '\t[' + reduction.LHS.name + ' ->'

			reduction.RHS.syms.map(function (sym) {
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