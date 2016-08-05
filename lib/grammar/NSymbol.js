var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')


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
 * The map of `NSymbol` names to the respective `NSymbol` instance.
 *
 * @private
 * @type {Object.<string, NSymbol>}
 */
var _NSymbols = {}

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

	_NSymbols[this.name] = this
}

/**
 * Adds a new rule to the grammar with this `NSymbol` as the LHS symbol.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {Object} [options.isTerminal=false] Specify the rule is terminal.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
NSymbol.prototype.addRule = function (options) {
	if (this.isTermSequence) {
		util.logErrorAndPath('Attempting to add a rule to a completed term sequence:', options)
		throw new Error('Adding rule to completed term sequence')
	}

	if (this.isBinarySymbol) {
		util.logErrorAndPath('Attempting to add a rule to a binary symbol (i.e., limited to a single binary rule):', options)
		throw new Error('Adding rule to binary symbol')
	}

	var newRule = options.isTerminal ? this._newTerminalRule(options) : this._newNonterminalRule(options)

	// Alert if this `NSymbol` already produces a rule with identical `rhs`.
	if (this.rules.some(existingRule => util.arraysEqual(existingRule.rhs, newRule.rhs))) {
		util.logErrorAndPath('Duplicate rule:', grammarUtil.stringifyRule(this.name, newRule))
		throw new Error('Duplicate rule')
	}

	// Save rule definition line for inclusion in error console messages. Excluded from output grammar.
	newRule.line = util.getModuleCallerLocation()

	this.rules.push(newRule)

	return this
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
 *     "repos `[1-sg]` created" -> "repos I created"
 * • obj - The objective case form, which conjugates pronouns used as the object of a verb, created by
 *   `g.newPronoun()`. For example:
 *     "repos created by `[1-sg]`" -> "repos created by me"
 * • past - The simple past tense form, which conjugates verbs created by `g.newVerb()` and
 *   `g.newTenseVerb()`. For example:
 *     "repos `[verb-like]` by me" -> "repos liked by me"
 * • infinitive - The bare infinitive form, which uses the present plural form that `personNumber` of 'pl'
 *   uses, which conjugates verbs created by `g.newVerb()`. For example:
 *     "people who `[have]` been ..." -> "people who have been ..."
 *     "people who `[verb-like]` ..." -> "people who like ..."
 *     "repos I `[verb-do]` not ..." -> "repos I do not ..."
 * • participle - The participle form, which conjugates verbs created in `beVerb`. For example, used in
 *   compound verb forms:
 *     "issues I have `[be-past]` ..." -> "issues I have been ..."
 *
 * `pfsearch` uses `acceptedTense` and `grammaticalForm` to conjugate `text` that `symbol` immediately produces (i.e., `symbol` is a term sequence), but does not conjugate any subsequent rules.
 * • This limitation of only conjugating immediate child nodes and no further enforces a grammar design that conjugates as many insertion rules as possible during grammar generation, as opposed to leaving conjugation to parse-time by positioning the property higher in the parse tree.
 *
 * If both `acceptedTense` and `grammaticalForm` as defined, `acceptedTense` has priority when conjugating and falls back to `grammaticalForm` if input `tense` does not match.
 *
 * @typedef {Object} RHSSymbolWrapper
 * @property {NSymbol|(NSymbol|RHSSymbolWrapper|Array)[]} symbol The RHS nonterminal symbol.
 * @property {string} [acceptedTense] The grammatical tense form for which the verb `symbol`, created with `g.newVerb()` or `g.newTenseVerb()`, is accepted when input in that `tense` (defined on terminal rules), but the tense verb form is not enforced when not input in that tense nor for insertion rules that use `symbol`.
 * @property {string} [grammaticalForm] The grammatical form to which to conjugate the term sequence `symbol`.
 * @property {boolean} [noInsert] Specify `createInsertionRules` can not create insertion rules using `symbol` and the rule in which this `RHSSymbolWrapper` is provided.
 */
var rhsSymbolWrapperSchema = {
	symbol: { type: [ NSymbol, Array ], required: true },
	acceptedTense: { values: [ 'past' ] },
	grammaticalForm: { values: [ 'nom', 'obj', 'past', 'infinitive', 'participle' ] },
	noInsert: Boolean,
}

/**
 * Creates a new nonterminal rule to assign to this `NSymbol`.
 *
 * Each item in `options.rhs` must be one of the following:
 * 1. An `NSymbol` instance.
 * 2. An object of the form `RHSSymbolWrapper`.
 * 3. A nested ordered pair containing any combination of #1 or #2 from which to recursively create a new binary symbol and rule.
 *   • If an existing binary symbol exists that produces the provided ordered pair, that symbol is used instead of creating a duplicate.
 * 4. A string name of an existing `NSymbol`. For use when passing an existing rule's `rhs` for a new rule, as in `user.js`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {(NSymbol|RHSSymbolWrapper|Array|string)[]} options.rhs The RHS symbols this rule produces, as documented above.
 * @param {boolean} [options.noInsert] Specify `createInsertionRules` can not create insertion rules that insert `options.rhs` entirely, but can create rules that insert one of two symbols in `options.rhs`.
 * @param {number} [options.transpositionCost] Specify `createEditRules` can create a transposition rule with this cost penalty that recognizes the reverse order of the ordered pair `options.rhs` in input, and corrects the order of the display text the two RHS symbols produce when parsing.
 * @param {Object[]} [options.semantic] The semantic from which a semantic tree is constructed in association with parse trees constructed with this rule.
 * @param {string} [options.personNumber] The grammatical person-number for which to conjugate verbs that either `options.rhs` produces or follow this rule within the same parse subtree.
 * @param {string} [options.anaphoraPersonNumber] The grammatical person-number for anaphoric rules with which to match and copy an antecedent semantic of the same person-number. E.g., "his|her" refers to semantics of third-person-singular representations.
 * @param {Object|string|(Object|string)[]} [options.text] The substitution display text that is used in place of any text `options.rhs` and its ancestors generate.
 * @param {number} [options.costPenalty] The rule's cost penalty. For use with substitution `options.text`.
 * @returns {Object} Returns the new nonterminal rule.
 */
