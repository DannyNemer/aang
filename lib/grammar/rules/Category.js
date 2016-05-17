var util = require('../../util/util')
var g = require('../grammar')
var grammarUtil = require('../grammarUtil')
var NSymbol = require('../NSymbol')
var semantic = require('../semantic')
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var conjunction = require('./conjunction')
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
		throw new Error('Ill-formed Category')
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

	// repos (of `{user:'s}`/mine/[users]); people (I follow)
	this.head = g.newSymbol(this.nameSg, 'head')

	// repos (of `{user:'s}`/mine/[users]); repos (I starred)
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


	var reducedNoTense = g.newSymbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) mentioned in [pull-requests+]; (people who are) mentioned in [pull-requests+]
	this.inner = g.newSymbol(this.nameSg, 'inner')
	reducedNoTense.addRule({ rhs: [ this.inner ] })
	// (issues) with `<int>` comments assigned to me
	// Creates ambiguity when transposing [inner][inner]. Can be avoided with the following rules, however, moving `[inner]` to a second rule adds more overhead than removing the ambiguity saves:
	//   [inner+] -> [inner] | [inner+][inner] (no insertions)
	//   [reduced-no-tense] -> [inner+] | [inner+][passive+] (w/ trans)
	reducedNoTense.addRule({ rhs: [ this.inner, reducedNoTense ], noInsert: true, transpositionCost: 0.1 })
	// (people) followed by me
	// (people who are) followed by me
	// (people who have been) followed by me
	this.passive = g.newSymbol(this.nameSg, 'passive')
	reducedNoTense.addRule({ rhs: [ conjunction.create(this.passive) ] })

	this.reduced = g.newSymbol(this.nameSg, 'reduced')
	// (people) followed by me
	// (people) employed by `[companies+]`
	this.reduced.addRule({ rhs: [ reducedNoTense ] })


	// (people who) follow me
	// (people who) worked at `[companies+]`
	this.subjFilter = g.newSymbol(this.nameSg, 'subj', 'filter')

	// (people) I follow
	// (people who) I follow
	this.objFilter = g.newSymbol(this.nameSg, 'obj', 'filter')
	// (people) I follow and/or `{user}` follows
	var objFilterPlus = conjunction.create(this.objFilter, true)


	this.rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	this.rhsExt.addRule({ rhs: [ objFilterPlus ] })
	// (repos) that I created (that I like) (alternative to requiring "repos that I created AND that I like")
	this.rhsExt.addRule({ rhs: [ this.relPronoun, this.objFilter ], noInsertionIndexes: [ 0 ] })


	var rhs = g.newSymbol(this.nameSg, 'rhs')
	rhs.addRule({ isTerminal: true, rhs: g.emptySymbol })
	// (people) followed by me
	rhs.addRule({ rhs: [ this.reduced ] })
	// (people) I follow
	rhs.addRule({ rhs: [ this.rhsExt ] })
	// (people) followed by me `{user}` follows
	rhs.addRule({ rhs: [ this.reduced, this.rhsExt ], noInsert: true, transpositionCost: 0.1 })
	// (people) not followed by me
	rhs.addRule({ rhs: [ auxVerbs.negation, this.reduced ], semantic: auxVerbs.notSemantic })
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
	// my/`{user:'s}`/my-followers' repos; (people who follow) my followers
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
	filter.addRule({ rhs: [ auxVerbs.haveSentenceAdverbialBeen, reducedNoTense ], noInsertionIndexes: [ 0 ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.left, filter ] })
	// (people who) are not followers of mine
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	filter.addRule({ rhs: [ auxVerbs.haveNegationBeen, this.reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	filter.addRule({ rhs: [ auxVerbs.beNon1SgSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	filter.addRule({ rhs: [ auxVerbs.beNon1SgNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


	var relativeClause = g.newSymbol(this.nameSg, 'relative', 'clause')
	// (repos) that I like
	// (people) who are followed by me
	var filterPlus = createFilterConjunctionRuleSet(filter, options.isPerson)
	relativeClause.addRule({ rhs: [ this.relPronoun, filterPlus ] })

	this.plural = g.newSymbol(this.nameSg, 'plural')
	// people I follow
	this.plural.addRule({ rhs: [ this.noRelative ], semantic: conjunction.intersectSemantic })
	// people I follow who are followed by me
	// Stopping the insertion of `relativeClause` avoids many ambiguous parses, but prevents a much smaller quantity of unambiguous parses, and hence remains for now.
	this.plural.addRule({ rhs: [ this.noRelative, relativeClause ], semantic: conjunction.intersectSemantic })

	this.pl = g.newSymbol(this.namePl)
	// (people who created) repos...
	this.pl.addRule({ rhs: [ this.plural ] })


	if (options.entities) {
		this.sg = g.newSymbol(this.nameSg)
		// (people) `{user}` (follows); (people who follow) `{user}`
		this.sg.addRule({
			isTerminal: true,
			rhs: g.newEntityCategory({
				name: this.nameSg,
				entities: options.entities,
				isPerson: !!options.isPerson,
			}),
			isPlaceholder: true,
		})

		// (people who like) `{repo}`
		// Direct entity suggestion: `{user}`
		this.pl.addRule({ rhs: [ this.sg ] })
	}

	// (people who like) my repos and/or `{user}`'s repos
	// The `user` category does not use this symbol (and its rules) because it manually defines `[obj-users+]`, `[nom-users+]`, etc.
	this.plPlus = conjunction.create(this.pl)

	g.startSymbol.addRule({ rhs: [ this.pl ] })
}

/**
 * Creates the nonterminal rule set for `filter` conjunctions.
 *
 * The resulting rule set is identical to the rules which `conjunction.create()` creates, with additional rules for relative pronouns; e.g., "`[cat-filter]` and who/that ... `[cat-filter+]`".
 *
 * For use by the `Category()` constructor when creating the base rules for a new category.
 *
 * @private
 * @static
 * @param {NSymbol} filter The `Category` `[cat-filter]` `NSymbol`, from which to build the conjunction rule set, `[cat-filter+]`.
 * @param {boolean} [isPerson] Specify the associated category represents a person, which instructs which relative pronoun to use (i.e., "that" vs. "who").
 * @returns {NSymbol} Returns the `NSymbol` that produces the `filter` conjunction rule set.
 */
function createFilterConjunctionRuleSet(filter, isPerson) {
	// Identical rule structure to rules `conjunction.create()` defines, though defined here to incorporate relative pronouns for "[filter] and who/that ...".
	var filterPlus = g.newSymbol(filter.name + '+')
	// (people who) `[filter]`
	filterPlus.addRule({
		rhs: [ filter ],
	})

	var filterAnd = g.newBinaryRule({
		rhs: [ filter, conjunction.and ],
		noInsertionIndexes: [ 0 ],
	})
	var filterAndRelPronoun = g.newBinaryRule({
		rhs: [ filter, isPerson ? conjunction.andWho : conjunction.andThat ],
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
		rhs: [ filterPlusNoUnion, conjunction.or ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunction.intersectSemantic,
	})
	var filterPlusNoUnionOrRelPronoun = g.newBinaryRule({
		rhs: [ filterPlusNoUnion, isPerson ? conjunction.orWho : conjunction.orThat ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunction.intersectSemantic,
	})
	var filterPlusIntersect = g.newSymbol(filterPlus.name, 'intersect').addRule({
		rhs: [ filterPlus ],
		semantic: conjunction.intersectSemantic,
	})

	// (people who) `[filter]` [and `[filter]` ...] or `[filter+]`
	filterPlus.addRule({
		rhs: [ filterPlusNoUnionOr, filterPlusIntersect ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunction.unionSemantic,
	}).addRule({
		rhs: [ filterPlusNoUnionOrRelPronoun, filterPlusIntersect ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunction.unionSemantic,
	})

	return filterPlus
}

/**
 * Adds nonterminal rules to this `Category` that represent relationships characterized by an action, represented by a verb, between users and instances of this `Category`.
 *
 * Adds the following rules for `options.catVerbSemantic`:
 * 1. `[cat-passive]`    -> `[verb]` `[by-obj-users+]`           => (repos) liked by `[obj-users+]`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb]`              => (repos) `[nom-users+]` like(s)
 * 3. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb]`     => (repos) `[nom-users+]` have/has liked
 * 4. `[cat-obj-filter]` -> `[nom-users+]` `[do-not]` `[verb]`   => (repos) `[nom-users+]` do/does not like
 * 5. `[cat-obj-filter]` -> `[nom-users+]` `[have-not]` `[verb]` => (repos) `[nom-users+]` have/has not liked
 *
 * If `options.catVerbSemantic` has the property `forbidsMultiple` defined as `true`, then forbids conjunctions of the subjects in the preceding rules:
 * 1. `[cat-passive]`    -> `[verb]` `[by-obj-users]`            => (repos) liked by `[obj-users]`
 * 2. `[cat-obj-filter]` -> `[nom-users]` `[verb]`               => (repos) `[nom-users]` like(s)
 * 3. `[cat-obj-filter]` -> `[nom-users]` `[have]` `[verb]`      => (repos) `[nom-users]` have/has liked
 * 4. `[cat-obj-filter]` -> `[nom-users]` `[do-not]` `[verb]`    => (repos) `[nom-users]` do/does not like
 * 5. `[cat-obj-filter]` -> `[nom-users]` `[have-not]` `[verb]`  => (repos) `[nom-users]` have/has not liked
 *
 * Adds the following rules for `options.userVerbSemantic`:
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`             => (people who) like `[repositories+]`
 * 7. `[user-subj-filter]` -> `[have]` `[verb]` `[cats+]`    => (people who) have liked `[repositories+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) do not like `[repositories+]`
 * 9. `[user-subj-filter]` -> `[have-not] `[verb]` `[cats+]` => (people who) have not liked `[repositories+]`
 *
 * If `options.acceptPastTenseIfInput` is `true`, the following present tense rules from above are also accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. For use by verbs that represent actions that can be expressed in present or past tense without semantic differences:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` like(s)/liked
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) like/liked `[repositories+]`
 *
 * If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. Specifically, the following rules from above will be different:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` forked
 * 4. `[cat-obj-filter]`   -> `[nom-users+]` `[do-not]` `[verb]` => (repos) `[nom-users+]` did not fork
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) forked `[repositories+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`       => (people who) did not fork `[repositories+]`
 *
 * If `options.noPresentPerfect` is `true`, omits all present perfect rules from the verb rule set: #3, #5, #7, and #9. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express both the current state and past occurrences of the state, the latter of which is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example:
 * • For rule #3, "(people) `[nom-users+]` have/has followed", `users-followed()` would return a list of users which the specified users currently follow; however, the rule's present perfect positive tense suggests the list includes both of the following:
 *   1. Users which the specified users currently follow.
 *   2. Users which the specified users have previously followed but no longer follow.
 * The latter implication is unlikely the user's intent, and is also unsatisfiable because there is no data for accounts a user previously follows and no longer follows.
 * • For rule #5, "(people) `[nom-users+]` have/has not followed", `not(users-followed())` would return a list of users which the specified users do not currently follow; however, the rule's present perfect negative tense suggests the list is the following:
 *   1. Users which the specified users do not currently follow *and* have never followed.
 * The latter property is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 * • For rule #7, "(people who) have followed `[obj-users+]`", `followers()` would return a list of users that currently follow the specified users; however, the rule's present perfect positive tense suggests the list includes both of the following:
 *   1. Users that currently follow the specified users.
 *   2. Users that have previously and no longer follow the specified users.
 * The latter implication is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 * • For rule #9, "(people who) have not followed `[obj-users+]`", `not(followers())` would return a list of users that do not currently follow the specified users; however, the rule's present perfect negative tense suggests the list is the following:
 *   1. Users that do not currently follow *and* have never followed the specified users.
 * The latter property is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 *
 * If `options.noPresentPerfectNegative` is `true`, omits only the present perfect negative rules #5 and #9 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example:
 * • For rule #5, "(repos) `[nom-users]` have/has not created", `not(repositories-created())` would return a list of repositories which the specified users did not create; however, the rule's present perfect negative tense suggests the specified users can create those same repositories in the future. This implication is false because a repository's creation can not reoccur.
 * • For rule #9, "(people who) have not created `[repositories+]`", `not(repository-creators())` would return a list of users that did not create the specified repositories; however, the rule's present perfect tense suggests those same users can create the specified repositories in the future. This implication is false because a repository's creation can not reoccur.
 *
 * If `options.agentNoun` is provided, adds the following rules for `options.userVerbSemantic`:
 * 10. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => likers of `[repositories+]`
 * 11. `[user-head]` -> `[cat]` `[agent-noun]`            => `{repository}` likers
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * `options.userVerbSemantic` must have the property `isPeople` defined as `true` to enable the verb's use as an antecedent for anaphora. For example:
 *   "(people who follow) people who like `[repositories+]` (and their followers)"
 *   "(people who follow) `{repository}` likers (and their followers)"
 *
 * If `options.catDateSemantic` is provided, add the following rule for the semantic:
 * 12. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {boolean} [options.acceptPastTenseIfInput] Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {boolean} [options.noPresentPerfect] Specify omitting all present perfect rules (i.e., rules #3, #5, #7, and #9) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
 * @param {boolean} [options.noPresentPerfectNegative] Specify omitting present perfect negative rules #5 and #9 from this verb rule set, which otherwise suggest past occurrences of this action can reoccur for the same objects.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which the specified users performed this action.
 * @param {NSymbol} [options.objectSym=this.plPlus] The symbol for the object that receives this action and produces the semantic arguments for `options.userVerbSemantic`. If omitted, default to this `Category` instance's `this.plPlus` (i.e., `[cats+]`).
 * @param {Object[]} options.userVerbSemantic The semantic that returns users who performed this action on the specified instances of this `Category`.
 * @param {Object} [options.agentNoun] The agent-noun options object.
 * @param {NSymbol} [options.agentNoun.agentNounTerm] The symbol that produces the terminal rule set for the agent noun, likely created by `NSymbol.prototype.addWord()`.
 * @param {NSymbol} [options.agentNoun.prepTerm] The symbol that produces the terminal rule set for the preposition that follows `options.agentNounTerm` in rule #10 of the second section of this method description, likely created by `NSymbol.prototype.addWord()`.
 * @param {Object[]} [options.catDateSemantic] The semantic that identifies instances of this `Category` for which this action occurred within a specified date range.
 * @returns {Category} Returns this `Category` instance.
 */
var verbRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	acceptPastTenseIfInput: Boolean,
	onlyPastTense: Boolean,
	noPresentPerfect: Boolean,
	noPresentPerfectNegative: Boolean,
	catVerbSemantic: { type: Array, arrayType: Object, required: true },
	objectSym: NSymbol,
	userVerbSemantic: { type: Array, arrayType: Object, required: true },
	agentNoun: Object,
	catDateSemantic: { type: Array, arrayType: Object },
}

Category.prototype.addVerbRuleSet = function (options) {
	if (util.illFormedOpts(verbRuleSetSchema, options) || isIllFormedVerbRuleSetOptions(options)) {
		throw new Error('Ill-formed verb rule set')
	}

	/**
	 * Check `options.verbTerm` is either:
	 * 1. A verb terminal rule set created by `g.newVerb()` (all of which have inflected text for past tense).
	 * 2. A verb sequence created by `g.newTermSequence()` that contains verbs created by `g.newVerb()`.
	 * 3. A verb created by `g.newVerbSet()` or `NSymbol.prototype.addVerb()` that has inflected text for past tense.
	 */
	if (!(options.verbTerm.isTermSet && options.verbTerm.termSetType === 'verb')
		&& !(options.verbTerm.isTermSequence && options.verbTerm.isVerb)
		&& !g.isVerb(options, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

	/**
	 * When `options.catVerbSemantic` has `forbidsMultiple` defined as `true`, the parser only permits one instance of `options.catVerbSemantic` within a parent semantic's RHS semantic array (irrespective of child semantics). This restriction is necessary for database object properties for which each object can only have one value for the property.
	 * • For example, a repository database object can only have one value for `repositories-created()` because a repository can only have one creator. This means the query "repos created by me and`{user}`" would return an empty set for the intersection because no repository can have both entities as its creator.
	 *
	 * `pfsearch` -> `semantic.mergeRHS()` -> `semantic.isIllegalRHS()` detects such illegal RHS semantic arrays that contain multiple instances of a semantic defined with `forbidsMultiple`, and discards the associated parse trees.
	 *
	 * Below, grammar rules with semantics that have `forbidsMultiple` are designed to limit the possible constructions of such semantically illegal trees, which prevents `pfsearch` from having to construct (and then discard) the trees in the first place. By using `[obj-users]` and `[nom-users]` below in place of `[obj-users+]` and `[nom-users+]`, respectively, it prevents subject conjunctions with `options.verbTerm`, which prevents the illegal query example above.
	 * • Semantically illegal parse trees with such semantics can still be constructed via other rules (e.g., "repos created by me that are created by `{user}`"), however, this grammar design still reduces some of the possible illegal constructions and hence improves performance.
	 */
	var noSubjectConjunctions = options.catVerbSemantic[0].semantic.forbidsMultiple

	// Check `options.onlyPastTense` is `true` for a semantic with `forbidsMultiple`, because semantics with `forbidsMultiple` almost certainly represent past actions.
	if (noSubjectConjunctions && !options.onlyPastTense) {
		util.logErrorAndPath('The semantic', semantic.toStylizedString(options.catVerbSemantic), 'was defined with `forbidsMultiple`, but its associated verb rule set', util.stylize(options.verbTerm.name), 'lacks `onlyPastTense`. Semantics with `forbidsMultiple` represent past events.', options)
		throw new Error('Ill-formed verb rule set')
	}

	// Load `user` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')

	// (repos) liked by me/`{user}`/people-who... [and/or `[obj-users+]`]
	this.passive.addRule({
		rhs: [ options.verbTerm, noSubjectConjunctions ? user.byObjUsers : user.byObjUsersPlus ],
		// Dictates inflection of `options.verbTerm`:
		//   "(repos) `[like]` by me" -> "(repos) liked by me"
		grammaticalForm: 'past',
		semantic: options.catVerbSemantic,
	})

	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] forked
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` is not used.
			rhs: [ noSubjectConjunctions ? user.nomUsers : user.nomUsersPlus, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I `[fork]`" -> "(repos) I forked"
			grammaticalForm: 'past',
			semantic: options.catVerbSemantic,
		})
	} else if (options.acceptPastTenseIfInput) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] like(s)/liked
		this.objFilter.addRule({
			// If `options.verbTerm` is not input in past tense, the grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbTerm`:
			//   "(repos) I `[like]`" -> "(repos) I like"
			rhs: [ noSubjectConjunctions ? user.nomUsers : user.nomUsersPlus, options.verbTerm ],
			// Accept the past tense form of `options.verbTerm` if input is past tense, while still defaulting to correct present tense form according to `[nom-users+]` grammatical person-number:
			//   "(repos) I/`{user}`/people-who... liked"
			// Default to `[nom-users+]` person-number for insertions created from this rule.
			acceptedTense: 'past',
			semantic: options.catVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] like(s)
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbTerm`:
			//   "(repos) I `[like]`" -> "(repos) I like"
			rhs: [ noSubjectConjunctions ? user.nomUsers : user.nomUsersPlus, options.verbTerm ],
			semantic: options.catVerbSemantic,
		})
	}

	/**
	 * Do not assign the present perfect positive rule to verbs that represent ongoing present actions or states. For example, avoid the following rule for the state of accounts following specified users:
	 *   Stop: "(people) `[nom-users+]` have/has followed"
	 * This rule suggests the results include both of the following:
	 *   1. Users which the specified users currently follow.
	 *   2. Users which the specified users have previously followed but no longer follow.
	 * The latter implication is unlikely the user's intent, hence the rule's omission.
	 */
	if (!options.noPresentPerfect) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] have/has liked
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
			//   "(repos) `{user}` `[have]` liked" -> "(repos) `{user}` has liked"
			// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were this insertion enabled, it would enable the following additional, wasteful suggestion:
			//   Stop: "(repos) I like" -> "(repos) I have liked".
			rhs: [ noSubjectConjunctions ? user.nomUsersHaveNoInsert : user.nomUsersPlusHaveNoInsert, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I have `[like]`" -> "(repos) I have liked"
			grammaticalForm: 'past',
			semantic: options.catVerbSemantic,
		})
	}

	var notCatVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.catVerbSemantic)

	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] did not fork
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` is not used.
			rhs: [ noSubjectConjunctions ? user.nomUsersDoPastNegation : user.nomUsersPlusDoPastNegation, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I did not `[fork]`" -> "(repos) I did not fork".
			personNumber: 'pl',
			semantic: notCatVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] do/does not like
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `[do]`:
			//   "(repos) `{user}` `[do]` not like" -> "(repos) `{user}` does not like".
			rhs: [ noSubjectConjunctions ? user.nomUsersDoPresentNegation : user.nomUsersPlusDoPresentNegation, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I do not `[like]`" -> "(repos) I do not like".
			personNumber: 'pl',
			semantic: notCatVerbSemantic,
		})
	}

	/**
	 * Do not assign the present perfect negative rule if either option is `true`:
	 * • `options.noPresentPerfect` - Verbs that represent ongoing present actions or states. For example, above the following rule for the state of accounts following specified users:
	 *     Stop: "(people) `[nom-users+]` have/has not followed"
	 *   This rule suggests the results are users which the specified users do not currently follow *and* have never followed. The latter property is unlikely the user's intent.
	 * • `options.noPresentPerfectNegative` - Verbs that represent past actions that can not reoccur for the same objects. For example, avoid the following rule, which has the false implication that the associated action (repository creation) can reoccur for the objects it returns:
	 *     Stop: "(repos) `[nom-users+]` have/has not created"
	 */
	if (!options.noPresentPerfect && !options.noPresentPerfectNegative) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] have/has not liked
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
			//   "(repos) I `[have]` liked" -> "(repos) I have liked"
			// No insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion enabled, it would (wastefully) enable the following semantically duplicate suggestions:
			//   Stop:  "(repos) I not" -> "(repos) I have not", "(repos) I do not"
			rhs: [ noSubjectConjunctions ? user.nomUsersHaveNoInsertNegation : user.nomUsersPlusHaveNoInsertNegation, options.verbTerm ],
			// Dictates inflection of `options.verbTerm`:
			//   "(repos) I have not `[like]`" -> "(repos) I have not liked"
			grammaticalForm: 'past',
			semantic: notCatVerbSemantic,
		})
	}


	// Check `options.userVerbSemantic` was defined with `isPeople` to enable the verb's use as an antecedent for anaphora.
	if (!options.userVerbSemantic[0].semantic.anaphoraPersonNumber) {
		util.logError('The agent noun semantic associated with the verb', util.stylize(options.verbTerm.name), 'was defined without `isPeople`:', options.userVerbSemantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed verb semantic')
	}

	// (people who) like `[repositories+]`
	// (people who) have liked `[repositories+]`
	// (people who) do not like `[repositories+]`
	// (people who) have not liked `[repositories+]`
	user.addSubjectVerbRuleSet({
		verbTerm: options.verbTerm,
		// If `options.acceptPastTenseIfInput` is `true`, the following rule is accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions:
		//   "(people who) like/liked `[repositories+]`"
		acceptPastTenseIfInput: !!options.acceptPastTenseIfInput,
		// If `options.onlyPastTense` is `true`, the following rules will be in past tense:
		//   "(people who) forked `[repositories+]`"
		//   "(people who) did not fork `[repositories+]`"
		onlyPastTense: !!options.onlyPastTense,
		// If `options.noPresentPerfect` is true, omits the following rules:
		//   Stop: "(people who) have followed `[obj-users+]`"
		//   Stop: "(people who) have not liked `[obj-users+]`"
		noPresentPerfect: !!options.noPresentPerfect,
		// If `options.noPresentPerfectNegative` is `true`, omits the following rule:
		//   Stop: "(people who) have not created `[repositories+]`"
		noPresentPerfectNegative: !!options.noPresentPerfectNegative,
		// If `options.objectSym` is defined, likely `[obj-users+]` for `users`.
		objectSym: options.objectSym || this.plPlus,
		catVerbSemantic: options.userVerbSemantic,
	})

	if (options.agentNoun) {
		// likers of `[repositories+]`
		// `{repository}` likers
		this.addAgentNoun({
			agentNounTerm: options.agentNoun.agentNounTerm,
			prepTerm: options.agentNoun.prepTerm,
			agentNounSemantic: options.userVerbSemantic,
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
 * Adds nonterminal rules to this `Category` that represent instances of this `Category` that performed an action to `options.objectSym`.
 *
 * Adds the following rules for `options.catVerbSemantic`:
 * 1. `[cat-subj-filter]` -> `[verb]` `[cats+]`             => (people who) like `[repositories+]`
 * 2. `[cat-subj-filter]` -> `[have]` `[verb]` `[cats+]`    => (people who) have liked `[repositories+]`
 * 3. `[cat-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) do not like `[repositories+]`
 * 4. `[cat-subj-filter]` -> `[have-not] `[verb]` `[cats+]` => (people who) have not liked `[repositories+]`
 *
 * If `options.acceptPastTenseIfInput` is `true`, the following present tense rule from above is also accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. For use by verbs that represent actions that can be expressed in present or past tense without semantic differences:
 * 1. `[cat-subj-filter]` -> `[verb]` `[cats+]`             => (people who) like/liked `[repositories+]`
 *
 * If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. Specifically, the following rules from above will be different:
 * 1. `[cat-subj-filter]` -> `[verb]` `[cats+]`             => (people who) forked `[repositories+]`
 * 2. `[cat-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) did not fork `[repositories+]`
 *
 * If `options.noPresentPerfect` is `true`, it omits all present perfect rules from the verb rule set: #2, #4. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express both the current state and past occurrences of the state, the latter of which is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example:
 * • For rule #2, "(people who) have followed `[obj-users+]`", `followers()` would return a list of users that currently follow the specified users; however, the rule's present perfect positive tense suggests the list includes both of the following:
 *   1. Users that currently follow the specified users.
 *   2. Users that have previously and no longer follow the specified users.
 * The latter implication is unlikely the user's intent, and is also unsatisfiable because there is no data for accounts a user previously follows and no longer follows.
 * • For rule #4, "(people who) have not followed `[obj-users+]`", `not(followers())` would return a list of users that do not currently follow the specified users; however, the rule's present perfect negative tense suggests the list is the following:
 *   1. Users that do not currently follow *and* have never followed the specified users.
 * The latter property is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 *
 * If `options.noPresentPerfectNegative` is `true`, it omits only the present perfect negative rule #4 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example:
 * • For rule #4, "(people who) have not created `[repositories+]`", `not(repository-creators())` would return a list of users that did not create the specified repositories; however, the rule's present perfect tense suggests those same users can create the specified repositories in the future. This implication is false because a repository's creation can not reoccur.
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {boolean} [options.acceptPastTenseIfInput] Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {boolean} [options.noPresentPerfect] Specify omitting all present perfect rules (i.e., rules #2 and #4) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
 * @param {boolean} [options.noPresentPerfectNegative] Specify omitting the present perfect negative rule #4 from this verb rule set, which otherwise suggests past occurrences of this action can reoccur for the same objects.
 * @param {NSymbol} options.objectSym The symbol for the object that receives this action and produces the semantic arguments for `options.catVerbSemantic`.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` that performed this action to `options.objectSym`.
 * @returns {Category} Returns this `Category` instance.
 */
var subjectVerbRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	acceptPastTenseIfInput: Boolean,
	onlyPastTense: Boolean,
	noPresentPerfect: Boolean,
	noPresentPerfectNegative: Boolean,
	objectSym: { type: NSymbol, required: true },
	catVerbSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addSubjectVerbRuleSet = function (options) {
	if (util.illFormedOpts(subjectVerbRuleSetSchema, options) || isIllFormedVerbRuleSetOptions(options)) {
		throw new Error('Ill-formed subject verb rule set')
	}

	/**
	 * Check `options.verbTerm` is either:
	 * 1. A verb terminal rule set created by `g.newVerb()` (all of which have inflected text for past tense).
	 * 2. A verb sequence created by `g.newTermSequence()` that contains verbs created by `g.newVerb()`.
	 * 3. A verb created by `g.newVerbSet()` or `NSymbol.prototype.addVerb()` that has inflected text for past tense.
	 */
	if (!(options.verbTerm.isTermSet && options.verbTerm.termSetType === 'verb')
		&& !(options.verbTerm.isTermSequence && options.verbTerm.isVerb)
		&& !g.isVerb(options, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

	if (options.onlyPastTense) {
		// (people who) forked `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]` is not used.
			rhs: [ options.verbTerm, options.objectSym ],
			// Dictates inflection of `options.verbTerm`:
			//   "(people who) `[fork]` `[repositories+]`" -> "(people who) forked `[repositories+]`"
			grammaticalForm: 'past',
			semantic: options.catVerbSemantic,
		})
	} else if (options.acceptPastTenseIfInput) {
		// (people who) like/liked `[repositories+]`
		this.subjFilter.addRule({
			// If `options.verbTerm` is not input in past tense, the grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of `options.verbTerm`:
			//   "(people who) `[like]`" -> "(people who) like".
			rhs: [ options.verbTerm, options.objectSym ],
			// Accept the past tense form of `options.verbTerm` if input is past tense, while still defaulting to correct present tense form according to `[cat-subj-filter]` grammatical person-number:
			//   "(people who) liked `[repositories+]`"
			// Default to `[cat-subj-filter]` person-number for insertions created from this rule.
			acceptedTense: 'past',
			semantic: options.catVerbSemantic,
		})
	} else {
		// (people who) like `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of `options.verbTerm`:
			//   "(people who) `[like]`" -> "(people who) like".
			rhs: [ options.verbTerm, options.objectSym ],
			semantic: options.catVerbSemantic,
		})
	}

	// (people who have) liked `[repositories+]`
	// (people who have not) liked `[repositories+]`
	var verbPastTenseObjectSym = g.newBinaryRule({
		rhs: [ options.verbTerm, options.objectSym ],
		// Dictates inflection of `options.verbTerm`:
		//   "(people who have) `[like]`" -> "(people who have) liked"
		//   "(people who have not) `[like]`" -> "(people who have not) liked"
		grammaticalForm: 'past',
	})

	/**
	 * Do not assign the present perfect positive rule to verbs that represent ongoing present actions or states. For example, avoid the following rule for the state of accounts following specified users:
	 *   Stop: "(people who) have followed `[obj-users+]`"
	 * This rule suggests the results include both of the following:
	 *   1. Users that currently follow the specified users.
	 *   2. Users that have previously and no longer follow the specified users.
	 * The latter implication is unlikely the user's intent, hence the rule's omission.
	 */
	if (!options.noPresentPerfect) {
		// (people who) have liked `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
			//   "(people who) `[have]` liked" -> "(people who) have liked"
			rhs: [ auxVerbs.have, verbPastTenseObjectSym ],
			// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were this insertion enabled, it would enable the following additional, wasteful suggestion:
			//   Stop: "(people who) liked" ->  "(people who) have liked"
			noInsertionIndexes: [ 0 ],
			semantic: options.catVerbSemantic,
		})
	}

	var notCatVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.catVerbSemantic)

	if (options.onlyPastTense) {
		// (people who) did not fork `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of (only) `options.verbTerm`:
			//   "(people who) did not `[fork]`" -> "(people who) did not fork"
			rhs: [ [ auxVerbs.doPastNegation, options.verbTerm ], options.objectSym ],
			semantic: notCatVerbSemantic,
		})
	} else {
		// (people who) do not like `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of both `[do]` and `options.verbTerm`:
			//   "(people who) `[do]` not `[like]`" -> "(people who) do not like"
			rhs: [ [ auxVerbs.doPresentNegation, options.verbTerm ], options.objectSym ],
			semantic: notCatVerbSemantic,
		})
	}

	/**
	 * Do not assign the present perfect negative rule if either option is true:
	 * • `options.noPresentPerfect` - Verbs that represent ongoing present actions or states. For example, above the following rule for the state of accounts following specified users:
	 *     Stop: "(people who) have not followed `[obj-users+]`"
	 *   This rule suggests the results are users that do not currently follow *and* have never followed the specified users. The latter property is unlikely the user's intent.
	 * • `options.noPresentPerfectNegative` - Verbs that represent past actions that can not reoccur for the same objects. For example, avoid the following rule, which has the false implication that the associated action (repository creation) can reoccur for the objects it returns:
	 *     Stop: "(people who) have not created `[repositories+]`"
	 *   Though, for this example, it *is* possible for the same users which the query returns to meet the same specified criteria in the future (e.g., "repos `{user}` likes"), it will not be for the same objects (i.e., "`{user}`" must "like" different repositories in the future).
	 *   Moreover, this rule's past-perfect implication can be absolutely false for other queries; e.g., "people who have not created Node.js". Hence, avoid this rule to prevent the queries that are absolutely false. Also, the same query semantics remain possible via the simple-present-negative rule; e.g., "(people who) did not create `[repositories+]`".
	 */
	if (!options.noPresentPerfect && !options.noPresentPerfectNegative) {
		// (people who) have not liked `[repositories+]`
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
			//   "(people who) `[have]` not liked" -> "(people who) have not liked"
			// No insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion enabled, it would (wastefully) enable the following semantically duplicate suggestions:
			//   Stop:  "(people who) not like" -> "(people who) do not like", "(people who) have not liked"
			rhs: [ auxVerbs.haveNoInsertNegation, verbPastTenseObjectSym ],
			semantic: notCatVerbSemantic,
		})
	}

	return this
}

