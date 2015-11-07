/**
 * Functions that automate adding many common sets of rules to grammar
 */

var util = require('../util/util')
var g = require('./grammar')
var Symbol = require('./symbol').constructor


// The schema for defining terminal symbols that have a cost penalty.
var terminalSymbolSchema = {
	name: { type: String, required: true },
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
	// The inflected terminal symbols for first-person-singular; e.g, "am".
	oneSg: { type: Array, arrayType: String },
	// The inflected terminal symbols for plural; e.g, "are", "were".
	pl: { type: Array, arrayType: String },
	// The inflected terminal symbols for first-person-singular or plural; e.g, "have been", "like".
	oneOrPl: { type: Array, arrayType: String },
	// The inflected terminal symbols for third-person-singular; e.g, "is", "has been", "likes".
	threeSg: { type: Array, arrayType: String },
	// The inflected terminal symbols for first-person-singular or third-person-singular; e.g, "was".
	oneOrThreeSg: { type: Array, arrayType: String },
	// The inflected terminal symbols for past-tense; e.g, "liked", "did".
	past: { type: Array, arrayType: String },
	// The terminal symbols that are accepted when seen in input.
	accepted: { type: Array, arrayType: String },
	// The terminal symbols to substitute when seen in input.
	substitutions: { type: Array, arrayType: String },
}

