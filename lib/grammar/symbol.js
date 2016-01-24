var util = require('../util/util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')
var semantic = require('./semantic')


// A map of the grammar's nonterminal symbols to rules.
exports._ruleSets = {}
// A map of `NSymbol` names to creation-lines (file-path + line-number); used for error reporting.
NSymbol._creationLines = {}
// Constructor for extending `NSymbol`.
exports.constructor = NSymbol

/**
 * Constructor for nonterminal symbols.
 *
 * @constructor
 * @param {...string} [nameTokens] The tokens to hyphenate for the new `NSymbol`'s name.
 */
function NSymbol() {
	this.name = NSymbol.genName.apply(null, arguments)

	if (exports._ruleSets.hasOwnProperty(this.name)) {
		util.logErrorAndPath('Duplicate symbol name:', util.stylize(this.name))
		util.log('\nOther', util.stylize(this.name), 'definition:')
		util.log('  ' + NSymbol._creationLines[this.name])
		throw new Error('Duplicate symbol name')
	}

	this.rules = exports._ruleSets[this.name] = []

	// Save instantiation file path and line number for error reporting.
	NSymbol._creationLines[this.name] = util.getModuleCallerPathAndLineNumber()
}

/**
 * Instantiates a new `NSymbol`.
 *
 * @static
 * @param {...string} [nameTokens] The tokens to hyphenate for the new `NSymbol`'s name.
 * @returns {NSymbol} Returns the new `NSymbol`.
 */
exports.new = function () {
	var newNSymbol = Object.create(NSymbol.prototype)
	NSymbol.apply(newNSymbol, arguments)
	return newNSymbol
}

/**
 * Hyphenates and formats the provided `tokens` for the name of a new `NSymbol`.
 *
 * @static
 * @memberOf NSymbol
 * @param {...string} [nameTokens] The tokens to hyphenate and format.
 * @returns {string} Returns the hyphenated and formatted string.
 */
NSymbol.genName = function () {
	return '[' + stringUtil.formatStringForName(stringUtil.hyphenate.apply(null, arguments)) + ']'
}

/**
 * Adds a new rule to the grammar.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {Object} [options.isTerminal=false] Specify the rule is terminal.
 * @returns {NSymbol} Returns this `NSymbol` for chaining.
 */
NSymbol.prototype.addRule = function (options) {
	var newRule = options.isTerminal ? this.newTerminalRule(options) : this.newNonterminalRule(options)

	if (this.ruleExists(newRule)) {
		util.logErrorAndPath('Duplicate rule:', util.stylize(this.name), '->', newRule.rhs)
		throw new Error('Duplicate rule')
	}

	this.rules.push(newRule)

	return this
}

