var g = require('../grammar')
var util = require('../../util/util')
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var conjunctions = require('./conjunctions')

/**
 * Crates a `Category` for the grammar, which adds several base symbols and rules necessary for every category.
 *
 * @param {Object} options The options object.
 */
var categoryOptionsSchema = {
	// The singular form of this category's name.
	sg: String,
	// The plural form of this category's name.
	pl: String,
	// Specify this category is person. This is used for relative pronouns (i.e., "that" vs. "who").
	isPerson: { type: Boolean, optional: true },
	// The optional entities for this category to also make it an entity category.
	entities: { type: Array, arrayType: String, optional: true },
}

function Category(options) {
	if (util.illFormedOpts(categoryOptionsSchema, options)) {
		throw new Error('Ill-formed symbol category')
	}

	this.nameSg = options.sg
	this.namePl = options.pl
	this.isPerson = options.isPerson

	this.lhs = g.newSymbol(this.nameSg, 'lhs') // (NOTE: orig manually makes rules that would be from <empty>)
	this.lhs.addRule({ isTerminal: true, RHS: g.emptySymbol })
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

	if (!options.isPerson) {
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

	var lhsHead = g.newSymbol(this.nameSg, 'lhs', this.nameSg, 'head')
	// people (I follow); people (followed by me)
	lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })

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
	// rhsExt.addRule({ RHS: [ options.isPerson ? relPronouns.whoNoInsert : relPronouns.thatNoInsert, objFilterPlus ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, RHS: g.emptySymbol })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) followed by me {user} follows (NOTE: orig has base cost penalty of 0.1)
	rhs.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })


	var noRelativeBase = g.newSymbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })

	var noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers; (people who follow) my followers
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })
	// people <stop> I follow
	noRelative.addRule({ RHS: [ stopWords.left, noRelative ] })
	// WHY IS IT NEEDED? noRelativeBase goes to stopWords.left, but not noRelativePossessive and any others that may be added


	// Segment that forms the relative clause
	var filter = g.newSymbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ RHS: [ this.subjFilter ], personNumber: 'pl' })
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
	// (people who) are not followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	filter.addRule({ RHS: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


	// (people) who follow me and/or I follow
	var filterPlus = conjunctions.addForSymbol(filter)

	var relPronounFilterPlus = g.newBinaryRule({ RHS: [ options.isPerson ? relPronouns.who : relPronouns.that, filterPlus ] })
	// (people) who follow me and who I follow
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.and, relPronounFilterPlus ] ] })
	// (people) who follow me or who I follow
	filterPlus.addRule({ RHS: [ filter, [ conjunctions.union, relPronounFilterPlus ] ], semantic: conjunctions.unionSemantic })


	var relativeClause = g.newSymbol(this.nameSg, 'relative', 'clause')
	// (people) who are followed by me; (people) who I follow
	// (repos) that are liked by me; (repos) that I like
	relativeClause.addRule({ RHS: [ options.isPerson ? relPronouns.who : relPronouns.that, filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ], semantic: conjunctions.intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeClause ], semantic: conjunctions.intersectSemantic })

	this.catPl = g.newSymbol(this.namePl)
	// (people who created) repos ...
	this.catPl.addRule({ RHS: [ this.plural ] })

	if (options.entities) {
		this.catSg = g.newSymbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		this.catSg.addRule({
			isTerminal: true,
			RHS: g.newEntityCategory({ name: this.nameSg, entities: options.entities }),
			isPlaceholder: true,
		})

		// (people who like) {repo}
		// Direct entity suggestion: {user}
		this.catPl.addRule({ RHS: [ this.catSg ] })
	}

	// user does not use because obj/nom-users
	if (!options.isPerson) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = conjunctions.addForSymbol(this.catPl)
	}

	// repositories(date-before(), date-after()); users(followers-count())
	this.semantic = g.newSemantic({ name: this.namePl, cost: 0.5, minParams: 1, maxParams: 2 })

	g.startSymbol.addRule({ RHS: [ this.catPl ] })
}

// Export `Category`.
module.exports = Category