Symbol.prototype.addVerb = function (options) {
	if (util.illFormedOpts(verbSchema, options)) {
		throw new Error('Ill-formed verb')
	}

	// Must have an inflected form for every person-number combination in nominative case:
	// - first-person-singular, third-person-singular, plural.
	if (!options.oneOrPl && !options.oneOrThreeSg && !options.oneSg) {
		util.logError('Missing inflected verb form for first-person-singular')
		util.logPathAndObject(options)
		throw new Error('Ill-formed verb')
	}

	if (!options.oneOrPl && !options.pl) {
		util.logError('Missing inflected verb form for plural')
		util.logPathAndObject(options)
		throw new Error('Ill-formed verb')
	}

	if (!options.oneOrThreeSg && !options.threeSg) {
		util.logError('Missing inflected verb form for third-person-singular')
		util.logPathAndObject(options)
		throw new Error('Ill-formed verb')
	}

	// Object of inflection forms for conjugation.
	var defaultTextForms = {
		// "am", "was", "like".
		oneSg: options.oneSg ? options.oneSg[0] : (options.oneOrPl ? options.oneOrPl[0] : options.oneOrThreeSg[0]),
		// "are", "were", "like".
		pl: options.pl ? options.pl[0] : options.oneOrPl[0],
		// "is", "was", "likes".
		threeSg: options.threeSg ? options.threeSg[0] : options.oneOrThreeSg[0],
	}

	// Past tense is optional.
	// - E.g., (repos) liked (by me), (repos I have) liked.
	if (options.past) {
		defaultTextForms.past = options.past[0]
	}

	// The inflected forms for first-person-singular (e.g., "am").
	if (options.oneSg) {
		options.oneSg.forEach(function (termSym, i) {
			var newRule = { isTerminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential).
			if (i === 0 && options.insertionCost !== undefined) {
				newRule.insertionCost = options.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// The inflected forms for plural (e.g., "are", "were").
	if (options.pl) {
		options.pl.forEach(function (termSym, i) {
			var newRule = { isTerminal: true, RHS: termSym, text: {
				oneSg: defaultTextForms.oneSg,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential).
			if (i === 0 && !options.oneSg && options.insertionCost !== undefined) {
				newRule.insertionCost = options.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// The inflected forms for first-person-singular or plural (e.g., "have", "like").
	if (options.oneOrPl) {
		options.oneOrPl.forEach(function (termSym, i) {
			var newRule = { isTerminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential).
			if (i === 0 && !options.oneSg && !options.pl && options.insertionCost !== undefined) {
				newRule.insertionCost = options.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// The inflected forms for third-person-singular (e.g., "is", "has", "likes").
	if (options.threeSg) {
		options.threeSg.forEach(function (termSym) {
			this.addRule({ isTerminal: true, RHS: termSym, text: {
				oneSg: defaultTextForms.oneSg,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// The inflected forms for third-person-singular or first-person-singular (e.g., "was").
	if (options.oneOrThreeSg) {
		options.oneOrThreeSg.forEach(function (termSym) {
			this.addRule({ isTerminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// Optional: The past tense forms. Accept 'past' terminal symbols for rules defined as past-tense (e.g., "repos liked by me") or rules which optionally accept the past form (e.g., "repos I like/liked").
	if (options.past) {
		options.past.forEach(function (termSym) {
			this.addRule({ isTerminal: true, RHS: termSym, tense: 'past', text: {
				oneSg: defaultTextForms.oneSg,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: termSym,
			} })
		}, this)
	}

	// Optional: The terminal symbols that are accepted when seen in input.
	if (options.accepted) {
		options.accepted.forEach(function (termSym) {
			this.addRule({ isTerminal: true, RHS: termSym, text: termSym })
		}, this)
	}

	// Terminal symbols which are replaced when input.
	if (options.substitutions) {
		options.substitutions.forEach(function (termSym) {
			this.addRule({ isTerminal: true, RHS: termSym, text: defaultTextForms })
		}, this)
	}

	return this
}

/**
 * Adds terminal rules to `Symbol` for a stop word, which replaces the terminal symbols with an `<empty>` when seen in input.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 */
var stopWordSchema = {
	// The terminal symbols to replace with `<empty>` when seen in input.
	stopWords: { type: Array, arrayType: [ String, Object ], required: true },
}

Symbol.prototype.addStopWord = function (options) {
	if (util.illFormedOpts(stopWordSchema, options)) {
		throw new Error('Ill-formed stop-word')
	}

	// Accepted terminal symbol is an empty string.
	this.addRule({ isTerminal: true, RHS: g.emptySymbol })

	// All stop-word terminal symbols are rejected.
	options.stopWords.forEach(function (termSym) {
		if (termSym.constructor === Object) {
			if (util.illFormedOpts(terminalSymbolSchema, termSym)) {
				throw new Error('Ill-formed terminal symbol')
			}

			this.addRule({ isTerminal: true, RHS: termSym.name, text: '', costPenalty: termSym.costPenalty })
		} else {
			this.addRule({ isTerminal: true, RHS: termSym, text: '' })
		}
	}, this)

	return this
}

/**
 * Adds terminal rules to `Symbol` for a normal word, with accepted and rejected synonyms.
 *
 * @memberOf Symbol
 * @param {Object} options The options object.
 */
var wordSchema = {
	// Specifiy the terminal rule can be omitted from input by accepting `<empty>` without a cost penalty.
	optional: Boolean,
	// Enable creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: Number,
	// The terminal symbols that are accepted when seen in input.
	accepted: { type: Array, arrayType: String, required: true },
	// The terminal symbols to substitute when seen in input. The first of `accepted` terminal symbols replaces `substitutions` when seen in input.
	substitutions: { type: Array, arrayType: String },
}

Symbol.prototype.addWord = function (options) {
	if (util.illFormedOpts(wordSchema, options)) {
		throw new Error('Ill-formed word')
	}

	if (options.accepted.indexOf(g.emptySymbol) !== -1) {
		util.logError('Words cannot have <empty> strings:', options.name)
		util.log('       Only stop-words or opt-terms can have <empty> strings')
		util.log('  ' + util.getModuleCallerPathAndLineNumber())
		throw new Error('Ill-formed word')
	}

	// Opt-words cannot have insertion costs.
	if (options.optional && options.insertionCost !== undefined) {
		util.logErrorAndPath('Optional words cannot have insertion costs:', options.name)
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
			this.addRule({ isTerminal: true, RHS: termSym, text: correctedText })
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