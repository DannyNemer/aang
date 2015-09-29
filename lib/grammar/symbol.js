var util = require('../util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')
var semantic = require('./semantic')
var entityCategory = require('./entityCategory')
var intSymbol = require('./intSymbol')


// A map of the grammar's nonterminal symbols to rules.
exports.ruleSets = {}
// A map of Symbol names to creation lines; used for error reporting
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

	if (exports.ruleSets.hasOwnProperty(this.name)) {
		util.logErrorAndPath('Duplicate Symbol:', this.name)
		throw new Error('Duplicate Symbol')
	}

	this.rules = exports.ruleSets[this.name] = []

	// Save instantiation file path and line number for error reporting
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
	// If `options.text` is an `Object`, then it is a set of inflected forms for conjugation.
	// If `options.text` is a `string`, then it is the literal display text.
	// If `options.text` is `undefined` and RHS is not a placeholder symbol, use `options.RHS` as `text`.
	// Use `options.text = ''` for a terminal rule with no display text (e.g., stop-words).
	text: { type: [ String, Object ], optional: true },
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
	}

	// If RHS is an integer symbol or an entity category, prevent those terminal symbols from being accepted as input
	if (opts.RHS === g.emptySymbol || intSymbol.creationLines.hasOwnProperty(opts.RHS) || entityCategory.creationLines.hasOwnProperty(opts.RHS)) {
		newRule.isPlaceholder = true

		// Forbid display text on placeholder symbols.
		if (opts.text !== undefined) {
			util.logErrorAndPath('\'' + opts.RHS + '\', a placeholder symbol, cannot have \'text\':', opts)
			throw new Error('Ill-formed terminal rule')
		}

		// Forbid insertions of placeholder symbols.
		if (opts.insertionCost !== undefined) {
			util.logErrorAndPath('\'' + opts.RHS + '\', a placeholder symbol, cannot have \'insertionCost\':', opts)
			throw new Error('Ill-formed terminal rule')
		}
	}

	// Assign text to display in output when terminal rule is seen in input
	if (opts.text) {
		// Object of inflected forms for conjugation.
		// String for symbols not needing conjugation.
		newRule.text = opts.text
	} else if (opts.text === undefined && !newRule.isPlaceholder) {
		// Use RHS as text if `text` are undefined
		newRule.text = opts.RHS
	}

	if (opts.insertionCost !== undefined) {
		newRule.insertionCost = opts.insertionCost
	}

	// If semantic, must be complete and constitute a RHS
	// Exceptions: terminal symbol is an entity category or <int>
	if (opts.semantic && !semantic.isRHS(opts.semantic) && (opts.RHS === g.emptySymbol || !newRule.isPlaceholder)) {
		util.logError('Terminal rules cannot hold incomplete (LHS) semantic functions:', opts.semantic)
		util.logPathAndObject(opts, true)
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
	gramCase: { values: [ 'nom', 'obj' ], optional: true }, // "me" vs. "I"
	verbForm: { values: [ 'past' ], optional: true }, // "like" vs. "liked"
	personNumber: { values: [ 'one', 'threeSg', 'pl' ], optional: true }, // "like" vs "likes"
	// Prevents insertion rules from being created using this rule and the RHS symbol at this index(es).
	noInsertionIndexes: { type: Array, arrayType: Number, optional: true },
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

	// Prevents insertion rules from being created using this rule and the RHS symbol at this index(es).
	if (opts.noInsertionIndexes) {
		if (opts.noInsertionIndexes.some(function (i) { return opts.RHS[i] === undefined })) {
			util.logErrorAndPath('\'noInsertionIndexes\' contains an index for which there is no RHS symbol:', opts)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.noInsertionIndexes = opts.noInsertionIndexes
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


// Creates a new Symbol with a signle binary nonterminal rule
// - Symbol's name is a concatenation of the RHS Symbols
// Accepts the same `opts` as `Symbol.prototype.newNonterminalRule()`
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

	// Create a new `Symbol` named by the concatenation of the two RHS symbols.
	var symbolNameTokens = RHS.map(function (sym, i) {
		var name = sym.name

		// Specify in symbol name if insertions are forbidden.
		if (opts.noInsertionIndexes && opts.noInsertionIndexes.indexOf(i) !== -1) {
			name = stringUtil.hyphenate(name, 'no', 'insert')
		}

		return name
	})

	return exports.new.apply(null, symbolNameTokens).addRule(opts)
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