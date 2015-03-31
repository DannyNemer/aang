var g = require('../grammar')
var util = require('../../util')
var relativePronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')

// Start symbol
var start = new g.Symbol('start')

// Definition of accepted options for a Category
var categoryOptsSchema = {
	sg: String,
	pl: String,
	person: { type: Boolean, optional: true } // "that" vs. "who" for relative pronoun
}

// Create the rules every must category
module.exports = function Category(catOpts) {
	if (util.illFormedOpts(categoryOptsSchema, catOpts)) {
		throw 'ill-formed Category'
	}

	this.nameSg = catOpts.sg
	this.namePl = catOpts.pl

	this.lhs = new g.Symbol(this.nameSg, 'lhs')
	this.lhs.addRule({ terminal: true, RHS: g.emptyTermSym })

	var lhsHead = new g.Symbol(this.nameSg, 'lhs', this.nameSg, 'head')
	// people (I follow); people (followed by me)
	this.head = new g.Symbol(this.nameSg, 'head')
	lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })


	var passivePlus = new g.Symbol(this.nameSg, 'passive+')
	// (people) followed by me
	this.passive = new g.Symbol(this.nameSg, 'passive')
	passivePlus.addRule({ RHS: [ this.passive ] })

	var reducedNoTense = new g.Symbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ]})

	var reduced = new g.Symbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ]})


	// (people who) follow me
	this.subjFilter = new g.Symbol(this.nameSg, 'subj', 'filter')


	var objFilterPlus = new g.Symbol(this.nameSg, 'obj', 'filter+')
	// (people) I follow
	this.objFilter = new g.Symbol(this.nameSg, 'obj', 'filter')
	objFilterPlus.addRule({ RHS: [ this.objFilter ] })

	var rhsExt = new g.Symbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(this.nameSg, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptyTermSym })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ] })


	var noRelativeBase = new g.Symbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })


	var filter = new g.Symbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ RHS: [ this.subjFilter ]})
	// (people who) I follow
	filter.addRule({ RHS: [ this.objFilter ]})
	// (people who) I follow <adverbial-stopword>
	filter.addRule({ RHS: [ filter, stopWords.sentenceAdverbial ]})
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ]})

	var bePastReducedNoTense = new g.Symbol('be', 'past', this.nameSg, 'reduced', 'no', 'tense')
	// (people who have) been followed by me; (people who have) been following me
	bePastReducedNoTense.addRule({ RHS: [ auxVerbs.bePast, reducedNoTense ] })
	// (people who) have been folllowed by me; (people who) have been following me
	// - personNumber exists to force [have] -> "have"
	filter.addRule({ RHS: [ auxVerbs.have, bePastReducedNoTense ], personNumber: 'oneOrPl' })


	var filterPlus = new g.Symbol(this.nameSg, 'filter+')
	filterPlus.addRule({ RHS: [ filter ] })

	var relativeclause = new g.Symbol(this.nameSg, 'relativeclause')
	if (catOpts.person) {
		// (people) who are followed by me
		relativeclause.addRule({ RHS: [ relativePronouns.who, filterPlus ]})
	} else {
		// (repos) that are liked by me
		relativeclause.addRule({ RHS: [ relativePronouns.that, filterPlus ]})
	}


	var noRelative = new g.Symbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers
	this.noRelativePossessive = new g.Symbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })


	this.plural = new g.Symbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ]})
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ]})

	// (people who like) my repos
	this.catPl = new g.Symbol(this.namePl)
	this.catPl.addRule({ RHS: [ this.plural ] })

	start.addRule({ RHS: [ this.catPl ]})
}