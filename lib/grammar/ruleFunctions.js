var g = require('./grammar')
var Symbol = require('./symbol').constructor
var util = require('../util')

/**
 * Functions that automate adding many common sets of rules to grammar
 */


/**
 * Adds terminal rules to `Symbol` for a pronoun.
 *
 * @param {Object} opts The options object.
 */
var pronounOptsSchema = {
	// Enables creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: { type: Number, optional: true },
	// Inflected terminal symbol for the objective case; e.g., "I".
	nom: String,
	// Inflected terminal symbol for the objective case; e.g., "me".
	obj: String,
	// Terminal symbols that are substituted when seen in input.
	substitutions: { type: Array, arrayType: String },
}

Symbol.prototype.addPronoun = function (opts) {
	if (util.illFormedOpts(pronounOptsSchema, opts)) {
		throw new Error('Ill-formed pronoun')
	}

	var pronoun = opts.symbol

	// Object of inflection forms for conjugation
	var textForms = {
		nom: opts.nom, // "I"
		obj: opts.obj // "me"
	}

	// Nominative case
	var newRule = { terminal: true, RHS: opts.nom, text: textForms }

	// Insertion cost added to first terminal rule (though, inconsequential)
	if (opts.insertionCost !== undefined) {
		newRule.insertionCost = opts.insertionCost
	}

	this.addRule(newRule)

	// Objective case
	this.addRule({ terminal: true, RHS: opts.obj, text: textForms })

	// Terminal symbols which are replaced when input
	opts.substitutions.forEach(function (termSym) {
		this.addRule({ terminal: true, RHS: termSym, text: textForms })
	}, this)

	return this
}

/**
 * Adds terminal rules to `Symbol` for a verb. Used in the nominative case; e.g., "people [nom-users] follow/follows".
 *
 * @param {Object} opts The options object.
 */
var verbOptsSchema = {
	// Enables creation of edit rules using `Symbol` for this cost by inserting the first terminal symbol for `oneSg`, `pl`, or `oneOrPl` (which ever of those is defined, prioritized in that order).
	insertionCost: { type: Number, optional: true },
	// Inflected terminal symbols for first-person-singular; e.g, "am".
	oneSg: { type: Array, arrayType: String, optional: true },
	// Inflected terminal symbols for plural; e.g, "are", "were".
	pl: { type: Array, arrayType: String, optional: true },
	// Inflected terminal symbols for first-person-singular or plural; e.g, "have been", "like".
	oneOrPl: { type: Array, arrayType: String, optional: true },
	// Inflected terminal symbols for third-person-singular; e.g, "is", "has been", "likes".
	threeSg: { type: Array, arrayType: String, optional: true },
	// Inflected terminal symbols for first-person-singular or third-person-singular; e.g, "was".
	oneOrThreeSg: { type: Array, arrayType: String, optional: true },
	// Inflected terminal symbols for past-tense; e.g, "liked", "did".
	past: { type: Array, arrayType: String, optional: true },
	// Specify allowing the `past` terminal symbols, if defined, to be accepted in every rule with the verb in addition to past-tense rules.
	pastIsAlwaysAccepted: { type: Boolean, optional: true },
	// Terminal symbols that are substituted when seen in input.
	substitutions: { type: Array, arrayType: String, optional: true },
}

