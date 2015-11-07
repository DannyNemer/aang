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
var categorySchema = {
	// The singular form of this category's name.
	sg: { type: String, required: true },
	// The plural form of this category's name.
	pl: { type: String, required: true },
	// Specify this category is person. This is used for relative pronouns (i.e., "that" vs. "who").
	isPerson: Boolean,
	// The optional entities for this category to also make it an entity category.
	entities: { type: Array, arrayType: String },
}

function Category(options) {
	if (util.illFormedOpts(categorySchema, options)) {
		throw new Error('Ill-formed symbol category')
	}

	this.nameSg = options.sg
	this.namePl = options.pl
	this.isPerson = options.isPerson

	// (repos) that I like; (people) who (are followed by me)
	var relPronoun = options.isPerson ? relPronouns.who : relPronouns.that

	this.lhs = g.newSymbol(this.nameSg, 'lhs')
	this.lhs.addRule({ isTerminal: true, RHS: g.emptySymbol })
	// (my) public/private (repos); (my) public/private ({language} repos)
	this.adjective = g.newSymbol(this.nameSg, 'adjective')
	this.lhs.addRule({ RHS: [ this.adjective, this.lhs ] })
	// {language} (repos); (repos that are) {language} (repos)
	this.preModifier = g.newSymbol(this.nameSg, 'pre', 'modifier')
	// Ensure `[pre-modifier]` is rightmost of `[this-lhs]` because `[cat-adjective]` must precede.
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

		// |Github repos (I starred)
		this.head.addRule({ RHS: [ this.headMayPoss ] })

		// (my) repos
		this.possessable = g.newSymbol(this.nameSg, 'possessable')
		this.possessable.addRule({ RHS: [ this.lhs, this.headMayPoss ], transpositionCost: 1 })
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
	var objFilterPlus = conjunctions.addForSymbol(this.objFilter, true)


	var rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })
	// (repos) that I created (that I like); (people) who I follow (who Danny follows)
	rhsExt.addRule({ RHS: [ relPronoun, this.objFilter ], noInsertionIndexes: [ 0 ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, RHS: g.emptySymbol })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) followed by me {user} follows
	rhs.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })
	// (people) not followed by me
	rhs.addRule({ RHS: [ auxVerbs.negation, reduced ], semantic: auxVerbs.notSemantic })


	var noRelativeBase = g.newSymbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })

	this.noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	this.noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers; (people who follow) my followers
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	this.noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })
	// people <stop> I follow
	this.noRelative.addRule({ RHS: [ stopWords.left, this.noRelative ] })


	// The segment that forms the relative clause.
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
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, this.noRelative ] })
	// (issues that) are <stop> open/closed
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	// (people who) are <stop> followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, reducedNoTense ] })
	// (people who) have <stop> been followed by me; (people who) have <stop> been following me
	// Prevent insertion of `[have-sentence-adverbial-be-past]` because it is semantically identical to `[be-non-1-sg-sentence-adverbial]` in the preceding rule.
	filter.addRule({ RHS: [ auxVerbs.haveSentenceAdverbialBePast, reducedNoTense ], noInsertionIndexes: [ 0 ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ RHS: [ stopWords.left, filter ] })
	// (people who) are not followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.noRelative ], semantic: auxVerbs.notSemantic })
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


	var filterPlus = conjunctions.addForSymbol(filter)
	// (people) who follow me and who I follow
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.andWho : conjunctions.andThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	], noInsertionIndexes: [ 0, 1 ] })
	// (people) who follow me or who I follow
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.unionWho : conjunctions.unionThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	], semantic: conjunctions.unionSemantic, noInsertionIndexes: [ 0, 1 ] })


	var relativeClause = g.newSymbol(this.nameSg, 'relative', 'clause')
	// (repos) that I like; (people) who are followed by me
	relativeClause.addRule({ RHS: [ relPronoun, filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ this.noRelative ], semantic: conjunctions.intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ this.noRelative, relativeClause ], semantic: conjunctions.intersectSemantic })

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

	// Unused by `[user]` because it defines `[obj-users]`, `[nom-users]`, etc.
	if (!options.isPerson) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = conjunctions.addForSymbol(this.catPl)
	}

	// repositories(date-before()); users(followers-count())
	// Requires `maxParams` be 1 for `date` semantic arguments.
	this.semantic = g.newSemantic({ name: this.namePl, cost: 0.5, minParams: 1, maxParams: 1 })

	g.startSymbol.addRule({ RHS: [ this.catPl ] })
}

// Export `Category`.
module.exports = Category