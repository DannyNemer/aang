// Functions to automate adding many common sets of rules to grammar

var g = require('./grammar')
var Symbol = require('./Symbol')
var util = require('../util')


// Schema for pronouns
var pronounOptsSchema = {
	symbol: Symbol,
	insertionCost: { type: Number, optional: true },
	nom: String,
	obj: String,
	substitutions: { type: Array, arrayType: String }
}

// Add all terminal symbols for a pronoun to the grammar; ex: "I", "me"
g.addPronoun = function (opts) {
	if (util.illFormedOpts(pronounOptsSchema, opts)) {
		throw 'ill-formed pronoun'
	}

	var pronoun = opts.symbol

	// Object of inflection forms for conjugation
	var textForms = {
		nom: opts.nom, // "I"
		obj: opts.obj // "me"
	}

	// Nominative case
	var newRule = { terminal: true, RHS: opts.nom, textForms: textForms }

	// Insertion cost added to first terminal rule (though, inconsequential)
	if (opts.hasOwnProperty('insertionCost')) {
		newRule.insertionCost = opts.insertionCost
	}

	pronoun.addRule(newRule)

	// Objective case
	pronoun.addRule({ terminal: true, RHS: opts.obj, textForms: textForms })

	// Terminal symbols which are replaced when input
	opts.substitutions.forEach(function (termSym) {
		pronoun.addRule({ terminal: true, RHS: termSym, textForms: textForms })
	})

	return pronoun
}


// Schema for verbs
var verbOptSchema = {
	symbol: Symbol,
	insertionCost: { type: Number, optional: true },
	one: { type: Array, arrayType: String, optional: true },
	pl: { type: Array, arrayType: String, optional: true },
	oneOrPl: { type: Array, arrayType: String, optional: true },
	threeSg: { type: Array, arrayType: String, optional: true },
	oneOrThreeSg: { type: Array, arrayType: String, optional: true },
	past: { type: Array, arrayType: String, optional: true },
	substitutions: { type: Array, arrayType: String, optional: true }
}

// Add all terminal symbols for a verb to the grammar
// Only used in nominative case; ex: "people [nom-users] follow/follows"
g.addVerb = function (opts) {
	if (util.illFormedOpts(verbOptSchema, opts)) {
		throw 'ill-formed verb'
	}

	// Must have an inflected form for every person-number combination in nominative case:
	// - first-person, third-person-singular, plural
	if (!opts.oneOrPl && !opts.oneOrThreeSg && !opts.one) {
		console.log('Err: Missing inflected verb form for first-person')
		console.log(util.getLine())
		throw 'ill-formed verb'
	}

	if (!opts.oneOrPl && !opts.pl) {
		console.log('Err: Missing inflected verb form for plural')
		console.log(util.getLine())
		throw 'ill-formed verb'
	}

	if (!opts.oneOrThreeSg && !opts.threeSg) {
		console.log('Err: Missing inflected verb form for third-person-singular')
		console.log(util.getLine())
		throw 'ill-formed verb'
	}

	var verb = opts.symbol

	// Object of inflection forms for conjugation
	var defaultTextForms = {
		// "am", "was", "like"
		one: opts.one ? opts.one[0] : (opts.oneOrPl ? opts.oneOrPl[0] : opts.oneOrThreeSg[0]),
		// "are", "were", "like"
		pl: opts.pl ? opts.pl[0] : opts.oneOrPl[0],
		// "is", "was", "likes"
		threeSg: opts.threeSg ? opts.threeSg[0] : opts.oneOrThreeSg[0]
	}

	// Past tense is optional (e.g.: [have])
	if (opts.past) {
		defaultTextForms.past = opts.past[0] // "liked"
	}

	// Inflected forms for first-person (e.g., "am")
	if (opts.one) {
		opts.one.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
			}

			verb.addRule(newRule)
		})
	}

	// Inflected forms for plural (e.g., "are", "were")
	if (opts.pl) {
		opts.pl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: defaultTextForms.one,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
			}

			verb.addRule(newRule)
		})
	}

	// Inflected forms for first-person or plural (e.g., "have", "like")
	if (opts.oneOrPl) {
		opts.oneOrPl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: termSym,
				threeSg: defaultTextForms.threeSg,
				past: defaultTextForms.past
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && !opts.pl && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
				assignedInsertionCost = true
			}

			verb.addRule(newRule)
		})
	}

	// Inflected forms for third-person-singular (e.g., "is", "has", "likes")
	if (opts.threeSg) {
		opts.threeSg.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, textForms: {
				one: defaultTextForms.one,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past
			} })
		})
	}

	// Inflected forms for third-person-singular or first-person (e.g., "was")
	if (opts.oneOrThreeSg) {
		opts.oneOrThreeSg.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: defaultTextForms.pl,
				threeSg: termSym,
				past: defaultTextForms.past
			} })
		})
	}

	// Past tense - optional
	if (opts.past) {
		opts.past.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, textForms: {
				one: defaultTextForms.one,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg,
				past: termSym
			} })
		})
	}

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		opts.substitutions.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, textForms: defaultTextForms })
		})
	}

	return verb
}


