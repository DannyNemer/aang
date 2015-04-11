var g = require('../grammar')
var util = require('../../util')
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var operators = require('./operators')

// Start symbol
var start = new g.Symbol('start')

// Definition of accepted options for a Category
var categoryOptsSchema = {
	sg: String,
	pl: String,
	person: { type: Boolean, optional: true }, // "that" vs. "who" for relative pronoun
	entity: { type: Boolean, optional: true }
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

	// repos of [users]; followers
	this.head = new g.Symbol(this.nameSg, 'head')

	if (!catOpts.person) {
		this.headMayPoss = new g.Symbol(this.nameSg, 'head', 'may', 'poss')

		// |Github repos (I starred)
		this.head.addRule({ RHS: [ this.headMayPoss ] })

		this.possessible = new g.Symbol(this.nameSg, 'possessible')
		// (my) repos
		this.possessible.addRule({ RHS: [ this.lhs, this.headMayPoss ], transpositionCost: 1 })
	}

	var lhsHead = new g.Symbol(this.nameSg, 'lhs', this.nameSg, 'head')
	// people (I follow); people (followed by me)
	lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })

	// (people) followed by me
	this.passive = new g.Symbol(this.nameSg, 'passive')
	// (repos) liked by me and/or created by {user}
	var passivePlus = operators.addConjunctions(this.passive)


	var reducedNoTense = new g.Symbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) mentioned in [pull-requests+]; (people who are) mentioned in [pull-requests+]
	this.inner = new g.Symbol(this.nameSg, 'inner')
	reducedNoTense.addRule({ RHS: [ this.inner ] })
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ] })

	var reduced = new g.Symbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ]})


	// (people who) follow me
	this.subjFilter = new g.Symbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	this.objFilter = new g.Symbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or {user} follows
	var objFilterPlus = operators.addConjunctions(this.objFilter)


	var rhsExt = new g.Symbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(this.nameSg, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptyTermSym })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) followed by me {user} follows (NOTE: orig has base cost penalty of 0.1)
	rhs.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })


	var noRelativeBase = new g.Symbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })

	var noRelative = new g.Symbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers
	this.noRelativePossessive = new g.Symbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })


	var filter = new g.Symbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ RHS: [ this.subjFilter ]})
	// (people who) I follow
	filter.addRule({ RHS: [ this.objFilter ]})
	// (people who) I follow <adverbial-stopword>
	filter.addRule({ RHS: [ filter, stopWords.sentenceAdverbial ]})
	// (people who) are followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ]})
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ]})


	var bePastReducedNoTense = new g.Symbol('be', 'past', this.nameSg, 'reduced', 'no', 'tense')
	// (people who have) been followed by me; (people who have) been following me
	bePastReducedNoTense.addRule({ RHS: [ auxVerbs.bePast, reducedNoTense ] })
	// (people who) have been folllowed by me; (people who) have been following me
	// - personNumber exists to force [have] -> "have"
	filter.addRule({ RHS: [ auxVerbs.have, bePastReducedNoTense ], personNumber: 'pl' })


	// (people) who follow me and/or I follow
	var filterPlus = operators.addConjunctions(filter)

	var relPronounFilterPlus = new g.Symbol(catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	relPronounFilterPlus.addRule({ RHS: [ catOpts.person ? relPronouns.who : relPronouns.that, filterPlus ] })
	// (people) who follow me and who I follow
	var andRelPronounFilterPlus = new g.Symbol('and', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	andRelPronounFilterPlus.addRule({ RHS: [ operators.and, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, andRelPronounFilterPlus ] })
	// (people) who follow me or who I follow
	var orRelPronounFilterPlus = new g.Symbol('or', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	orRelPronounFilterPlus.addRule({ RHS: [ operators.union, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, orRelPronounFilterPlus ], semantic: operators.unionSemantic })


	var relativeclause = new g.Symbol(this.nameSg, 'relativeclause')
	if (catOpts.person) {
		// (people) who are followed by me
		relativeclause.addRule({ RHS: [ relPronouns.who, filterPlus ]})
	} else {
		// (repos) that are liked by me
		relativeclause.addRule({ RHS: [ relPronouns.that, filterPlus ]})
	}


	this.plural = new g.Symbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ], semantic: operators.intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ], semantic: operators.intersectSemantic })

	this.catPl = new g.Symbol(this.namePl)
	// (people who created) repos ...
	this.catPl.addRule({ RHS: [ this.plural ] })

	if (catOpts.entity) {
		this.catSg = new g.Symbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		this.catSg.addRule({ terminal: true, RHS: '{' + this.nameSg + '}' })

		if (!catOpts.person) { // user does not use because obj/nom-users -> [user]
			// (people who like) {repo}
			this.catPl.addRule({ RHS: [ this.catSg ] })
		}
	}

	// user does not use because obj/nom-users
	if (!catOpts.person) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = operators.addConjunctions(this.catPl)
	}

	start.addRule({ RHS: [ this.catPl ]})
}