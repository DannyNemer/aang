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
	this.lhs.addRule({ isTerminal: true, rhs: g.emptySymbol })
	// (my) public/private (repos); (my) public/private ({language} repos)
	this.adjective = g.newSymbol(this.nameSg, 'adjective')
	this.lhs.addRule({ rhs: [ this.adjective, this.lhs ] })
	// {language} (repos); (repos that are) {language} (repos)
	this.preModifier = g.newSymbol(this.nameSg, 'pre', 'modifier')
	// Ensure `[pre-modifier]` is rightmost of `[this-lhs]` because `[cat-adjective]` must precede.
	// - Ex: (my public) Java (repos); Not: (my) Java (public repos)
	this.lhs.addRule({ rhs: [ this.lhs, this.preModifier ], transpositionCost: 0.1 })
	// <stop> (repos); <stop> {language} (repos)
	this.lhs.addRule({ rhs: [ stopWords.left, this.lhs ] })
	// [user:'s] public/private repos -> [user:'s] repos
	this.stopWord = g.newSymbol(this.nameSg, 'stop', 'word')
	this.lhs.addRule({ rhs: [ this.stopWord, this.lhs ] })

	// (my) repos; users (I like)
	this.term = g.newSymbol(this.namePl, 'term')

	// repos of [users]; followers of [users]
	this.head = g.newSymbol(this.nameSg, 'head')

	if (!options.isPerson) {
		this.headMayPoss = g.newSymbol(this.nameSg, 'head', 'may', 'poss')

		// |Github repos (I starred)
		this.head.addRule({ rhs: [ this.headMayPoss ] })

		// (my) repos
		this.possessable = g.newSymbol(this.nameSg, 'possessable')
		this.possessable.addRule({ rhs: [ this.lhs, this.headMayPoss ], transpositionCost: 1 })
	}

	// people (I follow); people (followed by me); Javascript repos (I like)
	var lhsHead = g.newBinaryRule({ rhs: [ this.lhs, this.head ], transpositionCost: 1 })

	// (people) followed by me
	this.passive = g.newSymbol(this.nameSg, 'passive')
	// (repos) liked by me and/or created by {user}
	var passivePlus = conjunctions.create(this.passive)


	var reducedNoTense = g.newSymbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) mentioned in [pull-requests+]; (people who are) mentioned in [pull-requests+]
	this.inner = g.newSymbol(this.nameSg, 'inner')
	reducedNoTense.addRule({ rhs: [ this.inner ] })
	// (issues) with <int> comments assigned to me
	// Creates ambiguity when tranposing [inner][inner]. Can be avoided with the following rules, however, moving `[inner]` to a second rule adds more overhead than removing the ambiguity saves:
	//   [inner+] -> [inner] | [inner+][inner] (no insertions)
	//   [reduced-no-tence] -> [inner+] | [inner+][passive+] (w/ trans)
	reducedNoTense.addRule({ rhs: [ this.inner, reducedNoTense ], transpositionCost: 0.1 })
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ rhs: [ passivePlus ] })

	var reduced = g.newSymbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ rhs: [ reducedNoTense ] })


	// (people who) follow me
	this.subjFilter = g.newSymbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	this.objFilter = g.newSymbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or {user} follows
	var objFilterPlus = conjunctions.create(this.objFilter, true)


	var rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ rhs: [ objFilterPlus ] })
	// (repos) that I created (that I like); (repos) created by me (that I like)
	rhsExt.addRule({ rhs: [ relPronoun, this.objFilter ], noInsertionIndexes: [ 0 ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, rhs: g.emptySymbol })
	// (people) followed by me
	rhs.addRule({ rhs: [ reduced ] })
	// (people) I follow
	rhs.addRule({ rhs: [ rhsExt ] })
	// (people) followed by me {user} follows
	rhs.addRule({ rhs: [ reduced, rhsExt ], transpositionCost: 0.1 })
	// (people) not followed by me
	rhs.addRule({ rhs: [ auxVerbs.negation, reduced ], semantic: auxVerbs.notSemantic })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ rhs: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })


	var baseNoRelative = g.newSymbol(this.nameSg, 'base', 'no', 'relative')
	// people I follow; female people followed by me
	baseNoRelative.addRule({ rhs: [ lhsHead, rhs ], transpositionCost: 1 })

	this.noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	this.noRelative.addRule({ rhs: [ baseNoRelative ] })
	// my followers; (people who follow) my followers
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	this.noRelative.addRule({ rhs: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })
	// people <stop> I follow
	this.noRelative.addRule({ rhs: [ stopWords.left, this.noRelative ] })


	// The segment that forms the relative clause.
	var filter = g.newSymbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ rhs: [ this.subjFilter ], personNumber: 'pl' })
	// (people who) I follow
	filter.addRule({ rhs: [ this.objFilter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.preFilter, filter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.sentenceAdverbial, filter ], transpositionCost: 0 })
	// (people who) are followers of mine
	filter.addRule({ rhs: [ auxVerbs.beNon1Sg, this.noRelative ] })
	// (issues that) are <stop> open/closed
	filter.addRule({ rhs: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	// (people who) are <stop> followed by me
	filter.addRule({ rhs: [ auxVerbs.beNon1SgSentenceAdverbial, reducedNoTense ] })
	// (people who) have <stop> been followed by me; (people who) have <stop> been following me
	// Prevent insertion of `[have-sentence-adverbial-be-past]` because it is semantically identical to `[be-non-1-sg-sentence-adverbial]` in the preceding rule.
	filter.addRule({ rhs: [ auxVerbs.haveSentenceAdverbialBePast, reducedNoTense ], noInsertionIndexes: [ 0 ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.left, filter ] })
	// (people who) are not followers of mine
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	filter.addRule({ rhs: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	filter.addRule({ rhs: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


	// Identical rule structure to rules `conjunctions.create()` defines, though defined here to incoporate relative pronouns for "[filter] and who/that ...".
	var filterPlus = g.newSymbol(filter.name + '+')
	// (people who) `[filter]`
	filterPlus.addRule({
		rhs: [ filter ],
	})

	var filterAnd = g.newBinaryRule({
		rhs: [ filter, conjunctions.and ],
		noInsertionIndexes: [ 0 ],
	})
	var filterAndRelPronoun = g.newBinaryRule({
		rhs: [ filter, options.isPerson ? conjunctions.andWho : conjunctions.andThat ],
		noInsertionIndexes: [ 0 ],
	})

	var filterPlusNoUnion = g.newSymbol(filterPlus.name, 'no', 'union')
	filterPlusNoUnion.addRule({
		rhs: [ filter ],
	}).addRule({
		rhs: [ filterAnd, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	}).addRule({
		rhs: [ filterAndRelPronoun, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// (people who) `[filter]` and [who] `[filter]` [and [who] `[filter]` ...]
	filterPlus.addRule({
		rhs: [ filterAnd, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	}).addRule({
		rhs: [ filterAndRelPronoun, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var filterPlusNoUnionOr = g.newBinaryRule({
		rhs: [ filterPlusNoUnion, conjunctions.union ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunctions.intersectSemantic,
	})
	var filterPlusNoUnionOrRelPronoun = g.newBinaryRule({
		rhs: [ filterPlusNoUnion, options.isPerson ? conjunctions.unionWho : conjunctions.unionThat ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunctions.intersectSemantic,
	})
	var filterPlusIntersect = g.newSymbol(filterPlus.name, 'intersect').addRule({
		rhs: [ filterPlus ],
		semantic: conjunctions.intersectSemantic,
	})

	// (people who) `[filter]` [and `[filter]` ...] or `[filter+]`
	filterPlus.addRule({
		rhs: [ filterPlusNoUnionOr, filterPlusIntersect ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.unionSemantic,
	}).addRule({
		rhs: [ filterPlusNoUnionOrRelPronoun, filterPlusIntersect ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.unionSemantic,
	})


	var relativeClause = g.newSymbol(this.nameSg, 'relative', 'clause')
	// (repos) that I like; (people) who are followed by me
	relativeClause.addRule({ rhs: [ relPronoun, filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people I follow
	this.plural.addRule({ rhs: [ this.noRelative ], semantic: conjunctions.intersectSemantic })
	// people I follow who are followed by me
	// Stopping the insertion of `relativeClause` avoids many ambiguous parses, but prevents a much smaller quantity of unambiguous parses, and hence remains for now.
	this.plural.addRule({ rhs: [ this.noRelative, relativeClause ], semantic: conjunctions.intersectSemantic })

	this.catPl = g.newSymbol(this.namePl)
	// (people who created) repos...
	this.catPl.addRule({ rhs: [ this.plural ] })


	if (options.entities) {
		this.catSg = g.newSymbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		this.catSg.addRule({
			isTerminal: true,
			rhs: g.newEntityCategory({ name: this.nameSg, entities: options.entities }),
			isPlaceholder: true,
		})

		// (people who like) {repo}
		// Direct entity suggestion: {user}
		this.catPl.addRule({ rhs: [ this.catSg ] })
	}

	// Unused by `[user]` because it manually defines `[obj-users]`, `[nom-users]`, etc.
	if (!options.isPerson) {
		// (people who like) my repos and/or {user}'s repos
		this.catPlPlus = conjunctions.create(this.catPl)
	}

	// Requires `maxParams` be 1 for `date` semantic arguments.
	// repositories(date-before()); users(followers-count())
	this.semantic = g.newSemantic({ name: this.namePl, cost: 0.5, minParams: 1, maxParams: 1 })

	g.startSymbol.addRule({ rhs: [ this.catPl ] })
}

// Export `Category`.
module.exports = Category