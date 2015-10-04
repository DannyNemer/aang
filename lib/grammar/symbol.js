var util = require('../util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')
var semantic = require('./semantic')
var entityCategory = require('./entityCategory')
var intSymbol = require('./intSymbol')


// A map of the grammar's nonterminal symbols to rules.
exports.ruleSets = {}
// A map of Symbol names to creation lines; used for error reporting.
exports.creationLines = {}
// Constructor for extending Symbol.
exports.constructor = Symbol

exports.new = function () {
	var symbolNew = Object.create(Symbol.prototype)
  Symbol.apply(symbolNew, arguments)
	return symbolNew
}

/**
 * Constructor for nonterminal symbols.
 *
 * @param {...string} nameChunks The name chunks to hyphenate for the new `Symbol`'s name.
 */
function Symbol() {
	this.name = '[' + stringUtil.formatName(stringUtil.hyphenate.apply(null, arguments)) + ']'

	if (exports.ruleSets.hasOwnProperty(this.name)) {
		util.logErrorAndPath('Duplicate Symbol:', util.stylize(this.name))
		util.log('\nOther', util.stylize(this.name), 'definition:', exports.creationLines[this.name])
		throw new Error('Duplicate Symbol')
	}

	this.rules = exports.ruleSets[this.name] = []

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[this.name] = util.getModuleCallerPathAndLineNumber()
}

/**
 * Adds a new rule to the grammar.
 *
 * @param {Object} options The options object.
 * @param {Object} [options.terminal=false] Specify whether this is a terminal rule.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
Symbol.prototype.addRule = function (options) {
	var newRule = options.terminal ? this.newTerminalRule(options) : this.newNonterminalRule(options)

	if (options.semantic) {
		newRule.semantic = options.semantic
		newRule.cost = this.calcCost(semantic.sumCosts(options.semantic))
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

/**
 * Creates a new terminal rule to assign to this `Symbol`.
 *
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var termRuleOptionsSchema = {
	// Specifies this is a terminal rule.
	terminal: Boolean,
	// The terminal symbol.
	RHS: String,
	// A completed reduced semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, optional: true },
	// Enables creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: { type: Number, optional: true },
	// If `options.text` is an `Object`, then it is a set of inflected forms for conjugation.
	// If `options.text` is a `string`, then it is the literal display text.
	// If `options.text` is `undefined` and RHS is not a placeholder symbol, use `options.RHS` as `text`.
	// Use `options.text = ''` for a terminal rule with no display text (e.g., stop-words).
	text: { type: [ String, Object ], optional: true },
}

Symbol.prototype.newTerminalRule = function (options) {
	if (util.illFormedOpts(termRuleOptionsSchema, options)) {
		throw new Error('Ill-formed terminal rule')
	}

	if (/[^\S ]/.test(options.RHS)) {
		util.logError('Terminal symbol contains a whitespace character other than a space:', util.stylize(options.RHS), options)
		throw new Error('Ill-formed terminal rule')
	}

	if (/ {2,}/.test(options.RHS)) {
		util.logError('Terminal symbol contains a sequence of multiple spaces:', util.stylize(options.RHS), options)
		throw new Error('Ill-formed terminal rule')
	}

	var newRule = {
		RHS: [ options.RHS.toLowerCase() ],
		isTerminal: true,
	}

	// If RHS is an integer symbol or an entity category, prevent those terminal symbols from being accepted as input.
	if (options.RHS === g.emptySymbol || intSymbol.creationLines.hasOwnProperty(options.RHS) || entityCategory.creationLines.hasOwnProperty(options.RHS)) {
		newRule.isPlaceholder = true

		// Forbid display text on placeholder symbols.
		if (options.text !== undefined) {
			util.logErrorAndPath('\'' + options.RHS + '\', a placeholder symbol, cannot have \'text\':', options)
			throw new Error('Ill-formed terminal rule')
		}

		// Forbid insertions of placeholder symbols.
		if (options.insertionCost !== undefined) {
			util.logErrorAndPath('\'' + options.RHS + '\', a placeholder symbol, cannot have \'insertionCost\':', options)
			throw new Error('Ill-formed terminal rule')
		}
	}

	// Assign text to display in output when terminal rule is seen in input.
	if (options.text) {
		// `Object` of inflected forms for conjugation.
		// `String` for symbols not needing conjugation.
		newRule.text = options.text
	} else if (options.text === undefined && !newRule.isPlaceholder) {
		// Use RHS as `rule.text` if `options.text` is undefined.
		newRule.text = options.RHS
	}

	if (options.insertionCost !== undefined) {
		newRule.insertionCost = options.insertionCost
	}

	// If semantic, must be complete and constitute a RHS semantic.
	// Exceptions: terminal symbol is an entity category or integer symbol.
	if (options.semantic && !semantic.isRHS(options.semantic) && (options.RHS === g.emptySymbol || !newRule.isPlaceholder)) {
		util.logError('Terminal rules cannot hold incomplete (LHS) semantic functions:', options.semantic)
		util.logPathAndObject(options, true)
		throw new Error('Ill-formed terminal rule')
	}

	return newRule
}

/**
 * Creates a new nonterminal rule to assign to this `Symbol`.
 *
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var nontermRuleOptionsSchema = {
	// RHS can be an array of Symbols and/or nested arrays of RHS for new binary rules.
	RHS: { type: Array, arrayType: [ Symbol, Array ] },
	// A semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, optional: true },
	// Enables creation of transposition rules which recognizes the swap of this rule's `RHS` symbols and swaps them back when parsing. Requires `RHS` to contain two `Symbol`s.
	transpositionCost: { type: Number, optional: true },
	// Specifies that text object requiring conjugation, belonging to a descendant of this rule, needs to be conjugated to a grammatical case. E.g., "me" vs. "I".
	gramCase: { values: [ 'nom', 'obj' ], optional: true },
	// Specifies that text object requiring conjugation, belonging to a descendant of this rule, needs to be conjugated to a grammatical case. E.g., "like" vs. "liked".
	verbForm: { values: [ 'past' ], optional: true },
	// Specifies that text object requiring conjugation, belonging to a descendant of this rule, needs to be conjugated to a grammatical case. E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ], optional: true },
	// Prevents insertion rules from being created using this rule and the RHS symbol at this index(es).
	noInsertionIndexes: { type: Array, arrayType: Number, optional: true },
}

Symbol.prototype.newNonterminalRule = function (options) {
	if (util.illFormedOpts(nontermRuleOptionsSchema, options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newRule = {
		// RHS can be an array of `Symbol`s and/or nested arrays of RHS for new binary rules.
		RHS: options.RHS.map(function (sym) {
			// `sym` is a nested RHS for a new binary rule.
			// Recursively create the new rule and replace the array with its new `Symbol`.
			if (sym.constructor === Array) {
				return exports.newBinaryRule({ RHS: sym }).name
			}

			// Replace `Symbol` in `RHS` with its name.
			else {
				return sym.name
			}
		}),
		// If `gramProps` has no defined properties, `newRule.gramProps` is removed at conclusion of grammar generation.
		gramProps: {
		gramCase: options.gramCase,
		verbForm: options.verbForm,
		personNumber: options.personNumber,
		},
	}

	// Prevent insertion rules from being created using this rule and the RHS symbol at this index(es).
	if (options.noInsertionIndexes) {
		if (options.noInsertionIndexes.some(function (i) { return options.RHS[i] === undefined })) {
			util.logErrorAndPath('\'noInsertionIndexes\' contains an index for which there is no RHS symbol:', options)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.noInsertionIndexes = options.noInsertionIndexes
	}

	if (options.semantic) {
		// `true` if semantic is complete and constitutes a RHS, else semantic is to accept other semantics as arguments.
		newRule.semanticIsRHS = semantic.isRHS(options.semantic)
	}

	if (options.RHS.length > 2) {
		util.logErrorAndPath('Nonterminal rules can only have 1 or 2 RHS symbols:', this.name, '->', newRule.RHS)
		throw new Error('Ill-formed nonterminal rule')
	}

	if (options.transpositionCost !== undefined) {
		if (options.RHS.length !== 2) {
			util.logErrorAndPath('Nonterminal rules with transposition costs must have 2 RHS symbols:', this.name, '->', newRule.RHS)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.transpositionCost = options.transpositionCost
	}

	return newRule
}

/**
 * Creates a new `Symbol` with a single binary nonterminal rule. The `Symbol`'s name is a concatenation of the rule's RHS `Symbol`s. Use the same options object as `Symbol.prototype.newNonterminalRule()`.
 *
 * As the Symbol's name is created from the rule's RHS, this new Symbol is intended only for this rule.
 *
 * `options.RHS` can be an
 *
 * @param {Object} options The options object following the schema for `Symbol.prototype.newNonterminalRule()`.
 * @param {Symbol[]|Array[]} options.RHS An array of `Symbol`s and/or nested arrays of RHS for new binary rules to recursively create. However, these sub-rules can only contain a RHS and not other rule properties.
 * @returns {Symbol} Returns the new binary `Symbol`.
 */
