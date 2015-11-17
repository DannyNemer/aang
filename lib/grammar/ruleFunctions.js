/**
 * Functions that automate adding many common sets of rules to grammar
 */

var util = require('../util/util')
var g = require('./grammar')
var symbol = require('./symbol')
var Symbol = symbol.constructor


/**
 * Adds rules to this `Symbol` for a pronoun.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
var pronounSchema = {
	// Enable creation of edit rules using `Symbol` for this cost.
	insertionCost: Number,
	// The inflected terminal symbol for the objective case; e.g., "I".
	nom: { type: String, required: true },
	// The inflected terminal symbol for the objective case; e.g., "me".
	obj: { type: String, required: true },
	// The symbols to substitute when input, defined as either strings or objects with properties `symbol` (string) and `costPenalty` (number).
	substitutions: { type: Array, arrayType: [ String, Object ] },
}

Symbol.prototype.addPronoun = function (options) {
	if (util.illFormedOpts(pronounSchema, options)) {
		throw new Error('Ill-formed pronoun')
	}

	var pronoun = options.symbol

	// Object of inflection forms for conjugation.
	var textForms = {
		// The inflected terminal symbol for nominative case; e.g., "I".
		nom: options.nom,
		// The inflected terminal symbol for objective case; e.g., "me".
		obj: options.obj,
	}

	// Nominative case.
	var newRule = { isTerminal: true, RHS: options.nom, text: textForms }

	// Insertion cost added to first terminal rule (though, inconsequential).
	if (options.insertionCost !== undefined) {
		newRule.insertionCost = options.insertionCost
	}

	this.addRule(newRule)

	// Objective case.
	this.addRule({ isTerminal: true, RHS: options.obj, text: textForms })

	// Symbols which are replaced when input.
	this.addSubstitutions(options.substitutions, textForms)

	return this
}

/**
 * Adds rules to this `Symbol` for a verb. Used in the nominative case; e.g., "people [nom-users] follow/follows".
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
var verbSchema = {
	// Enable creation of edit rules using `Symbol` for this cost by inserting the first terminal symbol for `oneSg`, `pl`, or `oneOrPl` (which ever of those is defined, prioritized in that order).
	insertionCost: Number,
	// The inflected terminal symbol for first-person-singular; e.g, "am", "was", "like".
	oneSg: { type: String, required: true },
	// The inflected terminal symbol for third-person-singular; e.g, "is", "was", "likes".
	threeSg: { type: String, required: true },
	// The inflected terminal symbol for plural; e.g, "are", "were", "like".
	pl: { type: String, required: true },
	// The (optional) inflected terminal symbol for past-tense; e.g, "liked", "did".
	past: String,
	// The terminal symbols that are accepted when input.
	accepted: { type: Array, arrayType: String },
	// The symbols to substitute when input, defined as either strings or objects with properties `symbol` (string) and `costPenalty` (number).
	substitutions: { type: Array, arrayType: [ String, Object ] },
}

Symbol.prototype.addVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	// The different inflection forms used in conjugation.
	var defaultTextForms = {
		// The inflected terminal symbol for first-person-singular; e.g, "am", "was", "like".
		oneSg: options.oneSg,
		// The inflected terminal symbol for third-person-singular; e.g, "is", "was", "likes".
		threeSg: options.threeSg,
		// The inflected terminal symbol for plural; e.g, "are", "were", "like".
		pl: options.pl,
	}

	// The (optional) past tense inflection.
	if (options.past) {
		// The inflected terminal symbol for past-tense; e.g, "liked", "did".
		defaultTextForms.past = options.past
	}

	// The inflected terminal symbol for first-person-singular; e.g, "am", "was", "like".
	var newRule = {
		isTerminal: true,
		RHS: options.oneSg,
		text: defaultTextForms,
	}

	if (options.insertionCost !== undefined) {
		newRule.insertionCost = options.insertionCost
	}

	this.addRule(newRule)

	// The inflected terminal symbol for third-person-singular; e.g, "is", "was", "likes".
	if (options.threeSg !== options.oneSg) {
		this.addRule({
			isTerminal: true,
			RHS: options.threeSg,
			text: defaultTextForms,
		})
	}

	// The inflected terminal symbol for plural; e.g, "are", "were", "like".
	if (options.pl !== options.oneSg && options.pl !== options.threeSg) {
		this.addRule({
			isTerminal: true,
			RHS: options.pl,
			text: defaultTextForms,
		})
	}

	// The inflected terminal symbol for past-tense; e.g, "liked", "did". Accept 'past' terminal symbols for rules defined as past-tense (e.g., "repos liked by me") or rules which optionally accept the past form (e.g., "repos I like/liked").
	if (options.past) {
		this.addRule({
			isTerminal: true,
			RHS: options.past,
			tense: 'past',
			text: defaultTextForms,
		})
	}

	// The terminal symbols that are accepted when input.
	if (options.accepted) {
		options.accepted.forEach(function (termSym) {
			this.addRule({
				isTerminal: true,
				RHS: termSym,
				text: termSym,
			})
		}, this)
	}

	// Symbols which are replaced when input.
	if (options.substitutions) {
		this.addSubstitutions(options.substitutions, defaultTextForms)
	}

	return this
}

/**
 * Adds rules to this `Symbol` for a stop word, which do not produce display text when input.
 *
 * @memberOf Symbol
 * @param {...(string|Symbol|Symbol[]|Object)} [symbols] The symbols to substitute when input, defined as either strings, Symbols, an array of a pair of Symbols, or objects with properties `symbol` (string, Symbol, or an array of a pair of Symbols) and `costPenalty`.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
Symbol.prototype.addStopWord = function () {
	// Accepted terminal symbol is an empty string.
	this.addRule({ isTerminal: true, RHS: g.emptySymbol })

	// Add stop words, which are rejected when input; i.e., produce no display text.
	this.addSubstitutions(Array.prototype.slice.call(arguments), '')

	return this
}

/**
 * Adds rules to this `Symbol` for a normal word, with accepted and rejected synonyms.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
var wordSchema = {
	// Specify this terminal rule set can be omitted without a cost penalty.
	optional: Boolean,
	// Enable creation of edit rules using this `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// The terminal symbols that are accepted when input.
	accepted: { type: Array, arrayType: String, required: true },
	// The symbols to substitute when input, defined as either strings or objects with properties `symbol` (string) and `costPenalty` (number).
	substitutions: { type: Array, arrayType: [ String, Object ] },
}

Symbol.prototype.addWord = function (options) {
	if (util.illFormedOpts(wordSchema, options)) {
		throw new Error('Ill-formed word')
	}

	// Prevent `<empty>` symbol.
	if (options.accepted.some(function (a) { return a === g.emptySymbol || a.symbol === g.emptySymbol })) {
		util.logError('Word produces the `<empty>` symbol:', options.name)
		util.log('       Only stop-words or opt-terms can use the `<empty>` symbol.')
		util.log('  ' + util.getModuleCallerPathAndLineNumber())
		throw new Error('Ill-formed word')
	}

	// Optional words cannot have insertion costs.
	if (options.optional && options.insertionCost !== undefined) {
		util.logErrorAndPath('Optional word has an insertion cost:', options.name)
		throw new Error('Ill-formed optional word')
	}

	// Optional terminal rule: rule can be omitted from input without a cost penalty.
	// `<empty>` must always be first for optional terminal rules.
	if (options.optional) {
		this.addRule({ isTerminal: true, RHS: g.emptySymbol })
	}

	// Terminal symbols which are accepted when input (i.e., not substituted).
	options.accepted.forEach(function (termSym, i) {
		var newRule = { isTerminal: true, RHS: termSym, text: termSym }

		// Insertion cost added to first terminal rule (though, inconsequential).
		if (i === 0 && options.insertionCost !== undefined) {
			newRule.insertionCost = options.insertionCost
		}

		this.addRule(newRule)
	}, this)

	// Symbols which are replaced with first of `accepted` terminal symbols when input.
	if (options.substitutions) {
		this.addSubstitutions(options.substitutions, options.accepted[0])
	}

	return this
}

// The substitution object schema.
var substitutionObjSchema = {
	symbol: { type: String, required: true },
	costPenalty: { type: Number, required: true },
}

/**
 * Adds rules to this `Symbol` which substitute the symbols in `substitutions` with `correctedText` when input.
 *
 * @memberOf Symbol
 * @param {(string|Object)[]} substitutions The symbols to substitute with `correctedText` when input, defined as either strings or objects with properties `symbol` (string) and `costPenalty` (number).
 * @param {string} correctedText The text to replace `substitutions` when input.
 * @returns {Symbol} Returns this `Symbol` for chaining.
 */
