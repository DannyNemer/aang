var util = require('../../util/util')
var g = require('../grammar')
var NSymbol = g.newSymbol
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var conjunctions = require('./conjunctions')
var date = require('./date')
var count = require('./count')
var preps = require('./prepositions')


/**
 * The `Category` constructor, which adds several base symbols and rules for a new database object category to the grammar.
 *
 * @constructor
 * @param {Object} options The options object.
 */
var categorySchema = {
	// The singular form of this category's name.
	sg: { type: String, required: true },
	// The plural form of this category's name.
	pl: { type: String, required: true },
	// Specify this category is person. This is used for relative pronouns (i.e., "that" vs. "who").
	isPerson: Boolean,
	// The optional entities for this category to also make it an entity category, defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "JavaScript", "JS").
	entities: { type: Array, arrayType: [ String, Object ] },
}

function Category(options) {
	// Check if constructor invoked without `new` keyword.
	if (!(this instanceof Category)) {
		return new Category(options)
	}

	if (util.illFormedOpts(categorySchema, options)) {
		throw new Error('Ill-formed symbol category')
	}

	this.nameSg = options.sg
	this.namePl = options.pl

	// (repos) that I like; (people) who (are followed by me)
	this.relPronoun = options.isPerson ? relPronouns.who : relPronouns.that

	this.lhs = g.newSymbol(this.nameSg, 'lhs')
	this.lhs.addRule({ isTerminal: true, rhs: g.emptySymbol })
	// (my) public/private (repos); (my) public/private ({language} repos)
	this.adjective = g.newSymbol(this.nameSg, 'adjective')
	this.lhs.addRule({ rhs: [ this.adjective, this.lhs ] })
	// {language} (repos); (repos that are) {language} (repos)
	this.preModifier = g.newSymbol(this.nameSg, 'pre', 'modifier')
	// Ensure `[cat-pre-modifier]` is rightmost of every `[cat-lhs]` subtree because `[cat-adjective]` must precede.
	// - Ex: (my public) Java (repos); Not: (my) Java (public repos)
	this.lhs.addRule({ rhs: [ this.lhs, this.preModifier ], transpositionCost: 0.1 })
	// <stop> (repos); <stop> {language} (repos)
	this.lhs.addRule({ rhs: [ stopWords.left, this.lhs ] })
	// [user:'s] public/private repos -> [user:'s] repos
	this.stopWord = g.newSymbol(this.nameSg, 'stop', 'word')
	this.lhs.addRule({ rhs: [ this.stopWord, this.lhs ] })

	// (my) repos; users (I follow)
	this.term = g.newSymbol(this.namePl, 'term')

	// repos (of {user:'s}/mine/[users]); people (I follow)
	this.head = g.newSymbol(this.nameSg, 'head')

	// repos (of {user:'s}/mine/[users]); repos (I starred)
	// The `user` category does not use this symbol (and its rules) because the category uses a "followers" subcategory for possessives.
	this.headMayPoss = g.newSymbol(this.head.name, 'may', 'poss')
	this.head.addRule({ rhs: [ this.headMayPoss ] })

	// (my) repos; (my) JavaScript repos
	// The `user` category does not use this symbol (and its rules) because the category uses a "followers" subcategory for possessives.
	// For now, leave insertion restriction (which would otherwise enable "my" -> "my repos") because it halves performance (i.e., doubles total parse time) (excluding no-legal-trees, which remain disproportionately slow until fixed).
	this.possessable = g.newSymbol(this.nameSg, 'possessable')
	this.possessable.addRule({ rhs: [ this.lhs, this.headMayPoss ], noInsert: true, transpositionCost: 1 })

	// people (I follow); female people (followed by me); JavaScript repos (I like)
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
	// Creates ambiguity when transposing [inner][inner]. Can be avoided with the following rules, however, moving `[inner]` to a second rule adds more overhead than removing the ambiguity saves:
	//   [inner+] -> [inner] | [inner+][inner] (no insertions)
	//   [reduced-no-tense] -> [inner+] | [inner+][passive+] (w/ trans)
	reducedNoTense.addRule({ rhs: [ this.inner, reducedNoTense ], noInsert: true, transpositionCost: 0.1 })
	// (people) followed by me
	// (people who are) followed by me
	// (people who have been) followed by me
	reducedNoTense.addRule({ rhs: [ passivePlus ] })

	var reduced = g.newSymbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ rhs: [ reducedNoTense ] })


	// (people who) follow me
	this.subjFilter = g.newSymbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	// (people who) I follow
	this.objFilter = g.newSymbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or {user} follows
	var objFilterPlus = conjunctions.create(this.objFilter, true)


	this.rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	this.rhsExt.addRule({ rhs: [ objFilterPlus ] })
	// (repos) that I created (that I like) (alternative to requiring "repos that I created AND that I like")
	this.rhsExt.addRule({ rhs: [ this.relPronoun, this.objFilter ], noInsertionIndexes: [ 0 ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, rhs: g.emptySymbol })
	// (people) followed by me
	rhs.addRule({ rhs: [ reduced ] })
	// (people) I follow
	rhs.addRule({ rhs: [ this.rhsExt ] })
	// (people) followed by me {user} follows
	rhs.addRule({ rhs: [ reduced, this.rhsExt ], noInsert: true, transpositionCost: 0.1 })
	// (people) not followed by me
	rhs.addRule({ rhs: [ auxVerbs.negation, reduced ], semantic: auxVerbs.notSemantic })
	// (people) I follow <adverbial-stop-word>
	rhs.addRule({ rhs: [ rhs, stopWords.sentenceAdverbial ], transpositionCost: 0 })


	var baseNoRelative = g.newSymbol(this.nameSg, 'base', 'no', 'relative')
	/**
	 * E.g., "people I follow"; "female people followed by me".
	 *
	 * Temporarily prevent `[cat-lhs-cat-head]` insertion to avoid recursive sequences of unary rules, which the symbol's insertion would otherwise enable:
	 *   [user-plural] -> ... -> [user-base-no-relative] -> (insert "people") [user-rhs] -> ... [user-plural]
	 *
	 * This only occurs for the `user` category rules because of the following production sequence:
	 *   [obj-users] -> ... -> [user-plural]
	 * Though, as all categories use `[obj-users]`, this recursive sequence damages parse performance of queries for all categories.
	 *
	 * The generator forbids such rules because they enable recursive parse nodes, which the parse-forest search heuristic calculator does not yet support. See "Recursive Node Restriction" in `calcHeuristicCosts` for a detailed explanation.
	 *
	 * In addition, even if this insertion only exists for all categories expect `user` (avoiding recursive parse nodes), the insertion still halves performance (i.e., doubles total parse time). (This measurement excludes queries re-parsed for failing to produce legal trees (due to contradictory semantics), because their parse time is disproportionately large and will be (separately) corrected by avoiding no-legal-trees altogether.)
	 */
	baseNoRelative.addRule({
		rhs: [ lhsHead, rhs ],
		noInsertionIndexes: [ 0 ],
		transpositionCost: 1,
	})

	this.noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me
	// people I follow
	// (people who are) people followed by me
	// (people who are not) people followed by me
	this.noRelative.addRule({ rhs: [ baseNoRelative ] })
	// my/{user:'s}/my-followers' repos; (people who follow) my followers
	this.noRelativePossessive = g.newSymbol(this.noRelative.name, 'possessive')
	this.noRelative.addRule({ rhs: [ this.noRelativePossessive, rhs ], noInsert: true, transpositionCost: 1 })
	// (people) <stop> I follow
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


	// Identical rule structure to rules `conjunctions.create()` defines, though defined here to incorporate relative pronouns for "[filter] and who/that ...".
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
	relativeClause.addRule({ rhs: [ this.relPronoun, filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people I follow
	this.plural.addRule({ rhs: [ this.noRelative ], semantic: conjunctions.intersectSemantic })
	// people I follow who are followed by me
	// Stopping the insertion of `relativeClause` avoids many ambiguous parses, but prevents a much smaller quantity of unambiguous parses, and hence remains for now.
	this.plural.addRule({ rhs: [ this.noRelative, relativeClause ], semantic: conjunctions.intersectSemantic })

	this.pl = g.newSymbol(this.namePl)
	// (people who created) repos...
	this.pl.addRule({ rhs: [ this.plural ] })


	if (options.entities) {
		this.sg = g.newSymbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		this.sg.addRule({
			isTerminal: true,
			rhs: g.newEntityCategory({
				name: this.nameSg,
				entities: options.entities,
				isPerson: !!options.isPerson,
			}),
			isPlaceholder: true,
		})

		// (people who like) {repo}
		// Direct entity suggestion: {user}
		this.pl.addRule({ rhs: [ this.sg ] })
	}

	// (people who like) my repos and/or {user}'s repos
	// The `user` category does not use this symbol (and its rules) because it manually defines `[obj-users+]`, `[nom-users+]`, etc.
	this.plPlus = conjunctions.create(this.pl)

	// Requires `maxParams` be 1 for `date` semantic arguments.
	// repositories(date-before()); users(followers-count())
	this.semantic = g.newSemantic({
		name: this.namePl,
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (repos liked by) people with 2 followers and their followers
		isPeople: !!options.isPerson,
	})

	g.startSymbol.addRule({ rhs: [ this.pl ] })
}

/**
 * Adds nonterminal rules to this `Category` that represents relationships characterized by an action, represented by a verb, between users and instances of this `Category`.
 *
 * Adds the following rules for `options.catVerbSemantic`
 * 1. `[cat-passive]`    -> `[verb]` `[by-obj-users+]`           => (repos) liked by `[obj-users+]`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb]`              => (repos) `[nom-users+]` like(s)/liked
 * 3. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb]`     => (repos) `[nom-users+]` have/has liked
 * 4. `[cat-obj-filter]` -> `[nom-users+]` `[do-not]` `[verb]`   => (repos) `[nom-users+]` do not like
 * 5. `[cat-obj-filter]` -> `[nom-users+]` `[have-not]` `[verb]` => (repos) `[nom-users+]` have/has not liked
 *
 * Adds the following rules for `options.userVerbSemantic`:
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                => (people who) like(d) `[repos+]`
 * 7. `[user-subj-filter]` -> `[have]` `[verb]` `[cats+]`       => (people who) have liked `[repos+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`      => (people who) do not like `[repos+]`
 * 9. `[user-subj-filter]` -> `[have-not] `[verb]` `[cats+]`    => (people who) have not liked `[repos+]`
 *
 * If `options.onlyPastTense` is `true`, then all nonterminal rules in this set will be in past tense. Specifically, the following rules from above will be different:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` forked
 * 4. `[cat-obj-filter]`   -> `[nom-users+]` `[do-not]` `[verb]` => (repos) `[nom-users+]` did not fork
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) forked `[repos+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`       => (people who) did not fork `[repos+]`
 *
 * If `options.agentNoun` is provided, adds the following rules for `options.userVerbSemantic`:
 * 10. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => likers of `[repos+]`
 * 11. `[user-head]` -> `[cat]` `[agent-noun]`            => `{repository}` likers
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * `options.userVerbSemantic` must have been created with `isPeople` defined as `true` to enable the verbs use as an antecedent in anaphora. For example:
 *   "(people who follow) people who like `[repos+]` (and their followers)"
 *   "(people who follow) `{repository}` likers (and their followers)"
 *
 * If `options.catDateSemantic` is provided, add the following rule for the semantic:
 * 12. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb, created by `NSymbol.prototype.addVerb()`.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which the specified users performed this action.
 * @param {Object[]} options.userVerbSemantic The semantic that returns users who performed this action on the specified instances of this `Category`.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {Object} [options.agentNoun] The agent-noun options object.
 * @param {NSymbol} [options.agentNoun.agentNounTerm] The symbol that produces the terminal rule set for the agent noun, likely created by `NSymbol.prototype.addWord()`.
 * @param {NSymbol} [options.agentNoun.prepTerm] The symbol that produces the terminal rule set for the preposition that follows `options.agentNounTerm` in rule #10 of the second section of this method description, likely created by `NSymbol.prototype.addWord()`.
 * @param {Object[]} [options.catDateSemantic] The semantic that identifies instances of this `Category` for which this action occurred within a specified date range.
 */
var verbRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	catVerbSemantic: { type: Array, arrayType: Object, required: true },
	userVerbSemantic: { type: Array, arrayType: Object, required: true },
	onlyPastTense: Boolean,
	agentNoun: Object,
	catDateSemantic: { type: Array, arrayType: Object },
}

Category.prototype.addVerbRuleSet = function (options) {
	if (util.illFormedOpts(verbRuleSetSchema, options)) {
		throw new Error('Ill-formed verb rule set')
	}

	// Check `options.verbTerm` is a verb created by `NSymbol.prototype.addVerb()` and has inflected text for past tense.
	if (isNotVerb(options, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

	// Load `user` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')

	// (repos) liked by me/`{user}`/people-who... [and/or `[obj-users+]`]
	this.passive.addRule({
		rhs: [ options.verbTerm, user.byObjUsersPlus ],
		// Dictates inflection of `options.verbTerm`:
		//   "(repos) `[like]` by me" -> "(repos) liked by me"
		grammaticalForm: 'past',
		semantic: options.catVerbSemantic,
	})

	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] forked
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` is not used.
			rhs: [ user.nomUsersPlus, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I `[fork]`" -> "(repos) I forked"
			grammaticalForm: 'past',
			semantic: options.catVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] like(s)/liked
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbTerm`:
			//   "(repos) I `[like]`" -> "(repos) I like"
			rhs: [ user.nomUsersPlus, options.verbTerm ],
			// Accept past tense form of `options.verbTerm` if input, otherwise conjugate according to `[nom-users+]` grammatical person-number:
			//   "(repos) I/`{user}`/people-who... liked"
			// Also, default to `[nom-users+]` person-number for insertions created from this rule.
			acceptedTense: 'past',
			semantic: options.catVerbSemantic,
		})
	}

	// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] have/has liked
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
		//   "(repos) `{user}` `[have]` liked" -> "(repos) `{user}` has liked"
		// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were this insertion enabled, it would enable the following additional, wasteful suggestion:
		//   Stop: "(repos) I like" -> "(repos) I have liked".
		rhs: [ user.nomUsersPlusHaveNoInsert, options.verbTerm ],
		// Dictates inflection of `options.verbTerm`:
		//   "(repos) I have `[like]`" -> "(repos) I have liked"
		grammaticalForm: 'past',
		semantic: options.catVerbSemantic,
	})

	var notCatVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.catVerbSemantic)

	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] did not fork
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` is not used.
			rhs: [ user.nomUsersPlusDoPastNegation, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I did not `[fork]`" -> "(repos) I did not fork".
			personNumber: 'pl',
			semantic: notCatVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] do not like
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `[do]`:
			//   "(repos) `{user}` `[do]` not like" -> "(repos) `{user}` does not like".
			rhs: [ user.nomUsersPlusDoPresentNegation, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I do not `[like]`" -> "(repos) I do not like".
			personNumber: 'pl',
			semantic: notCatVerbSemantic,
		})
	}

	// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] have/has not liked
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
		//   "(repos) I `[have]` liked" -> "(repos) I have liked"
		// No insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion enabled, it would (wastefully) enable the following semantically duplicate suggestions:
		//   Stop:  "(repos) I not" -> "(repos) I have not", "(repos) I do not"
		rhs: [ user.nomUsersPlusHaveNoInsertNegation, options.verbTerm ],
		// Dictates inflection of `options.verbTerm`:
		//   "(repos) I have not `[like]`" -> "(repos) I have not liked"
		grammaticalForm: 'past',
		semantic: notCatVerbSemantic,
	})


	// Check `options.userVerbSemantic` was defined with `isPeople` to enable the verb's use as an antecedent in anaphora.
	if (!options.userVerbSemantic[0].semantic.anaphoraPersonNumber) {
		util.logError('The agent noun semantic associated with the verb', util.stylize(options.verbTerm.name), 'was defined without `isPeople`:', options.userVerbSemantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed verb semantic')
	}

	if (options.onlyPastTense) {
		// (people who) forked `[repositories+]`
		user.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[user-subj-filter]` is not used.
			rhs: [ options.verbTerm, this.plPlus ],
			// Dictates inflection of `options.verbTerm`:
			//   "(people who) `[fork]` `[repositories+]`" -> "(people who) forked `[repositories+]`"
			grammaticalForm: 'past',
			semantic: options.userVerbSemantic,
		})
	} else {
		// (people who) like(d) `[repositories+]`
		user.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of `options.verbTerm`:
			//   "(people who) `[like]`" -> "(people who) like".
			rhs: [ options.verbTerm, this.plPlus ],
			// Accept past tense form of `options.verbTerm` if input, otherwise conjugate according to `[user-subj-filter]` grammatical person-number:
			//   "(people who) liked `[repositories+]`"
			// Also, default to `[user-subj-filter]` person-number for insertions created from this rule.
			acceptedTense: 'past',
			semantic: options.userVerbSemantic,
		})
	}

	// (people who have) liked `[repositories+]`
	// (people who have not) liked `[repositories+]`
	var verbPastTenseCatPlPlus = g.newBinaryRule({
		rhs: [ options.verbTerm, this.plPlus ],
		// Dictates inflection of `options.verbTerm`:
		//   "(people who have) `[like]`" -> "(people who have) liked"
		//   "(people who have not) `[like]`" -> "(people who have not) liked"
		grammaticalForm: 'past',
	})

	// (people who) have liked `[repositories+]`
	user.subjFilter.addRule({
		// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
		//   "(people who) `[have]` liked" -> "(people who) have liked"
		rhs: [ auxVerbs.have, verbPastTenseCatPlPlus ],
		// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were this insertion enabled, it would enable the following additional, wasteful suggestion:
		//   Stop: "(people who) liked" ->  "(people who) have liked"
		noInsertionIndexes: [ 0 ],
		semantic: options.userVerbSemantic,
	})

	var notUserVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.userVerbSemantic)

	if (options.onlyPastTense) {
		// (people who) did not fork `[repositories+]`
		user.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of (only) `options.verbTerm`:
			//   "(people who) did not `[fork]`" -> "(people who) did not fork"
			rhs: [ [ auxVerbs.doPastNegation, options.verbTerm ], this.plPlus ],
			semantic: notUserVerbSemantic,
		})
	} else {
		// (people who) do not like `[repositories+]`
		user.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of both `[do]` and `options.verbTerm`:
			//   "(people who) `[do]` not `[like]`" -> "(people who) do not like"
			rhs: [ [ auxVerbs.doPresentNegation, options.verbTerm ], this.plPlus ],
			semantic: notUserVerbSemantic,
		})
	}

	// (people who) have not liked `[repositories+]`
	user.subjFilter.addRule({
		// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
		//   "(people who) `[have]` not liked" -> "(people who) have not liked"
		// No insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion enabled, it would (wastefully) enable the following semantically duplicate suggestions:
		//   Stop:  "(people who) not like" -> "(people who) do not like", "(people who) have not liked"
		rhs: [ auxVerbs.haveNoInsertNegation, verbPastTenseCatPlPlus ],
		semantic: notUserVerbSemantic,
	})

	if (options.agentNoun) {
		// likers of `[repositories+]`
		// `{repository}` likers
		this.addAgentNoun({
			agentNounTerm: options.agentNoun.agentNounTerm,
			prepTerm: options.agentNoun.prepTerm,
			userVerbSemantic: options.userVerbSemantic,
		})
	}

	if (options.catDateSemantic) {
		// (companies) founded `[date]`
		this.addDateRuleSet({
			verbTerm: options.verbTerm,
			catDateSemantic: options.catDateSemantic,
		})
	}

	return this
}

