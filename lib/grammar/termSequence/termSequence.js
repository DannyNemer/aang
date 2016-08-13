/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce term sequences.
 *
 * All possible reductions (i.e., subtrees) of term sequences yield only display text, no semantics. Hence, all subtrees each term sequence produces are semantically identical. `flattenTermSequence` flattens these symbols' parse nodes to single terminal nodes with a single display text.
 */

var util = require('../../util/util')
var g = require('../grammar')
var NSymbol = require('../NSymbol')
var grammarUtil = require('../grammarUtil')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `termSequence` module when searching the call stack for instantiation file paths of `NSymbol` instances that `termSequence` methods create. For use in error messages.
util.skipFileInLocationRetrieval()

/**
 * The enumerated type of term sequence types. For use when assigning the `type` parameter with `g.newTermSequence()`.
 *
 * Designed as an enumerated type, though maps properties to strings instead of numbers to include the type names when printed to console.
 *
 * @type {Object.<string, string>}
 */
exports.termTypes = {
	INVARIABLE: 'invariable',
	NOUN: 'noun',
	PRONOUN: 'pronoun',
	VERB: 'verb',
	VERB_PRESENT: 'verb-present',
	VERB_PAST: 'verb-past',
	STOP: 'stop',
}

/**
 * The substituted term wrapper parameterization, for use in `termSequenceSchema.substitutedTerms` by `NSymbol.prototype.addTermSequenceSubstitutedTerm()`, to specify properties specific to the wrapped `term`.
 *
 * @typedef {Object} SubstitutedTermWrapper
 * @property {string|NSymbol|NSymbol[]} term The terminal symbol, terminal rule set, term sequence, or term sequence pair to substitute when matched in input.
 * @property {number} [costPenalty] The cost penalty added to the rule's base cost.
 * @property {number[]} [noInsertionIndexes] If `term` is a sequence pair (array), the index(es) of its term sequence(s) for which to forbid insertion rules.
 */
var substitutedTermWrapperSchema = {
	term: { type: [ String, NSymbol, Array ], required: true },
	costPenalty: { type: Number },
	noInsertionIndexes: { type: Array, arrayType: Number },
}

