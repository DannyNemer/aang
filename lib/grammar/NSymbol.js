var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')


// The map of the grammar's nonterminal symbols to rules.
NSymbol._ruleSets = {}
// The map of `NSymbol` names to definition lines (file-path + line-number). Used for error reporting.
NSymbol._defLines = {}

/**
 * The map of `NSymbol` names to the corresponding `NSymbol` instance.
 *
 * @private
 * @type {Object.<string, NSymbol>}
 */
var _NSymbolNames = {}

/**
 * The `NSymbol` constructor, which adds a new nonterminal symbol to the grammar.
 *
 * @constructor
 * @param {...string} [nameTokens] The tokens to hyphenate for the new `NSymbol`'s name.
 */
function NSymbol() {
	// Check if constructor invoked without `new` keyword.
	if (!(this instanceof NSymbol)) {
		var newNSymbol = Object.create(NSymbol.prototype)
		NSymbol.apply(newNSymbol, arguments)
		return newNSymbol
	}

	this.name = NSymbol.genName.apply(null, arguments)

	if (grammarUtil.isDuplicateName(this.name, NSymbol._defLines, 'symbol')) {
		throw new Error('Duplicate symbol name')
	}

	this.rules = NSymbol._ruleSets[this.name] = []

	_NSymbolNames[this.name] = this

	// Save instantiation file path and line number for error reporting.
	NSymbol._defLines[this.name] = util.getModuleCallerPathAndLineNumber()
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
	return '[' + grammarUtil.formatStringForName(grammarUtil.hyphenate.apply(null, arguments)) + ']'
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
		util.logErrorAndPath('Duplicate rule:', grammarUtil.stringifyRule(this.name, newRule))
		throw new Error('Duplicate rule')
	}

	// Temporarily save rule definition line for inclusion in error console messages.
	newRule.line = util.getModuleCallerPathAndLineNumber()

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
	// The array of `NSymbol`s, `NSymbol` names (strings), and/or nested arrays of RHS symbol for new binary rules to recursively create. These sub-rules, however, can only contain a RHS and no other rule properties.
	rhs: { type: Array, arrayType: [ NSymbol, String, Array ] },
	// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
	noInsertionIndexes: { type: Array, arrayType: Number },
	// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
	noInsert: Boolean,
	// The LHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: Array,
	// Enable creation of transposition rules which recognizes the swap of this rule's `rhs` symbols and swaps them back when parsing. Requires `rhs` to contain two `NSymbol`s.
	transpositionCost: Number,
	// The grammatical forms (case, tense) for which to conjugate terminal rules `options.rhs` produces. E.g., "me" vs. "I" (case), "like" vs. "liked" (tense). `pfsearch` uses this property to only conjugate the immediate rules `rhs` produces, but can not conjugate any further rules; the properties can only conjugate the display text, `ruleProps.text`, of immediate child nodes.
	grammaticalForm: { values: [ 'nom', 'obj', 'past' ] },
	// The grammatical tense for which forms of terminal rules `options.rhs` produces are accepted when input, but not enforced by default. E.g., "(repos I) liked" (past) and "(repos I) like" are both accepted, but defaults to "like". Like `options.grammaticalForm`, `pfsearch` uses this property to only conjugate the immediate rules `rhs` produces, but can not conjugate any further rules.
	acceptedTense: { values: [ 'past' ] },
	// The grammatical person-number for which to conjugate terminal rules either `options.rhs` produces or which follow in successive branches. E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ] },
	// The grammatical person-number for anaphoric rules with which to match to an antecedent semantic of the same person-number. E.g., "his/her" refers to semantics of third-person-singular representations.
	anaphoraPersonNumber: { values: [ 'threeSg', 'threePl' ] },
}