// Schema for stop-words
var stopWordOptSchema = {
	symbol: Symbol,
	stopWords: { type: Array, arrayType: String }
}

// Add a stop-word to the grammar - replaces terminal symbols with an empty-string
g.addStopWord = function (opts) {
	if (util.illFormedOpts(stopWordOptSchema, opts)) {
		throw 'ill-formed stop-word'
	}

	var stopWord = opts.symbol

	// Accepted terminal symbol is an empty-string
	stopWord.addRule({ terminal: true, RHS: g.emptySymbol })

	// All stop-word terminal symbols are rejected
	opts.stopWords.forEach(function (termSym) {
		stopWord.addRule({ terminal: true, RHS: termSym })
	})

	return stopWord
}


// Schema for other words
var wordOptsSchema = {
	symbol: Symbol,
	optional: { type: Boolean, optional: true },
	insertionCost: { type: Number, optional: true },
	accepted: { type: Array, arrayType: String },
	substitutions: { type: Array, arrayType: String, optional: true }
}

// Add a set of terminal symbols to the grammar
g.addWord = function (opts) {
	if (util.illFormedOpts(wordOptsSchema, opts)) {
		throw 'ill-formed word'
	}

	if (opts.accepted.indexOf(g.emptySymbol) !== -1) {
		console.log('Err: Words cannot have <empty> strings:', opts.name)
		console.log('Only stop-words or opt-terms can have <empty> strings')
		console.log(util.getLine())
		throw 'ill-formed word'
	}

	// Opt-words cannot have insertion costs
	if (opts.optional && opts.hasOwnProperty('insertionCost')) {
		console.log('Err: Optional words cannot have insertion costs:', opts.name)
		console.log(util.getLine())
		throw 'ill-formed opt-word'
	}

	var word = opts.symbol

	// Optional terminal rule -> rule can be omitted from input by accepting empty-string without penalty
	if (opts.optional) {
		word.addRule({ terminal: true, RHS: g.emptySymbol })
	}

	// Terminal symbols which are output when input (i.e., not substituted)
	opts.accepted.forEach(function (termSym, i) {
		var newRule = { terminal: true, RHS: termSym, text: termSym }

		// Insertion cost added to first terminal rule (though, inconsequential)
		if (i === 0 && opts.hasOwnProperty('insertionCost')) {
			newRule.insertionCost = opts.insertionCost
		}

		word.addRule(newRule)
	})

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		// First of 'accepted' terminal symbol is used to substitute rejected symbols
		var correctedText = opts.accepted[0]

		opts.substitutions.forEach(function (termSym) {
			word.addRule({ terminal: true, RHS: termSym, text: correctedText })
		})
	}

	return word
}


// Create an optionalized version of an existing nonterminal symbol
g.addNonterminalOpt = function (symbol) {
	// Append 'opt' to original symbol name
	var optSymbol = new g.Symbol(symbol.name.slice(1, -1), 'opt')

	optSymbol.addRule({ RHS: [ symbol ] })
	// <empty> always last for optional nonterminal symbols
	optSymbol.addRule({ terminal: true, RHS: g.emptyTermSym })

	return optSymbol
}