/**
 * Creates a new nonterminal rule to assign to this `NSymbol`.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var nontermRuleSchema = {
	// The array of `NSymbol`s, `NSymbol` names, and/or nested arrays of RHS for new binary rules to recursively create. However, these sub-rules can only contain a RHS and not other rule properties.
	rhs: { type: Array, arrayType: [ NSymbol, String, Array ] },
	// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
	noInsertionIndexes: { type: Array, arrayType: Number },
	// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
	noInsert: Boolean,
	// The LHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: Array,
	// Enable creation of transposition rules which recognizes the swap of this rule's `rhs` symbols and swaps them back when parsing. Requires `rhs` to contain two `NSymbol`s.
	transpositionCost: Number,
	// The grammatical case for which to conjugate terminal rules produced by this rule's RHS. E.g., "me" vs. "I".
	case: { values: [ 'nom', 'obj' ] },
	// The grammatical tense for which to conjugate terminal rules produced by this rule's RHS. E.g., "like" vs. "liked".
	tense: { values: [ 'past' ] },
	// The grammatical tense for which forms of terminal rules produced by this rule's RHS are accepted when input, but not enforced by default. E.g., "(repos I) liked" (past) and "(repos I) like" are both accepted, but defaults to "like".
	acceptedTense: { values: [ 'past' ] },
	// The grammatical person-number for which to conjugate terminal rules either produced by this rule's RHS or which follow in successive branches. E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ] },
	// The grammatical person-number for anaphoric rules with which to match to an antecedent semantic of the same person-number. E.g., "his/her" refers to semantics of third-person-singular representations.
	anaphoraPersonNumber: { values: [ 'threeSg', 'threePl' ] },
}

NSymbol.prototype.newNonterminalRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	// Prevent insertion rules from being created using this rule and the RHS symbol at this index(es).
	if (options.noInsertionIndexes) {
		if (options.noInsertionIndexes.some(function (i) { return options.rhs[i] === undefined })) {
			util.logErrorAndPath('\'noInsertionIndexes\' contains an index for which there is no RHS symbol:', options)
			throw new Error('Ill-formed nonterminal rule')
		}
	}

	var newRule = {
		// `NSymbol`s, `NSymbol` names, and/or nested arrays of RHS for new binary rules to recursively create.
		rhs: options.rhs.map(function (sym) {
			if (sym.constructor === String) {
				if (!exports._ruleSets.hasOwnProperty(sym)) {
					util.logError('RHS symbol does not exist:', util.stylize(sym))
					util.logPathAndObject('\n' + util.stylize(this.name) + ' -> ' + util.stylize(options))
					throw new Error('Ill-formed nonterminal rule')
				}

				return sym
			} else if (sym.constructor === Array) {
				// `sym` is a nested RHS for a new binary rule. Recursively create the new rule and replace the array with its new `NSymbol`.
				return NSymbol.newBinaryRule({ rhs: sym }).name
			} else {
				// Replace `NSymbol` in `rhs` with its name.
				return sym.name
			}
		}, this),
		// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
		noInsertionIndexes: options.noInsertionIndexes,
		// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
		noInsert: options.noInsert,
		// If `gramProps` has no defined properties, `newRule.gramProps` is removed at conclusion of grammar generation (i.e., to avoid an empty object).
		// Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
		gramProps: {
			case: options.case,
			tense: options.tense,
			acceptedTense: options.acceptedTense,
		},
		personNumber: options.personNumber,
		anaphoraPersonNumber: options.anaphoraPersonNumber,
	}

	// Check the RHS produces an accepting terminal rule for each of the rule's defined grammatical properties.
	for (var propName in newRule.gramProps) {
		var gramProp = newRule.gramProps[propName]

		if (gramProp && !NSymbol.rhsAcceptsGramProp(newRule.rhs, gramProp)) {
			util.logError('RHS does not produce a terminal rule that accepts the grammatical property ' + util.stylize(propName) + ' -> ' + util.stylize(gramProp) + ':')
			util.logPathAndObject('\n' + util.stylize(this.name) + ' -> ' + util.stylize(newRule.rhs))
			throw new Error('Ill-formed nonterminal rule')
		}
	}

	if (options.semantic) {
		if (options.anaphoraPersonNumber) {
			util.logErrorAndPath('Anaphoric rule has a semantic:', options)
			throw new Error('Ill-formed nonterminal rule')
		}

		// Assign semantic used in semantic trees that correspond to parse tree that contain this rule.
		newRule.semantic = options.semantic.sort(semantic.compare)
		// Specify if semantic is reduced, else semantic is to accept other semantics as arguments.
		newRule.semanticIsReduced = semantic.isReduced(options.semantic)
		// Calculate rule cost which includes the semantic's cost.
		newRule.cost = this.calcCost(semantic.sumCosts(options.semantic))
	} else {
		// Calculate rule cost.
		newRule.cost = this.calcCost()
	}

	if (options.rhs.length > 2) {
		util.logErrorAndPath('Nonterminal rule has > 2 RHS symbols:', options)
		throw new Error('Ill-formed nonterminal rule')
	}

	if (options.transpositionCost !== undefined) {
		if (options.rhs.length !== 2) {
			util.logErrorAndPath('Nonterminal rule with transposition cost does not have 2 RHS symbols:', options)
			throw new Error('Ill-formed nonterminal rule')
		}

		newRule.transpositionCost = options.transpositionCost
	}

	return newRule
}

/**
 * Checks if `rhs` produces at least one rule with a `text` value for the grammatical property, `gramProp`.
 *
 * @static
 * @memberOf NSymbol
 * @param {string[]} rhs The RHS symbols to check if produces a rule with a `text` value for `gramProp`.
 * @param {string} gramProp The grammatical property name to check for (e.g., 'oneSg', 'obj').
 * @returns {boolean} Returns `true` if `rhs` produces a rule that accepts `gramProp`, else `false`.
 */
NSymbol.rhsAcceptsGramProp = function (rhs, gramProp) {
	for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
		var rhsSym = rhs[s]
		var rhsRules = exports._ruleSets[rhsSym]

		for (var r = 0, rulesLen = rhsRules.length; r < rulesLen; ++r) {
			var rule = rhsRules[r]

			// Check both terminal and nonterminal rules. (The latter were created from regex-style terminal rules.)
			if (rule.text && rule.text[gramProp]) {
				return true
			}
		}
	}

	return false
}

/**
 * Creates a new `NSymbol` with a single binary nonterminal rule. The `NSymbol`'s name is a concatenation of the rule's RHS `NSymbol`s. Use the same options object as `NSymbol.prototype.newNonterminalRule()`.
 *
 * As the `NSymbol`'s name is created from the rule's RHS, this new `NSymbol` is intended only for this rule.
 *
 * @static
 * @memberOf NSymbol
 * @param {Object} options The options object following the schema for `NSymbol.prototype.newNonterminalRule()`.
 * @returns {NSymbol} Returns the new binary `NSymbol`.
 */
