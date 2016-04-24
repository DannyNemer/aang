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
 * Adds a new rule to the grammar with this `NSymbol` as the LHS symbol.
 *
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {Object} [options.isTerminal=false] Specify the rule is terminal.
 * @returns {NSymbol} Returns this `NSymbol` instance for method chaining.
 */
NSymbol.prototype.addRule = function (options) {
	if (this.isTermSet) {
		util.logErrorAndPath('Attempting to add a rule to a completed terminal rule set:', options)
		throw new Error('Adding rule to completed terminal rule set')
	}

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

	// Temporarily save rule definition line for inclusion in error console messages.
	newRule.line = util.getModuleCallerPathAndLineNumber()

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
	rhs: { type: Array, arrayType: [ NSymbol, String, Array ] },
	// Prevent insertion rules from being created using this rule and the RHS symbol at these indexes.
	noInsertionIndexes: { type: Array, arrayType: Number },
	// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
	noInsert: Boolean,
	// The LHS semantic from which a semantic tree is constructed in parse tree construction.
	semantic: { type: Array, arrayType: Object },
	// Enable creation of transposition rules which recognizes the swap of this rule's `rhs` symbols and swaps them back when parsing. Requires `rhs` to contain two `NSymbol`s.
	transpositionCost: Number,
	// The grammatical forms (case, tense) for which to conjugate the terminal rules `options.rhs` produces. E.g., "me" vs. "I" (case), "like" vs. "liked" (tense). `pfsearch` uses this property to only conjugate the immediate rules `rhs` produces, but can not conjugate any subsequent rules; the properties can only conjugate the display text, `ruleProps.text`, of immediate child nodes. Limiting this property to only conjugate immediate child nodes (and no further), forces a grammar design that enables conjugating as much as possible in edit-rules during their generation, as opposed to leaving the conjugative to run-time when could have been conjugated earlier.
	grammaticalForm: { values: [ 'nom', 'obj', 'past' ] },
	// The grammatical tense for which forms of the terminal rules `options.rhs` produces are accepted when input, but not enforced by default. For use when tense is semantically meaningless. E.g., "(repos I) liked" (past) and "(repos I) like" are both accepted, but defaults to "like". Like `options.grammaticalForm`, `pfsearch` uses this property to only conjugate the immediate rules `rhs` produces, but can not conjugate any subsequent rules.
	acceptedTense: { values: [ 'past' ] },
	// The grammatical person-number for which to conjugate terminal rules either `options.rhs` produces or which follow in successive branches. E.g., "like" vs "likes".
	personNumber: { values: [ 'oneSg', 'threeSg', 'pl' ] },
	// The grammatical person-number for anaphoric rules with which to match to an antecedent semantic of the same person-number. E.g., "his/her" refers to semantics of third-person-singular representations.
	anaphoraPersonNumber: { values: [ 'threeSg', 'threePl' ] },
	// The display text for multi-token substitutions where the RHS contains term sets that are matched when input and substituted for output. Either a string (invariable term), a conjugation object (verb), or an array of both.
	text: [ String, Object, Array ],
}

