var util = require('../util')

var grammar = {}

// Empty-string
exports.emptyTermSym = '<empty>'

// Constructor for nonterminal symbols
// Takes strings are arguments, to be concatenated as Symbol's name
exports.Symbol = function () {
	// Symbol names will be removed from production to conserve memory
	this.name = '[' + Array.prototype.slice.call(arguments).join('-') + ']'

	if (grammar.hasOwnProperty(this.name)) {
		console.log('duplicate Symbol:', this.name)
		console.log(util.getLine())
		throw 'duplicate Symbol'
	}

	this.rules = grammar[this.name] = []
}


// Add a new rule to the grammar
exports.Symbol.prototype.addRule = function (opts) {
	if (!opts.hasOwnProperty('RHS')) {
		console.log('rule missing RHS:', opts)
		throw 'ill-formed rule'
	}

	var newRule = opts.terminal ? createTermRule(opts) : createNontermRule(opts, this.name)

	newRule.cost = this.calcCost()

	if (this.ruleExists(newRule)) {
		console.log('duplicate rule:', this.name, '->', newRule.RHS)
		console.log(util.getLine())
		throw 'duplicate rule'
	}

	this.rules.push(newRule)
}

// Definition of accepted options for a terminal rule
var termRuleOptsDef = {
	terminal: Boolean,
	RHS: String,
	insertionCost: Number
}

// Initialize a new terminal rule from past opts
function createTermRule(opts) {
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
	RHS: Array
}

// Initialize a new nonterminal rule from past opts
function createNontermRule(opts, name) {
	if (util.illFormedOpts(opts, nontermRuleOptsDef)) {
		throw 'ill-formed nonterminal rule'
	}

	if (opts.RHS.length > 2) {
		console.log('rules can only have 1 or 2 RHS symbols:', name, '->', opts.RHS)
		console.log(util.getLine())
		throw 'ill-formed rule'
	}

	return {
		RHS: opts.RHS.map(function (RHSSymbol) {
			if (!(RHSSymbol instanceof exports.Symbol)) {
				console.log('RHS of nonterminal rules must be Symbols:', name, '->', opts.RHS)
				console.log(util.getLine())
				throw 'ill-formed rule'
			}

			return RHSSymbol.name
		})
	}
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


// Print the total count of rules in the grammar
// Print change if 'oldGrammarPath' passed
exports.printRuleCount = function (oldGrammarPath) {
	var fs = require('fs')

	var newRuleCount = ruleCount(grammar)

	if (fs.existsSync(oldGrammarPath)) {
		var oldRuleCount = ruleCount(require(fs.realpathSync(oldGrammarPath)))
		if (oldRuleCount !== newRuleCount) {
			console.log('Rules:', oldRuleCount, '->', newRuleCount)
			return
		}
	}

	console.log('Rules:', newRuleCount)
}

function ruleCount(grammar) {
	return Object.keys(grammar).reduce(function (prev, cur) {
		return prev + grammar[cur].length
	}, 0)
}

// Write grammar to 'filepath'
exports.writeGrammarToFile = function (filepath) {
	util.writeJSONFile(filepath, grammar)
}

exports.createEditRules = function () {
	require('./createEditRules')(grammar)
}