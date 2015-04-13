var g = require('../grammar')
var util = require('../../util')
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var conjunctions = require('./conjunctions')

// Schema for a Category
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

	this.lhs = new g.Symbol(this.nameSg, 'lhs') // (NOTE: orig manually makes rules that would be from <empty>)
	this.lhs.addRule({ terminal: true, RHS: g.emptySymbol })
	// open/closed (issues)
	this.adjective = new g.Symbol(this.nameSg, 'adjective')
	this.lhs.addRule({ RHS: [ this.adjective ] })
	// If multiple adjectives, or to combine with noun-modifer: recent profil photos
	// But will create ambiguity with stop-words
	// this.lhs.addRule({ RHS: [ this.adjective, this.lhs ] })
	// {language} (repos)
	this.nounModifier = new g.Symbol(this.nameSg, 'noun', 'modifier')
	this.lhs.addRule({ RHS: [ this.nounModifier ] })
	// <stop> (issues); <stop> [issue-adjective] (issues)
	this.lhs.addRule({ RHS: [ this.lhs, stopWords.left ], transpositionCost: 0 })


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
	var passivePlus = conjunctions.addForSymbol(this.passive)


	var reducedNoTense = new g.Symbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) mentioned in [pull-requests+]; (people who are) mentioned in [pull-requests+]
	this.inner = new g.Symbol(this.nameSg, 'inner')
	reducedNoTense.addRule({ RHS: [ this.inner ] })
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ] })

	var reduced = new g.Symbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ] })


	// (people who) follow me
	this.subjFilter = new g.Symbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	this.objFilter = new g.Symbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or {user} follows
	var objFilterPlus = conjunctions.addForSymbol(this.objFilter)


	var rhsExt = new g.Symbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(this.nameSg, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptySymbol })
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
	filter.addRule({ RHS: [ this.subjFilter ] })
	// (people who) I follow
	filter.addRule({ RHS: [ this.objFilter ] })
	// (people who) I follow <adverbial-stopword>
	filter.addRule({ RHS: [ filter, stopWords.sentenceAdverbial ] })
	// (people who) are followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ] })
	// (issues that) are open/closed (NOTE: orig has a seperate manually created rule without sentence-adverbial)
	var sentenceAdverbialAdjective = new g.Symbol('sentence', 'adverbial', this.nameSg, 'adjective')
	sentenceAdverbialAdjective.addRule({ RHS: [ stopWords.sentenceAdverbial, this.adjective ] })
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, sentenceAdverbialAdjective ] })
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ] })


	var bePastReducedNoTense = new g.Symbol('be', 'past', this.nameSg, 'reduced', 'no', 'tense')
	// (people who have) been followed by me; (people who have) been following me
	bePastReducedNoTense.addRule({ RHS: [ auxVerbs.bePast, reducedNoTense ] })
	// (people who) have been folllowed by me; (people who) have been following me
	// - personNumber exists to force [have] -> "have"
	filter.addRule({ RHS: [ auxVerbs.have, bePastReducedNoTense ], personNumber: 'pl' })
	// (people who) do not follow me
	filter.addRule({ RHS: [ auxVerbs.doNegation, this.subjFilter ], semantic: auxVerbs.notSemantic })
	// (people who) are not followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not follwed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been follwed by me
	filter.addRule({ RHS: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })


	// (people) who follow me and/or I follow
	var filterPlus = conjunctions.addForSymbol(filter)

	var relPronounFilterPlus = new g.Symbol(catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	relPronounFilterPlus.addRule({ RHS: [ catOpts.person ? relPronouns.who : relPronouns.that, filterPlus ] })
	// (people) who follow me and who I follow
	var andRelPronounFilterPlus = new g.Symbol('and', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	andRelPronounFilterPlus.addRule({ RHS: [ conjunctions.and, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, andRelPronounFilterPlus ] })
	// (people) who follow me or who I follow
	var orRelPronounFilterPlus = new g.Symbol('or', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	orRelPronounFilterPlus.addRule({ RHS: [ conjunctions.union, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, orRelPronounFilterPlus ], semantic: conjunctions.unionSemantic })


	var relativeclause = new g.Symbol(this.nameSg, 'relativeclause')
	if (catOpts.person) {
		// (people) who are followed by me
		relativeclause.addRule({ RHS: [ relPronouns.who, filterPlus ] })
	} else {
		// (repos) that are liked by me
		relativeclause.addRule({ RHS: [ relPronouns.that, filterPlus ] })
	}


	this.plural = new g.Symbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ], semantic: conjunctions.intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ], semantic: conjunctions.intersectSemantic })

	this.catPl = new g.Symbol(this.namePl)
	// (people who created) repos ...
	this.catPl.addRule({ RHS: [ this.plural ] })

	if (catOpts.entity) {
		this.catSg = new g.Symbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		var catEntityStr = '{' + this.nameSg + '}'
		var catSemanticArg = new g.Semantic({ name: catEntityStr, isArg: true, cost: 0 })
		this.catSg.addRule({ terminal: true, RHS: catEntityStr, text: catEntityStr, semantic: catSemanticArg })

		if (!catOpts.person) { // user does not use because obj/nom-users -> [user]
			// (people who like) {repo}
			this.catPl.addRule({ RHS: [ this.catSg ] })
		}
	}

	// user does not use because obj/nom-users
	if (!catOpts.person) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = conjunctions.addForSymbol(this.catPl)
	}

	g.startSymbol.addRule({ RHS: [ this.catPl ] })
}