NSymbol.newBinaryRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed binary rule')
	}

	// RHS must contain two RHS symbols.
	if (options.rhs.length !== 2) {
		util.logErrorAndPath('Binary rules does not have 2 RHS symbols:', options.rhs)
		throw new Error('Ill-formed binary rule')
	}

	// RHS can contain `NSymbol`s and/or nested arrays of RHS for new binary rules to recursively create.
	options.rhs = options.rhs.map(function (sym, i) {
		if (sym.constructor === Array) {
			// `sym` is a nested RHS for a new binary rule. Recursively create the new rule and replace the array with its new `NSymbol`.
			return NSymbol.newBinaryRule({ rhs: sym })
		} else {
			return sym
		}
	})

	// Create a new `NSymbol` named by the concatenation of the two RHS symbols.
	var symbolNameTokens = options.rhs.map(function (sym, i) {
		var name = sym.constructor === NSymbol ? sym.name : sym

		// Specify in name if insertions are forbidden.
		if (options.noInsertionIndexes && options.noInsertionIndexes.indexOf(i) !== -1) {
			name = stringUtil.hyphenate(name, 'no', 'insert')
		}

		return name
	})

	return exports.new.apply(null, symbolNameTokens).addRule(options)
}

/**
 * Creates a new terminal rule to assign to this `NSymbol`.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var termRuleSchema = {
	// Specify this is a terminal rule.
	isTerminal: { type: Boolean, required: true },
	// The terminal symbol.
	rhs: { type: String, required: true },
	// Specify the terminal symbol is a placeholder for input data to prevent the literal terminal symbol from being accepted as input. Placeholder terminal symbols generate and use display text and a semantic argument from input; e.g., integer symbols, entities.
	isPlaceholder: Boolean,
	// The completely reduced, RHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: Array,
	// Enable creation of edit rules using `NSymbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// Specify insertions that include this rule, and where the inserted segment is in the right (second) position of a binary rule, can only occur at the end of an input query. Requires `insertionCost`.
	restrictInsertion: Boolean,
	// The cost penalty added to this rule's cost.
	costPenalty: Number,
	// If `options.text` is an `Object`, then it is a set of inflected forms for conjugation.
	// If `options.text` is a `string`, then it is the literal display text.
	// If `options.text` is `undefined` and RHS is not a placeholder symbol, use `options.rhs` as `text`.
	text: { type: [ String, Object ] },
	// The tense of this terminal symbol that is checked against the parent nonterminal rules' `acceptedTense` property to determine if this symbol is an acceptable form of the associated verb (though not enforced by default).
	tense: nontermRuleSchema.acceptedTense,
	// Specify this rule substitutes the input terminal symbol as display text.
	isSubstitution: Boolean,
	// Specify this terminal symbol is a stop-word and does not produce any text when `rhs` is input.
	isStopWord: Boolean,
}

NSymbol.prototype.newTerminalRule = function (options) {
	if (util.illFormedOpts(termRuleSchema, options)) {
		throw new Error('Ill-formed terminal rule')
	}

	if (/[^\S ]/.test(options.rhs)) {
		util.logError('Terminal symbol contains a whitespace character other than a space:', util.stylize(options.rhs), options)
		throw new Error('Ill-formed terminal rule')
	}

	if (/ {2,}/.test(options.rhs)) {
		util.logError('Terminal symbol contains a sequence of multiple spaces:', util.stylize(options.rhs), options)
		throw new Error('Ill-formed terminal rule')
	}

	if (options.text === '') {
		util.logError('\'text\' equals \'\':', options)
		throw new Error('Ill-formed terminal rule')
	}

	if (options.isSubstitution && options.text === undefined) {
		util.logError('Substitution lacks \'text\':', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Prevent terminal rules with placeholder symbols from being assigned a reduced (RHS) semantic because placeholder symbols generate and use a semantic argument from input.
	if (options.isPlaceholder && options.semantic && semantic.isReduced(options.semantic)) {
		util.logErrorAndPath('Placeholder symbols has reduced (RHS) semantic:', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Forbid semantics on `<empty>`.
	if (options.rhs === g.emptySymbol && options.semantic) {
		util.logErrorAndPath('\'' + options.rhs + '\' has \'semantic\':', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Require semantics to be be completely reduced (i.e., a RHS semantic), except placeholder symbols.
	if (options.semantic && !semantic.isReduced(options.semantic) && !options.isPlaceholder) {
		util.logError('Terminal rules has non-reduced (LHS) semantic:', options.semantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed terminal rule')
	}

	var newRule = {
		rhs: [ options.rhs.toLowerCase() ],
		isTerminal: true,
		// Placeholder terminal symbols generate display text and a semantic argument from input; e.g., integer symbols, entities. Define `isPlaceholder` to prevent the literal terminal symbol from being accepted as input.
		isPlaceholder: options.isPlaceholder,
		tense: options.tense,
		isStopWord: options.isStopWord,
		isSubstitution: options.isSubstitution,
	}

	// The cost penalty added to this rule's cost.
	var costPenalty = options.costPenalty === undefined ? 0 : options.costPenalty

	if (options.semantic) {
		// Assign semantic used in semantic trees that correspond to parse tree that contain this rule.
		newRule.semantic = options.semantic.sort(semantic.compare)
		// Specify if semantic is reduced, else terminal symbol is a placeholder and will create a semantic argument from input.
		newRule.semanticIsReduced = semantic.isReduced(options.semantic)
		// Calculate rule cost which includes the semantic's cost.
		newRule.cost = this.calcCost(semantic.sumCosts(options.semantic) + costPenalty)
	} else {
		// Calculate rule cost.
		newRule.cost = this.calcCost(costPenalty)
	}

	if (options.rhs === g.emptySymbol || options.isPlaceholder || options.isStopWord) {
		var msgStart = '\'' + options.rhs + '\', '
		if (options.rhs === g.emptySymbol) {
			msgStart += 'an empty string'
		} else if (options.isPlaceholder) {
			msgStart += 'a placeholder symbol'
		} else if (options.isStopWord) {
			msgStart += 'a stop-word'
		}
		msgStart += ', has '

		// Forbid display text on stop-words, `<empty>` and placeholder symbols.
		if (options.text !== undefined) {
			util.logErrorAndPath(msgStart + '\'text\':', options)
			throw new Error('Ill-formed terminal rule')
		}

		// Forbid insertions of stop-words, `<empty>`, and placeholder symbols.
		if (options.insertionCost !== undefined) {
			util.logErrorAndPath(msgStart + '\'insertionCost\':', options)
			throw new Error('Ill-formed terminal rule')
		}
	}

	// Assign text to display in output when terminal symbol is input.
	else if (options.text) {
		// Either `Object` of inflected forms for conjugation or `string` for symbols not needing conjugation.
		newRule.text = options.text
	} else {
		// Use RHS as `rule.text` when `options.text` is `undefined`.
		newRule.text = options.rhs
	}

	if (options.insertionCost !== undefined) {
		newRule.insertionCost = options.insertionCost

		if (options.restrictInsertion) {
			newRule.restrictInsertion = true
		}
	} else if (options.restrictInsertion) {
		util.logErrorAndPath('\'restrictInsertion\' exists without \'insertionCost\':', options)
		throw new Error('Ill-formed terminal rule')
	}

	return newRule
}

/**
 * Checks if the RHS symbols of a new rule already exist for this symbol.
 *
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to check.
 * @returns {boolean} Returns `true` if `newRule`'s RHS symbols already exist for this symbol, else `false`.
 */