exports.newBinaryRule = function (options) {
	if (util.illFormedOpts(nontermRuleOptionsSchema, options)) {
		throw new Error('Ill-formed binary rule')
	}

	var RHS = options.RHS

	// RHS must contain two RHS symbols.
	if (RHS.length !== 2) {
		util.logErrorAndPath('Binary rules must have 2 RHS symbols:', RHS)
		throw new Error('Ill-formed binary rule')
	}

	// RHS can be an array of `Symbol`s and/or nested arrays of RHS for new binary rules.
	RHS.forEach(function (sym, i) {
		// `sym` is a nested RHS for a new binary rule.
		// Recursively create the new rule and replace the array with its new `Symbol`.
		if (sym.constructor === Array) {
			RHS[i] = exports.newBinaryRule({ RHS: sym })
		}
	})

	// Create a new `Symbol` named by the concatenation of the two RHS symbols.
	var symbolNameTokens = RHS.map(function (sym, i) {
		var name = sym.name

		// Specify in symbol name if insertions are forbidden.
		if (options.noInsertionIndexes && options.noInsertionIndexes.indexOf(i) !== -1) {
			name = stringUtil.hyphenate(name, 'no', 'insert')
		}

		return name
	})

	return exports.new.apply(null, symbolNameTokens).addRule(options)
}

/**
 * Checks if the RHS symbols of a new rule already exist for this symbol.
 *
 * @param {Object} newRule The new rule to check.
 * @returns {boolean} Returns `true` if `newRule`'s RHS symbols already exist for this symbol, else `false`.
 */
Symbol.prototype.ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysEqual(existingRule.RHS, newRule.RHS)
	})
}

/**
 * Calculate the cost of a new rule for this `Symbol`. Increments cost of each new rule by `1e-7` and adds a `costPenalty` for the rule's semantics, if any.
 *
 * @param {number} [costPenalty] The penalty added to the base cost for semantics.
 * @returns {number} The cost of the new rule.
 */
Symbol.prototype.calcCost = function (costPenalty) {
	// Cost penalty is cost of semantic on nonterminal rules (if present).
	var costPenalty = costPenalty || 0

	// Cost of rules for each symbol are incremented by `1e-7`.
	return this.rules.length * 1e-7 + costPenalty
}