var nonterminalRuleSchema = {
	rhs: { type: Array, arrayType: [ NSymbol, Object, Array, String ], required: true },
	noInsert: Boolean,
	transpositionCost: Number,
	semantic: { type: Array, arrayType: Object },
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ] },
	anaphoraPersonNumber: { values: [ 'threeSg', 'threePl' ] },
	text: [ String, Object, Array ],
	costPenalty: Number,
}

NSymbol.prototype._newNonterminalRule = function (options) {
	if (util.illFormedOpts(nonterminalRuleSchema, options) || isIllFormedNonterminalRuleOptions(options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	// Recursively converts instances of nested ordered pairs in `options.rhs` to binary symbols.
	flattenNonterminalRHS(options.rhs)

	var newRule = {
		// Map `options.rhs` to the nonterminal symbol names for writing grammar to output.
		rhs: options.rhs.map(nonterminalRHSSymbolToName),
		// The `rhs` indexes for which to prevent `createInsertionRules` from creating insertion rules.
		noInsertionIndexes: getRHSNoInsertionIndexes(options.rhs),
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
		// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
		noInsert: options.noInsert,
		personNumber: options.personNumber,
		anaphoraPersonNumber: options.anaphoraPersonNumber,
	}

	/**
	 * Assigns the following term sequence properties to `newRule`:
	 * • {boolean} [newRule.isTermSequence] - Defines `true` if the `newRule.rhs` produces only term sequences, which instructs `flattenTermSequence` to merge the `text` values produced by `newRule.rhs`, assign the merged `text` to this rule's parse node, and prevent `pfsearch` from traversing past this rule's node.
	 * • {Object|string|(Object|string)[]} [newRule.text] - If `newRule.isTermSequence` is `true`, assigns `options.text` to `newRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of text its RHS produces.
	 */
	assignTermSequence(newRule, options)

	/**
	 * Assigns the following semantic and cost properties to `newRule`:
	 * • {Object} [newRule.semantic] - The semantic used in semantic trees that correspond to parse trees that contain this rule.
	 * • {boolean} [newRule.semanticIsReduced] - Specify if `newRule.semantic` is reduced, else semantic is to accept other semantics as arguments.
	 * • {number} newRule.cost - The rule cost, which includes the cost of `newRule.semantic` and `options.costPenalty`, if any.
	 *
	 * Invoke after `assignTermSequence()` because this function checks for `newRule` properties which `assignTermSequence()` assigns.
	 */
	assignSemanticAndCost(newRule, options)

	return newRule
}

/**
 * Checks if `options`, which was passed to `NSymbol.prototype._newNonterminalRule()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `NSymbol.prototype._newNonterminalRule()` options object to inspect.
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
 * Recursively converts instances of nested ordered pairs in `rhs` to binary symbols.
 *
 * Note: This function mutates `rhs`.
 *
 * @private
 * @static
 * @param {(NSymbol|RHSSymbolWrapper|Array|string)[]} rhs The nonterminal RHS to flatten.
 * @returns {rhs} Returns `rhs` flattened.
 */
function flattenNonterminalRHS(rhs) {
	for (var rhsIndex = 0, rhsLen = rhs.length; rhsIndex < rhsLen; ++rhsIndex) {
		var rhsSym = rhs[rhsIndex]

		/**
		 * If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary `NSymbol`.
		 *
		 * Suppress `NSymbol.newBinaryRule()` warning for duplicate binary rule definition, which uses an existing, identical binary rule if any, because the nested-pair-shorthand is limited to only RHS symbols, suggesting any duplicate definition is not an accident and simply an extension of the convenience the shorthand offers.
		 */
		if (rhsSym.constructor === Array) {
			rhs[rhsIndex] = NSymbol.newBinaryRule({ rhs: rhsSym }, true)
		} else if (rhsSym.constructor === Object && rhsSym.symbol.constructor === Array) {
			rhsSym.symbol = NSymbol.newBinaryRule({ rhs: rhsSym.symbol }, true)
		}
	}

	return rhs
}

/**
 * Maps `rhsSym`, which was passed to `NSymbol.prototype.addNonterminalRule(options)` in `options.rhs`, to its nonterminal symbol name.
 *
 * For use by `NSymbol.prototype._newNonterminalRule()` to map the provided RHS nonterminal symbols to their string names for writing grammar to output.
 *
 * If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not. Accepts the string `NSymbol` names for use in `splitRegexTerminalSymbols`.
 *
 * @private
 * @static
 * @param {NSymbol|RHSSymbolWrapper|string} rhsSym The RHS nonterminal symbol to map.
 * @returns {string} Returns the name of `rhsSym`.
 */
function nonterminalRHSSymbolToName(rhsSym) {
	// If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not.
	if (rhsSym.constructor === String) {
		if (!NSymbol._ruleSets.hasOwnProperty(rhsSym)) {
			util.logErrorAndPath('RHS nonterminal symbol does not exist:', util.stylize(rhsSym))
			throw new Error('Unrecognized RHS nonterminal symbol name')
		}

		return rhsSym
	}

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
 * @param {(NSymbol|RHSSymbolWrapper|string)[]} rhs The nonterminal RHS array to iterate over.
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
				// Map 'infinitive' -> 'pl' to use the `pl` property on text objects created by `g.newVerb()` or `g.newTenseVerb()`.
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
 * • The `grammaticalForm` value 'infinitive' is mapped to 'pl' when creating the `gramProps` object, before invoking this function, because it uses the `pl` property on text objects that `g.newVerb()` and `g.newTenseVerb()` creates.
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
		util.logErrorAndPath('Unrecognized `gramProps` property:', util.stylize(gramProp), '\n  Acceptable `gramProps` properties:', util.without(rhsSymbolWrapperSchema.grammaticalForm.values, 'infinitive').map(util.unary(util.stylize)).join(', '))
		return true
	}

	return false
}

/**
 * Generates an array of `rhs` indexes to instruct `createInsertionRules` to prevent the creation of insertion rules.
 *
 * Invoke this function after invoking `flattenNonterminalRHS(rhs)`.
 *
 * @private
 * @static
 * @param {(NSymbol|RHSSymbolWrapper|string)[]} rhs The nonterminal RHS array to iterate over.
 * @returns {number[]|undefined} Returns the array of RHS indexes to forbid insertions if any, else `undefined`.
 */
function getRHSNoInsertionIndexes(rhs) {
	var noInsertionIndexes = []
	for (var rhsIndex = 0, rhsLen = rhs.length; rhsIndex < rhsLen; ++rhsIndex) {
		var rhsSym = rhs[rhsIndex]

		if (rhsSym.constructor === Object && rhsSym.noInsert) {
			noInsertionIndexes.push(rhsIndex)
		}
	}

	if (noInsertionIndexes.length > 0) {
		return noInsertionIndexes
	}
}

/**
 * Assigns the semantic and cost properties to `newRule` using `ruleOptions`. For use by `NSymbol.prototype._newNonterminalRule()` and `NSymbol.prototype._newTerminalRule()`.
 *
 * Assigns the following semantic and cost properties to `newRule`:
 * • {Object} [newRule.semantic] - The semantic used in semantic trees that correspond to parse trees that contain this rule.
 * • {boolean} [newRule.semanticIsReduced] - Specify if `newRule.semantic` is reduced, else semantic is to accept other semantics as arguments.
 * • {number} newRule.cost - The rule cost, which includes the cost of `newRule.semantic` and `ruleOptions.costPenalty`, if any.
 *
 * In `NSymbol.prototype._newNonterminalRule()`, invoke this function after invoking `assignTermSequence()`, which assigns term sequence properties to `newRule` which this function checks.
 *
 * Note: This function mutates `newRule`.
 *
 * @private
 * @static
 * @param {Object} newRule The new rule, terminal or nonterminal, which to assign the semantic and cost properties.
 * @param {Object} ruleOptions The rule options object passed to `NSymbol.prototype._newNonterminalRule()` or `NSymbol.prototype._newTerminalRule()`.
 * @returns {Object} Returns `newRule`.
 */
function assignSemanticAndCost(newRule, ruleOptions) {
	// The cost penalty added to this rule's cost.
	var costPenalty = 0
	if (ruleOptions.costPenalty !== undefined) {
		costPenalty = ruleOptions.costPenalty

		// Restrict cost penalties terminal rules and non-terminal substitutions.
		if (!ruleOptions.isTerminal && !newRule.text) {
			util.logErrorAndPath('`costPenalty` used on non-substitution nonterminal term sequence:', ruleOptions)
			throw new Error('Ill-formed nonterminal rule')
		}
	}

	if (ruleOptions.semantic) {
		if (!ruleOptions.isTerminal && ruleOptions.anaphoraPersonNumber) {
			util.logErrorAndPath('Anaphoric rule has semantic:', ruleOptions)
			throw new Error('Ill-formed nonterminal rule')
		}

		// Assign the semantic used in semantic trees that correspond to parse trees that contain this rule.
		newRule.semantic = ruleOptions.semantic.sort(semantic.compare)
		/**
		 * Specify if `newRule.semantic` is reduced, else semantic is to accept other semantics as arguments.
		 *
		 * For nonterminal rules, the rule's semantic may be reduced and have `newRule.rhs` produce additional semantics, reduced or not. If so, `pfsearch` will merge this rule's reduced semantic (`newRule.semantic`) with the semantic(s) `newRule.rhs` produces, forming a semantic array of RHS semantic arguments.
		 */
		newRule.semanticIsReduced = semantic.isReduced(ruleOptions.semantic)
		// Use `costPenalty` and the rule's semantic cost as the rule's cost, which `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation. `pfsearch` uses the cumulative cost of parse trees to rank the k-best trees.
		newRule.cost = semantic.sumCosts(ruleOptions.semantic) + costPenalty
	} else {
		// Use `costPenalty`, if any (else, cost of 0), as rule cost, which `NSymbol.diversifyRuleCosts()` later tweaks to ensure cost variation.
		// `NSymbol.diversifyRuleCosts()` occurs after grammar generation to ignore removed, unused rules when assigning the rule epsilon cost value.
		newRule.cost = costPenalty
	}
}

/**
 * Assigns term sequence properties to `newNonterminalRule` using `ruleOptions`. For use by `NSymbol.prototype._newNonterminalRule()`.
 *
 * Assigns the following term sequence properties to `newNonterminalRule`:
 * • {boolean} [newNonterminalRule.isTermSequence] - Defines `true` if the `newNonterminalRule.rhs` produces only term sequences, which instructs `flattenTermSequence` to merge the `text` values produced by `newNonterminalRule.rhs`, assign the merged `text` to this rule's parse node, and prevent `pfsearch` from traversing past this rule's node.
 * • {Object|string|(Object|string)[]} [newNonterminalRule.text] - If `newNonterminalRule.isTermSequence` is `true`, assigns `options.text` to `newNonterminalRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of text its RHS produces.
 *
 * Note: This function mutates `newNonterminalRule`.
 *
 * @private
 * @static
 * @param {Object} newNonterminalRule The new nonterminal rule which to assign term sequence properties.
 * @param {Object} ruleOptions The rule options object passed to `NSymbol.prototype._newNonterminalRule()`.
 * @returns {Object} Returns `newNonterminalRule`.
 */
function assignTermSequence(newNonterminalRule, ruleOptions) {
	// Check if `ruleOptions.rhs` contains only terminal rule sets (e.g., `g.newVerb()`, `g.newPronoun()`) or terminal rule sequences (e.g., `g.newTermSequence()`).
	var rhs = ruleOptions.rhs
	if (rhs.every(rhsSym => (rhsSym.constructor === Object ? rhsSym.symbol : rhsSym).isTermSequence)) {
		/**
		 * Forbid a rule's RHS from containing multiple verbs, each of which produces a conjugative `text` object that the rule can not conjugate.
		 * • If a RHS symbol is a conjugative verb, checks if that symbol is an instance of `RHSSymbolWrapper` with a `grammaticalForm` value that can conjugate the `text` object the verb produces.
		 *
		 * Prevents `flattenTermSequence` from merging two conjugative verb `text` objects, each of which can have an input `tense`, and passing the merged text array up to a parent node without knowing to which text object each input `tense` applies.
		 *
		 * It is okay if `newNonterminalRule` can only conjugate one verb and not the other, because it still prevents two unused instances of `tense` with two verb conjugative `text` objects.
		 *
		 * Whether this rule has `acceptedTense` is immaterial because `grammaticalForm` will always conjugate when `acceptedTense` is absent. If `acceptedTense` is present, `pfsearch` will attempt to use its value to conjugate the associated `RHSSymbolWrapper.symbol` term sequence.
		 */
		if (rhs.length > 1 && rhs.every(function (rhsSym) {
					var term = rhsSym.constructor === Object ? rhsSym.symbol : rhsSym

					/**
					 * Check if `term` produces a verb conjugative `text` object.
					 * • `[be-past]` is the only term sequence of type 'verb-past' that produces a conjugative `text` object.
					 */
					var isVerb = term.termSequenceType === g.termTypes.VERB ||
						term.termSequenceType === g.termTypes.VERB_PRESENT ||
						term.termSequenceType === g.termTypes.VERB_PAST

					/**
					 * Check if `rhsSym` is an instance of `RHSSymbolWrapper` and has a `grammaticalForm` value that will conjugate the `text` object `rhsSym.symbol` produces.
					 * • Map 'infinitive' -> 'pl' as `getGramProps()` does upon creating the `gramProps` object that the output grammar uses.
					 */
					var grammaticalForm = rhsSym.grammaticalForm === 'infinitive' ? 'pl' : rhsSym.grammaticalForm
					var canConjugateVerb = grammaticalForm && !isFutileGramProp(term.name, grammaticalForm)

					// `true` if `rhsSym` produces a verb conjugative `text` object that its rule (which will have the associated `gramProps`) can not conjugate, thereby depending on a parent rule for conjugation.
					return isVerb && !canConjugateVerb
				})) {
			util.logErrorAndPath('RHS contains two verb sequences and can not conjugate either:', rhs)
			throw new Error('Ill-formed term sequence')
		}

		/**
		 * The `isTermSequence` property instructs `flattenTermSequence` to merge the `text` properties of the rules produced by each of this rule's RHS symbols (i.e., the child nodes) and assign the merged `text` to this rule's parse node. `pfsearch` will use this merged `text` and not traverse past this rule's node (to its child nodes). `flattenTermSequence` also checks the child nodes' input tense, if any, for use by `pfsearch` when conjugating the merged `text`.
		 *
		 * For example, this enables the following construction:
		 *   "work|works|worked at|for" => `[work-at] -> `[work-verb]` `[at-prep]` -> "work|works|worked" "at|for"
		 * Depending on the matched terminal rules, `flattenTermSequence` will create the following `text` value to assign to the `[work-at]` node, which `pfsearch` uses.
		 *   `text: [ { oneSg: 'work', threeSg: 'works', pl: 'work', past: 'worked' }, 'at' ]`
		 *   `tense: 'past'` // If "worked" is matched.
		 *
		 * Merging these adjacent `text` terminal rule values is more efficient than requiring `pfsearch` to traverse the same subtree to produce identical display text for multiple parse tree.
		 *
		 * In addition, as shown by this example, without this merging of `text` values, the `text` value on the  matched `[work-verb]` terminal rule will be too far for any `grammaticalForm` conjugation property, which only conjugates its direct child nodes, on the nonterminal rule that contains `[work-at]`.
		 *
		 * This rule can be unary, and neither a substitution no insertion. For example:
		 *   `[like]` -> `[love]` -> "love", "loves", "loved", text: `{love-verb-forms}`
		 *
		 * If the parse node associated with a root term sequence node can produce multiple parse trees, it is ambiguous and the cheapest is chosen, though this rarely occurs.
		 */
		newNonterminalRule.isTermSequence = true

		/**
		 * Display text for multi-token substitutions. The term sequences produced by the RHS symbols are matched in input, `flattenTermSequence` checks the matched terminal rules for input `tense` (to maintain in verb substitutions), while `pfsearch` uses this rule's `text`.
		 *
		 * For example, the following nonterminal substitution uses the `text` on the parent nonterminal rule while maintaining the input `tense` of the matched verb terminal rule.
		 *   `[contribute-to]` -> `[work]` `[on]`, [ `[contribute]`, "to" ] -> "worked on" -> "contributed on"
		 */
		if (ruleOptions.text) {
			if (isIllFormedText(ruleOptions.text)) {
				util.logPathAndObject(ruleOptions)
				throw new Error('Ill-formed nonterminal substitution rule text')
			}

			/**
			 * Check nonterminal substitution has no `grammaticalForm`, which should have conjugated `ruleOptions.text` and been discarded.
			 *
			 * Do not check for `acceptedTense`, which should remain for (unconjugated) substitution `text` to allow `pfsearch` to conjugate `text` to match input tense.
			 *
			 * Note: This check should be extended to exempt `grammaticalForm` if `acceptedTense` also defined. Will implement later upon encountering this error in development.
			 */
			if (rhs.some(rhsSym => rhsSym.constructor === Object && rhsSym.grammaticalForm)) {
				util.logErrorAndPath('Nonterminal rule with substitution `text` has `grammaticalForm` property:', ruleOptions)
				throw new Error('Ill-formed nonterminal substitution rule')
			}

			// For use by nonterminal substitutions instead of the `text` produced by this rule's RHS (i.e., child nodes).
			newNonterminalRule.text = ruleOptions.text
		}
	} else if (ruleOptions.text) {
		util.logErrorAndPath('Nonterminal rule with `text` does not produce term sequence:', ruleOptions)
		throw new Error('Ill-formed nonterminal rule')
	}

	return newNonterminalRule
}

/**
 * Instantiates a new `NSymbol` with a single binary nonterminal rule for `options`.
 *
 * If an identical binary rule for `options` already exists, prints a warning and returns the associated, existing `NSymbol` instead of creating a new `NSymbol` and rule.
 *
 * For the new `NSymbol` `name`, concatenates the names of the `options.rhs` symbols (after recursively converting any nested arrays to binary symbols).
 * • To distinguish binary symbols with identical `options.rhs` but differing properties, the new `NSymbol` `name` includes suffixes for the RHS symbol names to which `options.noInsertionIndexes` and/or `options.grammaticalForm` applies, if defined.
 *
 * After recursively converting any nested `options.rhs` arrays to binary symbols, and instantiating the `NSymbol` with the name as explained, creates the binary nonterminal rule with `NSymbol.prototype._newNonterminalRule(options)`.
 *
 * Assigns `isBinarySymbol` to the returned `NSymbol` to prevent the addition of any more rules to the symbol.
 *
 * @static
 * @memberOf NSymbol
 * @param {Object} options The options object for the nonterminal binary rule, to pass to `NSymbol.prototype._newNonterminalRule()`.
 * @param {boolean} [suppressDupWarning] Specify suppressing the warning if an identical binary rule and `NSymbol` already exists.
 * @returns {NSymbol} Returns the new binary `NSymbol`.
 */
NSymbol.newBinaryRule = function (options, suppressDupWarning) {
	if (util.illFormedOpts(nonterminalRuleSchema, options)) {
		throw new Error('Ill-formed binary rule')
	}

	// Check RHS has two RHS symbols.
	if (options.rhs.length !== 2) {
		util.logErrorAndPath('Binary rule does not have 2 RHS symbols:', options)
		throw new Error('Ill-formed binary rule')
	}

	// Recursively convert instances of nested ordered pairs in `options.rhs` to binary symbols.
	flattenNonterminalRHS(options.rhs)

	/**
	 * Get the existing `NSymbol`, if any, that produces a single binary rule with properties identical to the rule generated from `options`.
	 *
	 * Perform this check after recursively creating binary rules for any nested RHS arrays in `options.rhs`.
	 */
	var existingBinaryRuleLHSSym = getExistingBinaryNSymbol(options)
	if (existingBinaryRuleLHSSym) {
		if (!suppressDupWarning) {
			util.logWarningAndPath('Duplicate binary rule definition:', grammarUtil.stringifyRule(existingBinaryRuleLHSSym.name, existingBinaryRuleLHSSym.rules[0]))
		}

		return existingBinaryRuleLHSSym
	}

	/**
	 * For the new `NSymbol` `name`, concatenate the names of the `options.rhs` symbols (after recursively converting any nested arrays to binary symbols).
	 *
	 * To distinguish binary symbols with identical `options.rhs` but differing properties, include suffixes for the RHS symbol names to which `options.noInsertionIndexes` and/or `options.grammaticalForm` applies, if defined.
	 */
	var symbolNameTokens = options.rhs.map(function (rhsSym) {
		if (rhsSym.constructor === NSymbol) {
			return rhsSym.name
		}

		if (rhsSym.constructor === String) {
			return rhsSym
		}

		if (rhsSym.constructor === Object) {
			var name = rhsSym.symbol.name

			// Specify in name if insertion rules are forbidden for `rhsSym`.
			if (rhsSym.noInsert) {
				name = grammarUtil.hyphenate(name, 'no', 'insert')
			}

			// Specify in name if `rhsSym` has an associated `grammaticalForm` conjugative value.
			if (rhsSym.grammaticalForm) {
				name = grammarUtil.hyphenate(name, rhsSym.grammaticalForm)
			}

			return name
		}

		util.logErrorAndPath('Unrecognized RHS symbol:', rhsSym)
		throw new Error('Unrecognized RHS symbol')
	})

	// Instantiate a new `NSymbol` and create the binary rule.
	var binaryRuleSym = NSymbol.apply(null, symbolNameTokens).addRule(options)
	// Mark `binaryRuleSym` as binary rule to prevent the addition of any more rules.
	binaryRuleSym.isBinarySymbol = true

	return binaryRuleSym
}

/**
 * Gets the existing `NSymbol`, if any, that produces a single binary rule with properties identical to the rule generated from `binaryRuleOptions`.
 *
 * For use by `NSymbol.newBinaryRule()` to check if a binary rule matching `binaryRuleOptions` already exists. This is useful for nested arrays in the `rhs` of nonterminal rule definitions, which is the shorthand to create binary sub-rules, thereby removing the need to reference `NSymbol` instances when used multiple rule definitions.
 *
 * The returned `NSymbol` need not have an identical name as the `NSymbol` that `NSymbol.newBinaryRule()` would have created had no existing identical rule been found. Though, this is currently impossible because all binary symbol names are generated automatically.
 *
 * Invoke this function after recursively creating binary rules for any nested RHS arrays in `binaryRuleOptions.rhs`.
 *
 * @private
 * @param {Object} binaryRuleOptions The nonterminal, binary rule options to check, passed to `NSymbol.newBinaryRule()`.
 * @returns {NSymbol|undefined} Returns the matching `NSymbol` if it exists, else `undefined`.
 */
function getExistingBinaryNSymbol(binaryRuleOptions) {
	if (binaryRuleOptions.rhs.length !== 2) {
		util.logErrorAndPath('Binary rule does not have 2 RHS symbols:', symbolNameTokens)
		throw new Error('Ill-formed binary rule')
	}

	if (binaryRuleOptions.rhs.some(Array.isArray)) {
		util.logErrorAndPath('Binary rule contains nested RHS array:', binaryRuleOptions.rhs)
		throw new Error('Ill-formed binary rule')
	}

	// Get the existing `NSymbol`, if any, that produces a single binary rule with properties identical to the rule generated from `binaryRuleOptions`. Ignore LHS symbol names.
	var nontermSyms = Object.keys(NSymbol._ruleSets)
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var existingNSymbol = _NSymbols[nontermSyms[s]]
		if (existingNSymbol.rules.length === 1) {
			/**
			 * Check `existingNSymbol`'s one rule has properties identical to the binary rule generated from `binaryRuleOptions`.
			 *
			 * Use `existingNSymbol._newNonterminalRule()`, bound to the existing `NSymbol`, to create a temporary rule to compare. The bound `NSymbol` is only needed for mapping RHS symbols and including the symbol's name in error messages. If this invocation throws an exception, it means `binaryRuleOptions` is unique anyway because the existing rule must have passed the same checks. Does not check (nor throw an exception) if this temporary rule is a duplicate of an existing rule, because that occurs in `NSymbol.prototype.addRule()`).
			 */
			if (existingNSymbol._ruleExists(existingNSymbol._newNonterminalRule(binaryRuleOptions))) {
				// Alert if the found, existing binary rule was not created by `NSymbol.newBinaryRule()`.
				if (!existingNSymbol.isBinarySymbol) {
					util.logErrorAndPath('Matching existing binary rule was not created by `NSymbol.newBinaryRule()` (lacks `isBinarySymbol` property):', existingNSymbol)
					throw new Error('Ill-formed binary rule')
				}

				return existingNSymbol
			}
		}
	}
}

