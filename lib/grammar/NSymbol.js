var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')
var semantic = require('./semantic')


/**
 * The map of the grammar's nonterminal symbols to rules.
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

	_NSymbols[this.name] = this

	// Save instantiation file path and line number for error reporting.
	NSymbol._defLines[this.name] = util.getModuleCallerLocation()
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

	if (this.isBinarySym) {
		util.logErrorAndPath('Attempting to add a rule to a binary symbol (i.e., limited to a single binary rule):', options)
		throw new Error('Adding rule to binary symbol')
	}

	var newRule = options.isTerminal ? this._newTerminalRule(options) : this._newNonterminalRule(options)

	if (this._ruleRHSExists(newRule)) {
		util.logErrorAndPath('Duplicate rule:', grammarUtil.stringifyRule(this.name, newRule))
		throw new Error('Duplicate rule')
	}

	// Save rule definition line for inclusion in error console messages. Excluded from output grammar.
	newRule.line = util.getModuleCallerLocation()

	this.rules.push(newRule)

	return this
}

/**
 * Creates a new nonterminal rule to assign to this `NSymbol`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} options The options object for the rule.
 * @returns {Object} Returns the new rule.
 */
var nontermRuleSchema = {
	// The array of `NSymbol`s, `NSymbol` names (strings), and/or nested arrays of either for new binary rules to recursively create. These sub-rules, however, can only contain a RHS and no other rule properties.
	rhs: { type: Array, arrayType: [ NSymbol, String, Array ], required: true },
	// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
	noInsertionIndexes: { type: Array, arrayType: Number },
	// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
	noInsert: Boolean,
	// The LHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, arrayType: Object },
	// Enable creation of transposition rules which recognizes the swap of this rule's `rhs` symbols and swaps them back when parsing. Requires `rhs` to contain two `NSymbol` instances.
	transpositionCost: Number,
	/**
	 * The grammatical forms with which to conjugate the term sequences `rhs` produces:
	 * • nom - The nominative case form, which conjugates pronouns used as the subject of a verb, created by
	 *   `g.newPronoun()`. For example:
	 *       "repos `[1-sg]` created" -> "repos I created"
	 *
	 * • obj - The objective case form, which conjugates pronouns used as the object of a verb, created by
	 *   `g.newPronoun()`. For example:
	 *       "repos created by `[1-sg]`" -> "repos created by me"
	 *
	 * • past - The simple past tense form, which conjugates verbs created by `g.newVerb()`. For example:
	 *       "repos `[verb-like]` by me" -> "repos liked by me"
	 *
	 * • infinitive - The bare infinitive form, which uses the present plural form that `personNumber` of 'pl'
	 *   uses, which conjugates verbs created by `g.newVerb()`. For example:
	 *       "people who `[have]` been ..." -> "people who have been ..."
	 *       "people who `[verb-like]` ..." -> "people who like ..."
	 *       "repos I `[verb-do]` not ..." -> "repos I do not ..."
	 *
	 * `pfsearch` uses the `grammaticalForm` property to conjugate `text` on this rule (including rules with insertion text) and rules `rhs` immediately produces (i.e., term sequences in `rhs`), but does not conjugate any subsequent rules.
	 * • This limitation of only conjugating immediate child nodes and no further enforces a grammar design that conjugates as many insertion rules as possible during generation, as opposed to leaving conjugation to run-time by positioning the property higher in the parse tree.
	 */
	grammaticalForm: { values: [ 'nom', 'obj', 'past', 'infinitive' ] },
	/**
	 * The grammatical tense for which forms of verbs, created with `g.newVerb()`, in `rhs` are accepted when input in the tense `acceptedTense` specifies, but the form is not enforced by default.
	 *
	 * For use when tense is semantically meaningless. For example, consider the following semantically identical queries:
	 *   past: "repos I liked"
	 *   present: "repos I like"
	 * Both forms are accepted when input, but an insertion for the verb "like" inserts the verb in present tense.
	 *
	 * `pfsearch` uses the `acceptedTense` property to conjugate rules `rhs` immediately produces (i.e., term sequences in `rhs`), but does not conjugate any subsequent rules.
	 */
	acceptedTense: { values: [ 'past' ] },
	// The grammatical person-number for which to conjugate term sequence either `rhs` produces or within the same parse subtree E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ] },
	// The grammatical person-number for anaphoric rules with which to match and copy an antecedent semantic of the same person-number. E.g., "his|her" refers to semantics of third-person-singular representations.
	anaphoraPersonNumber: { values: [ 'threeSg', 'threePl' ] },
	// The display text for multi-token substitutions where the RHS contains term sets that are matched when input and substituted for output. Either a string (invariable term), a conjugation object (verb), or an array of both.
	text: [ String, Object, Array ],
	// The cost penalty added to this rule's cost. For use as nonterminal substitution costs.
	costPenalty: Number,
}