/**
 * Creates an `NSymbol` that produces a terminal rule sequence forming a term or phrase, comprised of terminal rules, terminal rule sets, and nested term sequences.
 *
 * Each item in `options.acceptedTerms` and `options.substitutedTerms` must be one of the following:
 * 1. A terminal symbol.
 *   • I.e., an invariable term which `pfsearch` can not inflect when parsing.
 *   • Can not contain whitespace.
 * 2. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`,
 *    `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 3. A terminal rule sequence created by this method or `termSequence.newTermSequenceBinarySymbol()`.
 * 4. An ordered pair containing any combination of #2, #3, or nested ordered pairs from which to recursively
 *    create new term sequences.
 *
 * In addition, items in `options.substitutedTerms` may also be the following:
 * 5. `SubstitutedTermWrapper` - A term with a cost penalty and/or insertion restriction, parametrized as follows:
 *   • {string|NSymbol|NSymbol[]} SubstitutedTermWrapper.term - Any of #1-4 above.
 *   • {number} [SubstitutedTermWrapper.costPenalty] - The cost penalty added to the rule's base cost.
 *   • {number[]} [SubstitutedTermWrapper.noInsertionIndexes] - If `SubstitutedTermWrapper.term` is a
 *     sequence pair (array), the index(es) of its term sequence(s) for which to forbid insertion rules.
 *
 * The `defaultText` value (or merger of `defaultText` values) of the first term in `options.acceptedTerms` is used as the `text` value of the rules for the items in `options.substitutedTerms`, if any, which substitutes the text those rules would otherwise produce.
 *
 * All nonterminal rules the new `NSymbol` produces are marked `isTermSequence`, which instructs `flattenTermSequence` to do the following:
 * 1. For non-edit rules, `flattenTermSequence` merges the `text` values of the matched terminal rules each
 *    produces.
 * 2. For insertion rules, `flattenTermSequence` traverses the single child node, gets the `text` values of
 *    the matched terminal rules, and merges those `text` values with the rule's insertion `text` according
 *    to its `insertedSymIdx` property.
 * 3. For substitution rules, `flattenTermSequence` uses the rule's `text` value and ignores the matched
 *    terminal rules each produces.
 *
 * For all three, `flattenTermSequence` creates a new, terminal `ruleProps` for the rule's node with the `text` value defined as specified, which `pfsearch` uses to generate display text. `flattenTermSequence` also always traverses the matched terminal rules to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has matching `acceptedTense`.
 *
 * `options.type` must be one of the following:
 * 1. 'invariable'
 *   • Each term sequence in `options.acceptedTerms` and `options.substitutedTerms` has `termSequenceType` of
 *     'invariable'.
 *   • `options.acceptedTerms`and `options.substitutedTerms` can contain terminal symbols (which are
 *     invariable).
 *   • Enables use of `options.insertionCost`, assigned to the first terminal symbol in
 *     `options.acceptedTerms`.
 *   • `options.substitutedTerms` can contain term sequences with `termSequenceType` of 'pronoun', though is
 *     rare.
 *   • These restrictions ensure every accepted and substituted term sequence is invariable and produces no
 *     conjugative text objects.
 * 2. 'pronoun'
 *   • Each term sequence (or terminal rule set) in `options.acceptedTerms` has `termSequenceType` of
 *     'pronoun' and each term sequence in `options.substitutedTerms` has `termSequenceType` of 'pronoun' or
 *     'invariable'.
 *   • Term sequence pairs in `options.acceptedTerms` must contain one 'pronoun' and one 'invariable' term
 *     sequence, and every pair in `options.substitutedTerms` must contain either one 'pronoun' and one
 *     'invariable' term sequence or two 'invariable' term sequences.
 *   • These restrictions ensure every accepted term sequence produces exactly one pronoun terminal rule set,
 *     created by `g.newPronoun()`, and every substituted sequence produces exactly one pronoun terminal rule
 *     set or is invariable.
 * 3. 'noun'
 *   • Each term sequence (or terminal rule set) in `options.acceptedTerms` and `options.substitutedTerms` has
 *     `termSequenceType` of 'noun'.
 *   • Term sequence pairs in `options.acceptedTerms` and `options.substitutedTerms` must contain one 'noun'
 *     and one 'invariable' term sequence.
 *   • These restrictions ensure each term sequence produces exactly one noun terminal rule set, created by
 *     `g.newCountNoun()` or `g.newMassNoun()`.
 * 4-6. 'verb', 'verb-present', 'verb-past'
 *   • Each term sequence (or terminal rule set) in `options.acceptedTerms` and `options.substitutedTerms`
 *     has `termSequenceType` of 'verb', 'verb-present', or 'verb-past' (as `options.type` defines).
 *   • Hence, each term sequences includes verb forms of either all grammatical tenses ('verb'), present
 *     tense and excludes past tense forms ('verb-present'), or past tense and excludes present tense forms
 *     ('verb-past').
 *   • Term sequence pairs in `options.acceptedTerms` and `options.substitutedTerms` must contain one 'verb'
 *     and one 'invariable' term sequence.
 *   • Term sequence pairs in `options.acceptedTerms` in and `options.substitutedTerms` must contain one
 *     'verb'/'verb-present'/'verb-past' term sequence (as `options.type` defines) and one 'invariable' term
 *     sequence.
 *   • These restrictions ensure each term sequence produces exactly one verb terminal rule set, created by
 *     `g.newVerb()` or `g.newTenseVerb()` of matching tense.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName`.
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - `options.type`.
 * • defaultText - The `defaultText` value (or merger of `defaultText` values) of the first term sequence (or terminal rule set) in `options.acceptedTerms`. For use when nesting this `NSymbol` in another term sequence.
 * • insertionCost - `options.insertionCost`, if defined.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the new `NSymbol`.
 * @param {string} options.type The term sequence type, as explained above.
 * @param {number} [options.insertionCost] The insertion cost for the term sequence, assigned to the first terminal symbol in `options.acceptedTerms`, if any. Enables the creation of insertion rules using the new nonterminal symbol that produces this set. Only permitted if `options.type` is 'invariable'.
 * @param {(string|NSymbol|NSymbol[])[]} options.acceptedTerms The terminal symbols, terminal rule sets, term sequences, and term sequence pairs to accept when input, as explained above.
 * @param {(string|NSymbol|NSymbol[]|SubstitutedTermWrapper)[]} [options.substitutedTerms] The terminal symbols, terminal rule sets, term sequences, and term sequence pairs (with a cost penalty and/or insertion restriction if `SubstitutedTermWrapper`) to substitute when matched with the first item in `options.acceptedTerms`, as explained above.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var termSequenceSchema = {
	symbolName: { type: String, required: true },
	type: {
		values: util.without(Object.keys(exports.termTypes).map(term => exports.termTypes[term]), exports.termTypes.STOP),
		required: true,
	},
	insertionCost: Number,
	acceptedTerms: { type: Array, arrayType: [ String, NSymbol, Array ], required: true },
	substitutedTerms: { type: Array, arrayType: [ String, NSymbol, Array, Object ] },
}

exports.newTermSequence = function (options) {
	if (util.illFormedOpts(termSequenceSchema, options) || isIllFormedTermSequenceOptions(options)) {
		throw new Error('Ill-formed term sequence')
	}

	// Create the `NSymbol` that produces the terminal rule sequence.
	var termSeqSym = g.newSymbol(options.symbolName)
	// The insertion cost to assign to the first terminal symbol in `options.acceptedTerms`, if any.
	var insertionCost = options.insertionCost
	/**
	 * The `defaultText` value (or merger of `defaultText` values) of the first term sequence (or terminal rule set) in `options.acceptedTerms`.
	 *
	 * For use as the `text` value of the rules for the term sequences in `options.substitutedTerms`, if any, which substitutes the `text` they produce.
	 *
	 * Can be an invariable term string, a conjugative text object, or an array of both.
	 */
	var defaultText

	options.acceptedTerms.forEach(function (term, i) {
		/**
		 * If `term` is a terminal symbol.
		 *
		 * An example:
		 *   `[term-funding]` -> "funding", text: "funding"
		 */
		if (term.constructor === String) {
			// Check `term` lacks whitespace and forbidden characters.
			if (termSequenceUtil.isIllFormedTerminalSymbol(term)) {
				throw new Error('Ill-formed terminal symbol')
			}

			// Only permit terminal symbols as accepted term sequences for 'invariable' sequences.
			if (options.type !== exports.termTypes.INVARIABLE) {
				util.logErrorAndPath('Terminal symbol provided as accepted term to parent term sequence', util.stylize(termSeqSym.name), 'of `type`', util.stylize(options.type), '(only permitted for sequences of type', util.stylize(exports.termTypes.INVARIABLE) + '):', util.stylize(term), options)
				throw new Error('Ill-formed term sequence')
			}

			var newTerminalRule = {
				isTerminal: true,
				rhs: term,
				text: term,
			}

			// Assign `options.insertionCost`, if defined, to the first accepted terminal symbol.
			if (insertionCost !== undefined) {
				newTerminalRule.insertionCost = insertionCost
				// Track when `options.insertionCost` has been assigned to the first terminal symbol in `options.acceptedTerms`, which may not be the first element in the array.
				insertionCost = undefined
			}

			termSeqSym.addRule(newTerminalRule)

			// If `term` is the first item in `options.acceptedTerms`, save it as display text for `options.substitutedTerms`, if any.
			if (i === 0) {
				defaultText = term
			}
		}

		/**
		 * If `term` is a term sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()` (or a terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`).
		 *
		 * An example where `term` is the 'verb' terminal rule set `[make]`:
		 *   `[create]` -> `[make]` -> "make", text: `{make-verb-forms}`
		 *
		 * An example where `term` it the 'verb' mulit-term sequence `[work-on]`:
		 *   `[contribute-to]` -> `[work-on]` -> `[work]` -> "work", text: `{work-verb-forms}`
		 *                                    -> `[on]`   -> "on",   text: "on"
		 */
		else if (term.isTermSequence) {
			if (term.termSequenceType !== options.type) {
				util.logErrorAndPath('Term sequence', util.stylize(term.name), 'of type', util.stylize(term.termSequenceType), 'provided to parent term sequence of type', util.stylize(options.type) + ':', options)
				throw new Error('Ill-formed term sequence')
			}

			/**
			 * Even though this rule is unary and does not require `text` merging, `NSymbol` still assigns the rule property `isTermSequence` to instruct `flattenTermSequence` to bring the `text` up to this rule's node level, allowing `gramProps` to conjugate the `text` (`gramProps` only conjugates the immediate child nodes).
			 *
			 * Even if `term` is a terminal rule set, for which the `text` value of every terminal rule is identical, do not assign that `text` to this rule as if it were a substitution. Although the parsing result will be identical, leave them distinguishable for now.
			 */
			termSeqSym.addRule({
				rhs: [ term ],
			})

			/**
			 * If `term` is the first item in `options.acceptedTerms`, save its `defaultText` value as display text for `options.substitutedTerms`, if any.
			 * • If `term` is a terminal rule set, `defaultText` is the identical `text` of all terminal rules in the set.
			 * • If `term` is a term sequence, `defaultText` is the display text of the first accepted term sequence it produces.
			 */
			if (i === 0) {
				defaultText = term.defaultText
			}
		}

		/**
		 * If `term` is an ordered pair containing any combination of term sequences, terminal rule sets, or nested ordered pairs from which to recursively create new term sequences, for which one item has term sequence type `options.type` and the other has type 'invariable'.
		 *
		 * An example of two terminal rule sets:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to",         text: "to"
		 *
		 * An example of a terminal rule set (`[have]`) and a term sequence (`[in-common]`):
		 *   `[have-in-common]` -> `[have]`                    -> "have",   text: `{have-verb-forms}`
		 *                      -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                       -> `[common]` -> "common", text: "common"
		 *
		 * An example of a terminal rule set (`[have]`) and a nested ordered pair of terminal rule sets (`[in]` and `[common]`) from which to recursively create a new term sequence (`[in-common]`):
		 *   `[have-in-common]` -> `[have]`                              -> "have", text: `{have-verb-forms}`
		 *                      -> [ `[in]` `[common] ] -> `[in-common]` -> `[in]`     -> "in",     text: "in"
		 *                                                               -> `[common]` -> "common", text: "common"
		 */
		else if (term.constructor === Array) {
			/**
			 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence.
			 *
			 * Pass `options.type` to check the resulting term term sequence pair produces only one term sequence of type `options.type` and all others are 'invariable'.
			 */
			var termSeqPair = flattenNestedTermSequencePairs(term, options.type)

			// `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node's node to instruct `pfsearch` to use as display text and not traverse further.
			termSeqSym.addRule({
				rhs: termSeqPair,
			})

			/**
			 * If `term` is the first item in `options.acceptedTerms`, merge the `defaultText` values of the pair's term sequences as display text for for `options.substitutedTerms`, if any.
			 * • If an item in the pair is a verb, its `defaultText` is the identical `text` of all terminal rules in the set.
			 * • If an item in the pair is a term sequence, its `defaultText` is the display text of the first accepted term sequence it produces.
			 */
			if (i === 0) {
				defaultText = grammarUtil.mergeTextPair(termSeqPair[0].defaultText, termSeqPair[1].defaultText)
			}
		}

		else {
			util.logErrorAndPath('Accepted term is neither a terminal symbol, terminal rule set, term sequence, nor a term sequence pair:', term, options)
			throw new Error('Ill-formed term sequence')
		}
	})

	/**
	 * Extend `termSeqSym` with term sequence properties. Enables nesting of `termSeqSym` in other term sequences with matching term sequence type.
	 *
	 * Invoke before invoking `termSeqSym.addTermSequenceSubstitutedTerm()`, which checks for the `NSymbol` properties this method adds.
	 */
	termSeqSym._toTermSequence({
		type: options.type,
		// Either the `defaultText` value (or merger of `defaultText` values) of the term sequence or terminal rule set in its first rule, or is the display text of its first rule if terminal.
		defaultText: defaultText,
		insertionCost: options.insertionCost,
	})

	// If provided, create nonterminal substitution rules with `defaultText` as the `text` value for each rule. The `text` value instructs `flattenTermSequence` to use display text from these rules' nodes and discard the `text` values the nodes' descendants produce.
	if (options.substitutedTerms) {
		options.substitutedTerms.forEach(function (term) {
			termSeqSym.addTermSequenceSubstitutedTerm(term)
		})
	}

	return termSeqSym
}