/**
 * Checks if this `NSymbol` has a rule identical to `newRule` by comparing all rule properties.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to check.
 * @returns {boolean} Returns `true` if this `NSymbol` has a rule identical to `newRule`, else `false`.
 */
NSymbol.prototype._ruleExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		for (var prop in existingRule) {
			// Do not compare the property `line`, which is a temporary property used for debugging and which `removeTempRulesAndProps` removes at the conclusion of grammar generation.
			if (prop === 'line') {
				continue
			}

			if (!util.isDeepEqual(existingRule[prop], newRule[prop])) {
				return false
			}
		}

		return true
	})
}

/**
 * Creates a new terminal rule to assign to this `NSymbol`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {boolean} options.isTerminal Specify this is a terminal rule.
 * @param {string} options.rhs The single-token terminal symbol this rule produces.
 * @param {Object[]} [options.semantic] The completely reduced semantic from which a semantic tree is constructed in association with parse trees constructed with this rule.
 * @param {number} [options.insertionCost] Specify `createEditRules` can create insertion rules from nonterminal rules that contain this (LHS) `NSymbol` in their `rhs`, with this cost penalty and inserts `options.text`.
 * @param {number} [options.costPenalty] The rule's cost penalty. (Separate from `options.inserionCost`.)
 * @param {Object|string|(Object|string)[]} [options.text] The display text when `options.rhs` is matched in input. Can be omitted for stop-words or placeholders that generate display text from input.
 * @param {string} [options.tense] The grammatical tense of `options.rhs`, compared to the parent nonterminal rule's `acceptedTense` property, to determine if the associated verb is accepted (for display text) in the input tense, but not enforced if not input in that tense.
 * @param {boolean} [options.isPlaceholder] Specify `options.rhs` is a placeholder to replace with input when parsing; e.g., entity category, integer symbol. Prevents `Parser` from matching the literal form of `options.rhs` in input (e.g., "{user}"). Placeholder symbols generate display text and a semantic argument from matched input.
 * @param {boolean} [options.isSubstitution] Specify `options.text` substitutes `options.rhs` when matched in input. or use by `splitRegexTerminalSymbols` to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the `text` from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols).
 * @param {boolean} [options.isStopWord] Specify `options.rhs` is a stop-word and `options.text` is `undefined`, such that `options.rhs` is excluded from display text when matched in input. For use by `splitRegexTerminalSymbols`, just as `options.isSubstitution`.
 * @returns {Object} Returns the new terminal rule.
 */
