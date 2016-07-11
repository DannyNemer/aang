var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `NSymbol` module when searching the call stack for `NSymbol` instantiation file paths used in error reporting.
util.skipFileInLocationRetrieval()

/**
 * The map of the grammar's nonterminal symbols to rule arrays.
 *
 * @type {Object.<string, Object[]>}
 */
NSymbol._ruleSets = {}

/**
 * The map of `NSymbol` names to definition lines (file-path + line-number). For use in error messages.
 *
 * @type {Object.<string, string>}
 */
NSymbol._defLines = {}

/**
 * Creates a nonterminal symbol and adds it to the grammar.
 *
 * @constructor
 * @param {...string} [nameTokens] The tokens to hyphenate for the new nonterminal symbol name.
 */
function NSymbol() {
	// Check if constructor invoked without `new` keyword.
	if (!(this instanceof NSymbol)) {
		var newNSymbol = Object.create(NSymbol.prototype)
		NSymbol.apply(newNSymbol, arguments)
		return newNSymbol
	}

	// Hyphenate and format provided name tokens for the nonterminal symbol name.
	this.name = '[' + grammarUtil.formatStringForName(grammarUtil.hyphenate.apply(null, arguments)) + ']'

	// Check if `this.name` exists in `NSymbol._defLines` before appending it to `NSymbol._defLines`.
	if (grammarUtil.isDuplicateName(this.name, NSymbol._defLines, 'nonterminal symbol')) {
		throw new Error('Duplicate nonterminal symbol name')
	}

	// Save instantiation file path and line number for error reporting.
	NSymbol._defLines[this.name] = util.getModuleCallerLocation()

	// The array of rules `this.name` produces.
	this.rules = NSymbol._ruleSets[this.name] = []
}

/**
 * The nonterminal RHS `NSymbol` wrapper parameterization, for use in `nonterminalRuleSchema.rhs` with `NSymbol.prototype.newNonterminalRule()`, to specify properties specific to the wrapped RHS `symbol`.
 *
 * `acceptedTense` is for use when tense is semantically meaningless. For example, consider the following semantically identical queries:
 *   past: "repos I liked"
 *   present: "repos I like"
 * Both forms are accepted when input, but an insertion for the verb "like" inserts the verb in present tense.
 *
 * The following `grammaticalForm` values are supported:
 * • nom - The nominative case form, which conjugates pronouns used as the subject of a verb, created by
 *   `g.newPronoun()`. For example:
 *       "repos `[1-sg]` created" -> "repos I created"
 * • obj - The objective case form, which conjugates pronouns used as the object of a verb, created by
 *   `g.newPronoun()`. For example:
 *       "repos created by `[1-sg]`" -> "repos created by me"
 * • past - The simple past tense form, which conjugates verbs created by `g.newVerb()`. For example:
 *       "repos `[verb-like]` by me" -> "repos liked by me"
 * • infinitive - The bare infinitive form, which uses the present plural form that `personNumber` of 'pl'
 *   uses, which conjugates verbs created by `g.newVerb()`. For example:
 *       "people who `[have]` been ..." -> "people who have been ..."
 *       "people who `[verb-like]` ..." -> "people who like ..."
 *       "repos I `[verb-do]` not ..." -> "repos I do not ..."
 *
 * `pfsearch` uses `acceptedTense` and `grammaticalForm` to conjugate `text` that `symbol` immediately produces (i.e., `symbol` is a term sequence), but does not conjugate any subsequent rules.
 * • This limitation of only conjugating immediate child nodes and no further enforces a grammar design that conjugates as many insertion rules as possible during grammar generation, as opposed to leaving conjugation to parse-time by positioning the property higher in the parse tree.
 *
 * If both `acceptedTense` and `grammaticalForm` as defined, `acceptedTense` has priority when conjugating and falls back to `grammaticalForm` if input `tense` does not match.
 *
 * @typedef {Object} RHSSymbolWrapper
 * @property {NSymbol} symbol The RHS nonterminal symbol.
 * @property {string} [acceptedTense] The grammatical tense form for which the verb `symbol`, created with `g.newVerb()`, is accepted when input in that `tense` (defined on terminal rules), but the tense verb form is not enforced when not input in that tense nor for insertion rules that use `symbol`.
 * @property {string} [grammaticalForm] The grammatical form to which to conjugate the term sequence `symbol`.
 * @property {boolean} [noInsert] Specify `createInsertionRules` can not create insertion rules using `symbol` and the rule in which this `RHSSymbolWrapper` is provided.
 */