/**
 * Checks if `options`, which was passed to `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The term sequence options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedTermSequenceOptions(options) {
	// Prevent 'stop' for `type`; restrict to `g.newStopSequence()`.
	if (options.type === exports.termTypes.STOP) {
		util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `type`', util.stylize(exports.termTypes.STOP), ', which is restricted to `g.newStopSequence()`:', options)
		return true
	}

	if (options.insertionCost !== undefined) {
		// Check `options.insertionCost` only exists for invariable term sequences (the only type permitted to have accepted terminal rules).
		if (options.type !== exports.termTypes.INVARIABLE) {
			util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `insertionCost` but does not have `type`', util.stylize(exports.termTypes.INVARIABLE) + ':', options)
			return true
		}

		// Check `options.acceptedTerms` contains a terminal symbol for which to assign `options.insertionCost`.
		if (!options.acceptedTerms.some(term => term.constructor === String)) {
			util.logErrorAndPath('Term sequence', util.stylize(options.symbolName), 'has `insertionCost` but no terminal symbol (i.e., string) in `options.acceptedTerms` to which to assign it:', options)
			return true
		}
	}

	return false
}

/**
 * Adds a nonterminal term sequence substitution rule to this `NSymbol` for RHS `term` with `this.defaultText` as its `text` value.
 *
 * This substitution rule instructs `pfsearch` to use display text from this rule and discard the `text` values the rule's descendants produce.
 *
 * `term` must adhere to the term sequence type restrictions outlined in the description of `termSequence.newTermSequence()`.
 *
 * For use by `termSequence.newTermSequence()`.
 *
 * @memberOf NSymbol
 * @param {string|NSymbol|NSymbol[]|SubstitutedTermWrapper} term The terminal symbol, terminal rule set, term sequence, or term sequence pair (with a cost penalty and/or insertion restriction if `SubstitutedTermWrapper`) to substitute when matched with `this.defaultText`.
 * @returns {NSymbol} Returns this `NSymbol` instance.
 */