NSymbol.prototype.ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysEqual(existingRule.rhs, newRule.rhs)
	})
}

/**
 * Calculate the cost of a new rule for this `NSymbol`. Increments cost of each new rule by `1e-7` and adds a `costPenalty` for the rule's semantics, if any.
 *
 * @memberOf NSymbol
 * @param {number} [costPenalty] The penalty added to the base cost for semantics.
 * @returns {number} Returns the cost of the new rule.
 */
NSymbol.prototype.calcCost = function (costPenalty) {
	// Cost penalty is cost of semantic on nonterminal rules (if present).
	var costPenalty = costPenalty || 0

	// The arbitrarily small positive quantity with which to incremenet each rule's cost.
	var EPSILON = 1e-7

	return this.rules.length * EPSILON + costPenalty
}

/**
 * Sorts nonterminal symbols alphabetically and each symbols' rules by increasing cost.
 *
 * It is essential to sort rules by increasing cost so that when `StateTable` groups `ruleProps` together for edit rules with the same RHS symbols, the cheapest rules is the first `ruleProp` in the set. This enables `calcHeuristicCosts` to determine the minimum cost for these sets of `ruleProps` by checking the cost of the first object in each set.
 *
 * `grammar.sortGrammar()` invokes this method at the end of grammar generation.
 *
 * @static
 */
exports.sortRules = function () {
	Object.keys(exports._ruleSets).sort().forEach(function (symbolName) {
		// Sort rules by increasing cost.
		var rules = exports._ruleSets[symbolName].sort(function (ruleA, ruleB) {
			return ruleA.cost - ruleB.cost
		})

		// Sort nonterminal symbols alphabetically.
		delete exports._ruleSets[symbolName]
		exports._ruleSets[symbolName] = rules
	})
}

// Extend `NSymbol` with methods for predefined sets of rules (e.g., verbs, stop words).
require('./ruleFunctions')