// Functions to automate adding many common sets of rules to grammar

var g = require('./grammar')
var Symbol = require('./Symbol')
var util = require('../util')


// Schema for pronouns
var pronounOptsSchema = {
	name: String,
	insertionCost: { type: Number, optional: true },
	nom: { type: Array, arrayType: String },
	obj: { type: Array, arrayType: String },
	substitutions: { type: Array, arrayType: String, optional: true }
}

// Add all terminal symbols for a pronoun to the grammar; e.g., "I" and "me"
// Creates seperate symbols for nominative and objective case
g.addPronoun = function (opts) {
	if (util.illFormedOpts(pronounOptsSchema, opts)) {
		throw 'ill-formed pronoun'
	}

	var nomSymbol = new g.Symbol(opts.name, 'nom')
	var objSymbol = new g.Symbol(opts.name, 'obj')

	var correctedNomText = opts.nom[0]
	var correctedObjText = opts.obj[0]

	opts.nom.forEach(function (termSym, i) {
		var newNomRule = { terminal: true, RHS: termSym, text: termSym }
		var newObjRule = { terminal: true, RHS: termSym, text: correctedObjText }

		if (i === 0 && opts.insertionCost !== undefined) {
			newNomRule.insertionCost = opts.insertionCost
			newObjRule.insertionCost = opts.insertionCost
		}

		nomSymbol.addRule(newNomRule)
		objSymbol.addRule(newObjRule)
	})

	// same ordering in both
	opts.obj.forEach(function (termSym) {
		nomSymbol.addRule({ terminal: true, RHS: termSym, text: correctedNomText })
		objSymbol.addRule({ terminal: true, RHS: termSym, text: termSym })
	})

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		opts.substitutions.forEach(function (termSym) {
			nomSymbol.addRule({ terminal: true, RHS: termSym, text: correctedNomText })
			objSymbol.addRule({ terminal: true, RHS: termSym, text: correctedObjText })
		})
	}

	return {
		nom: nomSymbol,
		obj: objSymbol
	}
}


// Schema for verbs
var verbOptSchema = {
	name: String,
	insertionCost: { type: Number, optional: true },
	one: { type: Array, arrayType: String, optional: true },
	pl: { type: Array, arrayType: String, optional: true },
	oneOrPl: { type: Array, arrayType: String, optional: true },
	threeSg: { type: Array, arrayType: String, optional: true },
	oneOrThreeSg: { type: Array, arrayType: String, optional: true },
	past: { type: Array, arrayType: String, optional: true },
	substitutions: { type: Array, arrayType: String, optional: true },
	singleSymbol: { type: Boolean, optional: true }
}