var rhsSymbolWrapperSchema = {
	symbol: { type: [ NSymbol ], required: true },
	acceptedTense: { values: [ 'past' ] },
	grammaticalForm: { values: [ 'nom', 'obj', 'past', 'infinitive' ] },
	noInsert: Boolean,
}

/**
 * Creates a nonterminal rule from `options` and appends it to `this.rules`.
 *
 * Each item in `options.rhs` must be one of the following:
 * 1. An `NSymbol` instance.
 * 2. An object of the form `RHSSymbolWrapper`.
 *
 * `options.rhs` can not contain more than two symbols; i.e., only permits unary and binary nonterminal rules.
 *
 * `options.transpositionCost` requires `options.rhs` be an ordered pair (i.e., binary).
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {(NSymbol|RHSSymbolWrapper)[]} options.rhs The RHS symbols this rule produces, as documented above.
 * @param {number} [options.transpositionCost] Specify `createEditRules` can create a transposition rule with this cost penalty that recognizes the reverse order of the ordered pair `options.rhs` in input and corrects their order when parsing (i.e., swaps the order of the display text the two RHS symbols produce).
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
var nonterminalRuleSchema = {
	rhs: { type: Array, arrayType: [ NSymbol, Object ], required: true },
	transpositionCost: Number,
}

NSymbol.prototype.addNonterminalRule = function (options) {
	if (util.illFormedOpts(nonterminalRuleSchema, options) || isIllFormedNonterminalRuleOptions(options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newNonterminalRule = {
		// Map `options.rhs` to the nonterminal symbol names for writing grammar to output.
		rhs: options.rhs.map(nonterminalRHSSymbolToName),
		// The `rhs` indexes for which to prevent `createInsertionRules` from creating insertion rules.
		rhsNoInsertionIndexes: getRHSNoInsertionIndexes(options.rhs),
		/**
		 * The grammatical properties `pfsearch` uses to conjugate the `text` objects the term sequences in `rhs` produce; i.e., `ruleProps.text` of immediate child nodes (post flattening via `flattenTermSequence`.
		 *
		 * Structured as a map of RHS index to the grammatical properties with which to conjugate the term sequence at that RHS index.
		 *
		 * Stores multiple conjugation properties in a single object for each `rhs` index. Allows `pfsearch` to atomically check if a `ruleProps` instance contains any grammatical conjugation properties at all, instead of separate checks for each possible conjugation property, before attempting to conjugate the child node's display text.
		 *
		 * If `gramProps` lacks any properties, `removeTempRulesAndProps` removes the empty object at the end of grammar generation.
		 *
		 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitution/synonym terminal symbols. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the overhead for additional `pfsearch` conjugation.
		 */
		gramProps: getGramProps(options.rhs),
		// Enable `createEditRules` to create a transposition rule with this cost penalty that recognizes the reverse order of the ordered pair `options.rhs` in input and corrects their order when parsing (i.e., swaps the order of the display text the two RHS symbols produce).
		transpositionCost: options.transpositionCost,
	}

	// Extend, validate, and append `newNonterminalRule` to `this.rules`.
	this._addRule(newNonterminalRule)

	return this
}