var terminalRuleSchema = {
	isTerminal: { type: Boolean, required: true },
	rhs: { type: String, required: true },
	semantic: { type: Array, arrayType: Object },
	insertionCost: Number,
	costPenalty: Number,
	text: { type: [ String, Object, Array ] },
	tense: rhsSymbolWrapperSchema.acceptedTense,
	isPlaceholder: Boolean,
	isSubstitution: Boolean,
	isStopWord: Boolean,
}

NSymbol.prototype._newTerminalRule = function (options) {
	if (util.illFormedOpts(terminalRuleSchema, options) || isIllFormedTerminalRuleOptions(options)) {
		throw new Error('Ill-formed terminal rule')
	}

	var newRule = {
		// Specify this is a terminal rule (i.e., `options.rhs` does not produce rules).
		isTerminal: true,
		// Convert `options.rhs` to lowercase just as all input. This does not alter capitalization of `options.text`, even if identical to `options.rhs`.
		rhs: [ options.rhs.toLowerCase() ],
		// Placeholder terminal symbols generate display text and a semantic argument from input; e.g., integer symbols, entities. Define `isPlaceholder` to prevent `Parser` from matching the literal terminal symbol in input.
		isPlaceholder: options.isPlaceholder,
		tense: options.tense,
		// `splitRegexTerminalSymbols` uses the following two properties to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the display text, `text`, from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols). I.e., `pfsearch` only needs (and uses) `rhsDoesNotProduceText`. Both are excluded in the output grammar.
		isSubstitution: options.isSubstitution,
		isStopWord: options.isStopWord,
		// Text to display when `rhs` is matched in input.
		text: options.text,
		// Enable `createEditRules` to create insertion rules from nonterminal rules that contain this (LHS) `NSymbol` in their `rhs`, with `options.insertionCost` as cost penalty and inserts `options.text`.
		insertionCost: options.insertionCost,
	}

	/**
	 * Assigns the following semantic and cost properties to `newRule`:
	 * • {Object} [newRule.semantic] - The semantic used in semantic trees that correspond to parse trees that contain this rule.
	 * • {boolean} [newRule.semanticIsReduced] - Specify if `newRule.semantic` is reduced, else semantic is to accept other semantics as arguments.
	 * • {number} newRule.cost - The rule cost, which includes the cost of `newRule.semantic` and `options.costPenalty`, if any.
	 */
	assignSemanticAndCost(newRule, options)

	return newRule
}