NSymbol.prototype._newNonterminalRule = function (options) {
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
		rhs: options.rhs.map(this._symToName),
		// Prevent insertion rules using this rule and the RHS symbols at the specified indexes.
		noInsertionIndexes: options.noInsertionIndexes,
		// Specify preventing this rule's entire RHS from being inserted, while permitting insertion rules created using one of its RHS symbols.
		noInsert: options.noInsert,
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
			form: options.grammaticalForm,
			acceptedTense: options.acceptedTense,
		},
		personNumber: options.personNumber,
		anaphoraPersonNumber: options.anaphoraPersonNumber,
	}

	/**
	 * Assigns the following properties for binary term sets:
	 * • `isTermSequence` - Defines `newRule.isTermSequence` as `true` if the RHS produces only term sets, which instructs `calcHeuristicCosts` to merge the `text` values produced by the RHS, assign the merged `text` to this rule, and prevent `pfsearch` from traversing past this rule's node.
	 *
	 * • `text` - If `newNonterminalRule.isTermSequence` is `true`, assigns `options.text` to `newRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of text the RHS symbols produce.
	 */
	assignTermSequence(newRule, options)

	// Check `newRule.rhs` can produce a rule with applicable, conjugative `text` for each grammatical property in `newRule.gramProps`.
	if (isIllFormedGramProps(newRule)) {
		throw new Error('Ill-formed nonterminal rule')
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
 * Checks `newNonterminalRule.gramProps` does not contain unusable grammatical properties, for which `newNonterminalRule.rhs` produces no rules with conjugative `text` applicable to the property. Properties in `newNonterminalRule.gramProps` can only conjugate `text` values in the rules it produces (i.e., it's child nodes), and no further.
 *
 * For use by `NSymbol.prototype._newNonterminalRule()` when creating new nonterminal rules.
 *
 * @private
 * @static
 * @param {Object} newNonterminalRule The new nonterminal rule of which to inspect its `gramProps` property.
 * @returns {boolean} Returns `true` if `newNonterminalRule.gramProps` contains unusable grammatical properties, for which `newNonterminalRule.rhs` produces no rules with conjugative `text` applicable to the property, else `false`.
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
 * Checks if `rhs` produces no rules with conjugative `text` applicable to the non-person-number grammatical property, `gramProp`. If so, `gramProp` is useless on the rule that produces `rhs`, and therefore should be discarded.
 *
 * Non-person-number grammatical properties can only conjugate `text` on rules which their rule's RHS symbols immediately produce (i.e., its child nodes).
 *
 * `rhs` can produce either terminal rules or nonterminal term sequences (i.e., rules with `isTermSequence`).
 *
 * @static
 * @memberOf NSymbol
 * @param {string[]} rhs The RHS symbols to check if produce a rule with conjugative `text` applicable to `gramProp`.
 * @param {string} gramProp The non-person-number grammatical property name for which to check if can conjugate `rhs`; e.g., 'past', 'obj'.
 * @returns {boolean} Returns `true` if `rhs` produces no rules with conjugative `text` applicable to `gramProp` and should be discarded, else `false`.
 */
NSymbol.isFutileGramProp = function (rhs, gramProp) {
	if (nontermRuleSchema.personNumber.values.indexOf(gramProp) !== -1) {
		util.logError('`isFutileGramProp()` invoked with grammatical person-number property:', gramProp)
		throw new Error('isFutileGramProp invoked with person-number property')
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
		// Check `existingNSymbol`'s one rule has properties identical to the binary rule generated from `binaryRuleOptions`.
		// Use `existingNSymbol._newNonterminalRule()`, bound to the existing `NSymbol`, to create a temporary rule to compare. The bound `NSymbol` is only needed for mapping RHS symbols and including the symbol's name in error messages. If this invocation throws an error, it means `binaryRuleOptions` is unique anyway because the existing rule must have passed the same checks. Does not check (and throw an exception) if this temporary rule is a duplicate of an existing rule, because that occurs in `NSymbol.prototype.addRule()`).
		if (existingNSymbol._ruleExists(existingNSymbol._newNonterminalRule(binaryRuleOptions))) {
			return existingNSymbol
		}
	}
}

/**
 * Assigns binary term set properties to `newNonterminalRule` based on `ruleOptions`. For use by `NSymbol.prototype._newNonterminalRule()`.
 *
 * Defines `newRule.isTermSequence` as `true` if the RHS produces only term sets, which instructs `calcHeuristicCosts` to merge the `text` values produced by the RHS, assign the merged `text` to this rule, and prevent `pfsearch` from traversing past this rule's node.
 *
 * If `newNonterminalRule.isTermSequence` is `true`, assigns `ruleOptions.text` to `newNonterminalRule.text` for nonterminal multi-token substitutions, which instructs `pfsearch` to use this rule's display text instead of the `text` the RHS symbols produce.
 *
 * **Note:** This method mutates `newNonterminalRule`.
 *
 * @private
 * @static
 * @param {Object} newNonterminalRule The new nonterminal rule for which to assign binary term set properties.
 * @param {Object} ruleOptions The rule options object passed to `NSymbol.prototype._newNonterminalRule()`.
 * @returns {Object} Returns `newNonterminalRule`.
 */
function assignTermSequence(newNonterminalRule, ruleOptions) {
	// Check if `rhs` contains only terminal rule sets (created by `g.newVerb()` or `g.newInvariableTerm()`) or terminal rule sequences (created by `g.newTermSequence()`).
	if (ruleOptions.rhs.every(rhsSym => rhsSym.isTermSet || rhsSym.isTermSequence)) {
		/**
		 * This property instructs `calcHeuristicCosts` to merge the `text` properties of the rules produced by each of this rule's RHS symbols (i.e., the child nodes) and assign the merged `text` to this rule's node. `pfsearch` will use this merged `text` and not traverse past this rule's node (to its child nodes). `calcHeuristicCosts` also checks the child nodes' input tense, if any, for use by `pfsearch` when conjugating the merged `text`.
		 *
		 * For example, this enables the following construction:
		 *   "work|works|worked at|for" => `[work-at] -> `[work-verb]` `[at-prep]` -> "work|works|worked" "at|for"
		 * Depending on the matched terminal rules, `calcHeuristicCosts` will create the following `text` value to assign to the `[work-at]` node, which `pfsearch` uses.
		 *   `text: [ { oneSg: 'work', threeSg: 'works', pl: 'work', past: 'worked' }, 'at' ]`
		 *   `tense: 'past'` // If "worked" is matched.
		 *
		 * Merging these adjacent `text` terminal rule values is more efficient than requiring `pfsearch` to traverse the same subtree to produce identical display text for multiple parse tree.
		 *
		 * In addition, as shown by this example, without this merging of `text` values, the `text` value on the  matched `[work-verb]` terminal rule will be too far for any `grammaticalForm` conjugation property, which only conjugates its direct child nodes, on the nonterminal rule that contains `[work-at]`.
		 *
		 * This rule can be unary and neither a substitution no insertion. For example:
		 *   `[like]` -> `[love]` -> "love", "loves", "loved" text: `{love-verb-forms}`
		 */
		newNonterminalRule.isTermSequence = true

		// Temporarily forbid multiple verbs in a single binary term set. Otherwise, there can be multiple input tenses, which is difficult for `calcHeuristicCosts` to track which input tense applies to which verb in the merged `text` array.
		if (ruleOptions.acceptedTense && ruleOptions.rhs.every(rhsSym => rhsSym.termSetType === 'verb')) {
			util.logError('Binary term set contains two verbs:', ruleOptions.rhs)
			util.logPathAndObject(ruleOptions)
			throw new Error('Ill-formed nonterminal rule')
		}

		/**
		 * Display text for multi-token substitutions. The term sets produced by the RHS symbols are matched in input, `calcHeuristicCosts` checks the matched terminal rules for input tense (to maintain in verb substitutions), while `pfsearch` uses this rule's `text`.
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
		util.logErrorAndPath('Nonterminal rule has `text` does not produce a binary term set:', ruleOptions)
		throw new Error('Ill-formed nonterminal rule')
	}

	return newNonterminalRule
}

/**
 * Check `textArray` contains only strings or objects. For use when defining nonterminal substitution display text (for which the RHS contains terminal rule sets) in `NSymbol.prototype._newNonterminalRule()`.
 *
 * @private
 * @static
 * @param {(Object|string)[]} textArray The nonterminal substitution text array to inspect.
 * @returns {boolean} Returns `true` if `textArray` is empty or contains an element that is neither `String` nor `Object`, else `false`.
 */
function isIllFormedTextArray(textArray) {
	var textArrayLen = textArray.length
	if (textArrayLen === 0) {
		util.logError('Nonterminal substitution text array is empty:', textArray)
		return true
	}

	for (var t = 0; t < textArrayLen; ++t) {
		var textItem = textArray[t]
		if (textItem.constructor !== Object && textItem.constructor !== String) {
			util.logError('Item in nonterminal substitution text array is neither String nor Object:', textItem)
			return true
		}
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
	// Specify insertions that include this rule, and where the inserted segment is in the right (second) position of a binary rule, can only occur at the end of an input query. Requires `insertionCost`.
	restrictInsertion: Boolean,
	// The cost penalty added to this rule's cost.
	costPenalty: Number,
	// If `options.text` is an `Object`, then it is a set of inflected forms for conjugation.
	// If `options.text` is a `string`, then it is the literal display text.
	// If `options.text` is omitted, then there is no display text.
	text: { type: [ String, Object ] },
	// The tense of this terminal symbol that is checked against the parent nonterminal rules' `acceptedTense` property to determine if this symbol is an acceptable form of the associated verb (though not enforced by default).
	tense: nontermRuleSchema.acceptedTense,
	// Specify this rule substitutes the input terminal symbol as display text. For use by `splitRegexTerminalSymbols` to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the `text` from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols).
	isSubstitution: Boolean,
	// Specify this terminal symbol is a stop-word and does not produce any text when `rhs` is input. For use by `splitRegexTerminalSymbols` just as `options.isSubstitution`.
	isStopWord: Boolean,
}

NSymbol.prototype._newTerminalRule = function (options) {
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
		util.logError('\'text\' is an empty string, \'\':', options)
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
require('./ruleSetMethods')