var util = require('../util')
var g = require('./grammar')
var semantic = require('./semantic')
var entityCategory = require('./entityCategory')


// A mapping of symbols to productions
exports.grammar = {}
// A mapping of Symbol names to creation lines; used for error reporting
exports.creationLines = {}
// Constructor for extending Symbol
exports.constructor = Symbol

exports.new = function () {
	var symbolNew = Object.create(Symbol.prototype)
  Symbol.apply(symbolNew, arguments)
	return symbolNew
}

// Constructor for nonterminal symbols
// Concatenates arguments as Symbol's name
function Symbol() {
	this.name = '[' + exports.hyphenate.apply(null, arguments).toLowerCase() + ']'

	if (exports.grammar.hasOwnProperty(this.name)) {
		util.printErrWithLine('Duplicate Symbol', this.name)
		throw 'duplicate Symbol'
	}

	this.rules = exports.grammar[this.name] = []

	// Save calling line for error reporting
	exports.creationLines[this.name] = util.getLine()
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

	// If RHS is <int> or an entity category, prevent those terminal symbols from being accepted as input
	if (opts.RHS === g.intSymbol || entityCategory.creationLines.hasOwnProperty(opts.RHS)) {
		newRule.RHSIsPlaceholder = true
	}

	// If semantic, must be complete and consitute a RHS
	// Exceptions: terminal symbol is an entity category or <int>
	else if (opts.semantic && !semantic.semanticIsRHS(opts.semantic)) {
		util.printErr('Terminal rules can only hold complete (RHS) semantics', this.name, '->', newRule.RHS)
		util.log(opts.semantic)
		console.log(util.getLine())
		throw 'ill-formed terminal rule'
	}

	// intMin and intMax can only be used with <int>
	if (opts.RHS !== g.intSymbol && (opts.intMin !== undefined || opts.intMax !== undefined)) {
		util.printErrWithLine('\'intMin\' and \'intMax\' can only be used with ' + g.intSymbol, this.name, '->', newRule.RHS)
		throw 'ill-formed terminal rule'
	}

	return newRule
}


// Schema for nonterminal rules
var nontermRuleOptsSchema = {
	// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
	RHS: Array,
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
		// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
		RHS: opts.RHS.map(function (sym) {
			// sym is a nested RHS for a new binary rule
			// Create new rule and replace array with its new Symbol
			if (sym.constructor === Array) { // Can nest RHS
				return exports.newBinaryRule({ RHS: sym }).name
			}

			// Replace Symbol with its name
			else if (sym.constructor === Symbol) {
				return sym.name
			}

			else {
				util.printErrWithLine('\'RHS\' not an array of type Symbol or Array', opts.RHS)
				throw 'ill-formed nonterminal rule'
			}
		}),
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


// Create a new Symbol with a binary nonterminal rule
// - Symbol's name is a concatenation of the RHS Symbols
// Accepts the same 'opts' as Symbol.newNonterminalRule()
// As the Symbol's name is created from the rule's RHS, this new Symbol is intended only for this rule
// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
// - However, these sub-rules can only contain a RHS and no other rule properties
exports.newBinaryRule = function (opts) {
	if (util.illFormedOpts(nontermRuleOptsSchema, opts)) {
		throw 'ill-formed binary rule'
	}

	var RHS = opts.RHS

	// RHS must contain two RHS symbols
	if (RHS.length !== 2) {
		util.printErrWithLine('Binary rules must have 2 RHS symbols', RHS)
		throw 'ill-formed binary rule'
	}

	// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
	RHS.forEach(function (sym, i) {
		// sym is a nested RHS for a new binary rule
		// Create new rule and replace array with its new Symbol
		if (sym.constructor === Array) {
			RHS[i] = exports.newBinaryRule({ RHS: sym })
		}

		else if (sym.constructor !== Symbol) {
			util.printErrWithLine('RHS not an array of type Symbol or Array', RHS)
			throw 'ill-formed binary rule'
		}
	})

	// Create a new Symbol named by the concatenation of the two RHS symbols
	return exports.new.apply(null, RHS.map(function (sym) { return sym.name })).addRule(opts)
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

// Concatenate variadic arguments with hyphens
// Used by Symbol and Semantic
exports.hyphenate = function () {
	var chunks = Array.prototype.slice.call(arguments)

	if (chunks.indexOf(undefined) !== -1) {
		util.printErrWithLine('undefined String in name', chunks)
		throw 'ill-formed name'
	}

	// Concatenate arguments for name; remove brackets from passed Strings (i.e., Symbol names)
	return chunks.join('-').replace(/[\[\]]/g, '')
}