/**
 * Checks if `options`, which was passed to `NSymbol.prototype.addNonterminalRule()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `NSymbol.prototype.addNonterminalRule()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedNonterminalRuleOptions(options) {
	var rhs = options.rhs
	for (var r = 0, rhsLen = rhs.length; r < rhsLen; ++r) {
		var rhsSym = rhs[r]
		if (rhsSym.constructor === Object && util.illFormedOpts(rhsSymbolWrapperSchema, rhsSym)) {
			return true
		}
	}

	if (rhsLen > 2) {
		util.logErrorAndPath('Nonterminal rule has > 2 `rhs` symbols:', options)
		return true
	}

	if (options.transpositionCost !== undefined && rhsLen !== 2) {
		util.logErrorAndPath('Nonterminal rule with `transpositionCost` does not have two `rhs` symbols:', options)
		return true
	}

	return false
}

/**
 * Maps `rhsSym`, which was passed to `NSymbol.prototype.addNonterminalRule(options)` in `options.rhs`, to its nonterminal symbol name.
 *
 * For use by `NSymbol.prototype.addNonterminalRule()` to map the provided RHS nonterminal symbols to their string names for writing grammar to output.
 *
 * @private
 * @static
 * @param {NSymbol|RHSSymbolWrapper} rhsSym The RHS nonterminal symbol to map.
 * @returns {string} Returns the name of `rhsSym`.
 */
function nonterminalRHSSymbolToName(rhsSym) {
	if (rhsSym.constructor === NSymbol) {
		return rhsSym.name
	}

	if (rhsSym.constructor === Object) {
		return rhsSym.symbol.name
	}

	util.logErrorAndPath('Unrecognized RHS symbol type:', rhsSym)
	throw new Error('Unrecognized RHS symbol type')
}

/**
 * Creates an array of `rhs` indexes, from `RHSSymbolWrapper` instances in `rhs` with the property `noInsert` defined as `true`, that prevents `createInsertionRules` from creating insertion rules with the RHS symbols at those indexes.
 *
 * For use by `NSymbol.prototype.addNonterminalRule()` to assign to a new nonterminal rule.
 *
 * @private
 * @static
 * @param {(NSymbol|RHSSymbolWrapper)[]} rhs The nonterminal RHS array to iterate over.
 * @returns {number[]|undefined} Returns the array of RHS indexes for which to forbid insertions if any, else `undefined`.
 */
function getRHSNoInsertionIndexes(rhs) {
	var rhsNoInsertionIndexes = []
	for (var rhsIndex = 0, rhsLen = rhs.length; rhsIndex < rhsLen; ++rhsIndex) {
		var rhsSym = rhs[rhsIndex]
		if (rhsSym.constructor === Object && rhsSym.noInsert) {
			rhsNoInsertionIndexes.push(rhsIndex)
		}
	}

	if (rhsNoInsertionIndexes.length > 0) {
		return rhsNoInsertionIndexes
	}
}