NSymbol.prototype.addTermSequenceSubstitutedTerm = function (term) {
	if (forbidsSubstitutedTerm(this, term)) {
		throw new Error('Ill-formed substituted term sequence')
	}

	// The substitution cost penalty incurred when `term` is matched in input (and substituted).
	var costPenalty = 0

	var noInsertionIndexes
	if (term.constructor === Object) {
		if (isIllFormedSubstitutedTermWrapper(term)) {
			throw new Error('Ill-formed substituted term sequence')
		}

		costPenalty = term.costPenalty || 0
		noInsertionIndexes = term.noInsertionIndexes
		term = term.term
	}

	/**
	 * If `term` is a terminal symbol.
	 *
	 * A substitution example:
	 *   `[prep-day]` -> "in", text: "on"
	 */
	if (term.constructor === String) {
		// Check `term` lacks whitespace and forbidden characters.
		if (termSequenceUtil.isIllFormedTerminalSymbol(term)) {
			throw new Error('Ill-formed terminal symbol')
		}

		// Only permit terminal symbols as substituted term sequences for 'invariable' or 'pronoun' sequences.
		if (this.termSequenceType !== exports.termTypes.INVARIABLE && this.termSequenceType !== exports.termTypes.PRONOUN) {
			util.logErrorAndPath('Terminal symbol provided as substituted term to parent term sequence', util.stylize(this.name), 'of type', util.stylize(this.termSequenceType), '(only permitted for sequences of type', util.stylize(exports.termTypes.INVARIABLE), 'or', util.stylize(exports.termTypes.PRONOUN) + '):', util.stylize(term))
			throw new Error('Ill-formed substituted term sequence')
		}

		// `pfsearch` uses this rule's `text` as display text instead of the matched terminal symbol it produces (i.e., `term`).
		return this.addRule({
			isTerminal: true,
			rhs: term,
			text: this.defaultText,
			costPenalty: costPenalty,
		})
	}

	/**`
	 * If `term` is a term sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()` (or a terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`).
	 *
	 * A substitution example where `term` is the 'verb' terminal rule set `[love]`:
	 *   `[like]` -> `[love]`, text: `{like-verb-forms}`
	 *
	 * A substitution example where `term` the 'verb' multi-term sequence `[help-with]`:
	 *   `[contribute-to]` -> `[help-with]`, text: `[ {contribute-verb-forms}, "to" ]`
	 */
	if (term.isTermSequence) {
		/**
		 * Check substituted term sequence, `term`, is of matching term sequence type, `this.termSequenceType`.
		 *
		 * Verb sequences that only produce the verb forms of a specific grammatical tense are distinguished like all other term sequence types; e.g., 'verb-past'.
		 */
		if (!termSequenceUtil.isTermSequenceType(term, this.termSequenceType)) {
			/**
			 * 'pronoun' - Substituted term sequences must be of type 'pronoun' or 'invariable'. For example:
			 *   `[1-sg]` -> "myself", text: {1-sg-pronoun-forms}
			 */
			if (this.termSequenceType === exports.termTypes.PRONOUN) {
				if (!termSequenceUtil.isTermSequenceType(term, exports.termTypes.INVARIABLE)) {
					util.logErrorAndPath('Substituted term sequence', util.stylize(term.name), 'of type', util.stylize(term.termSequenceType), 'provided to parent term sequence', util.stylize(this.name), 'is neither of required type', util.stylize(this.termSequenceType), 'nor', util.stylize(exports.termTypes.INVARIABLE) + ':', util.deleteUndefinedObjectProps(term))
					throw new Error('Ill-formed substituted term sequence')
				}
			}

			/**
			 * 'invariable' - Substituted term sequences must be of type 'invariable' or 'pronoun', though the latter is rare and therefore not noted in the error message. For example:
			 *   `[1-sg-poss-det]` -> `[1-sg]`, text: "my"
			 *
			 * 'verb', 'verb-present', 'verb-past': Substituted term sequences must be of matching type.
			 */
			else if (this.termSequenceType !== exports.termTypes.INVARIABLE || !termSequenceUtil.isTermSequenceType(term, exports.termTypes.PRONOUN)) {
				util.logErrorAndPath('Substituted term sequence', util.stylize(term.name), 'of type', util.stylize(term.termSequenceType), 'provided to parent term sequence', util.stylize(this.name), 'of type', util.stylize(this.termSequenceType) + ':', util.deleteUndefinedObjectProps(term))
				throw new Error('Ill-formed substituted term sequence')
			}
		}

		// `pfsearch` uses this rule's `text` as display text instead of the `text` values its RHS produces.
		return this.addRule({
			rhs: [ term ],
			text: this.defaultText,
			costPenalty: costPenalty,
		})
	}

	/**
	 * If `term` is an ordered pair containing any combination of term sequences, terminal rule sets, or nested ordered pairs from which to recursively create new term sequences, for which one item has term sequence type `this.termSequenceType` and the other has type 'invariable'.
	 *
	 * A substitution example of two terminal rule sets:
	 *   `[contribute-to]` -> `[help]` `[with]`, text: `[ {contribute-verb-forms}, "to" ]`
	 *
	 * A substitution example of a terminal rule set (`[have]`) and a term sequence (`[in-common]`):
	 *   `[share]` -> `[have]` `[in-common]`, text: `{share-verb-forms}`
	 *
	 * A substitution example of a terminal rule set (`[have]`) and a nested ordered pair of terminal rule sets (`[in]` and `[common]`) from which to recursively create a new term sequence (`[in-common]`):
	 *   `[share]` -> `[have]` [ `[in]` `[common] ] -> `[have]` `[in-common]`, text: `{share-verb-forms}`
	 */
	if (term.constructor === Array) {
		/**
		 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence.
		 *
		 * Pass `this.termSequenceType` to check the resulting term term sequence pair produces only one term sequence of type `this.termSequenceType` and all others are 'invariable'.
		 *
		 * Pass `true` as third argument to specify `term` is a substituted term sequence pair and has the same term sequence type exceptions as the substituted term sequences above (e.g., invariable term sequence pairs a pronoun substitutions).
		 */
		var termSeqPair = flattenNestedTermSequencePairs(term, this.termSequenceType, true)

		// `pfsearch` uses this rule's `text` as display text instead of the `text` values its RHS produces.
		var newTermSequencePairRule = {
			rhs: termSeqPair,
			text: this.defaultText,
			costPenalty: costPenalty,
		}

		// If defined, prevent creation of insertion rules for the term sequence(s) in `termSeqPair` at the specified index(es).
		if (noInsertionIndexes) {
			// Temporarily map `newTermSequencePairRule.rhs` to use `RHSSymbolWrapper`. Will later extend `termSequence.newTermSequence()` to accept the `RHSSymbolWrapper` format.
			noInsertionIndexes.forEach(function (noInsertIndex) {
				newTermSequencePairRule.rhs[noInsertIndex] = {
					symbol: newTermSequencePairRule.rhs[noInsertIndex],
					noInsert: true,
				}
			})
		}

		return this.addRule(newTermSequencePairRule)
	}

	util.logErrorAndPath('Substituted term is neither a terminal symbol, terminal rule set, term sequence, nor a term sequence pair:', term)
	throw new Error('Ill-formed substituted term sequence')
}

/**
 * Checks if `termSequenceSym` forbids the addition of a substituted term sequence. If so, prints an error.
 *
 * For use by `NSymbol.prototype.addTermSequenceSubstitutedTerm()`.
 *
 * @private
 * @static
 * @param {NSymbol} termSequenceSym The term sequence to inspect.
 * @param {string|NSymbol|NSymbol[]|SubstitutedTermWrapper} term The terminal symbol, terminal rule set, term sequence, or term sequence pair to add as substitute rule to `termSequenceSym`, for use in error messages.
 * @returns {boolean} Returns `true` if `termSequenceSym` forbids substituted term sequences.
 */
function forbidsSubstitutedTerm(termSequenceSym, term) {
	if (!termSequenceSym.isTermSequence) {
		util.logErrorAndPath('Attempting to add a substituted term to', util.stylize(termSequenceSym.name), ', which is not a term sequence (created with `g.newTermSequence()`:', term.constructor === String ? util.stylize(term) : util.deleteUndefinedObjectProps(term))
		return true
	}

	if (termSequenceSym.isTermSet) {
		util.logErrorAndPath('Attempting to add a substituted term to terminal rule set', util.stylize(termSequenceSym.name) + ':', term.constructor === String ? util.stylize(term) : util.deleteUndefinedObjectProps(term))
		return true
	}

	if (termSequenceSym.termSequenceType === exports.termTypes.STOP) {
		util.logErrorAndPath('Attempting to add a substituted term to', util.stylize(exports.termTypes.STOP), 'sequence', util.stylize(termSequenceSym.name) + ':', term.constructor === String ? util.stylize(term) : util.deleteUndefinedObjectProps(term))
		return true
	}

	return false
}

/**
 * Checks if `substitutedTerm`, which is a `SubstitutedTermWrapper` passed to `termSequence.newTermSequence(termSeqOptions)` in `termSeqOptions.substitutedTerms`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {SubstitutedTermWrapper} substitutedTerm The substituted term wrapper to inspect.
 * @returns {boolean} Returns `true` if `substitutedTerm` is ill-formed, else `false`.
 */