/**
 * Checks if `options`, which was passed to `NSymbol.prototype._newTerminalRule()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The `NSymbol.prototype._newTerminalRule()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedTerminalRuleOptions(options) {
	if (/[^\S ]/.test(options.rhs)) {
		util.logError('Terminal symbol contains a whitespace character other than a space:', util.stylize(options.rhs), options)
		return true
	}

	if (/ {2,}/.test(options.rhs)) {
		util.logError('Terminal symbol contains a sequence of multiple spaces:', util.stylize(options.rhs), options)
		return true
	}

	if (options.text === '') {
		util.logError('`text` is an empty string, \'\':', options)
		return true
	}

	if (options.isSubstitution && options.text === undefined) {
		util.logError('Substitution lacks `text`:', options)
		return true
	}

	// Prevent terminal rules with placeholder symbols from being assigned a reduced (RHS) semantic because placeholder symbols generate and use a (reduced) semantic argument from input.
	if (options.isPlaceholder && options.semantic && semantic.isReduced(options.semantic)) {
		util.logErrorAndPath('Placeholder symbols has reduced (RHS) semantic:', options)
		return true
	}

	// Forbid semantics on `<empty>`.
	if (options.rhs === g.emptySymbol && options.semantic) {
		util.logErrorAndPath('Rule with `<empty>` has semantic:', options)
		return true
	}

	// Require semantics on terminal rules to be completely reduced (i.e., a RHS semantic), except placeholder symbols.
	if (options.semantic && !semantic.isReduced(options.semantic) && !options.isPlaceholder) {
		util.logError('Terminal rules has non-reduced (LHS) semantic:', options.semantic)
		util.logPathAndObject(options)
		return true
	}

	// Forbid `text on certain rules.
	if (options.rhs === g.emptySymbol || options.isPlaceholder || options.isStopWord) {
		var msgStart = util.stylize(options.rhs)
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
			util.logErrorAndPath(msgStart + '`text`:', options)
			return true
		}

		// Forbid insertions of stop-words, `<empty>`, and placeholder symbols.
		if (options.insertionCost !== undefined) {
			util.logErrorAndPath(msgStart + '`insertionCost`:', options)
			return true
		}
	}

	if (options.text && isIllFormedText(options.text)) {
		util.logPathAndObject(options)
		return true
	}

	return false
}

/**
 * Checks if `text` is ill-formed. If so, prints an error.
 *
 * Printed errors exclude the violating file-path + line-number so that the calling function can also print the options object that provided `text`.
 *
 * FIXME: Extend checks with `termSequence.isIllFormedTerminalSymbol()`, even if redundant.
 *
 * @private
 * @static
 * @param {Object|string|(Object|string)[]} text The display text to inspect.
 * @returns {boolean} Returns `true` if `text` is ill-formed, else `false`.
 */
