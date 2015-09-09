// Functions to automate adding many common sets of rules to grammar

var g = require('./grammar')
var Symbol = require('./symbol').constructor
var util = require('../util')


// Schema for pronouns
var pronounOptsSchema = {
	insertionCost: { type: Number, optional: true },
	nom: String,
	obj: String,
	substitutions: { type: Array, arrayType: String },
}

// Add all terminal symbols for a pronoun to the grammar; ex: "I", "me"
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


// Schema for verbs
var verbOptsSchema = {
	insertionCost: { type: Number, optional: true },
	one: { type: Array, arrayType: String, optional: true },
	pl: { type: Array, arrayType: String, optional: true },
	oneOrPl: { type: Array, arrayType: String, optional: true },
	threeSg: { type: Array, arrayType: String, optional: true },
	oneOrThreeSg: { type: Array, arrayType: String, optional: true },
	past: { type: Array, arrayType: String, optional: true },
	substitutions: { type: Array, arrayType: String, optional: true },
}

// Add all terminal symbols for a verb to the grammar
// Only used in nominative case; ex: "people [nom-users] follow/follows"
Symbol.prototype.addVerb = function (opts) {
	if (util.illFormedOpts(verbOptsSchema, opts)) {
		throw new Error('Ill-formed verb')
	}

	// Must have an inflected form for every person-number combination in nominative case:
	// - first-person, third-person-singular, plural
	if (!opts.oneOrPl && !opts.oneOrThreeSg && !opts.one) {
		util.logErrorAndPath('Missing inflected verb form for first-person')
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
		one: opts.one ? opts.one[0] : (opts.oneOrPl ? opts.oneOrPl[0] : opts.oneOrThreeSg[0]),
		// "are", "were", "like"
		pl: opts.pl ? opts.pl[0] : opts.oneOrPl[0],
		// "is", "was", "likes"
		threeSg: opts.threeSg ? opts.threeSg[0] : opts.oneOrThreeSg[0],
	}

	// Past tense is optional (e.g.: [have])
	if (opts.past) {
		defaultTextForms.past = opts.past[0] // "liked"
	}

	// Inflected forms for first-person (e.g., "am")
	if (opts.one) {
		opts.one.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, text: {
				one: termSym,
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
				one: defaultTextForms.one,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && opts.insertionCost !== undefined) {
				newRule.insertionCost = opts.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// Inflected forms for first-person or plural (e.g., "have", "like")
	if (opts.oneOrPl) {
		opts.oneOrPl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, text: {
				one: termSym,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past,
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && !opts.pl && opts.insertionCost !== undefined) {
				newRule.insertionCost = opts.insertionCost
			}

			this.addRule(newRule)
		}, this)
	}

	// Inflected forms for third-person-singular (e.g., "is", "has", "likes")
	if (opts.threeSg) {
		opts.threeSg.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: {
				one: defaultTextForms.one,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// Inflected forms for third-person-singular or first-person (e.g., "was")
	if (opts.oneOrThreeSg) {
		opts.oneOrThreeSg.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: {
				one: termSym,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past,
			} })
		}, this)
	}

	// Past tense - optional
	if (opts.past) {
		opts.past.forEach(function (termSym) {
			this.addRule({ terminal: true, RHS: termSym, text: {
				one: defaultTextForms.one,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: termSym,
			} })
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


// Schema for stop-words
var stopWordOptsSchema = {
	stopWords: { type: Array, arrayType: String },
}

// Add a stop-word to the grammar - replaces terminal symbols with an empty string
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


// Schema for other words
var wordOptsSchema = {
	optional: { type: Boolean, optional: true },
	insertionCost: { type: Number, optional: true },
	accepted: { type: Array, arrayType: String },
	substitutions: { type: Array, arrayType: String, optional: true },
}

// Add a set of terminal symbols to the grammar
Symbol.prototype.addWord = function (opts) {
	if (util.illFormedOpts(wordOptsSchema, opts)) {
		throw new Error('Ill-formed word')
	}

	if (opts.accepted.indexOf(g.emptySymbol) !== -1) {
		util.logError('Words cannot have <empty> strings:', opts.name)
		console.log('       Only stop-words or opt-terms can have <empty> strings')
		console.log('  ' + util.getModuleCallerPathAndLineNumber())
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
		// First of 'accepted' terminal symbol is used to substitute rejected symbols
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