function isIllFormedSubstitutedTermWrapper(substitutedTerm) {
	if (util.illFormedOpts(substitutedTermWrapperSchema, substitutedTerm)) {
		return true
	}

	if (substitutedTerm.noInsertionIndexes) {
		if (substitutedTerm.term.constructor !== Array) {
			util.logErrorAndPath('Substituted term wrapper with `noInsertionIndexes` used with a `term` of type', util.colors.cyan(substitutedTerm.term.constructor.name), 'instead of a term sequence pair:', substitutedTerm)
			return true
		}

		if (substitutedTerm.noInsertionIndexes.some(idx => substitutedTerm.term[idx] === undefined)) {
			util.logErrorAndPath('Substituted term wrapper `noInsertionIndexes` contains an out-of-bounds term sequence pair index:', substitutedTerm)
			return true
		}
	}

	return false
}

/**
 * Creates an `NSymbol` with a single binary rule with `options.termPair` as its `rhs`, which produces a terminal sequence forming a phrase comprised of terminal rule sets and nested term sequences.
 *
 * Each item in `options.termPair` must be one of the following:
 * 1. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or this method.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively
 *    create new term sequences.
 *
 * The single rule the new `NSymbol` produces is marked `isTermSequence`, which instructs `flattenTermSequence` to merge the `text` values of the matched terminal rules this rule produces.
 * • `flattenTermSequence` creates a new, terminal `ruleProps` for the rule's node with the `text` value, which
 *   `pfsearch` uses as display text. `flattenTermSequence` also always traverses the matched terminal rules
 *   to get the input tense of any matched verb terminal rules, which `pfsearch` uses if the parent rule has
 *   matching `acceptedTense`.
 *
 * `options.type` must be one of the following:
 * 1. 'invariable'
 *   • Each term sequence `options.termPair` produces is comprised of sequences with `termSequenceType` of
 *     'invariable'.
 *   • If `_isSubstitution` is `true`, `options.termPair` can contain a term sequence with `termSequenceType`
 *     of 'pronoun', though is rare.
 * 2. 'pronoun'
 *   • Each term sequence `options.termPair` produces includes one term with `termSequenceType` of 'pronoun'
 *     and all other terms are 'invariable'.
 *   • If `_isSubstitution` is `true`, `options.termPair` may otherwise produce only 'invariable' terms.
 * 3. 'noun'
 *   • Each term sequence `options.termPair` produces includes one term with `termSequenceType` of 'noun' and
 *     all other terms are 'invariable'.
 * 4-6. 'verb', 'verb-present', 'verb-past'
 *   • Each term sequence `options.termPair` produces includes one term with `termSequenceType` of 'verb',
 *     'verb-present', or 'verb-past' (as `options.type` defines), and all other terms are 'invariable'.
 *
 * The private parameters `_isSubstitution` and `_isNestedTermSequence` are used internally for nested term sequence pair type checks in `isIllFormedTermSequencePair()`:
 * • If `_isNestedTermSequence` is true`, manually checks whether `options.termPair` produces a term of
 *   non-invariable type.
 *   – For use when `options.termPair` was defined as a nested term sequence pair within another term
 *     sequence pair passed to this method or `termSequence.newTermSequence()`.
 *   - `options.type` only specifies if the entire base sequence (after flattening) contains a single term of
 *     type `options.type`, not every bigram within the sequence. E.g., do not check if the bigram "in
 *     common" within the verb sequence "have in common" contains a verb.
 *
 * The returned `NSymbol` has the following properties:
 * • name - `options.symbolName` if defined, else the concatenation of the names of the `NSymbol` instances
 *   in `options.termPair` (after flattening nested ordered pairs).
 * • isTermSequence - `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
 * • termSequenceType - `options.type` if `_isNestedTermSequence` is falsey, else the type of the
 *   non-invariable term in `options.termPair`, else 'invariable' if both terms in `options.termPair` are
 *   invariable.
 * • defaultText - The merger of the `defaultText` values of the term sequences in `options.termPair`. For
 *   use when nesting this `NSymbol` in another term sequence.
 *
 * @memberOf termSequence
 * @param {Object} options The options object.
 * @param {string} [options.symbolName] The name for the new `NSymbol`. If omitted, concatenates the names of the `NSymbol` instances in `options.termPair` (after flattening nested ordered pairs).
 * @param {string} options.type The term sequence type, as documented above.
 * @param {(NSymbol|NSymbol[])[]} options.termPair The ordered pair of term sequences and/or nested term sequence pairs.
 * @param {boolean} [_isSubstitution] Specify `options.termPair` is substituted when matched in input. Necessary for term sequence pair type check exceptions for substitutions of certain types.
 * @param {boolean} [_isNestedTermSequence] Specify `options.termPair` was defined as a nested term sequence pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule sequence.
 */
var binaryTermSequenceSchema = {
	symbolName: String,
	type: termSequenceSchema.type,
	termPair: { type: Array, arrayType: [ NSymbol, Array ], required: true },
}

exports.newTermSequenceBinarySymbol = function (options, _isSubstitution, _isNestedTermSequence) {
	if (util.illFormedOpts(binaryTermSequenceSchema, options) || isIllFormedTermSequenceOptions(options)) {
		throw new Error('Ill-formed binary term sequence')
	}

	/**
	 * Recursively flatten any nested ordered pairs to `NSymbol` instances that produce the term sequence.
	 * • Check `options.termPair` is a valid ordered pair.
	 *
	 * Pass `options.type` to check the resulting term sequence pair does contain a term sequence of type other than `options.type` or 'invariable'.
	 *
	 * Pass `_isSubstitution` to specify `options.termPair` is a substituted term sequence pair with the substituted term sequence type exceptions specified in the method description.
	 *
	 * Pass `_isNestedTermSequence` to specify whether `options.termPair` is nested term sequence pair within another term sequence pair. If falsey, checks `termSeqPair` produces only one term sequence of type `options.type` and all others are 'invariable'.
	 * • If `true`, does not check if `options.termPair` contains a sequence of type `options.type` because `options.type` only specifies if the entire base sequence contains a single term of type `options.type`, not every bigram within the sequence. E.g., do not check if the bigram "in common" within the verb sequence "have in common" contains a verb.
	 */
	var termSeqPair = flattenNestedTermSequencePairs(options.termPair, options.type, _isSubstitution, _isNestedTermSequence)
	var termA = termSeqPair[0]
	var termB = termSeqPair[1]

	/**
	 * Create the `NSymbol` that produces the terminal rule sequence.
	 *
	 * When parsing, `flattenTermSequence` will traverse this rule's child nodes, merge the `text` values of the matched terminal rules it produces, and create a new, terminal `ruleProps` for the rule's node to instruct `pfsearch` to use as display text and not traverse further.
	 */
	var termSeqSym = g.newSymbol(options.symbolName || g.hyphenate(termA.name, termB.name)).addRule({
		rhs: termSeqPair,
	})

	var termSequenceType
	if (_isNestedTermSequence) {
		/**
		 * Manually check whether `termSeqSym` produces a term of non-invariable type when `options.termPair` was defined as a nested term sequence pair within another term sequence pair passed to this method or `termSequence.newTermSequence()`. This is necessary because `options.type` only specifies if the entire base sequence (after flattening) contains a single term of type `options.type`, not every bigram within the sequence.
		 *
		 * For example, consider the following verb sequence passed to either of the two aforementioned methods:
		 *   `[ `[have]`, [ `[in]` `[common]` ] ]`
		 * This method creates a new `NSymbol` and binary rule for the nested array, `[ `[in]` `[common]` ]`, but can not use the `options.type` value passed with the root array because it is incorrect for this child rule within the verb sequence.
		 *
		 * Further, consider the following restructuring of the same verb sequence:
		 *   `[ [ `[have]` `[in]` ], `[common]` ]`
		 * As the previous example demonstrates, this method can not rely on `options.type` for nested term sequences. Hence, it manually checks if such nested pairs contain a non-invariable type.
		 *
		 * Perform this check after invoking `flattenNestedTermSequencePairs()` with `options.termPair` above to ensure either both terms are invariable, or one is invariable and the other is a conjugative sequence of type `options.type`.
		 *
		 * If `termA` is invariable, then `termB` is either invariable and the whole sequence is invariable, or `termB` is the conjugative sequence and defines this sequence's type. Else, `termB` is the conjugative sequence and defines this sequence's type.
		 */
		termSequenceType = termA.termSequenceType === exports.termTypes.INVARIABLE ? termB.termSequenceType : termA.termSequenceType
	} else {
		// Define the `termSeqSym` term sequence type, which specifies each term sequence `termSeqSym` produces contains a single term of type `options.type` and all other terms within the sequence are of type 'invariable'.
		termSequenceType = options.type
	}

	// Extend `termSeqSym` with term sequence properties. Enables nesting of `termSeqSym` in other term sequences with matching term sequence type.
	return termSeqSym._toTermSequence({
		type: termSequenceType,
		// The merger of `defaultText` values of the term sequences in `options.termPair`.
		defaultText: grammarUtil.mergeTextPair(termA.defaultText, termB.defaultText),
	})
}

