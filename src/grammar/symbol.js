var util = require('../util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')
var semantic = require('./semantic')
var entityCategory = require('./entityCategory')


// A mapping of symbols to rules
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
	this.name = '[' + stringUtil.formatName(stringUtil.hyphenate.apply(null, arguments)) + ']'

	if (exports.grammar.hasOwnProperty(this.name)) {
		util.logErrorAndPath('Duplicate Symbol:', this.name)
		throw new Error('Duplicate Symbol')
	}

	this.rules = exports.grammar[this.name] = []

	// Save calling line for error reporting
	exports.creationLines[this.name] = util.getModuleCallerPathAndLineNumber()
}

// Add a new rule to the grammar
Symbol.prototype.addRule = function (opts) {
	var newRule = opts.terminal ? this.newTerminalRule(opts) : this.newNonterminalRule(opts)

	if (opts.semantic) {
		newRule.semantic = opts.semantic
		newRule.cost = this.calcCost(semantic.sumCosts(opts.semantic))
	} else {
		newRule.cost = this.calcCost()
	}

	if (this.ruleExists(newRule)) {
		util.logErrorAndPath('Duplicate rule:', this.name, '->', newRule.RHS)
		throw new Error('Duplicate rule')
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
	// If text and textForms are undefined, and RHS is not <int>, <empty>, or an entity category, use RHS as text
	// Use text = '' for a terminal rule with no display text (e.g., stop-words)
	text: { type: String, optional: true },
	textForms: { type: Object, optional: true },
	intMin: { type: Number, optional: true },
	intMax: { type: Number, optional: true },
}

// Create a new terminal rule from passed opts
Symbol.prototype.newTerminalRule = function (opts) {
	if (util.illFormedOpts(termRuleOptsSchema, opts)) {
		throw new Error('Ill-formed terminal rule')
	}

	if (/[^\S ]/.test(opts.RHS)) {
		util.logError('Terminal symbol contains a whitespace character other than a space:', util.stylize(opts.RHS), opts)
		throw new Error('Ill-formed terminal rule')
	}

	if (/ {2,}/.test(opts.RHS)) {
		util.logError('Terminal symbol contains a sequence of multiple spaces:', util.stylize(opts.RHS), opts)
		throw new Error('Ill-formed terminal rule')
	}

	var newRule = {
		RHS: [ opts.RHS.toLowerCase() ],
		isTerminal: true,
		intMin: opts.intMin,
		intMax: opts.intMax,
	}

	// Assign text to display in output when terminal rule is seen in input
	if (opts.textForms) {
		// Object of inflected forms for conjugation
		newRule.text = opts.textForms
	} else if (opts.text) {
		// String for symbols not needing conjugation
		newRule.text = opts.text
	} else if (opts.text !== '' && opts.RHS !== g.emptySymbol && opts.RHS !== g.intSymbol && !entityCategory.creationLines.hasOwnProperty(opts.RHS)) {
		// Use RHS as text if textForms and text are undefined
		newRule.text = opts.RHS
	}

	if (opts.insertionCost !== undefined) {
		newRule.insertionCost = opts.insertionCost
	}

	// If RHS is <int> or an entity category, prevent those terminal symbols from being accepted as input
	if (opts.RHS === g.intSymbol || entityCategory.creationLines.hasOwnProperty(opts.RHS)) {
		newRule.isPlaceholder = true
	}

	// If semantic, must be complete and constitute a RHS
	// Exceptions: terminal symbol is an entity category or <int>
	else if (opts.semantic && !semantic.isRHS(opts.semantic)) {
		util.logError('Terminal rules can only hold complete (RHS) semantics:', this.name, '->', newRule.RHS)
		util.dir(opts.semantic)
		console.log('  ' + util.getModuleCallerPathAndLineNumber())
		throw new Error('Ill-formed terminal rule')
	}

	// <empty>, <int>, and entities cannot have predefined display text
	if (newRule.text) {
		if (opts.RHS === g.emptySymbol || opts.RHS === g.intSymbol) {
			util.logErrorAndPath(opts.RHS + ' cannot have predefined display text:', this.name, '->', newRule.RHS)
			throw new Error('Ill-formed terminal rule')
		} else if (entityCategory.creationLines.hasOwnProperty(opts.RHS)) {
			util.logErrorAndPath('Entities cannot have predefined display text:', this.name, '->', newRule.RHS)
			throw new Error('Ill-formed terminal rule')
		}
	}

	// intMin and intMax can only be used with <int>
	if (opts.RHS !== g.intSymbol && (opts.intMin !== undefined || opts.intMax !== undefined)) {
		util.logErrorAndPath('\'intMin\' and \'intMax\' can only be used with ' + g.intSymbol + ':', this.name, '->', newRule.RHS)
		throw new Error('Ill-formed terminal rule')
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
	verbForm: { type: [ 'past' ], optional: true }, // "like" vs. "liked"
	personNumber: { type: [ 'one', 'threeSg', 'pl' ], optional: true }, // "like" vs "likes"
}

// Create a new nonterminal rule from passed opts
Symbol.prototype.newNonterminalRule = function (opts) {
	if (util.illFormedOpts(nontermRuleOptsSchema, opts)) {
		throw new Error('Ill-formed nonterminal rule')
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
				util.logErrorAndPath('\'RHS\' not an array of type Symbol or Array:', opts.RHS)
				throw new Error('Ill-formed nonterminal rule')
			}
		}),
		gramCase: opts.gramCase,
		verbForm: opts.verbForm,
		personNumber: opts.personNumber,
	}

	if (opts.semantic) {
		// `true` if semantic is complete and constitutes a RHS
		// Otherwise semantic is to accept other semantics as arguments
		newRule.semanticIsRHS = semantic.isRHS(opts.semantic)
	}

	if (opts.RHS.length > 2) {
		util.logErrorAndPath('Nonterminal rules can only have 1 or 2 RHS symbols:', this.name, '->', newRule.RHS)
		throw new Error('Ill-formed nonterminal rule')
	}

	if (opts.transpositionCost !== undefined) {
		if (opts.RHS.length !== 2) {
			util.logErrorAndPath('Nonterminal rules with transposition costs must have 2 RHS symbols:', this.name, '->', newRule.RHS)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.transpositionCost = opts.transpositionCost
	}

	return newRule
}