NSymbol.prototype._newNonterminalRule = function (options) {
	if (util.illFormedOpts(nontermRuleSchema, options) || isIllFormedNewNonterminalRuleOptions(options)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	var newRule = {
		// Map the RHS symbols to its names (as strings). Recursively create new binary rules for any nested arrays.
		rhs: options.rhs.map(this._symToName),
		// Prevent insertion rules using this rule and the RHS symbols at the specified indexes.
		noInsertionIndexes: options.noInsertionIndexes,
		// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
		noInsert: options.noInsert,
		// Enable creation of transposition rules which recognizes the swap of `newRule.rhs` and swaps them back when parsing.
		transpositionCost: options.transpositionCost,
		/**
		 * The grammatical properties used to conjugate the immediate rules that `newRule.rhs` produces, but can not conjugate any subsequent rules. `pfsearch` uses `gramProps` to only conjugate the display text, `ruleProps.text`, of immediate child nodes.
		 *
		 * Store multiple conjugation properties in a single object, `gramProps`, so that `pfsearch` can check if a rule contains any grammatical conjugation properties at all, instead of checking for the existence of each possible conjugation properties, before attempting to conjugate the child node's display text.
		 *
		 * If `gramProps` has lacks any defined properties, the empty object is excluded from the output grammar.
		 *
		 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets for each grammatical case (depending on the rule) with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
		 */
		gramProps: {
			// Map 'infinitive' -> 'pl', to use the `pl` property on text objects created by `g.newVerb()`.
			form: options.grammaticalForm === 'infinitive' ? 'pl' : options.grammaticalForm,
			acceptedTense: options.acceptedTense,
		},
		personNumber: options.personNumber,
		anaphoraPersonNumber: options.anaphoraPersonNumber,
	}

	// Check `newRule.rhs` can produce a rule with applicable, conjugative `text` for each grammatical property in `newRule.gramProps`.
	if (isIllFormedGramProps(newRule)) {
		throw new Error('Ill-formed nonterminal rule')
	}

	/**
	 * Assigns the following term sequence properties to `newRule`:
	 * • {boolean} [newRule.isTermSequence] - Defines `true` if the `newRule.rhs` produces only term sets, which instructs `calcHeuristicCosts` to merge the `text` values produced by `newRule.rhs`, assign the merged `text` to this rule, and prevent `pfsearch` from traversing past this rule's node.
	 * • {string} [newRule.text] - If `newRule.isTermSequence` is `true`, assigns `options.text` to `newRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of text the RHS symbols produce.
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
function isIllFormedNewNonterminalRuleOptions(options) {
	if (options.rhs.length > 2) {
		util.logErrorAndPath('Nonterminal rule has > 2 RHS symbols:', options)
		return true
	}

	if (options.noInsertionIndexes && options.noInsertionIndexes.some(idx => options.rhs[idx] === undefined)) {
		util.logErrorAndPath('`noInsertionIndexes` contains an index for which there is no RHS symbol:', options)
		return true
	}

	if (options.transpositionCost !== undefined && options.rhs.length !== 2) {
		util.logErrorAndPath('Nonterminal rule with transposition cost does not have 2 RHS symbols:', options)
		return true
	}

	// if (options.acceptedTense && options.grammaticalForm) {
	// 	util.logErrorAndPath('Nonterminal rule has both `acceptedTense` and `grammaticalForm`:', options)
	// 	return true
	// }

	if (options.text && !options.rhs.every(rhsSym => rhsSym.isTermSequence)) {
		util.logErrorAndPath('Nonterminal rule with `text` does not produce term sequence:', options)
		return true
	}

	return false
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
 * **Note:** This function mutates `newRule`.
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
			util.logErrorAndPath('Anaphoric rule hss semantic:', ruleOptions)
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
 * Maps `rhsSym`, which is either an `NSymbol`, a string name of an `NSymbol`, or an array of either, to its name. For use in mapping the RHS nonterminal symbols in a rule's definition (e.g., passed to `NSymbol.prototype._newNonterminalRule()`) to strings for writing the output grammar.
 *
 * If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not. Accepts the string `NSymbol` names for passing an existing rule's `rhs` array for a new rule, as in `user`, and for use in `splitRegexTerminalSymbols`.
 *
 * If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary rule and returns the resulting `NSymbol` name.
 *
 * @private
 * @memberOf NSymbol
 * @param {NSymbol|string|(NSymbol|string)[]} rhsSym The RHS symbol to map, passed in an array of RHS symbols for a new nonterminal rule.
 * @returns {string} Returns the name of `rhsSym`.
 */
NSymbol.prototype._symToName = function (rhsSym) {
	// If `rhsSym` is a string name of an `NSymbol`, checks if the respective `NSymbol` exists and throws an exception if not.
	if (rhsSym.constructor === String) {
		if (!NSymbol._ruleSets.hasOwnProperty(rhsSym)) {
			util.logError('RHS symbol does not exist:', util.stylize(rhsSym))
			util.logPathAndObject(grammarUtil.stringifyRule(this.name, options))
			throw new Error('Ill-formed nonterminal rule')
		}

		return rhsSym
	}

	// If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary rule and return the resulting `NSymbol` name.
	if (rhsSym.constructor === Array) {
		// Suppress warning for duplicate binary rule definition, which gets the matching `NSymbol` when found, because the nested-array-shorthand is limited to only RHS symbols, suggesting any duplicate definition is not an accident and simply an extension of the convenience the shorthand already offers.
		return NSymbol.newBinaryRule({ rhs: rhsSym }, true).name
	}

	// If `rhsSym` is an `NSymbol`, return its name.
	return rhsSym.name
}

/**
 * Checks `newNonterminalRule.gramProps` does not contain unusable grammatical properties, for which `newNonterminalRule.rhs` produces no conjugative term sequences applicable to the property. Properties in `newNonterminalRule.gramProps` can only conjugate `text` values in the rules it produces (i.e., it's child nodes), and no further.
 *
 * For use by `NSymbol.prototype._newNonterminalRule()` when creating new nonterminal rules.
 *
 * @private
 * @static
 * @param {Object} newNonterminalRule The new nonterminal rule of which to inspect its `gramProps` property.
 * @returns {boolean} Returns `true` if `newNonterminalRule.gramProps` contains unusable grammatical properties, else `false`.
 */
function isIllFormedGramProps(newNonterminalRule) {
	var gramProps = newNonterminalRule.gramProps
	for (var propName in gramProps) {
		var gramProp = gramProps[propName]

		if (gramProp && NSymbol.isFutileGramProp(newNonterminalRule.rhs, gramProp)) {
			util.logError('RHS produces no rules with conjugative `text` applicable to the grammatical property', util.stylize(propName), '->', util.stylize(gramProp) + ':', util.deleteUndefinedObjectProps(newNonterminalRule))
			return true
		}
	}

	return false
}

/**
 * Checks if `rhs` produces no rules with a conjugative `text` object with a value for the grammatical form property, `gramProp`. If so, `gramProp` is useless should be discarded.
 *
 * Grammatical form properties, defined on the nonterminal rule object `gramProps`, can only conjugate `text` objects on term sequences which their rule's RHS symbols immediately produce (i.e., its child nodes).
 * • The `grammaticalForm` value 'infinitive' is mapped to 'pl' when creating the `gramProps` object, before invoking this check, because it uses the `pl` property on text objects created by `g.newVerb()`.
 *
 * @static
 * @memberOf NSymbol
 * @param {string[]} rhs The RHS symbols to check if produce no rules with a conjugative `text` object with a value for `gramProp`.
 * @param {string} gramProp The `gramProps` value for which to check if can conjugate `rhs`; e.g., 'past', 'obj'.
 * @returns {boolean} Returns `true` if `rhs` produces no rules with conjugative `text` applicable to `gramProp` and should be discarded, else `false`.
 */
NSymbol.isFutileGramProp = function (rhs, gramProp) {
	if (isUnrecognizedGramProp(gramProp)) {
		throw new Error('Unrecognized `gramProps` property')
	}

	for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
		var rhsSym = rhs[s]
		var rhsRules = NSymbol._ruleSets[rhsSym]

		for (var r = 0, rulesLen = rhsRules.length; r < rulesLen; ++r) {
			var rhsRule = rhsRules[r]
			var ruleText = rhsRule.text

			if (ruleText) {
				if (ruleText.constructor === Array) {
					// `rhsRule` is a nonterminal multi-token substitution.
					if (ruleText.some(textItem => textItem[gramProp])) {
						return false
					}
				} else if (ruleText[gramProp]) {
					return false
				}
			} else if (rhsRule.isTermSequence) {
				/**
				 * `rhsRule` is a non-substitution and non-edit term sequence, for which `calcHeuristicCosts` will merge the `text` values `rhsRule.rhs` produces and assign it to `rhsRule.text` for `pfsearch` to conjugate. For example:
				 * `[github-create]` -> `[create]` -> "create", text: `{create-text-forms}`
				 */
				if (!NSymbol.isFutileGramProp(rhsRule.rhs, gramProp)) {
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
 * For use by `NSymbol.isFutileGramProp()` to check its provided value.
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

	if (gramProp !== 'pl' && nontermRuleSchema.grammaticalForm.values.indexOf(gramProp) === -1) {
		util.logErrorAndPath('Unrecognized `gramProps` property:', util.stylize(gramProp))
		return true
	}

	return false
}

/**
 * Creates a new `NSymbol` with a single binary nonterminal rule. The `NSymbol`'s name is a concatenation of the rule's RHS `NSymbol`s. Use the same options object as `NSymbol.prototype._newNonterminalRule()`.
 *
 * As the `NSymbol`'s name is created from the rule's RHS, this new `NSymbol` is intended only for this rule.
 *
 * If an identical binary rule and `NSymbol` already exists for `options`, prints a warning, does not add a new rule, and returns the existing `NSymbol`.
 *
 * @static
 * @memberOf NSymbol
 * @param {Object} options The options object following the schema for `NSymbol.prototype._newNonterminalRule()`.
 * @param {boolean} [suppressDupWarning] Specify suppressing the warning if an identical binary rule and `NSymbol` already exists.
 * @returns {NSymbol} Returns the new binary `NSymbol`.
 */
NSymbol.newBinaryRule = function (options, suppressDupWarning) {
	if (util.illFormedOpts(nontermRuleSchema, options)) {
		throw new Error('Ill-formed binary rule')
	}

	// Check RHS has two RHS symbols.
	if (options.rhs.length !== 2) {
		util.logErrorAndPath('Binary rule does not have 2 RHS symbols:', options.rhs)
		throw new Error('Ill-formed binary rule')
	}

	// Recursively create new binary rules for any nested arrays in the RHS. RHS can contain `NSymbol`s, `NSymbol` names (strings), and/or nested arrays of either for new binary rules to recursively create.
	options.rhs = options.rhs.map(function (sym) {
		// If `rhsSym` is an array (of symbols), recursively invokes the array on `NSymbol.newBinaryRule()` to create a new binary rule and return the resulting `NSymbol`.
		if (sym.constructor === Array) {
			// Suppress warning for duplicate binary rule definition, which gets the matching `NSymbol` when found, because the nested-array-shorthand is limited to only RHS symbols, suggesting any duplicate definition is not an accident and simply an extension of the convenience the shorthand already offers.
			return NSymbol.newBinaryRule({ rhs: sym }, true)
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

	// Get the existing `NSymbol`, if any, for this binary rule.
	// Perform this check after recursively creating binary rules for any nested RHS arrays in `options.rhs`.
	var existingBinaryRuleLHSSym = getExistingBinaryRuleLHSSym(symbolNameTokens, options)
	if (existingBinaryRuleLHSSym) {
		if (!suppressDupWarning) {
			util.logWarningAndPath('Duplicate binary rule def:', grammarUtil.stringifyRule(existingBinaryRuleLHSSym.name, existingBinaryRuleLHSSym.rules[0]))
		}

		return existingBinaryRuleLHSSym
	}

	// Create a new `NSymbol` and add the binary rule.
	var binaryRuleSym = NSymbol.apply(null, symbolNameTokens).addRule(options)
	// Mark `NSymbol` as for a binary rule, to prevent adding additional rules to it
	binaryRuleSym.isBinarySym = true

	return binaryRuleSym
}

/**
 * Gets the existing `NSymbol`, if any, for which the following are true:
 * 1. Its name is identical to the name generated from `symbolNameTokens`.
 * 2. Its only rule is binary and has properties identical to the rule generated from `binaryRuleOptions`.
 *
 * For use by `NSymbol.newBinaryRule()` to check if a binary rule already exists. This is useful for nested arrays in `NSymbol.prototype._newNonterminalRule()` rule definitions, the shorthand to create binary sub-rules, removing the need to reference the associated `NSymbol` in multiple rule definitions.
 *
 * Invoke this function after recursively creating binary rules for any nested RHS arrays in `binaryRuleOptions.rhs`.
 *
 * This function might be unneeded when the grammar generator is extended to reduce duplicate rules and rule sets with different LHS symbol names, amongst other optimization to reduce the grammar's size (e.g., unary nonterminal rule flattening).
 *
 * @private
 * @param {string[]} symbolNameTokens The `NSymbol` name tokens to check.
 * @param {Object} binaryRuleOptions The nonterminal, binary rule options to check, passed to `NSymbol.newBinaryRule()`.
 * @returns {NSymbol|undefined} Returns the matching `NSymbol` if it exists, else `undefined`.
 */
function getExistingBinaryRuleLHSSym(symbolNameTokens, binaryRuleOptions) {
	if (binaryRuleOptions.rhs.length !== 2) {
		util.logErrorAndPath('Binary rule does not have 2 RHS symbols:', symbolNameTokens)
		throw new Error('Ill-formed binary rule')
	}

	if (binaryRuleOptions.rhs.some(Array.isArray)) {
		util.logErrorAndPath('Binary rule contains nested RHS array:', binaryRuleOptions.rhs)
		throw new Error('Ill-formed binary rule')
	}

	// Get the `NSymbol` with a name generated from `symbolNameTokens`.
	var symbolName = NSymbol.genName.apply(null, symbolNameTokens)
	var existingNSymbol = _NSymbols[symbolName]

	// Check the `NSymbol` exists and has only one rule (a required attribute of binary rules).
	if (existingNSymbol && existingNSymbol.rules.length === 1) {
		/**
		 * Check `existingNSymbol`'s one rule has properties identical to the binary rule generated from `binaryRuleOptions`.
		 *
		 * Use `existingNSymbol._newNonterminalRule()`, bound to the existing `NSymbol`, to create a temporary rule to compare. The bound `NSymbol` is only needed for mapping RHS symbols and including the symbol's name in error messages. If this invocation throws an exception, it means `binaryRuleOptions` is unique anyway because the existing rule must have passed the same checks. Does not check (and throw an exception) if this temporary rule is a duplicate of an existing rule, because that occurs in `NSymbol.prototype.addRule()`).
		 */
		if (existingNSymbol._ruleExists(existingNSymbol._newNonterminalRule(binaryRuleOptions))) {
			return existingNSymbol
		}
	}
}

/**
 * Assigns term sequence properties to `newNonterminalRule` using `ruleOptions`. For use by `NSymbol.prototype._newNonterminalRule()`.
 *
 * Assigns the following term sequence properties to `newNonterminalRule`:
 * • {boolean} [newNonterminalRule.isTermSequence] - Defines `true` if the `newNonterminalRule.rhs` produces only term sets, which instructs `flattenTermSequence` to merge the `text` values produced by `newNonterminalRule.rhs`, assign the merged `text` to this rule, and prevent `pfsearch` from traversing past this rule's node.
 * • {string} [newNonterminalRule.text] - If `newNonterminalRule.isTermSequence` is `true`, assigns `options.text` to `newNonterminalRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of text the RHS symbols produce.
 *
 * **Note:** This function mutates `newNonterminalRule`.
 *
 * @private
 * @static
 * @param {Object} newNonterminalRule The new nonterminal rule which to assign term sequence properties.
 * @param {Object} ruleOptions The rule options object passed to `NSymbol.prototype._newNonterminalRule()`.
 * @returns {Object} Returns `newNonterminalRule`.
 */
function assignTermSequence(newNonterminalRule, ruleOptions) {
	// Check if `rhs` contains only terminal rule sets (e.g., `g.newVerb()`, `g.newPronoun()`) or terminal rule sequences (e.g., `g.newTermSequence()`).
	var rhs = ruleOptions.rhs
	if (rhs.every(rhsSym => rhsSym.isTermSequence)) {
		/**
		 * Forbid a rule's RHS from producing multiple verbs that this rule can not conjugate.
		 *
		 * Prevents `flattenTermSequence` from merging two conjugative verb text objects, each of which can have an input `tense`, and passing the merged text array up to a parent node without knowing to which text object which input `tense` applies.
		 *
		 * Whether this rule has `acceptedTense` is immaterial. If present, will attempt to conjugate each sequence separately, where input `tense` of is on separate nodes; if absent, `grammaticalForm` will conjugate.
		 */
		if (rhs.length > 1 && rhs.every(term =>
				term.termSequenceType === g.termTypes.VERB ||
				term.termSequenceType === g.termTypes.VERB_PRESENT ||
				term.termSequenceType === g.termTypes.VERB_PAST) &&
				(ruleOptions.grammaticalForm !== 'past' && ruleOptions.grammaticalForm !== 'infinitive')) {
			util.logErrorAndPath('RHS contains two verb sequences:', ruleOptions)
			throw new Error('Ill-formed term sequence')
		}

		/**
		 * This property instructs `flattenTermSequence` to merge the `text` properties of the rules produced by each of this rule's RHS symbols (i.e., the child nodes) and assign the merged `text` to this rule's node. `pfsearch` will use this merged `text` and not traverse past this rule's node (to its child nodes). `flattenTermSequence` also checks the child nodes' input tense, if any, for use by `pfsearch` when conjugating the merged `text`.
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
		 * This rule can be unary and neither a substitution no insertion. For example:
		 *   `[like]` -> `[love]` -> "love", "loves", "loved" text: `{love-verb-forms}`
		 *
		 * If the parse node associated with a root term sequence node can produce multiple parse trees, it is ambiguous and the cheapest is chosen, though this rarely occurs.
		 */
		newNonterminalRule.isTermSequence = true

		/**
		 * Display text for multi-token substitutions. The term sets produced by the RHS symbols are matched in input, `flattenTermSequence` checks the matched terminal rules for input tense (to maintain in verb substitutions), while `pfsearch` uses this rule's `text`.
		 *
		 * For example, the following nonterminal substitution uses the `text` on the parent nonterminal rule while maintaining the input tense of the matched verb terminal rule.
		 *   `[contribute-to]` -> `[work]` `[on]`, [ `[contribute]`, "to" ] -> "worked on" -> "contributed on"
		 */
		if (ruleOptions.text) {
			if (ruleOptions.text.constructor === Array && isIllFormedTextArray(ruleOptions.text)) {
				util.logPathAndObject(ruleOptions)
				throw new Error('Ill-formed nonterminal substitution rule text')
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
 * Check if `textArray` ill-formed. If so, prints an error.
 *
 * Ensures `textArray` contains only strings or objects, and checks objects in `textArray` contain at least two term forms.
 *
 * @private
 * @static
 * @param {(Object|string)[]} textArray The text array to inspect.
 * @returns {boolean} Returns `true` if `textArray` is ill-formed, else `false`.
 */
function isIllFormedTextArray(textArray) {
	var textArrayLen = textArray.length
	if (textArrayLen === 0) {
		util.logError('Text array is empty:', textArray)
		return true
	}

	for (var t = 0; t < textArrayLen; ++t) {
		var textItem = textArray[t]
		if (textItem.constructor !== Object && textItem.constructor !== String) {
			util.logError('Item in text array is neither String nor Object:', textItem)
			util.log('  Text array:', textArray)
			return true
		}

		if (isIllFormedTextObject(textItem)) {
			return true
		}
	}

	return false
}

/**
 * Checks if `textItem` is an `Object` with only one term form (i.e., property), for which a single string should have been used. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object|string} textItem The text value to check.
 * @returns {boolean} Returns `true` if `textItem` is an `Object` with only one term form, else `false`.
 */
function isIllFormedTextObject(textItem) {
	if (textItem.constructor === Object && Object.keys(textItem).length < 2) {
		util.logError('Text object contains only one term form:', textItem)
		return true
	}

	return false
}

/**
 * Creates a new terminal rule to assign to this `NSymbol`.
 *
 * @private
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
	semantic: { type: Array, arrayType: Object },
	// Enable creation of edit rules using `NSymbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// The cost penalty added to this rule's cost.
	costPenalty: Number,
	// The display text when `rhs` is matched in input. Can be omitted if a stop-word or an input placeholder (e.g., entity).
	text: { type: [ String, Object, Array ] },
	// The tense of this terminal symbol that is checked against the parent nonterminal rules' `acceptedTense` property to determine if this symbol is an acceptable form of the associated verb (though not enforced by default).
	tense: nontermRuleSchema.acceptedTense,
	// Specify this rule substitutes the input terminal symbol as display text. For use by `splitRegexTerminalSymbols` to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the `text` from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols).
	isSubstitution: Boolean,
	// Specify this terminal symbol is a stop-word and does not produce any text when `rhs` is input. For use by `splitRegexTerminalSymbols` just as `options.isSubstitution`.
	isStopWord: Boolean,
}

NSymbol.prototype._newTerminalRule = function (options) {
	if (util.illFormedOpts(termRuleSchema, options) || isIllFormedNewTerminalRuleOptions(options)) {
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
		// Text to display when `rhs` is matched in input.
		text: options.text,
		// Enable creating of insertion rules using this new rule, with this as the cost penalty.
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
function isIllFormedNewTerminalRuleOptions(options) {
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

	if (options.text) {
		// Forbid `text` objects with only one form, for which a single string should have been used.
		if (isIllFormedTextObject(options.text)) {
			return true
		}

		if (options.text.constructor === Array && isIllFormedTextArray(options.text)) {
			return true
		}
	}

	return false
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
 * Checks if this `NSymbol` has a rule with RHS symbols identical to `newRule`'s RHS symbols.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} newRule The new rule to check.
 * @returns {boolean} Returns `true` if this `NSymbol` has a rule with RHS symbols identical to `newRule`'s, else `false`.
 */
NSymbol.prototype._ruleRHSExists = function (newRule) {
	return this.rules.some(function (existingRule) {
		return util.arraysEqual(existingRule.rhs, newRule.rhs)
	})
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
 * Sorts the grammar's nonterminal symbols alphabetically and each symbols' rules by increasing cost.
 *
 * It is essential to sort rules by increasing cost so that when `StateTable` groups `ruleProps` together for edit rules with the same RHS symbols, the cheapest rules is the first `ruleProp` in the set. This enables `calcHeuristicCosts` to determine the minimum cost for these sets of `ruleProps` by checking the cost of the first object in each set.
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