/**
 * Creates the `gramProps` object from `RHSSymbolWrapper` instances in `rhs` for a new nonterminal rule, formatted for use by `pfsearch` and `conjugateText`.
 *
 * Structures the returned `gramProps` object as a map of RHS index to the grammatical properties with which to conjugate the term sequence at that RHS index.
 *
 * Consider the following example, which conjugates each term sequence in the rule's binary RHS as specified.
 *   gramProps: {
 *     0: {
 *       // Inflects the display text object produced by `rhs[0]` to its infinitive form.
 *       grammaticalForm: 'infinitive',
 *     },
 *     1: {
 *       // Accept the past tense form of `rhs[1]` if input is past tense, while defaulting to
 *       `grammaticalForm` infinitive form for insertions created from this rule.
 *       acceptedTense: 'past',
 *       // If `rhs[1]` is not input in past tense (as `acceptedTense` specifies), `grammaticalForm` inflects
 *       the display text object produced by `rhs[1]` to its infinitive form.
 *       grammaticalForm: 'infinitive',
 *     },
 *   }
 *
 * Defines conjugation properties for each RHS symbol separately, instead of using the same properties to conjugate text objects produced by either RHS symbol (as previously implemented), to enable different conjugation for two separate verbs in a binary RHS.
 * • For example, in the following rule, `pfsearch` would conjugate `[have]` to its infinitive form and `[verb-created]` to its past tense form: "(people who) `[have]` [verb-created]` (...)"
 *
 * Stores multiple conjugation properties in a single object for each `rhs` index. Allows `pfsearch` to atomically check if a `ruleProps` instance contains any grammatical conjugation properties at all, instead of separate checks for each possible conjugation property, before attempting to conjugate the child node's display text.
 *
 * Checks each `RHSSymbolWrapper` if the `symbol` produces conjugative `text` for each associated grammatical property. If not, throws an exception.
 * • The `RHSSymbolWrapper` grammatical properties can only conjugate `text` values `symbol` immediately produces (after term sequence flattening), and not further.
 *
 * At the end of grammar generation, `removeTempRulesAndProps` removes pairings within `gramProps` instances that map a RHS index to an empty object, and removes entire `gramProps` instances from rules if each RHS index maps to an empty object.
 *
 * Invoke this function after invoking `flattenNonterminalRHS(rhs)`.
 *
 * @private
 * @static
 * @param {(NSymbol|RHSSymbolWrapper)[]} rhs The nonterminal RHS array to iterate over.
 * @returns {Object} Returns the new `gramProps` object for assignment to a new nonterminal rule.
 */
function getGramProps(rhs) {
	var gramProps = {}
	for (var rhsIndex = 0, rhsLen = rhs.length; rhsIndex < rhsLen; ++rhsIndex) {
		// The grammatical properties with which to conjugate the term sequence at `rhs[rhsIndex]`.
		var symGramProps = gramProps[rhsIndex] = {}

		var rhsSym = rhs[rhsIndex]
		if (rhsSym.constructor === Object) {
			if (rhsSym.acceptedTense) {
				symGramProps.acceptedTense = rhsSym.acceptedTense

				// Check `rhsSym.symbol` produces `text` that `symGramProps.acceptedTense` can conjugate.
				if (isFutileGramProp(rhsSym.symbol.name, symGramProps.acceptedTense)) {
					printFutileGramPropError(rhsSym, 'acceptedTense')
					throw new Error('Ill-formed nonterminal grammatical property')
				}
			}

			if (rhsSym.grammaticalForm) {
				// Map 'infinitive' -> 'pl', to use the `pl` property on text objects created by `g.newVerb()`.
				symGramProps.form = rhsSym.grammaticalForm === 'infinitive' ? 'pl' : rhsSym.grammaticalForm

				// Check `rhsSym.symbol` produces `text` that `symGramProps.form` can conjugate.
				// Check after mapping 'infinitive' -> 'pl'.
				if (isFutileGramProp(rhsSym.symbol.name, symGramProps.form)) {
					printFutileGramPropError(rhsSym, 'grammaticalForm')
					throw new Error('Ill-formed nonterminal grammatical property')
				}
			}
		}
	}

	// If `gramProps` lacks any properties, `removeTempRulesAndProps` removes the empty object at the conclusion of grammar generation.
	return gramProps
}

/**
 * Prints an error message for when `rhsSymbolWrapper.symbol` produces no rules with a conjugative `text` object with a value for the grammatical property, `gramProp`.
 *
 * For use by `getGramProps()`.
 *
 * @private
 * @static
 * @param {RHSSymbolWrapper} rhsSymbolWrapper The RHS symbol wrapper with the futile `symbol`.
 * @param {string} gramProp The grammatical property name, defined on `RHSSymbolWrapper`.
 */
function printFutileGramPropError(rhsSymbolWrapper, gramProp) {
	util.logErrorAndPath('The RHS symbol,', util.stylize(rhsSymbolWrapper.symbol.name) + ', produces no rules with conjugative `text` applicable to the grammatical property', util.stylize(gramProp), '->', util.stylize(rhsSymbolWrapper[gramProp]) + ':', rhsSymbolWrapper)
}