function isIllFormedText(text) {
	var textConstructor = text.constructor

	if (textConstructor === Array) {
		var textArrayLen = text.length
		if (textArrayLen === 0) {
			util.logError('Text array is empty:', text)
			return true
		}

		if (textArrayLen === 1) {
			util.logError('Text array contains only one item (for which an array is unnecessary):', text)
			return true
		}

		for (var t = 0; t < textArrayLen; ++t) {
			var textItem = text[t]
			if (textItem.constructor !== Object && textItem.constructor !== String) {
				util.logError('Item in text array is neither string nor object:', textItem)
				util.log('  Text array:', text)
				return true
			}

			if (t > 0 && textItem.constructor === String && text[t - 1].constructor === String) {
				util.logError('Text array contains adjacent (non-concatenated) strings:', text)
				return true
			}

			if (isIllFormedText(textItem)) {
				util.log('  Text array:', text)
				return true
			}
		}
	}

	else if (textConstructor === Object) {
		// Check if `text` object has only one property or an recognized property.
		if (isIllFormedTextObject(text)) {
			return true
		}
	}

	else if (textConstructor !== String) {
		util.logError('`text` is neither string, nor object, nor array:', text)
		return true
	}

	return false
}

/**
 * Checks if `textObject` is ill-formed. If so, prints an error.
 *
 * Checks `textObject` for the following illegal conditions:
 * • Has only one property/form.
 * • Has an unrecognized property.
 *
 * @private
 * @static
 * @param {Object} textObject The conjugative display text object to inspect.
 * @returns {boolean} Returns `true` if `textObject` is ill-formed, else `false`.
 */
