// Create nonterminal symbols and add production rules to grammar

var util = require('../util')
var semantic = require('./semantic')

module.exports = Symbol

// Constructor for nonterminal symbols
// Concatenates arguments after 0th index as Symbol's name
function Symbol(grammar) {
	var symNameChunks = Array.prototype.slice.call(arguments, 1)

	if (symNameChunks.indexOf(undefined) !== -1) {
		util.printErrWithLine('undefined String in Symbol name:', symNameChunks)
		throw 'ill-formed Symbol'
	}

	// Symbol names will be removed from production to conserve memory
	this.name = '[' + symNameChunks.join('-') + ']'

	if (grammar.hasOwnProperty(this.name)) {
		util.printErrWithLine('Duplicate Symbol:', this.name)
		throw 'duplicate Symbol'
	}

	this.rules = grammar[this.name] = []
}

// Add a new rule to the grammar
Symbol.prototype.addRule = function (opts) {
	var newRule = opts.terminal ? this.newTerminalRule(opts) : this.newNonterminalRule(opts)

	if (opts.semantic) {
		newRule.semantic = opts.semantic
		newRule.cost = this.calcCost(semantic.costOfSemantic(opts.semantic))
	} else {
		newRule.cost = this.calcCost()
	}

	if (this.ruleExists(newRule)) {
		ruleErr('Duplicate rule', this.name, newRule.RHS)
	}

	this.rules.push(newRule)
}


// Schema for terminal rules
var termRuleOptsSchema = {
	terminal: Boolean,
	RHS: String,
	semantic: { type: Array, optional: true },
	insertionCost: { type: Number, optional: true },
	textForms: { type: Object, optional: true },
	text: { type: String, optional: true }
}

// Create a new terminal rule from passed opts
Symbol.prototype.newTerminalRule = function (opts) {
	if (util.illFormedOpts(termRuleOptsSchema, opts)) {
		throw 'ill-formed terminal rule'
	}

	var newRule = {
		RHS: [ opts.RHS ],
		terminal: true,
		// String for terminal symbols, or Object of inflected forms for conjugation
		text: opts.text || opts.textForms
	}

	if (opts.hasOwnProperty('insertionCost')) {
		newRule.insertionCost = opts.insertionCost
	}

	return newRule
}


// Schema for nonterminal rule
var nontermRuleOptsSchema = {
	RHS: { type: Array, arrayType: Symbol },
	semantic: { type: Array, optional: true },
	transpositionCost: { type: Number, optional: true },
	gramCase: { type: [ 'nom', 'obj' ], optional: true }, // "me" vs. "I"
	verbForm: { type: [ 'past' ], optional: true },
	personNumber: { type: [ 'one', 'threeSg', 'pl' ], optional: true }
}

// Create a new nonterminal rule from passed opts
Symbol.prototype.newNonterminalRule = function (opts) {
	if (util.illFormedOpts(nontermRuleOptsSchema, opts)) {
		throw 'ill-formed nonterminal rule'
	}

	if (opts.RHS.length > 2) {
		ruleErr('Nonterminal rules can only have 1 or 2 RHS symbols', this.name, opts.RHS)
	}

	var newRule = {
		RHS: opts.RHS.map(function (RHSSymbol) { return RHSSymbol.name }),
		gramCase: opts.gramCase,
		verbForm: opts.verbForm,
		personNumber: opts.personNumber
	}

	if (opts.hasOwnProperty('transpositionCost')) {
		if (opts.RHS.length !== 2) {
			ruleErr('Nonterminal rules with transposition-costs must have 2 RHS symbols', this.name, opts.RHS)
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
// Could have a cost penalty, especially for term rules, but need a mechanism for determining this cost
Symbol.prototype.calcCost = function (costPenalty) {
	// Cost penalty is cost of semantic on nonterminal rules (if present)
	var costPenalty = costPenalty || 0

	// Cost of rules for each sym are incremented by 1e-7
	return this.rules.length * 1e-7 + costPenalty
}

// Print error when new rule is ill-formed
function ruleErr(errMessage, name, RHS) {
	if (Array.isArray(RHS)) {
		RHS = RHS.map(function (sym) {
			return sym instanceof Symbol ? sym.name : sym
		})
	}

	console.log(util.getLine())
	console.log('Err:', errMessage + ':')
	console.log('\t' + name, '->', RHS)

	throw 'ill-formed rule'
}