Symbol.prototype.addSubstitutions = function (substitutions, correctedText) {
	if (correctedText === undefined) {
		throw new Error('Missing corrected text')
	}

	for (var s = 0, substitutionsLen = substitutions.length; s < substitutionsLen; ++s) {
		var substitution = substitutions[s]
		var costPenalty = undefined

		// Check if substitution has a cost penalty.
		if (substitution.constructor === Object) {
			if (util.illFormedOpts(substitutionObjSchema, substitution)) {
				throw new Error('Ill-formed terminal symbol')
			}

			costPenalty = substitution.costPenalty
			substitution = substitution.symbol
		}

		var newRule = undefined

		if (/[ |]/.test(substitution)) {
			newRule = {
				RHS: splitMutliTokenTerminal(substitution),
				text: correctedText,
			}
		} else {
			newRule = {
				isTerminal: true,
				RHS: substitution,
				text: correctedText,
			}
		}

		if (costPenalty !== undefined) {
			newRule.costPenalty = costPenalty
		}

		this.addRule(newRule)
	}

	return this
}

// The map of symbol names to `Symbol` instances created for dividing multi-token terminal symbols. Used by `splitMutliTokenTerminal()`.
var symbolMap = {}

/**
 * Tokenizes `terminalSymbol` by spaces (separate terms indexes) and the `|` symbol (acceptable terms for that single index). Creates an array of `Symbol`s that produces a tree of single-token terminal rules for the tokens, for use as a nonterminal rule's `RHS`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The multi-token terminal symbol to split into a tree of single-token terminal rules.
 * @returns {Symbol[]} Returns an array of `Symbol`s that produces `terminalSymbol` for use as a nonterminal rule's `RHS`.
 */