// Create a new Symbol with a binary nonterminal rule
// - Symbol's name is a concatenation of the RHS Symbols
// Accepts the same `opts` as `Symbol.newNonterminalRule()`
// As the Symbol's name is created from the rule's RHS, this new Symbol is intended only for this rule
// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
// - However, these sub-rules can only contain a RHS and no other rule properties
exports.newBinaryRule = function (opts) {
	if (util.illFormedOpts(nontermRuleOptsSchema, opts)) {
		throw new Error('Ill-formed binary rule')
	}

	var RHS = opts.RHS

	// RHS must contain two RHS symbols
	if (RHS.length !== 2) {
		util.logErrorAndPath('Binary rules must have 2 RHS symbols:', RHS)
		throw new Error('Ill-formed binary rule')
	}

	// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules
	RHS.forEach(function (sym, i) {
		// sym is a nested RHS for a new binary rule
		// Create new rule and replace array with its new Symbol
		if (sym.constructor === Array) {
			RHS[i] = exports.newBinaryRule({ RHS: sym })
		}

		else if (sym.constructor !== Symbol) {
			util.logErrorAndPath('RHS not an array of type Symbol or Array:', RHS)
			throw new Error('Ill-formed binary rule')
		}
	})

	// Create a new Symbol named by the concatenation of the two RHS symbols
	return exports.new.apply(null, RHS.map(function (sym) { return sym.name })).addRule(opts)
}


/**
 * Checks if the RHS symbols of a new rule already exist for this symbol
 *
 * @param {Object} newRule The new rule to check.
 * @returns {boolean} Returns `true` if `newRule`'s RHS symbols already exist for this symbol, else `false`.
 */
Symbol.prototype.ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysEqual(existingRule.RHS, newRule.RHS)
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