/**
 * Adds nonterminal rules to the `user` `Category` for an agent noun which represents relationships characterized by an action between users and instances of this `Category`.
 *
 * Adds the following rules for `options.userVerbSemantic`:
 * 1. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => founders of `[companies+]`
 * 2. `[user-head]` -> `[cat]` `[agent-noun]`            => `{company}` founders
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * An agent noun is a word derived from another word denoting an action, and that identifies an entity that does that action.
 *
 * `options.userVerbSemantic` must have been created with `isPeople` defined as `true` to enable the verbs use as an antecedent in anaphora. For example:
 *   "(people who follow) `{company}` founders (and their followers)"
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.agentNounTerm The symbol that produces the terminal rule set for the agent noun, likely created by `NSymbol.prototype.addWord()`.
 * @param {NSymbol} options.prepTerm The symbol that produces the terminal rule set for the preposition that follows `options.agentNounTerm` in rule #1 of this method description, likely created by `NSymbol.prototype.addWord()`.
 * @param {Object[]} options.userVerbSemantic The semantic that returns users who performed this action on the specified instances of this `Category`.
 */
var agentNounSchema = {
	agentNounTerm: { type: NSymbol, required: true },
	prepTerm: { type: NSymbol, required: true },
	userVerbSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addAgentNoun = function (options) {
	if (util.illFormedOpts(agentNounSchema, options)) {
		throw new Error('Ill-formed agent noun')
	}

	// Check `options.userVerbSemantic` was defined with `isPeople` to enable the noun's use as an antecedent in anaphora.
	if (!options.userVerbSemantic[0].semantic.anaphoraPersonNumber) {
		util.logError('The semantic associated with the agent noun', util.stylize(options.agentNounTerm.name), 'was defined without `isPeople`:', options.userVerbSemantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed agent noun semantic')
	}

	// Load `user` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')

	// founders of `[companies+]`
	user.head.addRule({
		rhs: [ options.agentNounTerm, [ options.prepTerm, this.plPlus ] ],
		// Prevent head noun insertion, which other disproportionally hurts performance for its benefit.
		noInsertionIndexes: [ 0 ],
		// Enable transposition:
		//   "companies with `<int>` employees founders" -> "founders of companies with `<int>` employees"
		// NOTE: This edit might be removed because it hurts performance by significantly increasing the size of the state table.
		transpositionCost: 1,
		semantic: options.userVerbSemantic,
	})

	// Check if the `Category` has an associated entity category (e.g., `repository` does and `issue` does not).
	if (this.sg) {
		// `{company}` founders
		user.head.addRule({
			rhs: [ this.sg, options.agentNounTerm ],
			semantic: options.userVerbSemantic,
		})
	}

	return this
}

/**
 * Adds a nonterminal rule to this `Category` that represents instances of this `Category` for which the action, `options.verbTerm`, occurred within the specified date range.
 *
 * Adds the following rule for `options.catDateSemantic`:
 * 1. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`
 *
 * `[date]` produces the following rules:
 * 1. this/last week/month/year, today, yesterday      => `date(this-year)`
 * 2. in `[year]`                                      => `date(<int:1950-2050>)`
 * 3. in `[month]` `[year]`/`[year-phrase]`            => `date(jan,<int:1950-2050>)`
 * 4. on `[month]` `[day]` `[year]`/`[year-phrase]`    => `date(jan,<int:1-31>,<int:1950-2050>)`
 * 5. before  `[date-value]`                           => `date-before(a,b,c)`
 * 6. after   `[date-value]`                           => `date-after(a,b,c)`
 * 7. before  `[date-value]` and after  `[date-value]` => `date-after(a,b,c),date-before(a,b,c)`
 * 7. after   `[date-value]` and before `[date-value]` => `date-after(a,b,c),date-before(a,b,c)`
 * 8. from    `[date-value]` to         `[date-value]` => `date-interval(date(a,b,c),date(a,b,c))`
 * 9. between `[date-value]` and        `[date-value]` => `date-interval(date(a,b,c),date(a,b,c))`
 *
 * `[date-value]` produces the following rules:
 * 1. this/last week/month/year, today, yesterday => `this-year`
 * 2. `[year]`                                    => `<int:1950-2050>`
 * 3. `[month]` `[year]`/`[year-phrase]`          => `jan,<int:1950-2050>`
 * 4. `[month]` `[day]` `[year]`/`[year-phrase]`  => `jan,<int:1-31>,<int:1950-2050>`
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb, created by `NSymbol.prototype.addVerb()`.
 * @param {Object[]} options.catDateSemantic The semantic that returns instances of this `Category` for which this action occurred within the specified date range.
 */
var dateRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	catDateSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addDateRuleSet = function (options) {
	if (util.illFormedOpts(dateRuleSetSchema, options)) {
		throw new Error('Ill-formed date verb')
	}

	// Check `options.verbTerm` is a verb created by `NSymbol.prototype.addVerb()` and has inflected text for past tense.
	if (isNotVerb(options, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

	// (companies) founded `[date]`
	this.inner.addRule({
		rhs: [ options.verbTerm, date ],
		// Dictates inflection of `options.verbTerm`:
		//   "(companies) `[found]` in `[year]`" -> "(companies) founded in `[year]`"
		grammaticalForm: 'past',
		semantic: options.catDateSemantic,
	})

	return this
}

/**
 * Adds nonterminal rules to this `Category` that represents of this `Category` with the specified quantity of `itermTerm`.
 *
 * Adds the following rule for `options.catCountSemantic`:
 * 1. `[cat-rhs-ext]`     -> `[with]` `[item-count]`        => (issues) with `<int>` comments
 * 2. `[cat-subj-filter]` -> `[have]` `[item-count]`        => (issues that) have `<int>` comments
 * 3. `[cat-subj-filter]` -> `[do-not-have]` `[item-count]` => (issues that) do not have `<int>` comments
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.itemTerm The symbol that produces the terminal rule set for the items being quantified.
 * @param {Object[]} options.catCountSemantic The semantic that returns instances of this `Category` with the specified quantity of `itermTerm`.
 */
var countRuleSetSchema = {
	itemTerm: { type: NSymbol, required: true },
	catCountSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addCountRuleSet = function (options) {
	if (util.illFormedOpts(countRuleSetSchema, options)) {
		throw new Error('Ill-formed count rule set')
	}

	var itemCount = count.create(options.itemTerm)

	// (issues) with `<int>` comments
	// (issues opened by me) with `<int>` comments
	// (my issues) with `<int>` comments
	this.rhsExt.addRule({
		rhs: [ preps.possessed, itemCount ],
		semantic: options.catCountSemantic,
	})

	// (issues that) have `<int>` comments
	this.subjFilter.addRule({
		// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
		//   "(issues that) `[have]` `<int>` comments" -> "(issues that) have `<int>` comments"
		rhs: [ auxVerbs.have, itemCount ],
		semantic: options.catCountSemantic,
	})

	// (issues that) do not have `<int>` comments
	this.subjFilter.addRule({
		// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of both `[do]` and `[have]`:
		//   "(issues that) `[do]` not `[have]` `<int>` comments" -> "(issues that) do not have `<int>` comments"
		rhs: [ auxVerbs.doPresentNegationHave, itemCount ],
		semantic: g.reduceSemantic(auxVerbs.notSemantic, options.catCountSemantic),
	})
}

/**
 * Checks `options[paramName]` is a verb created by `NSymbol.prototype.addVerb()` and has inflected text for past tense. If not, prints an error message.
 *
 * @private
 * @static
 * @param {Object} options The options object with the property to inspect.
 * @param {string} paramName The `options` property to inspect.
 * @returns {boolean} Returns `true` if `options[paramName]` is a verb with past tense, else `false`.
 */
function isNotVerb(options, paramName) {
	var verbTerm = options[paramName]
	var textForms = verbTerm.rules[0].text

	// Check `options[paramName]` is a verb created by `NSymbol.prototype.addVerb()`.
	if (textForms.constructor !== Object || !textForms.oneSg || !textForms.threeSg || !textForms.pl) {
		printTerminalRuleSetErr(options, paramName, 'is not a verb created by `NSymbol.prototype.addVerb()`')
		return true
	}

	// Check `options[paramName]` has inflected text for past tense, even though optional for `NSymbol.prototype.addVerb()` (e.g., `[be]`).
	if (!textForms.past) {
		printTerminalRuleSetErr(options, paramName, 'lacks past tense inflection')
		return true
	}

	return false
}

/**
 * Prints an error for `options[paramName]`, and `NSymbol` that produces an incorrect terminal rule set.
 *
 * Formats the error as follows:
 *   Error: '${paramName}' ${description}: ${options[paramName].name} -> options[paramName].rules[0].text
 *     ${options}
 *
 * For use by `isNotVerb()`.
 *
 * @private
 * @static
 * @param {Object} options The options object with the property for which to print an error.
 * @param {string} paramName The `options` property for the `NSymbol` that produces the incorrect terminal rule set.
 * @param {string} description The error description.
 */
function printTerminalRuleSetErr(options, paramName, description) {
	var errMsg = '\'' + paramName + '\' ' + description + ':'
	var termRuleSetSym = options[paramName]
	util.logError(errMsg, util.stylize(termRuleSetSym.name), '->', util.stylize(termRuleSetSym.rules[0].text))
	util.logPathAndObject(options)
}

// Export `Category`.
module.exports = Category