/**
 * Checks if `ruleSetOptions`, which was passed to `Category.prototype.addVerbRuleSet()` or `Category.prototype.addSubjectVerbRuleSet()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} ruleSetOptions The verb rule set options object to inspect.
 * @returns {boolean} Returns `true` if `ruleSetOptions` is ill-formed, else `false`.
 */
function isIllFormedVerbRuleSetOptions(ruleSetOptions) {
	if (ruleSetOptions.acceptPastTenseIfInput && ruleSetOptions.onlyPastTense) {
		util.logErrorAndPath('Both `acceptPastTenseIfInput` and `onlyPastTense` are `true`, which is contradictory because `acceptPastTenseIfInput` enables accepting both present and past tense when input (defaulting to present), while `onlyPastTense` forbids present tense.', ruleSetOptions)
		return true
	}

	if (ruleSetOptions.noPresentPerfect && ruleSetOptions.noPresentPerfectNegative) {
		util.logErrorAndPath('Both `noPresentPerfect` and `noPresentPerfectNegative` are `true`, which is redundant because `noPresentPerfect` encompasses `noPresentPerfectNegative`. `noPresentPerfect` prevents both positive and negative present perfect rules.', ruleSetOptions)
		return true
	}

	if (ruleSetOptions.noPresentPerfectNegative && !ruleSetOptions.onlyPastTense) {
		util.logErrorAndPath('`noPresentPerfectNegative` is `true` while `onlyPastTense` is falsey. `onlyPastTense` must also be `true` because `noPresentPerfectNegative` is a restriction for verbs that represent past actions.', ruleSetOptions)
		return true
	}

	return false
}

