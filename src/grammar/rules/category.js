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
	isPerson: { type: Boolean, optional: true }, // "that" vs. "who" for relative pronoun
	entities: { type: Array, arrayType: String, optional: true }
}

exports.new = function (opts) {
	return new Category(opts)
}

// Create base rules for a category
function Category(opts) {
	if (util.illFormedOpts(categoryOptsSchema, opts)) {
		throw 'ill-formed Category'
	}

	this.nameSg = opts.sg
	this.namePl = opts.pl
	this.isPerson = opts.isPerson

	this.lhs = g.newSymbol(this.nameSg, 'lhs') // (NOTE: orig manually makes rules that would be from <empty>)
	this.lhs.addRule({ terminal: true, RHS: g.emptySymbol })
	// (my) public/private (repos); (my) public/private ({language} repos)
	this.adjective = g.newSymbol(this.nameSg, 'adjective')
	this.lhs.addRule({ RHS: [ this.adjective, this.lhs ] })
	// {language} (repos); (repos that are) {language} (repos)
	this.preModifier = g.newSymbol(this.nameSg, 'pre', 'modifier')
	// Ensure [pre-modifier] is rightmost of [this-lhs] because adjective must precede
	// - Ex: (my public) Java (repos); Not: (my) Java (public repos)
	this.lhs.addRule({ RHS: [ this.lhs, this.preModifier ], transpositionCost: 0 })
	// <stop> (repos); <stop> {language} (repos)
	this.lhs.addRule({ RHS: [ stopWords.left, this.lhs ] })

	// (my) repos; users (I like)
	this.term = g.newSymbol(this.namePl, 'term')

	// repos of [users]; followers of [users]
	this.head = g.newSymbol(this.nameSg, 'head')

	if (!opts.isPerson) {
		this.headMayPoss = g.newSymbol(this.nameSg, 'head', 'may', 'poss')

		// [head] -> [head-may-poss] is likely used for reducing frequency of "my" insertions
		// my/[user's] -> [head-may-poss] is seperate and will not create duplicates
		// Unable to determine how accomplished because cost of this additional rule is higher,
		// so all rules with a matching semantic will already have been accepted

		// |Github repos (I starred)
		this.head.addRule({ RHS: [ this.headMayPoss ] })

		this.possessible = g.newSymbol(this.nameSg, 'possessible')
		// (my) repos
		this.possessible.addRule({ RHS: [ this.lhs, this.headMayPoss ], transpositionCost: 1 })
	}

	this.lhsHead = g.newSymbol(this.nameSg, 'lhs', this.nameSg, 'head')
	// people (I follow); people (followed by me)
	this.lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })

	// (people) followed by me
	this.passive = g.newSymbol(this.nameSg, 'passive')
	// (repos) liked by me and/or created by {user}
	var passivePlus = conjunctions.addForSymbol(this.passive)


	var reducedNoTense = g.newSymbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) mentioned in [pull-requests+]; (people who are) mentioned in [pull-requests+]
	this.inner = g.newSymbol(this.nameSg, 'inner')
	reducedNoTense.addRule({ RHS: [ this.inner ] })
	// (issues) with <int> comments assigned to me
	reducedNoTense.addRule({ RHS: [ this.inner, reducedNoTense ], transpositionCost: 0.1 })
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ] })

	var reduced = g.newSymbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ] })


	// (people who) follow me
	this.subjFilter = g.newSymbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	this.objFilter = g.newSymbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or {user} follows
	var objFilterPlus = conjunctions.addForSymbol(this.objFilter)


	var rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })
	// (repos) that I created (that I like); (people) who I follow (who Danny follows)
	// rhsExt.addRule({ RHS: [ opts.isPerson ? relPronouns.whoNoInsertion : relPronouns.thatNoInsertion, objFilterPlus ] })


	this.rhs = g.newSymbol(this.nameSg, 'rhs')
	this.rhs.addRule({ terminal: true, RHS: g.emptySymbol })
	// (people) followed by me
	this.rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	this.rhs.addRule({ RHS: [ rhsExt ] })
	// (people) followed by me {user} follows (NOTE: orig has base cost penalty of 0.1)
	this.rhs.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	// (people) I follow <adverbial-stopword>
	this.rhs.addRule({ RHS: [ this.rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })


	var noRelativeBase = g.newSymbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ this.lhsHead, this.rhs ], transpositionCost: 1 })

	var noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers; (people who follow) my followers
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, this.rhs ], transpositionCost: 1 })
	// people <stop> I follow
	noRelative.addRule({ RHS: [ stopWords.left, noRelative ] })
	// WHY IS IT NEEDED? noRelativeBase goes to stopWords.left, but not noRelativePossessive and any others that may be added


	this.filter = g.newSymbol(this.nameSg, 'filter')
	// (people who) follow me
	this.filter.addRule({ RHS: [ this.subjFilter ] })
	// (people who) I follow
	this.filter.addRule({ RHS: [ this.objFilter ] })
	// (people who) <stop> follow me, I follow
	this.filter.addRule({ RHS: [ stopWords.preFilter, this.filter ] })
	// (people who) <stop> follow me, I follow
	this.filter.addRule({ RHS: [ stopWords.sentenceAdverbial, this.filter ], transpositionCost: 0 })
	// (people who) are followers of mine
	this.filter.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ] })
	// (issues that) are <stop> open/closed
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	// (people who) are <stop> followed by me
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, reducedNoTense ] })
	// (people who) have <stop> been folllowed by me; (people who) have <stop> been following me
	this.filter.addRule({ RHS: [ auxVerbs.haveSentenceAdverbialBePast, reducedNoTense ] })
	// (people who) <stop> follow me, I follow
	this.filter.addRule({ RHS: [ stopWords.left, this.filter ] })
	// (people who) do not follow me
	this.filter.addRule({ RHS: [ auxVerbs.doNegation, this.subjFilter ], semantic: auxVerbs.notSemantic })
	// (people who) are not followers of mine
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	this.filter.addRule({ RHS: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	this.filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


	// (people) who follow me and/or I follow
	this.filterPlus = conjunctions.addForSymbol(this.filter)

	var relPronounFilterPlus = g.newBinaryRule({ RHS: [ opts.isPerson ? relPronouns.who : relPronouns.that, this.filterPlus ] })
	// (people) who follow me and who I follow
	this.filterPlus.addRule({ RHS: [ this.filter, [ conjunctions.and, relPronounFilterPlus ] ] })
	// (people) who follow me or who I follow
	this.filterPlus.addRule({ RHS: [ this.filter, [ conjunctions.union, relPronounFilterPlus ] ], semantic: conjunctions.unionSemantic })


	// (people) who are followed by me; (repos) that are liked by me
	var relativeclause = g.newSymbol(this.nameSg, 'relativeclause')
	relativeclause.addRule({ RHS: [ opts.isPerson ? relPronouns.who : relPronouns.that, this.filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ], semantic: conjunctions.intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ], semantic: conjunctions.intersectSemantic })

	this.catPl = g.newSymbol(this.namePl)
	// (people who created) repos ...
	this.catPl.addRule({ RHS: [ this.plural ] })

	if (opts.entities) {
		this.catSg = g.newSymbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		var entity = g.newEntityCategory({ name: this.nameSg, entities: opts.entities })
		this.catSg.addRule({ terminal: true, RHS: entity })

		// (people who like) {repo}; {user}
		this.catPl.addRule({ RHS: [ this.catSg ] })
	}

	// user does not use because obj/nom-users
	if (!opts.isPerson) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = conjunctions.addForSymbol(this.catPl)
	}

	// repositories(date-before(), date-after()); users(followers-count())
	this.semantic = g.newSemantic({ name: this.namePl, cost: 0.5, minParams: 1, maxParams: 2 })

	g.startSymbol.addRule({ RHS: [ this.catPl ] })
}


