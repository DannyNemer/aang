// Create nonterminal symbols and add production rules to grammar

var util = require('../util')

module.exports = Symbol

// Constructor for nonterminal symbols
// Concatenates arguments after 0th index as Symbol's name
function Symbol(grammar) {
	// Symbol names will be removed from production to conserve memory
	this.name = '[' + Array.prototype.slice.call(arguments, 1).join('-') + ']'

	if (grammar.hasOwnProperty(this.name)) {
		console.log('duplicate Symbol:', this.name)
		console.log(util.getLine())
		throw 'duplicate Symbol'
	}

	this.rules = grammar[this.name] = []
}

// Add a new rule to the grammar
Symbol.prototype.addRule = function (opts) {
	if (!opts.hasOwnProperty('RHS')) {
		console.log('rule missing RHS:', opts)
		throw 'ill-formed rule'
	}

	var newRule = opts.terminal ? this.newTermRule(opts) : this.newNontermRule(opts)

	newRule.cost = this.calcCost()

	if (this.ruleExists(newRule)) {
		this.ruleErr('duplicate rule', newRule.RHS)
	}

	this.rules.push(newRule)
}


// Definition of accepted options for a terminal rule
var termRuleOptsDef = {
	terminal: Boolean,
	RHS: String,
	insertionCost: Number
}

// Initialize a new terminal rule from passed opts
Symbol.prototype.newTermRule = function (opts) {
	if (util.illFormedOpts(opts, termRuleOptsDef)) {
		throw 'ill-formed terminal rule'
	}

	var newRule = {
		RHS: [ opts.RHS ],
		terminal: true
	}

	if (opts.hasOwnProperty('insertionCost')) {
		newRule.insertionCost = opts.insertionCost
	}

	return newRule
}


// Definition of accepted options for a nonterminal rule
var nontermRuleOptsDef = {
	terminal: Boolean,
	RHS: Array,
	transpositionCost: Number
}

// Initialize a new nonterminal rule from passed opts
Symbol.prototype.newNontermRule = function (opts) {
	if (util.illFormedOpts(opts, nontermRuleOptsDef)) {
		throw 'ill-formed nonterminal rule'
	}

	if (opts.RHS.length > 2) {
		this.ruleErr('rules can only have 1 or 2 RHS symbols', opts.RHS)
	}

	var newRule = {
		RHS: opts.RHS.map(function (RHSSymbol) {
			if (!(RHSSymbol instanceof Symbol)) {
				this.ruleErr('RHS of nonterminal rules must be Symbols', opts.RHS)
			}

			return RHSSymbol.name
		})
	}

	if (opts.hasOwnProperty('transpositionCost')) {
		if (opts.RHS.length !== 2) {
			this.ruleErr('nonterminal rules with transposition-costs must have 2 RHS symbols', opts.RHS)
		}

		newRule.transpositionCost = opts.transpositionCost
	}

	return newRule
}


// Returns true if newRule already exists
Symbol.prototype.ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysMatch(existingRule.RHS, newRule.RHS)
	})
}

// Calculate cost of new rule
// Could have a cost penalty, especially for term rules, but need a mechanism for choose determining this cost
Symbol.prototype.calcCost = function (costPenalty) {
	// Cost of rules for each sym are incremented by 1e-7
	return this.rules.length * 1e-7
}

// Print error when new rule is ill-formed
Symbol.prototype.ruleErr = function (errMessage, RHS) {
	RHS = RHS.map(function (sym) {
		return sym instanceof Symbol ? sym.name : sym
	})

	console.log(util.getLine())
	console.log(errMessage + ':')
	console.log('\t' + this.name, '->', RHS)
	throw 'ill-formed rule'
}