/**
 * Adds nonterminal rules to this `Category` that represent relationships characterized by an action whose time is meaningful, represented by a verb, between users and instances of this `Category`. The tense of this verb yields different semantics.
 *
 * Adds the following rules for `options.catVerbSemantic` :
 * 1. `[cat-passive]`    -> `[verb-past]` `[by-obj-users+]` => (companies) worked at by `[obj-users+]`, `ever()`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb-present]` => (companies) `[nom-users+]` work(s) at, `present()`
 *
 * Demands the verb be two separate rule sets with distinct rules (i.e., not intersection of rule sets) to prevent multiple similar suggestions, scarcely distinguished by grammatical tense (though different semantics), for the same input. For example, this prevents the following:
 *   "companies I work at"
 *   -> "companies I work at", `present(companies-worked-at(me))`
 *   -> "companies I worked at", `ever-past(companies-worked-at(me))`
 *
 * `options.verbPresentTerm` and `options.verbPastTerm` can only produce terminal rules for their respective grammatical tenses and produce no terminal rules for the opposite tense:
 * • Each is created by `terminalRuleSetMethods.newVerb(verbOptions)` with matching `verbOptions.tense`, or `terminalRuleSetMethods.newTermSequence(termSeqOptions)` with matching `termSeqOptions.verbTense`.
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbPresentTerm The symbol that produces the present tense verb terminal rule set or present tense verb term sequence that represents this action.
 * @param {NSymbol} options.verbPastTerm The symbol that produces the past tense verb terminal rule set or past tense verb term sequence that represents this action.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which the specified users performed this action.
 * @returns {Category} Returns this `Category` instance.
 */
