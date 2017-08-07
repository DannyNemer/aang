/**
 * After 10 hours of work, this implementation of `Category` removes instances of semantic ambiguity produced by queries of the following forms:
 * - "repos I like"
 * - "repos that I like"
 * - "repos I like Danny likes"
 * - "repos I like and Danny likes"
 * - "repos that I like and Danny likes"
 * - "repos that I like that Danny likes"
 * - "repos that I like and that Danny likes"
 * - "repos I like and that Danny likes"
 * - "repos that I like Danny likes"
 *
 * While this implementation can significantly reduce the number of semantically identical trees that are generated and then discarded, the required rules yield an increased total number of created paths. More importantly, the greater number of rules can significantly increases the time required for `Parser.prototype.parse()` (i.e., the parse forests are more complex). As a result, this implementation is slower.
 */

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
	sg: String,
	// The plural form of this category's name.
	pl: String,
	// Specify this category is person. This is used for relative pronouns (i.e., "that" vs. "who").
	isPerson: { type: Boolean, optional: true },
	// The optional entities for this category to also make it an entity category.
	entities: { type: Array, arrayType: String, optional: true },
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
		this.possessible = g.newSymbol(this.nameSg, 'possessible')
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
	var objFilterPlus = conjunctions.addForSymbol(this.objFilter, true)


	var rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })
	// (repos) that I created (that I like); (people) who I follow (who Danny follows)
	rhsExt.addRule({ RHS: [ relPronoun, objFilterPlus ], noInsertionIndexes: [ 0 ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, RHS: g.emptySymbol })
	rhs.addRule({ RHS: [ reduced ] })
	rhs.addRule({ RHS: [ rhsExt ] })
	rhs.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })
	rhs.addRule({ RHS: [ auxVerbs.negation, reduced ], semantic: auxVerbs.notSemantic })

	var noRelativeBase = g.newSymbol(this.nameSg, 'no', 'relative', 'base')
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })

	var noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })
	noRelative.addRule({ RHS: [ stopWords.left, noRelative ] })


	var rhsNoObj = g.newSymbol(rhs.name, 'no', 'obj')
	rhsNoObj.addRule({ isTerminal: true, RHS: g.emptySymbol })
	rhsNoObj.addRule({ RHS: [ reduced ] })
	rhsNoObj.addRule({ RHS: [ rhsNoObj, stopWords.sentenceAdverbial ], transpositionCost: 0 })
	rhsNoObj.addRule({ RHS: [ auxVerbs.negation, reduced ], semantic: auxVerbs.notSemantic })

	var noRelativeBaseNoObj = g.newSymbol(noRelativeBase.name, 'no', 'obj')
	noRelativeBaseNoObj.addRule({ RHS: [ lhsHead, rhsNoObj ], transpositionCost: 1 })

	var noRelativeNoObj = g.newSymbol(noRelative.name, 'no', 'obj')
	noRelativeNoObj.addRule({ RHS: [ noRelativeBaseNoObj ] })
	noRelativeNoObj.addRule({ RHS: [ this.noRelativePossessive, rhsNoObj ], transpositionCost: 1 })
	noRelativeNoObj.addRule({ RHS: [ stopWords.left, noRelativeNoObj ] })


	var rhsObj = g.newSymbol(rhs.name, 'obj')
	// no empty
	rhsObj.addRule({ RHS: [ rhsExt ] })
	rhsObj.addRule({ RHS: [ reduced, rhsExt ], transpositionCost: 0.1 })
	rhsObj.addRule({ RHS: [ rhsObj, stopWords.sentenceAdverbial ], transpositionCost: 0 })

	var noRelativeBaseObj = g.newSymbol(noRelativeBase.name, 'obj')
	noRelativeBaseObj.addRule({ RHS: [ lhsHead, rhsObj ], transpositionCost: 1 })

	var noRelativeObj = g.newSymbol(noRelative.name, 'obj')
	noRelativeObj.addRule({ RHS: [ noRelativeBaseObj ] })
	noRelativeObj.addRule({ RHS: [ this.noRelativePossessive, rhsObj ], transpositionCost: 1 })
	noRelativeObj.addRule({ RHS: [ stopWords.left, noRelativeObj ] })


	var filterSub = g.newSymbol(this.nameSg, 'filter', 'sub')
	filterSub.addRule({ RHS: [ this.subjFilter ], personNumber: 'pl' })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.adjective ] })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, reducedNoTense ] })
	filterSub.addRule({ RHS: [ auxVerbs.haveSentenceAdverbialBePast, reducedNoTense ] })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ] })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgNegation, reduced ], semantic: auxVerbs.notSemantic })
	filterSub.addRule({ RHS: [ auxVerbs.haveNegationBePast, reduced ], semantic: auxVerbs.notSemantic })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgNegation, noRelative ], semantic: auxVerbs.notSemantic })
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	filterSub.addRule({ RHS: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


	var filter = g.newSymbol(this.nameSg, 'filter')
	filter.addRule({ RHS: [ stopWords.preFilter, filter ] })
	filter.addRule({ RHS: [ stopWords.sentenceAdverbial, filter ], transpositionCost: 0 })
	filter.addRule({ RHS: [ stopWords.left, filter ] })
	filter.addRule({ RHS: [ this.objFilter ] })
	filter.addRule({ RHS: [ filterSub ] })

	var filterPlus = g.newSymbol(filter.name + '+')
	filterPlus.addRule({ RHS: [ filter ] })
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({ RHS: [ filter, conjunctions.and ], noInsertionIndexes: [ 0 ] }),
		filterPlus,
	] })
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({ RHS: [ filter, conjunctions.union ], noInsertionIndexes: [ 0 ] }),
		filterPlus,
	], semantic: conjunctions.unionSemantic })
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.andWho : conjunctions.andThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	] })
	filterPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.unionWho : conjunctions.unionThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	], semantic: conjunctions.unionSemantic })

	var relativeClause = g.newSymbol(this.nameSg, 'relative', 'clause')
	relativeClause.addRule({ RHS: [ relPronoun, filterPlus ] })


	var filterNoObj = g.newSymbol(this.nameSg, 'filter', 'no', 'obj')
	filterNoObj.addRule({ RHS: [ stopWords.preFilter, filterNoObj ] })
	filterNoObj.addRule({ RHS: [ stopWords.sentenceAdverbial, filterNoObj ], transpositionCost: 0 })
	filterNoObj.addRule({ RHS: [ stopWords.left, filterNoObj ] })
	filterNoObj.addRule({ RHS: [ filterSub ] })

	var filterNoObjPlus = g.newSymbol(filterNoObj.name + '+')
	filterNoObjPlus.addRule({ RHS: [ filterNoObj ] })
	filterNoObjPlus.addRule({ RHS: [
		g.newBinaryRule({ RHS: [ filterNoObj, conjunctions.and ], noInsertionIndexes: [ 0 ] }),
		filterPlus,
	] })
	filterNoObjPlus.addRule({ RHS: [
		g.newBinaryRule({ RHS: [ filterNoObj, conjunctions.union ], noInsertionIndexes: [ 0 ] }),
		filterPlus,
	], semantic: conjunctions.unionSemantic })
	filterNoObjPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filterNoObj, options.isPerson ? conjunctions.andWho : conjunctions.andThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	] })
	filterNoObjPlus.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filterNoObj, options.isPerson ? conjunctions.unionWho : conjunctions.unionThat ],
			noInsertionIndexes: [ 0 ]
		}),
		filterPlus,
	], semantic: conjunctions.unionSemantic })

	var relativeClauseNoObj = g.newSymbol(this.nameSg, 'relative', 'clause', 'no', 'obj')
	relativeClauseNoObj.addRule({ RHS: [ relPronoun, filterNoObjPlus ] })


	var filterPlusAndThat = g.newSymbol(filter.name + '+', 'and', 'that')
	filterPlusAndThat.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.andWhoNoInsert : conjunctions.andThatNoInsert ],
			noInsertionIndexes: [ 0 ],
		}),
		filterPlus,
	] })
	filterPlusAndThat.addRule({ RHS: [
		g.newBinaryRule({
			RHS: [ filter, options.isPerson ? conjunctions.unionWhoNoInsert : conjunctions.unionThatNoInsert ],
			noInsertionIndexes: [ 0 ],
		}),
		filterPlus,
	], semantic: conjunctions.unionSemantic })

	var relativeClauseAndThat = g.newSymbol(this.nameSg, 'relative', 'clause', 'and', 'that')
	// repos that I like and that danny likes
	relativeClauseAndThat.addRule({ RHS: [ relPronoun, filterPlusAndThat ] })


	this.plural = g.newSymbol(this.nameSg, 'plural')
	this.plural.addRule({ RHS: [ noRelative ], semantic: conjunctions.intersectSemantic })

	this.plural.addRule({ RHS: [ noRelativeNoObj, relativeClauseNoObj ], semantic: conjunctions.intersectSemantic })
	// repos I like and danny likes
	// repos I like that danny likes
	// repos that I like and danny likes
	// repos that I like that danny likes
	this.plural.addRule({ RHS: [ noRelativeObj, relativeClause ], semantic: conjunctions.intersectSemantic })
	// repos that I like and that danny likes
	this.plural.addRule({ RHS: [ noRelativeNoObj, relativeClauseAndThat ], semantic: conjunctions.intersectSemantic })


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