/**
 * Checks if `rhsSym` produces no rules with a conjugative `text` object with a value for the grammatical form property, `gramProp`.
 *
 * Grammatical form properties, defined on the nonterminal rule `gramProps` object for a specific RHS symbol, can only conjugate `text` objects on term sequences that the RHS symbol (at the property's associated index) immediately produces after term sequence flattening (i.e., its child nodes).
 * • The `grammaticalForm` value 'infinitive' is mapped to 'pl' when creating the `gramProps` object, before invoking this function, because it uses the `pl` property on text objects that `g.newVerb()` creates.
 *
 * @private
 * @static
 * @param {string} rhsSym The RHS nonterminal symbol to check if produces conjugative `text` objects with a value for `gramProp`.
 * @param {string} gramProp The `gramProps` value for which to check if can conjugate `rhsSym`; e.g., 'past', 'obj'.
 * @returns {boolean} Returns `true` if `rhsSym` produces no conjugative `text` applicable to `gramProp`, else `false`.
 */
function isFutileGramProp(rhsSym, gramProp) {
	if (isUnrecognizedGramProp(gramProp)) {
		throw new Error('Unrecognized `gramProps` property')
	}

	var rhsRules = NSymbol._ruleSets[rhsSym]
	for (var r = 0, rulesLen = rhsRules.length; r < rulesLen; ++r) {
		var rhsRule = rhsRules[r]
		var ruleText = rhsRule.text

		if (ruleText) {
			if (ruleText.constructor === Array) {
				// `rhsRule` is a nonterminal multi-token substitution.
				if (ruleText.some(textItem => textItem[gramProp])) {
					// `gramProp` can conjugate a text object object in this text array.
					return false
				}
			} else if (ruleText[gramProp]) {
				// `gramProp` can conjugate this text object.
				return false
			}
		} else if (rhsRule.isTermSequence) {
			/**
			 * `rhsRule` is a non-substitution and non-edit term sequence, for which `flattenTermSequence` will merge the `text` values `rhsRule.rhs` produces and assign it to `rhsRule.text` (within reach of `gramProp`) for `pfsearch` to conjugate. For example:
			 *   `[github-create]` -> `[create]` -> "create", text: `{create-text-forms}`
			 */
			var subRHS = rhsRule.rhs
			for (var s = 0, subRHSLen = subRHS.length; s < subRHSLen; ++s) {
				if (!isFutileGramProp(subRHS[s], gramProp)) {
					// `gramProp` can conjugate a text object produced by the term sequence, `rhsRule`.
					return false
				}
			}
		}
	}

	return true
}

/**
 * Checks if `gramProp` is an unrecognized grammatical form property. If so, prints an error.
 *
 * For use by `isFutileGramProp()` to check its provided value.
 *
 * @private
 * @static
 * @param {string} gramProp The `gramProps` value from a new nonterminal rule.
 * @returns {boolean} Returns `true` if `gramProp` is ill-formed, else `false`.
 */
function isUnrecognizedGramProp(gramProp) {
	// The value 'infinitive' is used when defining nonterminal rules, but mapped to 'pl' for the output grammar because it uses the `pl` value on `text` objects.
	if (gramProp === 'infinitive') {
		util.logErrorAndPath('Grammatical form property', util.stylize('infinitive'), 'should have been mapped to', util.stylize('pl') + ':', util.stylize(gramProp))
		return true
	}

	if (gramProp !== 'pl' && rhsSymbolWrapperSchema.grammaticalForm.values.indexOf(gramProp) === -1) {
		util.logErrorAndPath('Unrecognized `gramProps` property:', util.stylize(gramProp))
		return true
	}

	return false
}