/**
 * Checks `termSeqPair` is a valid term sequence pair and recursively flattens any nested ordered pairs to `NSymbol` instances that produce the nested term sequence. If `termSeqPair` is invalid, throws an exception.
 *
 * Each item in `termSeqPair` must be one of the following:
 * 1. A terminal rule set created by `verbTermSet.newVerb()`, `verbTermSet.newTenseVerb()`, `pronounTermSet.newPronoun()`, `nounTermSet.newCountNoun()`, or `nounTermSet.newMassNoun()`.
 * 2. A terminal rule sequence created by `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()`.
 * 3. An ordered pair containing any combination of #1, #2, or nested ordered pairs from which to recursively create new term sequences with `termSequence.newTermSequenceBinarySymbol()`.
 *
 * Performs the following `termSeqPair` checks after flattening any nested term sequence pairs:
 * • Checks `termSeqPair` does not contain two non-invariable term sequences.
 * • Checks `termSeqPair` does not contain non-invariable term sequences of type other than `termSequenceType`.
 * • If `isNestedTermSequence` is falsey, checks `termSeqPair` contains contains one invariable term sequence and one of type `termSequenceType`.
 *
 * Returns the flattened ordered pair of `NSymbol` instances for use as a term sequence binary rule's `rhs`.
 *
 * @private
 * @static
 * @param {(NSymbol|NSymbol[])[]} termSeqPair The term sequence ordered pair to validate and flatten.
 * @param {string} termSequenceType The required term sequence type of `termSeqPair`.
 * @param {boolean} isSubstitution Specify `termSeqPair` is substituted when matched in input. Necessary for term sequence pair type check exceptions for substitutions of certain types.
 * @param {boolean} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term sequence pair within another term sequence pair passed to `termSequence.newTermSequenceBinarySymbol()` or `termSequence.newTermSequence()`.
 * @returns {NSymbol[]} Returns `termSeqPair` with any nested term sequences pairs flattened.
 */
function flattenNestedTermSequencePairs(termSeqPair, termSequenceType, isSubstitution, isNestedTermSequence) {
	// Check `termSeqPair` is an ordered pair, does not contains `undefined`.
	if (isIllFormedTermSequenceOrderedPair(termSeqPair)) {
		throw new Error('Ill-formed term sequence pair')
	}

	for (var t = 0, termSeqLen = termSeqPair.length; t < termSeqLen; ++t) {
		var termSym = termSeqPair[t]
		if (termSym.constructor === Array) {
			/**
			 * Recursively create an `NSymbol` that produces a single binary rule for the term sequence of this nested ordered pair.
			 *
			 * Pass `isSubstitution` for term sequence type check exceptions when `termSequence.newTermSequenceBinarySymbol()` re-invokes this function with `termSym` to validate its contents.
			 *
			 * Pass `true` for the method's third parameter, `isNestedTermSequence`, to instruct the method to manually check if the pair `termSym` contains a term of type `termSequenceType` or is entirely invariable.
			 * • This is necessary because `termSequenceType` only specifies if the entire base sequence contains a single term of type `termSequenceType` (e.g., 'verb') and all others (at whatever nesting level) are of type 'invariable', not every bigram within the sequence (i.e., recursive invocations of this function). E.g., do not check if the bigram "in common" within the verb sequence "have in common" contains a verb.
			 */
			termSeqPair[t] = exports.newTermSequenceBinarySymbol({
				// `termSequence.newTermSequenceBinarySymbol()` will check `termSym` is a valid ordered pair when it recursively invokes this function with `termSym`.
				termPair: termSym,
				// Pass the base sequence type so that if `termSequenceType` is not invariable, `isIllFormedTermSequencePair()` can catch any further nested term sequence pairs that contain a sequence of type other than (neutral) 'invariable' or `termSequenceType`.
				type: termSequenceType,
			}, isSubstitution, true)
		} else if (!termSym.isTermSequence) {
			util.logErrorAndPath('Term is terminal rule set, term sequence, nor a nested term sequence pair:', util.stylize(termSym))
			throw new Error('Ill-formed term sequence')
		}
	}

	/**
	 * Perform the following `termSeqPair` checks after flattening any nested term sequence pairs:
	 * • Check `termSeqPair` does not contain two non-invariable term sequences.
	 * • Check `termSeqPair` does not contain non-invariable term sequences of type other than `termSequenceType`.
	 * • If `isNestedTermSequence` is falsey, check `termSeqPair` contains contains one invariable term sequence and one of type `termSequenceType`.
	 */
	if (isIllFormedTermSequencePair(termSeqPair, termSequenceType, isSubstitution, isNestedTermSequence)) {
		throw new Error('Ill-formed term sequence pair')
	}

	// The flattened ordered pair of `NSymbol` instances for use as a term sequence binary rule's `rhs`.
	return termSeqPair
}

