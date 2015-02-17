var util = require('./util')

var grammar = {}

// Constructor for nonterminal symbols
exports.Symbol = function (name) {
	// Symbol names will be removed from production to conserve memory
	this.name = '[' + name + ']'

	if (grammar.hasOwnProperty(this.name)) {
		console.log('duplicate Symbol:', this.name)
		console.log(util.getLine())
		throw 'duplicate Symbol'
	}

	this.rules = grammar[this.name] = []
}

// Definition of accepted options for a rule
var ruleOptsDef = {
	RHS: Array // add check for Array contents (string or Symbol), size, duplicates
}

// Add a new rule to the grammar
exports.Symbol.prototype.addRule = function (opts) {
	if (util.illFormedOpts(opts, ruleOptsDef)) {
		throw 'ill-formed rule'
	}

	if (!opts.hasOwnProperty('RHS')) {
		console.log('rule missing RHS:', opts)
		throw 'ill-formed rule'
	}

	if (opts.RHS.length > 2) {
		console.log('rules\' RHS can only have 1 or 2 symbols:', this.name, '->', opts.RHS)
		throw 'ill-formed rule'
	}

	if (opts.RHS.length === 2 && opts.RHS.every(function (s) { return typeof s === 'string' })) {
		console.log('rules cannot have 2 term symbols:', this.name, '->', opts.RHS)
		throw 'ill-formed rule'
	}

	var newRule = {
		RHS: opts.RHS.map(function (RHSSymbol) {
			return RHSSymbol instanceof exports.Symbol ? RHSSymbol.name : RHSSymbol
		}),
		cost: this.calcCost()
	}

	if (this.ruleExists(newRule)) {
		console.log('duplicate rule:', this.name, '->', newRule.RHS)
		console.log(util.getLine())
		throw 'duplicate rule'
	}

	this.rules.push(newRule)
}

// Returns true if newRule already exists
exports.Symbol.prototype.ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysMatch(existingRule.RHS, newRule.RHS)
	})
}

// Calculate cost of new rule
// Could have a cost penalty, especially for term rules, but need a mechanism for choose determining this cost
exports.Symbol.prototype.calcCost = function (costPenalty) {
	// Cost of rules for each sym are incremented by 1e-7
	return this.rules.length * 1e-7
}

exports.printGrammar = function () {
	util.log(grammar)
}