var util = require('../util')
var g = require('./grammar')
var semantic = require('./semantic')


module.exports = Symbol

// Constructor for nonterminal symbols
// Concatenates arguments after 0th index as Symbol's name
function Symbol() {
	var symNameChunks = Array.prototype.slice.call(arguments)

	if (symNameChunks.indexOf(undefined) !== -1) {
		util.printErrWithLine('undefined String in Symbol name', symNameChunks)
		throw 'ill-formed Symbol'
	}

	// Symbol names will be removed from production to conserve memory
	this.name = '[' + symNameChunks.join('-') + ']'

	if (g.grammar.hasOwnProperty(this.name)) {
		util.printErrWithLine('Duplicate Symbol', this.name)
		throw 'duplicate Symbol'
	}

	this.rules = g.grammar[this.name] = []

	// Save calling line for error reporting
	g.creationLines[this.name] = util.getLine()
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
		util.printErrWithLine('Duplicate rule', this.name, '->', newRule.RHS)
		throw 'duplicate rule'
	}

	this.rules.push(newRule)

	return this
}


// Schema for terminal rules
var termRuleOptsSchema = {
	terminal: Boolean,
	RHS: String,
	semantic: { type: Array, optional: true },
	insertionCost: { type: Number, optional: true },
	textForms: { type: Object, optional: true },
	text: { type: String, optional: true },
	intMin: { type: Number, optional: true },
	intMax: { type: Number, optional: true }
}

// Create a new terminal rule from passed opts
Symbol.prototype.newTerminalRule = function (opts) {
	if (util.illFormedOpts(termRuleOptsSchema, opts)) {
		throw 'ill-formed terminal rule'
	}

	var newRule = {
		RHS: [ opts.RHS.toLowerCase() ],
		terminal: true,
		// String for terminal symbols, or Object of inflected forms for conjugation
		text: opts.text || opts.textForms,
		intMin: opts.intMin,
		intMax: opts.intMax
	}

	if (opts.insertionCost !== undefined) {
		newRule.insertionCost = opts.insertionCost
	}

	// If semantic, must be complete and consitute a RHS
	// Exceptions: terminal symbol is an entity category or <int>
	if (opts.semantic && !semantic.semanticIsRHS(opts.semantic) && !g.creationLines.hasOwnProperty(newRule.RHS[0]) && newRule.RHS[0] !== g.intSymbol) {
		util.printErr('Terminal rules can only hold complete (RHS) semantics', this.name, '->', newRule.RHS)
		util.log(opts.semantic)
		console.log(util.getLine())
		throw 'ill-formed nonterminal rule'
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

	var newRule = {
		RHS: opts.RHS.map(function (RHSSymbol) { return RHSSymbol.name }),
		gramCase: opts.gramCase,
		verbForm: opts.verbForm,
		personNumber: opts.personNumber
	}

	if (opts.semantic) {
		// True if semantic is complete and constitutes a RHS
		// Otherwise semantic is to accept other semantics as arguments
		newRule.semanticIsRHS = semantic.semanticIsRHS(opts.semantic)
	}

	if (opts.RHS.length > 2) {
		util.printErrWithLine('Nonterminal rules can only have 1 or 2 RHS symbols', this.name, '->', newRule.RHS)
		throw 'ill-formed nonterminal rule'
	}

	if (opts.transpositionCost !== undefined) {
		if (opts.RHS.length !== 2) {
			util.printErrWithLine('Nonterminal rules with transposition costs must have 2 RHS symbols', this.name, '->', newRule.RHS)
			throw 'ill-formed nonterminal rule'
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