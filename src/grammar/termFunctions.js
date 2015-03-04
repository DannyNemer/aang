var g = require('./grammar')
var util = require('../util')


var pronounOptsDef = {
	name: String,
	insertionCost: Number,
	nom: String,
	obj: String,
	substitutions: Array
}

exports.addPronoun = function (opts) {
	if (util.illFormedOpts(opts, pronounOptsDef)) {
		throw 'ill-formed pronoun'
	}

	var pronoun = new g.Symbol(opts.name)

	var textForms = {
		nom: opts.nom,
		obj: opts.obj
	}

	var newRule = { terminal: true, RHS: opts.nom, text: textForms }
	if (opts.hasOwnProperty('insertionCost')) {
		newRule.insertionCost = opts.insertionCost
	}
	pronoun.addRule(newRule)

	pronoun.addRule({ terminal: true, RHS: opts.obj, text: textForms })

	opts.substitutions.forEach(function (termSym) {
		pronoun.addRule({ terminal: true, RHS: termSym, text: textForms })
	})

	return pronoun
}


var verbOptDef = {
	name: String,
	insertionCost: Number,
	oneOrPl: Array,
	threeSg: Array,
	past: Array,
	substitutions: Array
}

exports.addVerb = function (opts) {
	if (util.illFormedOpts(opts, verbOptDef)) {
		throw 'ill-formed verb'
	}

	var verb = new g.Symbol(opts.name)

	var defaultTextForms = {
		oneOrPl: opts.oneOrPl[0],
		threeSg: opts.threeSg[0],
		past: opts.past[0]
	}

	opts.oneOrPl.forEach(function (termSym, i) {
		var newRule = { terminal: true, RHS: termSym, text: {
			oneOrPl: termSym,
			threeSg: defaultTextForms.threeSg,
			past: defaultTextForms.past
		} }

		if (i === 0 && opts.hasOwnProperty('insertionCost')) {
			newRule.insertionCost = opts.insertionCost
		}

		verb.addRule(newRule)
	})

	opts.threeSg.forEach(function (termSym) {
		verb.addRule({ terminal: true, RHS: termSym, text: {
			oneOrPl: defaultTextForms.oneOrPl,
			threeSg: termSym,
			past: defaultTextForms.past
		} })
	})

	opts.past.forEach(function (termSym) {
		verb.addRule({ terminal: true, RHS: termSym, text: {
			oneOrPl: defaultTextForms.oneOrPl,
			threeSg: defaultTextForms.threeSg,
			past: termSym
		} })
	})

	if (opts.substitutions) {
		opts.substitutions.forEach(function (termSym) {
			verb.addRule({ terminal: true, RHS: termSym, text: defaultTextForms })
		})
	}

	return verb
}


var wordOptsDef = {
	name: String,
	insertionCost: Number,
	accepted: Array,
	substitutions: Array
}

exports.addWord = function (opts) {
	if (util.illFormedOpts(opts, wordOptsDef)) {
		throw 'ill-formed word'
	}

	var word = new g.Symbol(opts.name)

	opts.accepted.forEach(function (termSym, i) {
		var newRule = { terminal: true, RHS: termSym }

		if (termSym !== g.emptyTermSym) {
			newRule.text = { plain: termSym }
		}

		if (i === 0 && opts.hasOwnProperty('insertionCost')) {
			newRule.insertionCost = opts.insertionCost
		}

		word.addRule(newRule)
	})

	if (opts.substitutions) {
		var correctedText = opts.accepted[0]
		if (correctedText !== g.emptyTermSym) {
			opts.substitutions.forEach(function (termSym) {
				word.addRule({ terminal: true, RHS: termSym, text: { plain: correctedText } })
			})
		} else {
			opts.substitutions.forEach(function (termSym) {
				word.addRule({ terminal: true, RHS: termSym })
			})
		}
	}

	return word
}