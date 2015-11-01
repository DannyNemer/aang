var util = require('../util/util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')
var semantic = require('./semantic')
var entityCategory = require('./entityCategory')
var intSymbol = require('./intSymbol')


// A map of the grammar's nonterminal symbols to rules.
exports.ruleSets = {}
// A map of `Symbol` names to creation lines; used for error reporting.
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
 * @constructor
 * @param {...string} [nameChunks] The name chunks to hyphenate for the new `Symbol`'s name.
 */
function Symbol() {
	this.name = '[' + stringUtil.formatName(stringUtil.hyphenate.apply(null, arguments)) + ']'

	if (exports.ruleSets.hasOwnProperty(this.name)) {
		util.logErrorAndPath('Duplicate symbol name:', util.stylize(this.name))
		util.log('\nOther', util.stylize(this.name), 'definition:', exports.creationLines[this.name])
		throw new Error('Duplicate symbol name')
	}

	this.rules = exports.ruleSets[this.name] = []

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[this.name] = util.getModuleCallerPathAndLineNumber()
}

/**
 * Adds a new rule to the grammar.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 * @param {Object} [options.isTerminal=false] Specify the rule is terminal.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
Symbol.prototype.addRule = function (options) {
	var newRule = options.isTerminal ? this.newTerminalRule(options) : this.newNonterminalRule(options)

	if (options.semantic) {
		newRule.semantic = options.semantic.sort(semantic.compare)
		newRule.cost = this.calcCost(semantic.sumCosts(options.semantic))
	} else {
		newRule.cost = this.calcCost()
	}

	if (this.ruleExists(newRule)) {
		util.logErrorAndPath('Duplicate rule:', util.stylize(this.name), '->', newRule.RHS)
		throw new Error('Duplicate rule')
	}

	this.rules.push(newRule)

	return this
}

/**
 * Creates a new nonterminal rule to assign to this `Symbol`.
 *
 * @memberOf Symbol
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var nontermRuleSchema = {
	// The array of `Symbol`s and/or nested arrays of RHS for new binary rules to recursively create. However, these sub-rules can only contain a RHS and not other rule properties.
	RHS: { type: Array, arrayType: [ Symbol, Array ] },
	// The LHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, optional: true },
	// Enable creation of transposition rules which recognizes the swap of this rule's `RHS` symbols and swaps them back when parsing. Requires `RHS` to contain two `Symbol`s.
	transpositionCost: { type: Number, optional: true },
	// The grammatical case for which to conjugate terminal rules produced by this rule's RHS. E.g., "me" vs. "I".
	gramCase: { values: [ 'nom', 'obj' ], optional: true },
	// The verb form for which to conjugate terminal rules produced by this rule's RHS. E.g., "like" vs. "liked".
	verbForm: { values: [ 'past' ], optional: true },
	// The tense for which forms of terminal rules produced by this rule's RHS are accepted when input, but not enforced by default. E.g., "(repos I) liked" (past) and "(repos I) like" are both accepted, but defaults to "like".
	acceptedTense: { values: [ 'past' ], optional: true },
	// The person-number for which to conjugate terminal rules either produced by this rule's RHS or which follow in successive branches. E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ], optional: true },
	// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
	noInsertionIndexes: { type: Array, arrayType: Number, optional: true },
}

Symbol.prototype.newNonterminalRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newRule = {
		// RHS can contain `Symbol`s and/or nested arrays of RHS for new binary rules to recursively create.
		RHS: options.RHS.map(function (sym) {
			if (sym.constructor === Array) {
				// `sym` is a nested RHS for a new binary rule. Recursively create the new rule and replace the array with its new `Symbol`.
				return exports.newBinaryRule({ RHS: sym }).name
			} else {
				// Replace `Symbol` in `RHS` with its name.
				return sym.name
			}
		}),
		// If `gramProps` has no defined properties, `newRule.gramProps` is removed at conclusion of grammar generation (i.e., to avoid an empty object).
		gramProps: {
			gramCase: options.gramCase,
			verbForm: options.verbForm,
			acceptedTense: options.acceptedTense,
		},
		personNumber: options.personNumber,
	}

	// Check the RHS produces an accepting terminal rule for each of the rule's defined grammatical properties.
	for (var propName in newRule.gramProps) {
		var gramProp = newRule.gramProps[propName]

		if (gramProp && !rhsAcceptsGramProp(newRule.RHS, gramProp)) {
			util.logError('RHS does not produce a terminal rule that accepts the grammatical property ' + util.stylize(propName) + ' -> ' + util.stylize(gramProp) + ':')
			util.logPathAndObject('\n' + util.stylize(this.name) + ' -> ' + util.stylize(newRule.RHS), true)
			throw new Error('Ill-formed nonterminal rule')
		}
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
		util.logErrorAndPath('Nonterminal rules can only have 1 or 2 RHS symbols:', util.stylize(this.name), '->', newRule.RHS)
		throw new Error('Ill-formed nonterminal rule')
	}

	if (options.transpositionCost !== undefined) {
		if (options.RHS.length !== 2) {
			util.logErrorAndPath('Nonterminal rules with transposition costs must have 2 RHS symbols:', util.stylize(this.name), '->', newRule.RHS)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.transpositionCost = options.transpositionCost
	}

	return newRule
}

/**
 * Checks if `rhs` produces terminal rules that accept the grammatical property, `gramProp`.
 *
 * @param {string[]} rhs The RHS symbols to check if produce accepting terminal rules.
 * @param {string} gramProp The grammatical property name to check for (e.g., 'oneSg', 'obj').
 * @returns {boolean} Returns `true` if `rhs` produces a terminal rule that accepts `gramProp`, else `false`.
 */