Symbol.prototype.addVerb = function (opts) {
	if (util.illFormedOpts(verbOptsSchema, opts)) {
		throw new Error('Ill-formed verb')
	}

	// Must have an inflected form for every person-number combination in nominative case:
	// - first-person-singular, third-person-singular, plural
	if (!opts.oneOrPl && !opts.oneOrThreeSg && !opts.oneSg) {
		util.logErrorAndPath('Missing inflected verb form for first-person-singular')
		throw new Error('Ill-formed verb')
	}

	if (!opts.oneOrPl && !opts.pl) {
		util.logErrorAndPath('Missing inflected verb form for plural')
		throw new Error('Ill-formed verb')
	}

	if (!opts.oneOrThreeSg && !opts.threeSg) {
		util.logErrorAndPath('Missing inflected verb form for third-person-singular')
		throw new Error('Ill-formed verb')
	}

	// Object of inflection forms for conjugation
	var defaultTextForms = {
		// "am", "was", "like"
		oneSg: opts.oneSg ? opts.oneSg[0] : (opts.oneOrPl ? opts.oneOrPl[0] : opts.oneOrThreeSg[0]),
		// "are", "were", "like"
		pl: opts.pl ? opts.pl[0] : opts.oneOrPl[0],
		// "is", "was", "likes"
		threeSg: opts.threeSg ? opts.threeSg[0] : opts.oneOrThreeSg[0],
	}

	// Past tense is optional
	// - E.g., (repos) liked (by me), (repos I have) liked
	if (opts.past) {
		defaultTextForms.past = opts.past[0]
	}

	// Inflected forms for first-person-singular (e.g., "am")
	if (opts.oneSg) {
		opts.oneSg.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && opts.insertionCost !== undefined) {
				newRule.insertionCost = opts.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// Inflected forms for plural (e.g., "are", "were")
	if (opts.pl) {
		opts.pl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, text: {
				oneSg: defaultTextForms.oneSg,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.oneSg && opts.insertionCost !== undefined) {
				newRule.insertionCost = opts.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// Inflected forms for first-person-singular or plural (e.g., "have", "like")
	if (opts.oneOrPl) {
		opts.oneOrPl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.oneSg && !opts.pl && opts.insertionCost !== undefined) {
				newRule.insertionCost = opts.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// Inflected forms for third-person-singular (e.g., "is", "has", "likes")
	if (opts.threeSg) {
		opts.threeSg.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: {
				oneSg: defaultTextForms.oneSg,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// Inflected forms for third-person-singular or first-person-singular (e.g., "was")
	if (opts.oneOrThreeSg) {
		opts.oneOrThreeSg.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: {
				oneSg: termSym,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// Past tense - optional
	if (opts.past) {
		opts.past.forEach(function (termSym) {
			if (opts.pastIsAlwaysAccepted) {
				// Accept `past` terminal symbols for every grammatical case. E.g., accept both "repos I like" and "repos I liked".
				this.addRule({ terminal: true, RHS: termSym, text: termSym })
			} else {
				// Only accept `past` terminal symbols for rules defined as past-tense.
				this.addRule({ terminal: true, RHS: termSym, text: {
					oneSg: defaultTextForms.oneSg,
					pl: defaultTextForms.pl,
					threeSg: defaultTextForms.threeSg,
					past: termSym,
				} })
			}
		}, this)
	}

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		opts.substitutions.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: defaultTextForms })
		}, this)
	}

	return this
}

/**
 * Adds terminal rules to `Symbol` for a stop word, which replaces the terminal symbols with an `<empty>` when seen in input.
 *
 * @param {Object} opts The options object.
 */
var stopWordOptsSchema = {
	// The terminal symbols to replace with `<empty>` when seen in input.
	stopWords: { type: Array, arrayType: String },
}

Symbol.prototype.addStopWord = function (opts) {
	if (util.illFormedOpts(stopWordOptsSchema, opts)) {
		throw new Error('Ill-formed stop-word')
	}

	// Accepted terminal symbol is an empty string
	this.addRule({ terminal: true, RHS: g.emptySymbol })

	// All stop-word terminal symbols are rejected
	opts.stopWords.forEach(function (termSym) {
		this.addRule({ terminal: true, RHS: termSym, text: '' })
	}, this)

	return this
}

/**
 * Adds terminal rules to `Symbol` for a normal word, with accepted and rejected synonyms.
 *
 * @param {Object} opts The options object.
 */
var wordOptsSchema = {
	// Optional terminal rule: rule can be omitted from input by accepting empty string without penalty.
	optional: { type: Boolean, optional: true },
	// Enables creation of edit rules using `Symbol` for this cost by inserting the first of the `accepted` terminal symbols.
	insertionCost: { type: Number, optional: true },
	// Terminal symbols that are accepted when seen in input.
	accepted: { type: Array, arrayType: String },
	// Terminal symbols that are substituted when seen in input.
	// First of `accepted` terminal symbols replaces `substitutions` when seen in input.
	substitutions: { type: Array, arrayType: String, optional: true },
}

Symbol.prototype.addWord = function (opts) {
	if (util.illFormedOpts(wordOptsSchema, opts)) {
		throw new Error('Ill-formed word')
	}

	if (opts.accepted.indexOf(g.emptySymbol) !== -1) {
		util.logError('Words cannot have <empty> strings:', opts.name)
		util.log('       Only stop-words or opt-terms can have <empty> strings')
		util.log('  ' + util.getModuleCallerPathAndLineNumber())
		throw new Error('Ill-formed word')
	}

	// Opt-words cannot have insertion costs
	if (opts.optional && opts.insertionCost !== undefined) {
		util.logErrorAndPath('Optional words cannot have insertion costs:', opts.name)
		throw new Error('Ill-formed opt-word')
	}

	// Optional terminal rule: rule can be omitted from input by accepting empty string without penalty
	// <empty> must always be first for optional terminal rules
	if (opts.optional) {
		this.addRule({ terminal: true, RHS: g.emptySymbol })
	}

	// Terminal symbols which are output when input (i.e., not substituted)
	opts.accepted.forEach(function (termSym, i) {
		var newRule = { terminal: true, RHS: termSym, text: termSym }

		// Insertion cost added to first terminal rule (though, inconsequential)
		if (i === 0 && opts.insertionCost !== undefined) {
			newRule.insertionCost = opts.insertionCost
		}

		this.addRule(newRule)
	}, this)

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		// First of `accepted` terminal symbols replaces `substitutions` when seen in input.
		var correctedText = opts.accepted[0]

		opts.substitutions.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: correctedText })
		}, this)
	}

	return this
}

/**
 * Creates an optionalized version of an existing nonterminal symbol.
 *
 * @returns {Symbol} Returns the new Symbol
 */
Symbol.prototype.createNonterminalOpt = function () {
	// Append 'opt' to original symbol name.
	var symbolOpt = g.newSymbol(this.name, 'opt')

	symbolOpt.addRule({ RHS: [ this ] })

	// '<empty>' is always the last rule for optional nonterminal symbols.
	symbolOpt.addRule({ terminal: true, RHS: g.emptySymbol })

	return symbolOpt
}