function isIllFormedTextObject(textObject) {
	// Forbid `text` objects with only one property/form, for which a single string should have been used.
	if (Object.keys(textObject).length < 2) {
		util.logError('Text object contains only one term form:', textObject)
		return true
	}

	// Check for unrecognized `text` object properties.
	for (var textPropName in textObject) {
		/**
		 * Though 'infinitive' is a recognized `grammaticalForm` value, it is not used on text objects.
		 * For `grammaticalForm`, `NSymbol` maps 'infinitive' -> 'pl' to share the text form with `personNumber` defined as 'pl'`.
		 */
		if (textPropName === 'infinitive') {
			util.logError('Conjugative text object property', util.stylize('infinitive'), 'is forbidden. Use', util.stylize('pl'), 'instead:', textObject)
			return true
		}

		/**
		 * Recognize:
		 * • personNumber: 'oneSg', 'threeSg', 'pl'
		 * • gramProps: 'nom', 'obj', 'past', 'participle'. ('infinitive' is manually stopped above.)
		 */
		if (nonterminalRuleSchema.personNumber.values.indexOf(textPropName) === -1 && rhsSymbolWrapperSchema.grammaticalForm.values.indexOf(textPropName) === -1) {
			util.logError('Unrecognized conjugative `text` object property:', util.stylize(textPropName), textObject)
			util.log('Acceptable `text` properties:\n ', nonterminalRuleSchema.personNumber.values.concat(util.without(rhsSymbolWrapperSchema.grammaticalForm.values, 'infinitive')).map(util.unary(util.stylize)).join(', '))
			return true
		}
	}

	return false
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

// Extend `NSymbol` with methods for predefined sets of rules (e.g., verbs, stop words).
require('./ruleSetMethods')