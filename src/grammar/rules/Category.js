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
	this.preModifier = new g.Symbol(this.nameSg, 'pre', 'modifier')
	this.lhs.addRule({ RHS: [ this.preModifier ] })
	// <stop> (issues); <stop> [issue-adjective] (issues)
	this.lhs.addRule({ RHS: [ stopWords.left, this.lhs ], transpositionCost: 0 })


	// repos of [users]; followers
	this.head = new g.Symbol(this.nameSg, 'head')

	if (!catOpts.person) {
		this.headMayPoss = new g.Symbol(this.nameSg, 'head', 'may', 'poss')

		// [head] -> [head-may-poss] is likely used for reducing frequency of "my" insertions
		// my/[user's] -> [head-may-poss] is seperate and will not create duplicates
		// Unable to determine how accomplished because cost of this additional rule is higher,
		// so all rules with a matching semantic will already have been accepted

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
	// (issues) with <int> comments assigned to me
	reducedNoTense.addRule({ RHS: [ this.inner, reducedNoTense ], transpositionCost: 0.1 })
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
	// my followers; (people who follow) my followers
	this.noRelativePossessive = new g.Symbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })
	// people <stop> I follow
	noRelative.addRule({ RHS: [ stopWords.left, noRelative ] })


	var filter = new g.Symbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ RHS: [ this.subjFilter ] })
	// (people who) I follow
	filter.addRule({ RHS: [ this.objFilter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ RHS: [ stopWords.preFilter, filter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ RHS: [ stopWords.sentenceAdverbial, filter ], transpositionCost: 0 })
	// (people who) are followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ] })
	// (issues that) are <stop> open/closed
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	// (people who) are <stop> followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, reducedNoTense ] })
	// (people who) have <stop> been folllowed by me; (people who) have <stop> been following me
	filter.addRule({ RHS: [ auxVerbs.haveSentenceAdverbialBePast, reducedNoTense ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ RHS: [ stopWords.left, filter ] })
	// (people who) do not follow me
	filter.addRule({ RHS: [ auxVerbs.doNegation, this.subjFilter ], semantic: auxVerbs.notSemantic })
	// (people who) are not followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	filter.addRule({ RHS: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = new g.Symbol(this.nameSg, 'post', 'modifier')
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


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
		var catSemanticArg = g.newSemantic({ name: catEntityStr, isArg: true, cost: 0 })
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