exports.newSubcategoryForAdjectives = function (category, subcategoryName) {
	return new SubcategoryForAdjectives(category, subcategoryName)
}

function SubcategoryForAdjectives(category, subcategoryNameSg) {
	this.nameSg = subcategoryNameSg

	lhs = g.newSymbol(this.nameSg, 'lhs') // (NOTE: orig manually makes rules that would be from <empty>)
	// (my) public/private (repos); (my) public/private ({language} repos)
	this.adjective = g.newSymbol(this.nameSg, 'adjective')
	lhs.addRule({ RHS: [ this.adjective ] })
	lhs.addRule({ RHS: [ this.adjective, lhs ] })
	// {language} (repos); (repos that are) {language} (repos)
	// Ensure [pre-modifier] is rightmost of [this-lhs] because adjective must precede
	// - Ex: (my public) Java (repos); Not: (my) Java (public repos)
	lhs.addRule({ RHS: [ lhs, category.preModifier ], transpositionCost: 0 })
	// <stop> (repos); <stop> {language} (repos)
	lhs.addRule({ RHS: [ stopWords.left, lhs ] })
	lhs.addRule({ RHS: [ lhs, stopWords.left ] })
	// NEED TO STOP ABOVE FROM INSERTIONS BEING MADE WITH BLANK THAT TURNS LHS INTO TWO ADDITIONAL PATHS TO JUST THIS.ADJECTIVE, WHICH ONLY SLOWS DOWN

	// (my) public repos; (my) public {left-stop-words} Java repos
	this.possessible = g.newSymbol(this.nameSg, 'possessible')
	this.possessible.addRule({ RHS: [ lhs, category.headMayPoss ], transpositionCost: 1 })

	// repos of mine
	this.head = g.newSymbol(this.nameSg, 'head')

	// public repos of mine (I like)
	category.lhsHead.addRule({ RHS: [ lhs, this.head ], transpositionCost: 1 })

	// Java repos of mine that are public
	var lhsHead = g.newBinaryRule({ RHS: [ category.lhs, this.head ], transpositionCost: 1 })

	var noRelativeBase = g.newSymbol(this.nameSg, 'no', 'relative', 'base')
	noRelativeBase.addRule({ RHS: [ lhsHead, category.rhs ], transpositionCost: 1 })

	var noRelative = g.newSymbol(this.nameSg, 'no', 'relative')

	noRelative.addRule({ RHS: [ noRelativeBase ] })

	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, category.rhs ], transpositionCost: 1 })

	noRelative.addRule({ RHS: [ stopWords.left, noRelative ] })


	var filter = g.newSymbol(this.nameSg, 'filter')
	// (my repos that) are <stop> private
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	// (my repos that) are not private
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (my repos that) <stop> are private
	filter.addRule({ RHS: [ stopWords.left, filter ] })
	// (my repos that) <stop> are private
	filter.addRule({ RHS: [ stopWords.sentenceAdverbial, filter ], transpositionCost: 0 })
	// (my repos that) <stop> are private
	filter.addRule({ RHS: [ stopWords.preFilter, filter ] })


	// could rearange rules, so do not need to do [ filter, [and, X ] ], [ filter, [ and, Y ] ]

	var filterPlus = g.newSymbol(filter.name + '+')
	// (my repos that) are public
	filterPlus.addRule({ RHS: [ filter ] })

	var filterPlusOrParentFilterPlus = g.newSymbol(filterPlus.name, 'or', category.filterPlus.name)
	// (my repos that) are private and are public
	filterPlusOrParentFilterPlus.addRule({ RHS: [ filterPlus ] })
	// (my repos that) are private and I like
	filterPlusOrParentFilterPlus.addRule({ RHS: [ category.filterPlus ] })

	// (my repos that) are private and are-public/I-like
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.and, filterPlusOrParentFilterPlus ] ] })
	// (my repos that) are private or are-public/I-like
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.union, filterPlusOrParentFilterPlus ] ], semantic: conjunctions.unionSemantic })

	// (my repos that) I like and are public
	filterPlus.addRule({ RHS: [ category.filter, [ conjunctions.and, filterPlus ] ] })
	// (my repos that) I like or are public
	filterPlus.addRule({ RHS: [ category.filter, [ conjunctions.union, filterPlus ] ], semantic: conjunctions.unionSemantic })

	// (my repos that are public and/or) that are-public/I-like
	var relPronounFilterPlusOrParentFilterPlus = g.newBinaryRule({ RHS: [ category.isPerson ? relPronouns.who : relPronouns.that, filterPlusOrParentFilterPlus ] })
	// (my repos that) are public and that are-public/I-like
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.and, relPronounFilterPlusOrParentFilterPlus ] ] })
	// (my repos that) are public or that are-public/I-like
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.union, relPronounFilterPlusOrParentFilterPlus ] ], semantic: conjunctions.unionSemantic })

	// (my repos that) I like and that are public
	var relPronounFilterPlus = g.newBinaryRule({ RHS: [ category.isPerson ? relPronouns.who : relPronouns.that, filterPlus ] })
	// (my repos that) I like and that are public
	filterPlus.addRule({ RHS: [ category.filter, [ conjunctions.and, relPronounFilterPlus ] ] })
	// (my repos that) I like or that are public
	filterPlus.addRule({ RHS: [ category.filter, [ conjunctions.union, relPronounFilterPlus ] ], semantic: conjunctions.unionSemantic })


	// (my repos) that are public
	var relativeclause = g.newSymbol(this.nameSg, 'relativeclause')
	relativeclause.addRule({ RHS: [ category.isPerson ? relPronouns.who : relPronouns.that, filterPlus ] })

	// my repos that are public
	category.plural.addRule({ RHS: [ noRelative, relativeclause ], semantic: conjunctions.intersectSemantic })
}