function rhsAcceptsGramProp(rhs, gramProp) {
	for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
		var rhsSym = rhs[s]
		var rhsRules = exports.ruleSets[rhsSym]

		for (var r = 0, rulesLen = rhsRules.length; r < rulesLen; ++r) {
			var rule = rhsRules[r]

			if (rule.isTerminal && rule.text && rule.text[gramProp]) {
				return true
			}
		}
	}

	return false
}

/**
 * Creates a new `Symbol` with a single binary nonterminal rule. The `Symbol`'s name is a concatenation of the rule's RHS `Symbol`s. Use the same options object as `Symbol.prototype.newNonterminalRule()`.
 *
 * As the `Symbol`'s name is created from the rule's RHS, this new `Symbol` is intended only for this rule.
 *
 * @static
 * @param {Object} options The options object following the schema for `Symbol.prototype.newNonterminalRule()`.
 * @returns {Symbol} Returns the new binary `Symbol`.
 */
exports.newBinaryRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed binary rule')
	}

	// RHS must contain two RHS symbols.
	if (options.RHS.length !== 2) {
		util.logErrorAndPath('Binary rules must have 2 RHS symbols:', options.RHS)
		throw new Error('Ill-formed binary rule')
	}

	// RHS can contain `Symbol`s and/or nested arrays of RHS for new binary rules to recursively create.
	options.RHS = options.RHS.map(function (sym, i) {
		if (sym.constructor === Array) {
			// `sym` is a nested RHS for a new binary rule. Recursively create the new rule and replace the array with its new `Symbol`.
			return exports.newBinaryRule({ RHS: sym })
		} else {
			return sym
		}
	})

	// Create a new `Symbol` named by the concatenation of the two RHS symbols.
	var symbolNameTokens = options.RHS.map(function (sym, i) {
		var name = sym.name

		// Specify in `Symbol` name if insertions are forbidden.
		if (options.noInsertionIndexes && options.noInsertionIndexes.indexOf(i) !== -1) {
			name = stringUtil.hyphenate(name, 'no', 'insert')
		}

		return name
	})

	return exports.new.apply(null, symbolNameTokens).addRule(options)
}