// Add all terminal symbols for a verb to the grammar
// Only used in nominative case; ex: "people [nom-users] follow/follows"
// Creates multiple symbols for different verb forms: objective, past, and pl-subj
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

	if (opts.singleSymbol) {
		if (opts.past) {
			console.log('Err: Verb with \'singleSymbol\' will not use \'past\' terms')
			console.log(util.getLine())
			throw 'ill-formed verb'
		}

		// Only create one symbol; e.g., [be-general]
		var verbObj = new g.Symbol(opts.name)
	} else {
		var verbObj = new g.Symbol(opts.name, 'obj')
	}

	// Object of inflection forms for conjugation
	var defaultTextForms = {
		// "am", "was", "like"
		one: opts.one ? opts.one[0] : (opts.oneOrPl ? opts.oneOrPl[0] : opts.oneOrThreeSg[0]),
		// "are", "were", "like"
		pl: opts.pl ? opts.pl[0] : opts.oneOrPl[0],
		// "is", "was", "likes"
		threeSg: opts.threeSg ? opts.threeSg[0] : opts.oneOrThreeSg[0]
	}

	if (opts.past) {
		var verbPast = new g.Symbol(opts.name, 'past')
		var correctedPastText = opts.past[0]
	}

	if (!opts.singleSymbol) {
		var verbPlSubj = new g.Symbol(opts.name, 'pl', 'subj')
		var correctedPlSubjText = defaultTextForms.pl
	}


	// Inflected forms for first-person (e.g., "am")
	if (opts.one) {
		opts.one.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: defaultTextForms.pl,
				threeSg: defaultTextForms.threeSg
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
			}

			verbObj.addRule(newRule)

			if (opts.past) {
				var newPastRule = { terminal: true, RHS: termSym, text: correctedPastText }

				if (i === 0 && opts.hasOwnProperty('insertionCost')) {
					newPastRule.insertionCost = opts.insertionCost
				}

				verbPast.addRule(newPastRule)
			}

			if (!opts.singleSymbol) {
				var newPlSubjRule = { terminal: true, RHS: termSym, text: correctedPlSubjText }

				if (i === 0 && opts.hasOwnProperty('insertionCost')) {
					newPlSubjRule.insertionCost = opts.insertionCost
				}

				verbPlSubj.addRule(newPlSubjRule)
			}
		})
	}

	// Inflected forms for plural (e.g., "are", "were")
	if (opts.pl) {
		opts.pl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: defaultTextForms.one,
				pl: termSym,
				threeSg: defaultTextForms.threeSg
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
			}

			verbObj.addRule(newRule)

			if (opts.past) {
				var newPastRule = { terminal: true, RHS: termSym, text: correctedPastText }

				if (i === 0 && !opts.one && opts.hasOwnProperty('insertionCost')) {
					newPastRule.insertionCost = opts.insertionCost
				}

				verbPast.addRule(newPastRule)
			}

			if (!opts.singleSymbol) {
				var newPlSubjRule = { terminal: true, RHS: termSym, text: termSym }

				if (i === 0 && !opts.one && opts.hasOwnProperty('insertionCost')) {
					newPlSubjRule.insertionCost = opts.insertionCost
				}

				verbPlSubj.addRule(newPlSubjRule)
			}
		})
	}

	// Inflected forms for first-person or plural (e.g., "have", "like")
	if (opts.oneOrPl) {
		opts.oneOrPl.forEach(function (termSym, i) {
			var newRule = { terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: termSym,
				threeSg: defaultTextForms.threeSg
			} }

			// Insertion cost added to first terminal rule (though, inconsequential)
			if (i === 0 && !opts.one && !opts.pl && opts.hasOwnProperty('insertionCost')) {
				newRule.insertionCost = opts.insertionCost
			}

			verbObj.addRule(newRule)

			if (opts.past) {
				var newPastRule = { terminal: true, RHS: termSym, text: correctedPastText }

				if (i === 0 && !opts.one && !opts.pl && opts.hasOwnProperty('insertionCost')) {
					newPastRule.insertionCost = opts.insertionCost
				}

				verbPast.addRule(newPastRule)
			}

			if (!opts.singleSymbol) {
				var newPlSubjRule = { terminal: true, RHS: termSym, text: termSym }

				if (i === 0 && !opts.one && !opts.pl && opts.hasOwnProperty('insertionCost')) {
					newPlSubjRule.insertionCost = opts.insertionCost
				}

				verbPlSubj.addRule(newPlSubjRule)
			}
		})
	}

	// Inflected forms for third-person-singular (e.g., "is", "has", "likes")
	if (opts.threeSg) {
		opts.threeSg.forEach(function (termSym) {
			verbObj.addRule({ terminal: true, RHS: termSym, textForms: {
				one: defaultTextForms.one,
				pl: defaultTextForms.pl,
				threeSg: termSym
			} })

			if (opts.past) {
				verbPast.addRule({ terminal: true, RHS: termSym, text: correctedPastText })
			}

			if (!opts.singleSymbol) {
				verbPlSubj.addRule({ terminal: true, RHS: termSym, text: correctedPlSubjText })
			}
		})
	}

	// Inflected forms for third-person-singular or first-person (e.g., "was")
	if (opts.oneOrThreeSg) {
		opts.oneOrThreeSg.forEach(function (termSym) {
			verbObj.addRule({ terminal: true, RHS: termSym, textForms: {
				one: termSym,
				pl: defaultTextForms.pl,
				threeSg: termSym
			} })

			if (opts.past) {
				verbPast.addRule({ terminal: true, RHS: termSym, text: correctedPastText })
			}

			if (!opts.singleSymbol) {
				verbPlSubj.addRule({ terminal: true, RHS: termSym, text: correctedPlSubjText })
			}
		})
	}

	// Terminal symbols which are replaced when input
	if (opts.substitutions) {
		opts.substitutions.forEach(function (termSym) {
			verbObj.addRule({ terminal: true, RHS: termSym, textForms: defaultTextForms })

			if (opts.past) {
				verbPast.addRule({ terminal: true, RHS: termSym, text: correctedPastText })
			}

			if (!opts.singleSymbol) {
				verbPlSubj.addRule({ terminal: true, RHS: termSym, text: correctedPlSubjText })
			}
		})
	}

	// Only create one symbol; e.g., [be-general]
	if (opts.singleSymbol) {
		return verbObj
	}

	// Past tense is optional (e.g.: [have])
	if (opts.past) {
		// Past tense terms also serve as substitutions for objective form
		opts.past.forEach(function (termSym) {
			verbObj.addRule({ terminal: true, RHS: termSym, textForms: defaultTextForms })

			verbPast.addRule({ terminal: true, RHS: termSym, text: termSym })

			verbPlSubj.addRule({ terminal: true, RHS: termSym, text: correctedPlSubjText })
		})
	}

	return {
		obj: verbObj,
		past: verbPast,
		plSubj: verbPlSubj
	}
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
		if (i === 0 && opts.insertionCost !== undefined) {
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
	var symbolOpt = new g.Symbol(symbol.name.slice(1, -1), 'opt')

	symbolOpt.addRule({ RHS: [ symbol ] })
	// <empty> always last for optional nonterminal symbols
	symbolOpt.addRule({ terminal: true, RHS: g.emptySymbol })

	return symbolOpt
}