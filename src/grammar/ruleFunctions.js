// Functions to automate adding many common sets of rules to grammar

var g = require('./grammar')
var util = require('../util')

// Schema for pronouns
var pronounOptsSchema = {
	name: String,
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

	var pronoun = new g.Symbol(opts.name)

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
	name: String,
	insertionCost: { type: Number, optional: true },
	oneOrPl: { type: Array, arrayType: String },
	threeSg: { type: Array, arrayType: String },
	past: { type: Array, arrayType: String, optional: true },
	substitutions: { type: Array, arrayType: String, optional: true }
}

// Add all terminal symbols for a verb to the grammar
// Only used in nominative case; ex: "people [nom-users] follow/follows"
g.addVerb = function (opts) {
	if (util.illFormedOpts(verbOptSchema, opts)) {
		throw 'ill-formed verb'
	}

	var verb = new g.Symbol(opts.name)

	// Object of inflection forms for conjugation
	var defaultTextForms = {
		oneOrPl: opts.oneOrPl[0], // "like"
		threeSg: opts.threeSg[0] // "likes"
	}

	// Past tense is optional (e.g., [have])
	if (opts.past) {
		defaultTextForms.past = opts.past[0] // "liked"
	}

	// Inflections for first-person or plural
	opts.oneOrPl.forEach(function (termSym, i) {
		var newRule = { terminal: true, RHS: termSym, textForms: {
			oneOrPl: termSym,
			threeSg: defaultTextForms.threeSg,
			past: defaultTextForms.past
		} }

		// Insertion cost added to first terminal rule (though, inconsequential)
		if (i === 0 && opts.hasOwnProperty('insertionCost')) {
			newRule.insertionCost = opts.insertionCost
		}

		verb.addRule(newRule)
	})

	// Inflections for third-person-singular
	opts.threeSg.forEach(function (termSym) {
		verb.addRule({ terminal: true, RHS: termSym, textForms: {
			oneOrPl: defaultTextForms.oneOrPl,
			threeSg: termSym,
			past: defaultTextForms.past
		} })
	})

	// Past tense - optional
	if (opts.past) {
		opts.past.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, textForms: {
				oneOrPl: defaultTextForms.oneOrPl,
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
	name: String,
	stopWords: { type: Array, arrayType: String }
}

// Add a stop-word to the grammar - replaces terminal symbols with an empty-string
g.addStopWord = function (opts) {
	if (util.illFormedOpts(stopWordOptSchema, opts)) {
		throw 'ill-formed stop-word'
	}

	var stopWord = new g.Symbol(opts.name)

	// Accepted terminal symbol is an empty-string
	stopWord.addRule({ terminal: true, RHS: g.emptyTermSym })

	// All stop-word terminal symbols are rejected
	opts.stopWords.forEach(function (termSym) {
		stopWord.addRule({ terminal: true, RHS: termSym })
	})

	return stopWord
}

// Schema for other words
var wordOptsSchema = {
	name: String,
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

	if (opts.accepted.indexOf(g.emptyTermSym) !== -1) {
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

	var word = new g.Symbol(opts.name)

	// Optional terminal rule -> rule can be omitted from input by accepting empty-string without penalty
	if (opts.optional) {
		word.addRule({ terminal: true, RHS: g.emptyTermSym })
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