NSymbol.prototype.newNonterminalRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	if (options.rhs.length > 2) {
		util.logErrorAndPath('Nonterminal rule has > 2 RHS symbols:', options)
		throw new Error('Ill-formed nonterminal rule')
	}

	if (options.noInsertionIndexes && options.noInsertionIndexes.some(idx => options.rhs[idx] === undefined)) {
		util.logErrorAndPath('\'noInsertionIndexes\' contains an index for which there is no RHS symbol:', options)
		throw new Error('Ill-formed nonterminal rule')
	}

	var newRule = {
		// Map the RHS symbols to its names (as strings). Recursively create new binary rules for any nested arrays.
		rhs: options.rhs.map(this.symToName),
		// Prevent insertion rules using this rule and the RHS symbols at the specified indexes.
		noInsertionIndexes: options.noInsertionIndexes,
		// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
		noInsert: options.noInsert,
		// The grammatical properties used to conjugate the immediate rules that `newRule.rhs` produces, but can not conjugate any further rules. `pfsearch` uses `gramProps` to only conjugate the display text, `ruleProps.text`, of immediate child nodes.
		// Store multiple conjugation properties in a single object, `gramProps`, so that `pfsearch` can check if a rule contains any grammatical conjugation properties at all, instead of checking for the existence of each possible conjugation properties, before attempting to conjugate the child node's display text.
		// If `gramProps` has lacks any defined properties, the empty object is excluded from the output grammar.
		// Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
		gramProps: {
			form: options.grammaticalForm,
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
			util.logPathAndObject(grammarUtil.stringifyRule(this.name, newRule))
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
		// The rule's semantic can be reduced and have its RHS produce additional semantics, reduced or not. If so, `pfsearch` will property the rule's reduced semantic with the semantic(s) its RHS produces, to form a semantic array of RHS semantic arguments.
		newRule.semanticIsReduced = semantic.isReduced(options.semantic)
		// Use the rule's semantic cost as the rule's cost, which `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation.
		newRule.cost = semantic.sumCosts(options.semantic)
	} else {
		// No rule cost, though `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation.
		newRule.cost = 0
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
 * Maps `rhsSym`, which is either an `NSymbol`, a string name of an `NSymbol`, or an array of either, to its name. For use in mapping the RHS nonterminal symbols in a rule's definition (e.g., passed to `NSymbol.prototype.newNonterminalRule()`) to strings for writing the output grammar.
 *
 * If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not.
 *
 * If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary rule and returns the resulting `NSymbol` name.
 *
 * @memberOf NSymbol
 * @param {NSymbol|string|(NSymbol|string)[]} rhsSym The RHS symbol to map, passed in an array of RHS symbols for a new nonterminal rule.
 * @returns {string} Returns the name of `rhsSym`.
 */
NSymbol.prototype.symToName = function (rhsSym) {
	// If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not.
	if (rhsSym.constructor === String) {
		if (!NSymbol._ruleSets.hasOwnProperty(rhsSym)) {
			util.logError('RHS symbol does not exist:', util.stylize(rhsSym))
			util.logPathAndObject('\n' + grammarUtil.stringifyRule(this.name, options))
			throw new Error('Ill-formed nonterminal rule')
		}

		return rhsSym
	}

	// If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary rule and returns the resulting `NSymbol` name.
	if (rhsSym.constructor === Array) {
		return NSymbol.newBinaryRule({ rhs: rhsSym }).name
	}

	// If `rhsSym` is an `NSymbol`, returns its name.
	return rhsSym.name
}

/**
 * Checks if `rhs` produces at least one rule with a `text` value for the grammatical property, `gramProp`.
 *
 * @static
 * @memberOf NSymbol
 * @param {string[]} rhs The RHS symbols to check if produces a rule with a `text` value for `gramProp`.
 * @param {string} gramProp The grammatical property name to check for (e.g., 'past', 'obj').
 * @returns {boolean} Returns `true` if `rhs` produces a rule that accepts `gramProp`, else `false`.
 */
NSymbol.rhsAcceptsGramProp = function (rhs, gramProp) {
	for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
		var rhsSym = rhs[s]
		var rhsRules = NSymbol._ruleSets[rhsSym]

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

	// Check RHS has two RHS symbols.
	if (options.rhs.length !== 2) {
		util.logErrorAndPath('Binary rules does not have 2 RHS symbols:', options.rhs)
		throw new Error('Ill-formed binary rule')
	}

	// RHS can contain `NSymbol`s and/or nested arrays of RHS for new binary rules to recursively create.
	options.rhs = options.rhs.map(function (sym) {
		if (sym.constructor === Array) {
			// `sym` is a nested RHS for a new binary rule. Recursively create the new rule and replace the array with its new `NSymbol`.
			return NSymbol.newBinaryRule({ rhs: sym })
		}

		return sym
	})

	// Create a new `NSymbol` named by the concatenation of the two RHS symbols.
	var symbolNameTokens = options.rhs.map(function (sym, i) {
		var name = sym.constructor === NSymbol ? sym.name : sym

		// Specify in name if insertions are forbidden.
		if (options.noInsertionIndexes && options.noInsertionIndexes.indexOf(i) !== -1) {
			name = grammarUtil.hyphenate(name, 'no', 'insert')
		}

		return name
	})

	return NSymbol.apply(null, symbolNameTokens).addRule(options)
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
	// Specify this rule substitutes the input terminal symbol as display text. For use by `splitRegexTerminalSymbols` to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the `text` from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols).
	isSubstitution: Boolean,
	// Specify this terminal symbol is a stop-word and does not produce any text when `rhs` is input. For use by `splitRegexTerminalSymbols` just as `options.isSubstitution`.
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

	// Prevent terminal rules with placeholder symbols from being assigned a reduced (RHS) semantic because placeholder symbols generate and use a (reduced) semantic argument from input.
	if (options.isPlaceholder && options.semantic && semantic.isReduced(options.semantic)) {
		util.logErrorAndPath('Placeholder symbols has reduced (RHS) semantic:', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Forbid semantics on `<empty>`.
	if (options.rhs === g.emptySymbol && options.semantic) {
		util.logErrorAndPath('Rule with `<empty>` has semantic:', options)
		throw new Error('Ill-formed terminal rule')
	}

	// Require semantics on terminal rules to be completely reduced (i.e., a RHS semantic), except placeholder symbols.
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
		// `splitRegexTerminalSymbols` uses the following two properties to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the display text, `text`, from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols). I.e., `pfsearch` only needs (and uses) `rhsDoesNotProduceText`. Both are excluded in the output grammar.
		isSubstitution: options.isSubstitution,
		isStopWord: options.isStopWord,
	}

	// The cost penalty added to this rule's cost.
	var costPenalty = options.costPenalty === undefined ? 0 : options.costPenalty

	if (options.semantic) {
		// Assign semantic used in semantic trees that correspond to parse tree that contain this rule.
		newRule.semantic = options.semantic.sort(semantic.compare)
		// Specify if semantic is reduced. If not, then the  terminal symbol is a placeholder and will create a semantic argument from input.
		newRule.semanticIsReduced = semantic.isReduced(options.semantic)
		// Use `costPenalty` and the rule's semantic cost as the rule's cost, which `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation.
		newRule.cost = semantic.sumCosts(options.semantic) + costPenalty
	} else {
		// Use `costPenalty`, if any, as rule cost, which `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation.
		newRule.cost = costPenalty
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
		newRule.restrictInsertion = options.restrictInsertion
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
 * Diversifies the costs of the grammar's non-edit rules by incrementing the cost of each nonterminal symbol's rules by an increasing epsilon value. This ensures no nonterminal symbol produces multiple non-edit rules of identical cost.
 *
 * The cost modification introduces entropy to the grammar via multiplicity, which significantly reduces the probability of a given parse node producing multiple sub-nodes with identical cost or identical cost heuristic. This enables consistent determination of the cheapest path for `pfsearch` to follow or use in its minimum cost heuristic calculations. Otherwise, `pfsearch` would choose whichever path/subnode is arbitrarily first.
 *
 * Invoke this method after invoking `removeUnusedComponents`, which removes unused rules from the grammar, and before adding edit-rules in `createEditRules`. Diversify the costs after removing the unused rules, instead of incrementing each rule's cost upon each `NSymbol.prototype.addRule()` invocation, to evenly distribute the increasing epsilon value for each nonterminal symbol's rules. Though edit-rules are excluded from this operation, they will inherit the diversified costs of their base rules and not lessen the rule cost multiplicity.
 *
 * @static
 * @memberOf NSymbol
 */
NSymbol.diversifyRuleCosts = function () {
	// The arbitrarily small positive quantity with which to increment each rule's cost by an increasing value.
	var EPSILON = 1e-7

	grammarUtil.forEachRuleSet(NSymbol._ruleSets, function (rules) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Check this method was invoked before adding edit-rules.
			if (rule.insertionIdx !== undefined || rule.isTransposition) {
				var errMsg = util.colors.cyan('NSymbol.diversifyRuleCosts()') + ' invoked after adding edit-rules to the grammar'
				util.logError(errMsg + ':', rule)
				throw errMsg
			}

			rule.cost += EPSILON * r
		}
	})
}

/**
 * Sorts nonterminal symbols alphabetically and each symbols' rules by increasing cost.
 *
 * It is essential to sort rules by increasing cost so that when `StateTable` groups `ruleProps` together for edit rules with the same RHS symbols, the cheapest rules is the first `ruleProp` in the set. This enables `calcHeuristicCosts` to determine the minimum cost for these sets of `ruleProps` by checking the cost of the first object in each set.
 *
 * `grammar.sortGrammar()` invokes this method at the end of grammar generation.
 *
 * @static
 * @memberOf NSymbol
 */
NSymbol.sortRules = function () {
	Object.keys(NSymbol._ruleSets).sort().forEach(function (symbolName) {
		// Sort rules by increasing cost.
		var rules = NSymbol._ruleSets[symbolName].sort(function (ruleA, ruleB) {
			return ruleA.cost - ruleB.cost
		})

		// Sort nonterminal symbols alphabetically.
		delete NSymbol._ruleSets[symbolName]
		NSymbol._ruleSets[symbolName] = rules
	})
}

// Export `NSymbol`.
module.exports = NSymbol

// Extend `NSymbol` with methods for predefined sets of rules (e.g., verbs, stop words).
require('./ruleMethods')