/**
 * Creates a terminal rule from `options` and appends it to `this.rules`.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {string} options.rhs The single-token terminal symbol this rule produces.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
var terminalRuleSchema = {
	rhs: { type: String, required: true },
}

NSymbol.prototype.addTerminalRule = function (options) {
	if (util.illFormedOpts(terminalRuleSchema, options)) {
		throw new Error('Ill-formed terminal rule')
	}

	var newTerminalRule = {
		// Specify this is a terminal rule (i.e., `options.rhs` does not produce rules).
		isTerminal: true,
		// Convert `options.rhs` to lowercase just as all input. This does not alter capitalization of `options.text`, even if identical to `options.rhs`.
		rhs: [ options.rhs.toLowerCase() ],
	}

	// Extend, validate, and append `newTerminalRule` to `this.rules`.
	this._addRule(newTerminalRule)

	return this
}

/**
 * Extends, validates, and appends `newRule` to `this.rules`.
 *
 * Extends `newRule` with `line` property, which is the rule's definition line, for use in error messages.
 *
 * Throws an exception if this `NSymbol` instance is either a completed term sequence or a binary symbol, which forbid further addition of rules.
 *
 * Throws an exception if this `NSymbol` already produces a rule with `rhs` identical to `newRule.rhs`.
 *
 * For use internally by `NSymbol.prototype.addNonterminalRule()` and `NSymbol.prototype.addTerminalRule()`.
 *
 * Note: This method mutates `newRule`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to append.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
NSymbol.prototype._addRule = function (newRule) {
	if (this.isTermSequence) {
		util.logErrorAndPath('Attempting to add a rule to the completed term sequence,', util.stylize(this.name) + ':', newRule)
		throw new Error('Adding rule to completed term sequence')
	}

	if (this.isBinarySymbol) {
		util.logErrorAndPath('Attempting to add a rule to the completed binary symbol,', util.stylize(this.name) + ':', newRule)
		throw new Error('Adding rule to completed binary symbol')
	}

	// Alert if this `NSymbol` already produces a rule with identical `rhs`.
	if (this.rules.some(existingRule => util.arraysEqual(existingRule.rhs, newRule.rhs))) {
		util.logErrorAndPath('Duplicate rule:', grammarUtil.stringifyRule(this.name, newRule))
		throw new Error('Duplicate rule')
	}

	// Save rule definition line (file-path + line-number), for use in error messages. Excluded from output grammar.
	newRule.line = util.getModuleCallerLocation()

	// Append `newRule`.
	this.rules.push(newRule)

	return this
}

/**
 * Diversifies the costs of the grammar's non-edit rules by incrementing the cost of each nonterminal symbol's rules by an increasing epsilon value. This ensures no nonterminal symbol produces multiple non-edit rules of identical cost.
 *
 * The cost modification introduces entropy to the grammar via multiplicity, which significantly reduces the probability of a given parse node producing multiple subnodes with identical cost or identical cost heuristic. This enables consistent determination of the cheapest path for `pfsearch` to follow or use in its minimum cost heuristic calculations. Otherwise, `pfsearch` would choose whichever path/subnode is arbitrarily first.
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
			if (rule.insertedSymIdx !== undefined || rule.isTransposition) {
				util.logError('`NSymbol.diversifyRuleCosts()` invoked invoked after adding edit-rules to grammar:', rule)
				throw new Error('Grammar generation out of sequence')
			}

			rule.cost += EPSILON * r
		}
	})
}

/**
 * Sorts the grammar's nonterminal symbols alphabetically and each symbols' rules by increasing cost.
 *
 * It is essential to sort rules by increasing cost so that when `StateTable` groups `ruleProps` instances for edit rules with the same RHS symbols, the cheapest rule is the first `ruleProps` instance in the set. This enables `calcHeuristicCosts` to determine the minimum cost for these `ruleProps` sets by checking the cost of the first object in each set.
 *
 * `sortGrammar()` in `grammar` invokes this method at the end of grammar generation.
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