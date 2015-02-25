var g = require('../grammar')
var relativePronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')

// Create the rules every category has
module.exports = function Category(catName) {
	this.name = catName

	this.lhs = new g.Symbol(catName, 'lhs')
	this.lhs.addRule({ terminal: true, RHS: g.emptyTermSym })

	var lhsHead = new g.Symbol(catName, 'lhs', catName, 'head')
	// people (I follow); people (followed by me)
	this.head = new g.Symbol(catName, 'head')
	lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })


	var passivePlus = new g.Symbol(catName, 'passive+')
	// (people) followed by me
	this.passive = new g.Symbol(catName, 'passive')
	passivePlus.addRule({ RHS: [ this.passive ] })

	var reducedNoTense = new g.Symbol(catName, 'reduced', 'no', 'tense')
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ]})

	var reduced = new g.Symbol(catName, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ]})


	// (people who) follow me
	this.subjFilter = new g.Symbol(catName, 'subj', 'filter')


	var objFilterPlus = new g.Symbol(catName, 'obj', 'filter+')
	// (people) I follow
	this.objFilter = new g.Symbol(catName, 'obj', 'filter')
	objFilterPlus.addRule({ RHS: [ this.objFilter ] })

	var rhsExt = new g.Symbol(catName, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(catName, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptyTermSym })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ] })


	var noRelativeBase = new g.Symbol(catName, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })


	var filter = new g.Symbol(catName, 'filter')
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ]})

	var bePastReducedNoTense = new g.Symbol('be', 'past', catName, 'reduced', 'no', 'tense')
	// (people who have) been followed by me
	bePastReducedNoTense.addRule({ RHS: [ auxVerbs.bePast, reducedNoTense ] })
	// (people who) have been follloed by me
	filter.addRule({ RHS: [ auxVerbs.have, bePastReducedNoTense ] })


	var filterPlus = new g.Symbol(catName, 'filter+')
	filterPlus.addRule({ RHS: [ filter ] })

	var relativeclause = new g.Symbol(catName, 'relativeclause')
	// (people) who are followed by me
	relativeclause.addRule({ RHS: [ relativePronouns.who, filterPlus ]})


	var noRelative = new g.Symbol(catName, 'no', 'relative')
	// people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers
	this.noRelativePossessive = new g.Symbol(catName, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ] })


	this.plural = new g.Symbol(catName, 'plural')
	// people I follow
	this.plural.addRule({ RHS: [ noRelative ]})
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ]})
}