var tenseVerbRuleSetSchema = {
	verbPresentTerm: { type: NSymbol, required: true },
	verbPastTerm: { type: NSymbol, required: true },
	catVerbSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addTenseVerbRuleSet = function (options) {
	if (util.illFormedOpts(tenseVerbRuleSetSchema, options) || isIllFormedTenseVerbRuleSetOptions(options)) {
		throw new Error('Ill-formed tense verb rule set')
	}

	// Load `user` and `userTense` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')
	var userTense = require('./user/userTense')

	// (companies) worked at by me/`{user}`/people-who... [and/or `[obj-users+]`], `ever(companies-worked-at())`
	this.passive.addRule({
		rhs: [ options.verbPastTerm, user.byObjUsersPlus ],
		semantic: g.reduceSemantic(userTense.everSemantic, options.catVerbSemantic),
	})

	// (companies) I/`{user}`/people-who... [and/or `[nom-users+]`] work(s) at, `present(companies-worked-at())`
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbPresentTerm`:
		//   "(companies) I `[work]` at" -> "(companies) I work at"
		rhs: [ user.nomUsersPlus, options.verbPresentTerm ],
		semantic: g.reduceSemantic(userTense.presentSemantic, options.catVerbSemantic),
	})

	return this
}

/**
 * Checks if `ruleSetOptions`, which was passed to `Category.prototype.addTenseVerbRuleSet()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} ruleSetOptions The `Category.prototype.addTenseVerbRuleSet()` options object to inspect.
 * @returns {boolean} Returns `true` if `ruleSetOptions` is ill-formed, else `false`.
 */
function isIllFormedTenseVerbRuleSetOptions(ruleSetOptions) {
	// Check `ruleSetOptions.verbPresentTerm` produces terminal rules for present tense verb forms and lacks past tense verb forms.
	if (!g.isVerbTerm(ruleSetOptions.verbPresentTerm, 'present')) {
		util.logError('`verbPresentTerm` is not a present tense verb set or present tense verb term sequence:', ruleSetOptions.verbPresentTerm)
		return true
	}

	// Check `ruleSetOptions.verbPastTerm` produces terminal rules for past tense verb forms and lacks present tense verb forms.
	if (!g.isVerbTerm(ruleSetOptions.verbPastTerm, 'past')) {
		util.logError('`verbPastTerm` is not a past tense verb set or past tense verb term sequence:', ruleSetOptions.verbPastTerm)
		return true
	}

	// Check `ruleSetOptions.verbPresentTerm` and `ruleSetOptions.verbPastTerm` have distinct terminal rules. This is necessary to prevent multiple similar suggestions, scarcely distinguished by tense (though different semantics), for the same input.
	// If so, `grammarUtil.haveIdenticalRules()` prints an error message.
	if (grammarUtil.haveIdenticalRules(ruleSetOptions.verbPresentTerm, ruleSetOptions.verbPastTerm)) {
		return true
	}

	return false
}

/**
 * Adds nonterminal rules to the `user` `Category` for an agent noun which represents relationships characterized by an action between users and instances of this `Category`.
 *
 * Adds the following rules for `options.agentNounSemantic`:
 * 1. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => founders of `[companies+]`
 * 2. `[user-head]` -> `[cat]` `[agent-noun]`            => `{company}` founders
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * An agent noun is a word derived from another word denoting an action, and that identifies an entity that does that action.
 *
 * `options.agentNounSemantic` must the property `isPeople` defined as `true` to enable the verb's use as an antecedent for anaphora. For example:
 *   "(people who follow) `{company}` founders (and their followers)"
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.agentNounTerm The symbol that produces the terminal rule set for the agent noun, likely created by `NSymbol.prototype.addWord()`.
 * @param {NSymbol} options.prepTerm The symbol that produces the terminal rule set for the preposition that follows `options.agentNounTerm` in rule #1 of this method description, likely created by `NSymbol.prototype.addWord()`.
 * @param {Object[]} options.agentNounSemantic The semantic that returns users who performed this action on the specified instances of this `Category`.
 * @returns {Category} Returns this `Category` instance.
 */
var agentNounSchema = {
	agentNounTerm: { type: NSymbol, required: true },
	prepTerm: { type: NSymbol, required: true },
	agentNounSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addAgentNoun = function (options) {
	if (util.illFormedOpts(agentNounSchema, options)) {
		throw new Error('Ill-formed agent noun')
	}

	// Check `options.agentNounSemantic` has the property `isPeople` defined as `true` to enable the noun's use as an antecedent for anaphora.
	if (!options.agentNounSemantic[0].semantic.anaphoraPersonNumber) {
		util.logError('The semantic associated with the agent noun', util.stylize(options.agentNounTerm.name), 'was defined without `isPeople`:', options.agentNounSemantic)
		util.logPathAndObject(options)
		throw new Error('Ill-formed agent noun semantic')
	}

	// Load `user` here instead of at file top to avoid cyclical module dependence when instantiating `user` `Category`.
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
		semantic: options.agentNounSemantic,
	})

	// Check if the `Category` has an associated entity category (e.g., `repository` does and `issue` does not).
	if (this.sg) {
		// `{company}` founders
		user.head.addRule({
			rhs: [ this.sg, options.agentNounTerm ],
			semantic: options.agentNounSemantic,
		})
	}

	return this
}