/**
 * Checks if `termSeqPair` is ill-formed. If so, prints an error.
 *
 * For use by `flattenNestedTermSequencePairs()` after it flattens any nested term sequence pairs in `termSeqPair`.
 *
 * Checks `termSeqPair` does not contain two non-invariable term sequences. This temporarily forbids terms sequences from containing multiple conjugative terms.
 * • A single term sequence with multiple conjugative terms would require `flattenTermSequence` to support nested conjugation, because it requires separately specifying the desired grammatical form of each conjugative term.
 * • Prevents multiple instances of verbs with `tense` within a single verb sequence, which would require `flattenTermSequence` to map a terminal rule's input tense to a particular item in the merged `text` array to know to which text object the `tense` value applies.
 *
 * Checks `termSeqPair` does not contain non-invariable term sequences of type other than `termSequenceType`. There are exceptions, documented internally.
 *
 * If `isNestedTermSequence` is falsey, specifies `termSeqPair` is the base term sequence passed to `termSequence.newTermSequenceBinarySymbol()` or `termSequence.newTermSequence()`. When so, checks `termSeqPair` contains one invariable term sequence and one of type `termSequenceType` (which might also be 'invariable'). There are exceptions, documented internally.
 * • `isNestedTermSequence` must be falsey because because `termSequenceType` only specifies if the entire base sequence contains a single term of type `termSequenceType` (e.g., 'verb') and all others (at whatever nesting level) are of type 'invariable', not every bigram within the sequence.
 * • E.g., do not check if the bigram "in common" within the verb sequence "have in common" contains a verb.
 *
 * @private
 * @static
 * @param {NSymbol[]} termSeqPair The (flattened) term sequence ordered pair to inspect.
 * @param {string} termSequenceType The required term sequence type of `termSeqPair`.
 * @param {boolean} isSubstitution Specify `termSeqPair` is substituted when matched in input. Necessary for term sequence pair type check exceptions for substitutions of certain types.
 * @param {boolean} [isNestedTermSequence] Specify `termSeqPair` was defined as a nested term sequence pair within another term sequence pair passed to `termSequence.newTermSequenceBinarySymbol()` or `termSequence.newTermSequence()`.
 * @returns {boolean} Returns `true` if `termSeqPair` is ill-formed, else `false`.
 */
function isIllFormedTermSequencePair(termSeqPair, termSequenceType, isSubstitution, isNestedTermSequence) {
	// Check `termSeqPair` is an ordered pair, does not contains `undefined`.
	if (isIllFormedTermSequenceOrderedPair(termSeqPair)) {
		return true
	}

	// Check `termSeqPair` only contains term sequences.
	if (!termSeqPair.every(term => term.isTermSequence)) {
		util.logErrorAndPath('Non-term sequence provided in term sequence pair:', termSeqPair)
		return true
	}

	/**
	 * Alert if both term sequences in `termSeqPair` are not non-invariable (i.e., conjugative). Always check irrespective of `isNestedTermSequence`.
	 *
	 * Check for two non-invariable term sequences instead of two of type `termSequenceType` because there are exceptions for when non-invariable sequences of a type other than `termSequenceType` are permitted. For example, as checked below, pronouns are permitted as substitutions for invariable term sequences:
	 *   `[1-sg-poss-det]` -> `[1-sg-pronoun]`, text: "my"
	 */
	if (termSeqPair.every(term => term.termSequenceType !== exports.termTypes.INVARIABLE)) {
		util.logErrorAndPath('Term sequence pair contains two non-' + util.stylize(exports.termTypes.INVARIABLE), '(i.e., conjugative) term sequences:', termSeqPair)
		return true
	}

	// Alert if `termSeqPair` contains a term sequence that is neither of type `termSequenceType` nor invariable (i.e., neutral).
	for (var t = 0, termSeqLen = termSeqPair.length; t < termSeqLen; ++t) {
		var termType = termSeqPair[t].termSequenceType

		// Check `termType` is neither invariable nor `termSequenceType`.
		if (termType !== exports.termTypes.INVARIABLE && termType !== termSequenceType) {
			/**
			 * Exception: Permit pronouns as substitutions for invariable term sequences. For example:
			 *   `[1-sg-poss-det]` -> `[1-sg-pronoun]`, text: "my"
			 */
			if (isSubstitution && termSequenceType === exports.termTypes.INVARIABLE && termType === exports.termTypes.PRONOUN) {
				continue
			}

			util.logErrorAndPath('Term sequence of type', util.stylize(termType), 'provided in term sequence pair of type', util.stylize(termSequenceType) + ':', termSeqPair)
			return true
		}
	}

	/**
	 * If `termSeqPair` is the base term sequence pair passed to `termSequence.newTermSequence()` or `termSequence.newTermSequenceBinarySymbol()` (i.e., is not a nested pair), check it contains a term of type `termSequenceType`.
	 * • The check above already ensures `termSeqPair` does not have two term of non-invariable type, so need only check for any term of type `termSequenceType`.
	 *
	 * Only check the base pair, not the nested pairs, because `termSequenceType` only specifies if the entire base sequence contains a single term of type `termSequenceType` (e.g., 'verb') and all others (at whatever nesting level) are of type 'invariable', not every bigram within the sequence.
	 * • E.g., do not check if the bigram "in common" within the verb sequence "have in common" contains a verb.
	 *
	 * If `term` is a verb with grammatical tense (i.e., only produces verb forms for the specified tense), its compatibility is checked like all other term sequence types because `verb-present` and `verb-past` are distinct types.
	 */
	if (!isNestedTermSequence && termSeqPair.every(term => term.termSequenceType !== termSequenceType)) {
			/**
			 * Exception: Permit 'invariable' sequences as substitutions for 'pronoun' sequences. Ergo, there is no term of type `termSequenceType`. For example:
			 *   `[1-sg]` -> "myself", text: {1-sg-pronoun-forms}
			 */
			if (isSubstitution && termSequenceType === exports.termTypes.PRONOUN) {
				// Check if 'pronoun' substitution neither has no 'pronoun' (above) nor is all 'invariable'.
				if (!termSeqPair.every(term => term.termSequenceType === exports.termTypes.INVARIABLE)) {
					util.logErrorAndPath('Substituted term sequence pair for', util.stylize(termSequenceType), 'sequence has neither a term of type', util.stylize(termSequenceType), 'nor is entirely terms of type', util.stylize(exports.termTypes.INVARIABLE) + ':', termSeqPair)
					return true
				}
			}

			// `termSeqPair` has no term of type `termSequenceType`.
			else {
				util.logErrorAndPath('Term sequence pair lacks term of specified type', util.stylize(termSequenceType) + ':', termSeqPair)
				return true
			}
	}

	return false
}

/**
 * Checks if `termSeqPair` is an ill-formed term sequence ordered pair. If so, prints an error.
 *
 * @private
 * @static
 * @param {NSymbol[]} termSeqPair The term sequence ordered pair to inspect.
 * @returns {boolean} Returns `true` if `termSeqPair` is ill-formed, else `false`.
 */
function isIllFormedTermSequenceOrderedPair(termSeqPair) {
	if (termSeqPair.length !== 2) {
		util.logErrorAndPath('Term sequence array is not an ordered pair:', termSeqPair)
		return true
	}

	if (termSeqPair.indexOf(undefined) !== -1) {
		util.logErrorAndPath('Term sequence array contains `undefined`:', termSeqPair)
		return true
	}

	return false
}