function splitMutliTokenTerminal(terminalSymbol) {
	// Check `terminalSymbol` is a multi-token symbol.
	if (!/[ |]/.test(terminalSymbol)) {
		throw new Error('splitMutliTokenTerminal: terminalSymbol is not a multi-token symbol')
	}

	var prevSymbol

	// Create rules that produce the tokens in `terminalSymbol`.
	var tokenSets = terminalSymbol.split(' ')
	for (var s = 0, tokenSetsLen = tokenSets.length; s < tokenSetsLen; ++s) {
		var tokenSet = tokenSets[s]

		var newSymbolName = symbol.genName(tokenSet, 'blank')
		var newSymbol = symbolMap[newSymbolName]

		if (!newSymbol) {
			// Create a new terminal rule set if none exists for `tokenSet`.
			newSymbol = g.newSymbol(newSymbolName)
			symbolMap[newSymbol.name] = newSymbol

			var tokens = tokenSet.split('|')
			for (var t = 0, tokensLen = tokens.length; t < tokensLen; ++t) {
				var token = tokens[t]

				var newRule = {
					isTerminal: true,
				}

				if (token === '') {
					newRule.RHS = g.emptySymbol
				} else {
					newRule.RHS = token
					newRule.text = ''
					// newRule.text = token
				}

				newSymbol.addRule(newRule)
			}
		}

		if (s === tokenSetsLen - 1) {
			// Return the array of `Symbol`s that produces `terminalSymbol` for use as a nonterminal rule's `RHS`.
			if (prevSymbol) {
				return [ prevSymbol, newSymbol ]
			} else {
				return [ newSymbol ]
			}
		} else {
			// Create a binary rule using the symbol that produces the previous token sets and the new symbol for this token set.
			if (prevSymbol) {
				var parentSymbol = symbolMap[symbol.genName(prevSymbol.name, newSymbol.name)]

				if (parentSymbol) {
					prevSymbol = parentSymbol
				} else {
					prevSymbol = g.newBinaryRule({ RHS: [ prevSymbol, newSymbol ] })
					symbolMap[prevSymbol.name] = prevSymbol
				}
			} else {
				prevSymbol = newSymbol
			}
		}
	}
}

/**
 * Creates an optionalized version of an existing nonterminal symbol.
 *
 * @memberOf Symbol
 * @returns {Symbol} Returns the new Symbol
 */
Symbol.prototype.createNonterminalOpt = function () {
	// Append 'opt' to original symbol name.
	var symbolOpt = g.newSymbol(this.name, 'opt')

	// Prevent insertions if `this` is insertable.
	symbolOpt.addRule({ RHS: [ this ], noInsertionIndexes: [ 0 ] })

	// `<empty>` is always the last rule for optional nonterminal symbols.
	symbolOpt.addRule({ isTerminal: true, RHS: g.emptySymbol })

	return symbolOpt
}