/**
 * Creates a new terminal rule to assign to this `Symbol`.
 *
 * @memberOf Symbol
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var termRuleSchema = {
	// Specify this is a terminal rule.
	isTerminal: Boolean,
	// The terminal symbol.
	RHS: String,
	// Specify the terminal symbol is a placeholder for input data to prevent the literal terminal symbol from being accepted as input. Placeholder terminal symbols generate and use display text and a semantic argument from input; e.g., integer symbols, entities.
	isPlaceholder: { type: Boolean, optional: true },
	// The completely reduced, RHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, optional: true },
	// Enable creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: { type: Number, optional: true },
	// If `options.text` is an `Object`, then it is a set of inflected forms for conjugation.
	// If `options.text` is a `string`, then it is the literal display text.
	// If `options.text` is `undefined` and RHS is not a placeholder symbol, use `options.RHS` as `text`.
	// Use `options.text: ''` for a terminal rule with no display text (e.g., stop-words).
	text: { type: [ String, Object ], optional: true },
	// The tense of this terminal symbol that is checked against the parent nonterminal rules' `acceptedTense` property to determine if this symbol is an acceptable form of the associated verb (though not enforced by default).
	tense: nontermRuleSchema.acceptedTense,
}

Symbol.prototype.newTerminalRule = function (options) {
	if (util.illFormedOpts(termRuleSchema, options)) {
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

	// Prevent terminal rules with placeholder symbols from being assigned a reduced (RHS) semantic because placeholder symbols generate and use a semantic argument from input.
	if (options.isPlaceholder && options.semantic && semantic.isRHS(options.semantic)) {
		util.logErrorAndPath('Placeholder symbols cannot have reduced (RHS) semantics:', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Forbid semantics on `<empty>`.
	if (options.RHS === g.emptySymbol && options.semantic) {
		util.logErrorAndPath('\'' + options.RHS + '\' cannot have \'semantic\':', options)
		throw new Error('Ill-formed terminal rule')
	}

	if (options.RHS === g.emptySymbol || options.isPlaceholder) {
		// Forbid display text on `<empty>` and placeholder symbols.
		if (options.text !== undefined) {
			util.logErrorAndPath('\'' + options.RHS + '\'' + (options.isPlaceholder ? ', a placeholder symbol,' : '') + ' cannot have \'text\':', options)
			throw new Error('Ill-formed terminal rule')
		}

		// Forbid insertions of `<empty>` and placeholder symbols.
		if (options.insertionCost !== undefined) {
			util.logErrorAndPath('\'' + options.RHS + '\'' + (options.isPlaceholder ? ', a placeholder symbol,' : '') + ' cannot have \'insertionCost\':')
			throw new Error('Ill-formed terminal rule')
		}
	}

	// Require semantics to be be completely reduced (i.e., a RHS semantic), except placeholder symbols.
	if (options.semantic && !semantic.isRHS(options.semantic) && !options.isPlaceholder) {
		util.logError('Terminal rules cannot hold incomplete (LHS) semantic functions:', options.semantic)
		util.logPathAndObject(options, true)
		throw new Error('Ill-formed terminal rule')
	}

	var newRule = {
		RHS: [ options.RHS.toLowerCase() ],
		isTerminal: true,
		// Placeholder terminal symbols generate display text and a semantic argument from input; e.g., integer symbols, entites. Define `isPlaceholder` to prevent the literal terminal symbol from being accepted as input.
		isPlaceholder: options.isPlaceholder,
		tense: options.tense,
	}

	// Assign text to display in output when terminal symbol is seen in input.
	if (options.text) {
		// `Object` of inflected forms for conjugation, `string` for symbols not needing conjugation.
		newRule.text = options.text
	} else if (options.text === undefined && !newRule.isPlaceholder && options.RHS !== g.emptySymbol) {
		// Use RHS as `rule.text` if `options.text` is `undefined`.
		newRule.text = options.RHS
	}

	if (options.insertionCost !== undefined) {
		newRule.insertionCost = options.insertionCost
	}

	return newRule
}

/**
 * Checks if the RHS symbols of a new rule already exist for this symbol.
 *
 * @memberOf Symbol
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
 * @memberOf Symbol
 * @param {number} [costPenalty] The penalty added to the base cost for semantics.
 * @returns {number} The cost of the new rule.
 */
Symbol.prototype.calcCost = function (costPenalty) {
	// Cost penalty is cost of semantic on nonterminal rules (if present).
	var costPenalty = costPenalty || 0

	// Cost of rules for each symbol are incremented by `1e-7`.
	return this.rules.length * 1e-7 + costPenalty
}