/**
 * Extends this symbol with term sequence properties. The properties enable nesting of this symbol in other term sequences with matching `options.type`. If `options.isTermSet`, prevents addition of further rules to this symbol.
 *
 * For use by `termSequence` and `verbTermSet` after adding term sequence rules.
 *
 * Assigns the following properties:
 * • {boolean} isTermSequence - `true`.
 * • {boolean} isTermSet - `options.isTermSet`.
 * • {string} termSequenceType - `options.type`.
 * • {Object|string|(Object|string)[]} defaultText - `options.defaultText`. Omitted if `termSequenceType` is 'stop'.
 * • {number} insertionCost - `options.insertionCost`.
 *
 * @private
 * @memberOf NSymbol
 * @param {Object} options The options object.
 * @param {boolean} [options.isTermSet] Specify this symbol produces only terminal rules, each with the same `text` value. Prevents addition of further rules to this symbol.
 * @param {string} options.type The term sequence type.
 * @param {Object|string|(Object|string)[]} [options.defaultText] The text used for substitution display text when nesting this symbol in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. Omitted if `options.type` is 'stop'.
 * @param {number} [options.insertionCost] The insertion cost of the first terminal rule this symbol produces, if any.
 * @returns {NSymbol} Returns this `NSymbol` instance after assigning the term sequence properties.
 */
var toTermSequenceSchema = {
	isTermSet: Boolean,
	type: { values: Object.keys(exports.termTypes).map(term => exports.termTypes[term]), required: true },
	defaultText: { type: [ Array, Object, String ] },
	insertionCost: Number,
}

NSymbol.prototype._toTermSequence = function (options) {
	if (util.illFormedOpts(toTermSequenceSchema, options, true) || isIllFormedToTermSequenceOptions(this, options)) {
		throw new Error('Ill-formed term sequence')
	}

	/**
	 * Specify all possible symbol reductions (i.e., subtrees) yield only display text, no semantics. Hence, all subtrees this symbol produces are semantically identical. Enables nesting within term sequences and instructs `flattenTermSequence` to flatten instances of this symbol to a single terminal parse node with a single display text.
	 */
	this.isTermSequence = true

	/**
	 * Specify every rule this symbol produces is a single-token terminal rule with the same `text` (display text) value. A terminal rule set is subset of term sequences.
	 *
	 * Assign after adding all rule because `NSymbol.prototype.addRule()` prevents invocation on `NSymbol` instances with `isTermSet`.
	 */
	this.isTermSet = options.isTermSet

	/**
	 * Define the term sequence type, which specifies each term sequence this symbol produces is of the specified type, as described in the `termSequence.newTermSequence()` method description.
	 *
	 * For use when including this term sequence within another term sequence of matching type.
	 */
	this.termSequenceType = options.type

	/**
	 * Save `options.defaultText`:
	 * • For terminal rule sets, `options.defaultText` is the identical `text` value of every rule in the set.
	 * • For term sequences `termSequence.newTermSequence()` creates, `options.defaultText` is either the `defaultText` value (or merger of `defaultText` values) of the term sequence or terminal rule set in its first rule, or is the display text of its first rule if terminal.
	 *
	 * For use when nesting this symbol in the first accepted rule of a term sequence created with `termSequence.newTermSequence()`. If so, that new term sequence uses `this.defaultText` in its default text, which it uses as the display text for its substitution rules, if any.
	 */
	this.defaultText = options.defaultText

	// Save `options.insertionCost` for convenience; unused internally.
	this.insertionCost = options.insertionCost

	return this
}

/**
 * Checks if `options`, which was passed to `NSymbol.prototype._toTermSequence()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {NSymbol} symbol The `NSymbol` for which `NSymbol.prototype._toTermSequence(options)` was invoked.
 * @param {Object} options The `NSymbol.prototype._toTermSequence()` options object to inspect.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 */
function isIllFormedToTermSequenceOptions(symbol, options) {
	if (symbol.isTermSequence) {
		util.logErrorAndPath('`NSymbol.prototype._toTermSequence()` invoked on', util.stylize(symbol.name), 'which is already a term sequence:', options)
		return true
	}

	if (symbol.rules.length === 0) {
		util.logErrorAndPath('`NSymbol.prototype._toTermSequence()` invoked on', util.stylize(symbol.name), 'which has no rules:', options)
		return true
	}

	if (options.defaultText && options.type === exports.termTypes.STOP) {
		util.logErrorAndPath('Term sequence of type', util.stylize(options.type), 'defined with `defaultText`:', options)
		return true
	}

	if (!options.defaultText && options.type !== exports.termTypes.STOP) {
		util.logErrorAndPath('Term sequence of type', util.stylize(options.type), 'defined without `defaultText`:', options)
		return true
	}

	// If `options.type` if 'stop', check `symbol` does not produce rules that are not stop sequences.
	if (options.type === g.termTypes.STOP) {
		var symRules = symbol.rules
		for (var r = 0, rulesLen = symRules.length; r < rulesLen; ++r) {
			var rule = symRules[r]
			if (!rule.isTerminal && !rule.isStopSequence) {
				util.logError('Term sequence of type', util.stylize(options.type), 'produces a nonterminal rule without `isStopSequence`:', util.deleteUndefinedObjectProps(rule))
				util.logPathAndObject(options)
				return true
			}

			if (rule.text) {
				util.logError('Term sequence of type', util.stylize(options.type), 'produces a rule with `text`:', util.deleteUndefinedObjectProps(rule))
				util.logPathAndObject(options)
				return true
			}
		}
	}

	return false
}

/**
 * Extend `termSequence` with the following methods:
 * `termSequence.newCountNoun(options)` - Creates an `NSymbol` that produces a terminal rule set for a count noun.
 *
 * `termSequence.newMassNoun(options)` - Creates an `NSymbol` that produces a terminal rule set for a mass (uncountable) noun.
 *
 * `termSequence.newPronoun(options)` - Creates an `NSymbol` that produces a terminal rule set for a pronoun with the necessary text forms for conjugation.
 *
 * `termSequence.newVerb(options)` - Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.
 *
 * `termSequence.newTenseVerb(options)` - Creates two terminal rule sets from the verb forms in `options.verbFormsTermSet`, split by present and past grammatical tense, and a third nonterminal substitution term sequence that produces both without tense restrictions.
 *
 * `termSequence.newStopSequence(options)` - Creates an `NSymbol` that produces a stop sequence, which is a term sequence that yields no display text when matched in input.
 *
 * `termSequence.isTermSequenceType(term, type)` - Checks if `term` is a term sequence or terminal rule set with term sequence type, `type`.
 *
 * `termSequence.isIllFormedTerminalSymbol(terminalSymbol)` - Checks if `terminalSymbol` is ill-formed. If so, prints an error message.
 */
Object.assign(exports, require('./nounTermSet'))
Object.assign(exports, require('./pronounTermSet'))
Object.assign(exports, require('./verbTermSet'))
Object.assign(exports, require('./stopSequence'))
Object.assign(exports, require('./termSequenceUtil'))