/**
 * Functions that automate adding many common sets of rules to grammar
 */

var util = require('../util/util')
var g = require('./grammar')
var Symbol = require('./symbol').constructor


// The schema for defining terminal symbols that have a cost penalty.
var terminalSymbolSchema = {
	symbol: { type: String, required: true },
	costPenalty: { type: Number, required: true },
}

/**
 * Adds terminal rules to `Symbol` for a pronoun.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 */
var pronounSchema = {
	// Enable creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// The inflected terminal symbol for the objective case; e.g., "I".
	nom: { type: String, required: true },
	// The inflected terminal symbol for the objective case; e.g., "me".
	obj: { type: String, required: true },
	// The terminal symbols to substitute when seen in input.
	substitutions: { type: Array, arrayType: String, required: true },
}

Symbol.prototype.addPronoun = function (options) {
	if (util.illFormedOpts(pronounSchema, options)) {
		throw new Error('Ill-formed pronoun')
	}

	var pronoun = options.symbol

	// Object of inflection forms for conjugation.
	var textForms = {
		nom: options.nom, // "I"
		obj: options.obj, // "me"
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

	// Terminal symbols which are replaced when input.
	options.substitutions.forEach(function (termSym) {
		this.addRule({ isTerminal: true, RHS: termSym, text: textForms })
	}, this)

	return this
}

/**
 * Adds terminal rules to `Symbol` for a verb. Used in the nominative case; e.g., "people [nom-users] follow/follows".
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
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
	// The terminal symbols that are accepted when seen in input.
	accepted: { type: Array, arrayType: String },
	// The terminal symbols to substitute when seen in input.
	substitutions: { type: Array, arrayType: String },
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

	// The terminal symbols that are accepted when seen in input.
	if (options.accepted) {
		options.accepted.forEach(function (termSym) {
			this.addRule({
				isTerminal: true,
				RHS: termSym,
				text: termSym,
			})
		}, this)
	}

	// Terminal symbols which are replaced when input.
	if (options.substitutions) {
		options.substitutions.forEach(function (termSym) {
			this.addRule({
				isTerminal: true,
				RHS: termSym,
				text: defaultTextForms,
			})
		}, this)
	}

	return this
}

/**
 * Adds terminal rules to `Symbol` for a stop word, which replaces the terminal symbols with an `<empty>` when seen in input.
 *
 * @memberOf Symbol
 * @param {string|Object} symbols The terminal symbols as either strings or objects with properties `symbol` and `costPenalty`.
 */
Symbol.prototype.addStopWord = function () {
	// Accepted terminal symbol is an empty string.
	this.addRule({ isTerminal: true, RHS: g.emptySymbol })

	// Add stop words, which are rejected when seen in input; i.e., produce no display text.
	for (var a = 0, argumentsLen = arguments.length; a < argumentsLen; ++a) {
		var termSym = arguments[a]

		if (termSym.constructor === Object) {
			if (util.illFormedOpts(terminalSymbolSchema, termSym)) {
				throw new Error('Ill-formed terminal symbol')
			}

			this.addRule({ isTerminal: true, RHS: termSym.symbol, text: '', costPenalty: termSym.costPenalty })
		} else {
			this.addRule({ isTerminal: true, RHS: termSym, text: '' })
		}
	}

	return this
}

/**
 * Adds terminal rules to `Symbol` for a normal word, with accepted and rejected synonyms.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 */
var wordSchema = {
	// Specify the terminal rule can be omitted from input by accepting `<empty>` without a cost penalty.
	optional: Boolean,
	// Enable creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// The terminal symbols that are accepted when seen in input.
	accepted: { type: Array, arrayType: String, required: true },
	// The terminal symbols to substitute when seen in input, defined as either strings or objects with properties `symbol` and `costPenalty`. The first of `accepted` terminal symbols replaces `substitutions` when seen in input.
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

	// Opt-words cannot have insertion costs.
	if (options.optional && options.insertionCost !== undefined) {
		util.logErrorAndPath('Optional word has an insertion cost:', options.name)
		throw new Error('Ill-formed opt-word')
	}

	// Optional terminal rule: rule can be omitted from input by accepting empty string without penalty.
	// `<empty>` must always be first for optional terminal rules.
	if (options.optional) {
		this.addRule({ isTerminal: true, RHS: g.emptySymbol })
	}

	// Terminal symbols which are output when input (i.e., not substituted).
	options.accepted.forEach(function (termSym, i) {
		var newRule = { isTerminal: true, RHS: termSym, text: termSym }

		// Insertion cost added to first terminal rule (though, inconsequential).
		if (i === 0 && options.insertionCost !== undefined) {
			newRule.insertionCost = options.insertionCost
		}

		this.addRule(newRule)
	}, this)

	// Terminal symbols which are replaced when input.
	if (options.substitutions) {
		// First of `accepted` terminal symbols replaces `substitutions` when seen in input.
		var correctedText = options.accepted[0]

		options.substitutions.forEach(function (termSym) {
			var newRule = { isTerminal: true, text: correctedText }

			if (termSym.constructor === Object) {
				if (util.illFormedOpts(terminalSymbolSchema, termSym)) {
					throw new Error('Ill-formed terminal symbol')
				}

				newRule.RHS = termSym.symbol
				newRule.costPenalty = termSym.costPenalty
			} else {
				newRule.RHS = termSym
			}

			this.addRule(newRule)
		}, this)
	}

	return this
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