/**
 * Adds a nonterminal rule to this `Category` that represents instances of this `Category` for which the action, `options.verbTerm`, occurred within the specified date range.
 *
 * Adds the following rule for `options.catDateSemantic`:
 * 1. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`
 *                                          (repos not) created `[date]`
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
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {Object[]} options.catDateSemantic The semantic that returns instances of this `Category` for which this action occurred within the specified date range.
 * @returns {Category} Returns this `Category` instance.
 */
var dateRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	catDateSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addDateRuleSet = function (options) {
	if (util.illFormedOpts(dateRuleSetSchema, options)) {
		throw new Error('Ill-formed date verb')
	}

	/**
	 * Check `options.verbTerm` is either:
	 * 1. A verb terminal rule set created by `g.newVerb()` (all of which have inflected text for past tense).
	 * 2. A verb sequence created by `g.newTermSequence()` that contains verbs created by `g.newVerb()`.
	 * 3. A verb created by `g.newVerbSet()` or `NSymbol.prototype.addVerb()` that has inflected text for past tense.
	 */
	if (!(options.verbTerm.isTermSet && options.verbTerm.termSetType === 'verb')
		&& !(options.verbTerm.isTermSequence && options.verbTerm.isVerb)
		&& !g.isVerb(options, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

	// (companies) founded `[date]`
	// (companies not) founded `[date]`
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
 * Adds nonterminal rules to this `Category` that represent instances of this `Category` with the specified quantity of `options.itemTerm`.
 *
 * Adds the following rule for `options.catCountSemantic`:
 * 1. `[cat-rhs-ext]` -> `[with]` `[item-count]` => (issues) with `<int>` comments
 *
 * If `options.verbTerm` is provided, adds the following rules for `options.catCountSemantic`:
 * 2. `[cat-subj-filter]` -> `[verb]` `[item-count]`             => (cos that) raised `<int>` in funding
 * 3. `[cat-subj-filter]` -> `[have]` `[verb]` `[item-count]`    => (cos that) have raised `<int>` in funding
 * 4. `[cat-subj-filter]` -> `[do-not] `[verb]` `[item-count]`   => (cos that) did not raise `<int>` in funding
 * 5. `[cat-subj-filter]` -> `[have-not] `[verb]` `[item-count]` => (cos that) have not raised `<int>` in funding
 *
 * If `options.verbTerm` is not provided, adds the following rules for `options.catCountSemantic`:
 * 2. `[cat-subj-filter]` -> `[have]` `[item-count]`        => (issues that) have `<int>` comments
 * 3. `[cat-subj-filter]` -> `[do-not-have]` `[item-count]` => (issues that) do not have `<int>` comments
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.itemTerm The symbol that produces the terminal rule set for the items being quantified.
 * @param {NSymbol} [options.verbTerm] The symbol that produces the terminal rule set for the action associated with the item count, created by `g.newVerbSet()`.
 * @param {Object[]} options.catCountSemantic The semantic that returns instances of this `Category` with the specified quantity of `options.itemTerm`.
 * @returns {Category} Returns this `Category` instance.
 */
var countRuleSetSchema = {
	itemTerm: { type: NSymbol, required: true },
	verbTerm: NSymbol,
	catCountSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addCountRuleSet = function (options) {
	if (util.illFormedOpts(countRuleSetSchema, options)) {
		throw new Error('Ill-formed count rule set')
	}

	// Creates an `NSymbol` that produces a nonterminal rule set for number-based expressions.
	// If an `NSymbol` for a count set already exists for `options.itemTerm`, gets the existing `NSymbol` instead of throwing an exception for duplicity. `
	var itemCount = count.create(options.itemTerm)

	// (issues) with `<int>` comments
	// (issues opened by me) with `<int>` comments
	// (my issues) with `<int>` comments
	this.rhsExt.addRule({
		rhs: [ preps.possessed, itemCount ],
		semantic: options.catCountSemantic,
	})

	if (options.verbTerm) {
		// (companies that) raised `<int>` in funding
		// (companies that) have raised `<int>` in funding
		// (companies that) did not raise `<int>` in funding
		// (companies that) have not raised `<int>` in funding
		this.addSubjectVerbRuleSet({
			verbTerm: options.verbTerm,
			onlyPastTense: true,
			objectSym: itemCount,
			catVerbSemantic: options.catCountSemantic,
		})
	} else {
		// (issues that) have `<int>` comments
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of `[have]`:
			//   "(issues that) `[have]` `<int>` comments" -> "(issues that) have `<int>` comments"
			rhs: [ auxVerbs.have, itemCount ],
			semantic: options.catCountSemantic,
		})

		// (issues that) do not have `<int>` comments
		this.subjFilter.addRule({
			// The grammatical person-number in the parent rule that produces `[cat-subj-filter]`, defined as `pl`, dictates the inflection of both `[do]` and `[have]`:
			//   "(issues that) `[do]` not `[have]` `<int>` comments" -> "(issues that) do not have `<int>` comments"
			rhs: [ auxVerbs.doPresentNegationHave, itemCount ],
			semantic: g.reduceSemantic(auxVerbs.notSemantic, options.catCountSemantic),
		})
	}

	return this
}

/**
 * Adds a nonterminal rule to this `Category` that represents instances of this `Category` with the specified measurement of `options.unitTerm`.
 *
 * Adds the following rule for `options.catMeasurementSemantic`:
 * 1. `[cat-post-modifier]` -> `[item-count]` => (repos that are) `<int>` KB
 *                                               (repos that are not) `<int>` KB
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.unitTerm The symbol that produces the terminal rule set for the measurement unit.
 * @param {Object[]} options.catCountSemantic The semantic that returns instances of this `Category` with the specified measurement of `options.unitTerm`.
 * @returns {Category} Returns this `Category` instance.
 */
var measurementRuleSetSchema = {
	unitTerm: { type: NSymbol, required: true },
	catMeasurementSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addMeasurementRuleSet = function (options) {
	if (util.illFormedOpts(measurementRuleSetSchema, options)) {
		throw new Error('Ill-formed measurement rule set')
	}

	// (repos that are) `<int>` KB
	// (repos that are not) `<int>` KB
	this.postModifer.addRule({
		rhs: [ count.create(options.unitTerm) ],
		semantic: options.catMeasurementSemantic,
	})

	return this
}

// Export `Category`.
module.exports = Category