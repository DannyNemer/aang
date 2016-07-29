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
 * @param {string} options.sg The singular form of this category's name.
 * @param {string} options.pl The plural form of this category's name.
 * @param {boolean} [options.isPerson] Specify this category is person. This is used for relative pronouns (i.e., "that" vs. "who").
 * @param {NSymbol} options.headTerm The term sequence of type 'invariable' for the category head, created by `g.newTermSequence()` with `type` 'invariable'.
 * @param {Object[]} [options.possSemantic] The semantic that returns instances of this `Category` that the specified users own/possess.
 * @param {(Object|string)[]} [options.entities] The entities for this category with which to create an associated entity category. Defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "JavaScript", "JS").
 */
var categorySchema = {
	sg: { type: String, required: true },
	pl: { type: String, required: true },
	isPerson: Boolean,
	headTerm: { type: NSymbol, required: true },
	possSemantic: { type: Array, arrayType: Object },
	entities: { type: Array, arrayType: [ String, Object ] },
}

function Category(options) {
	// Check if constructor invoked without `new` keyword.
	if (!(this instanceof Category)) {
		return new Category(options)
	}

	if (util.illFormedOpts(categorySchema, options) || isIllFormedCategoryOptions(options)) {
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
	this.term = options.headTerm

	// repos (of `{user:'s}`/mine/[users]); people (I follow)
	this.head = g.newSymbol(this.nameSg, 'head')

	// my/`{user:'s}`/my-followers' repos
	this.noRelativePossessive = g.newSymbol(this.nameSg, 'no', 'relative', 'possessive')

	// my/`{user:'s}`/my-followers' repos
	// my/`{user:'s}`/my-followers' {language}` repos
	// (repos) of `[poss-users]` [or `[poss-users+-disjunction]`]
	if (options.possSemantic) {
		this._addPossessiveRules(options.possSemantic)
	}

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


	/**
	 * A reduced relative clause is a relative clause that is not marked by an explicit relative pronoun or complementizer such as "who", "which", or "that".
	 *
	 * For example, the clause "I saw" in the English sentence, "This is the man I saw".
	 * • Unreduced forms of this relative clause would be, "This is the man that I saw, or ...who I saw, ...whom I saw".
	 */
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


	this.rhsExt = g.newSymbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow; (people) I follow and/or `{user}` follows
	this.rhsExt.addRule({ rhs: [ conjunction.create(this.objFilter, true) ] })
	// (repos) that I created (that I like) (alternative to requiring "repos that I created AND that I like")
	this.rhsExt.addRule({
		rhs: [
			{ symbol: this.relPronoun, noInsert: true },
			this.objFilter,
		],
	})


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
	 *   `[user-plural]` -> ... -> `[user-base-no-relative]`
	 *      -> (insert "people") `[user-rhs]` -> ... `[user-plural]`
	 *
	 * This only occurs for the `user` category rules because of the following production sequence:
	 *   `[obj-users]` -> ... -> `[user-plural]`
	 * Though, as all categories use `[obj-users]`, this recursive sequence damages parse performance of queries for all categories.
	 *
	 * The generator forbids such rules because they enable recursive parse nodes, which the parse-forest search heuristic calculator does not yet support. See "Recursive Node Restriction" in `calcHeuristicCosts` for a detailed explanation.
	 *
	 * In addition, even if this insertion only exists for all categories expect `user` (avoiding recursive parse nodes), the insertion still halves performance (i.e., doubles total parse time). (This measurement excludes queries reparsed for failing to produce legal trees (due to contradictory semantics), because their parse time is disproportionately large and will be (separately) corrected by avoiding no-legal-trees altogether.)
	 */
	baseNoRelative.addRule({
		rhs: [
			{ symbol: lhsHead, noInsert: true },
			rhs,
		],
		transpositionCost: 1,
	})

	this.noRelative = g.newSymbol(this.nameSg, 'no', 'relative')
	// people followed by me
	// people I follow
	// (people who are) people followed by me
	// (people who are not) people followed by me
	this.noRelative.addRule({ rhs: [ baseNoRelative ] })
	// my/`{user:'s}`/my-followers' repos
	// my/`{user:'s}`/my-followers' repos I like
	// (people who like) my/`{user:'s}`/my-followers' repos;
	this.noRelative.addRule({ rhs: [ this.noRelativePossessive, rhs ], noInsert: true, transpositionCost: 1 })
	// (people) <stop> I follow
	this.noRelative.addRule({ rhs: [ stopWords.left, this.noRelative ] })


	// The segment that forms the relative clause.
	var filter = g.newSymbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ rhs: [ this.subjFilter ] })
	// (people who) I follow
	filter.addRule({ rhs: [ this.objFilter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.preFilter, filter ] })
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.sentenceAdverbial, filter ], transpositionCost: 0 })
	// (people who) are followers of mine
	filter.addRule({ rhs: [ auxVerbs.bePl, this.noRelative ] })
	// (issues that) are <stop> open/closed
	filter.addRule({ rhs: [ auxVerbs.bePlSentenceAdverbial, this.adjective ] })
	// (people who) are <stop> followed by me
	filter.addRule({ rhs: [ auxVerbs.bePlSentenceAdverbial, reducedNoTense ] })
	// (people who) have <stop> been followed by me; (people who) have <stop> been following me
	// Prevent insertion of `[have-sentence-adverbial-be-past]` because it is semantically identical to `[be-pl-sentence-adverbial]` in the preceding rule.
	filter.addRule({
		rhs: [
			{ symbol: auxVerbs.haveSentenceAdverbialBeen, noInsert: true },
			reducedNoTense,
		],
	})
	// (people who) <stop> follow me, I follow
	filter.addRule({ rhs: [ stopWords.left, filter ] })
	// (people who) are not followers of mine
	filter.addRule({ rhs: [ auxVerbs.bePlNegation, this.noRelative ], semantic: auxVerbs.notSemantic })
	// (issues that) are not open
	filter.addRule({ rhs: [ auxVerbs.bePlNegation, this.adjective ], semantic: auxVerbs.notSemantic })
	// (people who) are not followed by me
	filter.addRule({ rhs: [ auxVerbs.bePlNegation, this.reduced ], semantic: auxVerbs.notSemantic })
	// (people who) have not been followed by me
	filter.addRule({ rhs: [ auxVerbs.haveNegationBeen, this.reduced ], semantic: auxVerbs.notSemantic })
	// (repos that) are 22 KB
	this.postModifer = g.newSymbol(this.nameSg, 'post', 'modifier')
	filter.addRule({ rhs: [ auxVerbs.bePlSentenceAdverbial, this.postModifer ] })
	// (repos that) are not 22 KB
	filter.addRule({ rhs: [ auxVerbs.bePlNegation, this.postModifer ], semantic: auxVerbs.notSemantic })


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
		rhs: [
			{ symbol: filter, noInsert: true },
			conjunction.and,
		],
	})
	var filterAndRelPronoun = g.newBinaryRule({
		rhs: [
			{ symbol: filter, noInsert: true },
			isPerson ? conjunction.andWho : conjunction.andThat,
		],
	})

	var filterPlusNoUnion = g.newSymbol(filterPlus.name, 'no', g.getSemanticName(conjunction.unionSemantic))
	filterPlusNoUnion.addRule({
		rhs: [ filter ],
	}).addRule({
		rhs: [
			{ symbol: filterAnd, noInsert: true },
			{ symbol: filterPlusNoUnion, noInsert: true },
		],
	}).addRule({
		rhs: [
			{ symbol: filterAndRelPronoun, noInsert: true },
			{ symbol: filterPlusNoUnion, noInsert: true },
		],
	})

	filterPlus.addRule({
		// (people who) `[filter]` and `[filter]` [and `[filter]` ...]
		rhs: [
			{ symbol: filterAnd, noInsert: true },
			{ symbol: filterPlusNoUnion, noInsert: true },
		],
	}).addRule({
		// (people who) `[filter]` and `[who]` `[filter]` [and `[filter]` ...]
		rhs: [
			{ symbol: filterAndRelPronoun, noInsert: true },
			{ symbol: filterPlusNoUnion, noInsert: true },
		],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var filterPlusNoUnionOr = g.newBinaryRule({
		rhs: [
			filterPlusNoUnion,
			conjunction.or,
		],
		semantic: conjunction.intersectSemantic,
	})
	var filterPlusNoUnionOrRelPronoun = g.newBinaryRule({
		rhs: [
			filterPlusNoUnion,
			isPerson ? conjunction.orWho : conjunction.orThat,
		],
		semantic: conjunction.intersectSemantic,
	})
	var filterPlusIntersect = g.newSymbol(filterPlus.name, g.getSemanticName(conjunction.intersectSemantic)).addRule({
		rhs: [ filterPlus ],
		semantic: conjunction.intersectSemantic,
	})

	filterPlus.addRule({
		// (people who) `[filter]` [and `[filter]` ...] or `[filter+]`
		rhs: [
			{ symbol: filterPlusNoUnionOr, noInsert: true },
			filterPlusIntersect
		],
		semantic: conjunction.unionSemantic,
	}).addRule({
		// (people who) `[filter]` [and `[filter]` ...] or `[who]` `[filter+]`
		rhs: [
			{ symbol: filterPlusNoUnionOrRelPronoun, noInsert: true },
			filterPlusIntersect
		],
		semantic: conjunction.unionSemantic,
	})

	return filterPlus
}

/**
 * Adds nonterminal rules to this `Category` that represent user/person possession/ownership of instances of this `Category`.
 *
 * Adds the following rules for `possSemantic`, which represent instances of this `Category` that the specified users own/possess:
 * 1. `[cat-no-relative-possessive]` -> `[poss-determiner]` `[cat-possessable]`
 *                                   => my/`{user:'s}`/my-followers' repos
 * 2. `[cat-head]` -> `[cat-head-may-poss]` `[of-poss-users+]` => (repos) of `[poss-users]`
 *
 * If `possSemantic` has the property `forbidsMultipleIntersection` defined as `true`, then forbids conjunctions of user subjects (via `intersect()`) and restricts `possSemantic` to disjunctions (i.e., only `union()`) with the following changes to the preceding rules:
 * 2. `[poss-users+-disjunction]` replaces `[of-poss-users+]`
 *
 * This method is only invoked once from within the `Category` constructor. Not all categories use these rules (e.g., `user`, `company`).
 *
 * @private
 * @memberOf Category
 * @param {Object[]} possSemantic The semantic that returns instances of this `Category` that the specified users own/possess.
 * @returns {Category} Returns this `Category` instance.
 */
Category.prototype._addPossessiveRules = function (possSemantic) {
	var user = require('./user/user')

	// repos (of `[poss-users]`); (my) repos (I starred)
	this.headMayPoss = g.newSymbol(this.head.name, 'may', 'poss')
	this.head.addRule({ rhs: [ this.headMayPoss ] })

	// (my) repos; (my) JavaScript repos
	this.possessable = g.newBinaryRule({
		rhs: [ this.lhs, this.headMayPoss ],
		transpositionCost: 1,
	})

	// my/`{user:'s}`/my-followers' repos
	// my/`{user:'s}`/my-followers' `{language}` repos
	this.noRelativePossessive.addRule({
		rhs: [
			g.newSymbol(this.nameSg, user.possDeterminer.name).addRule({
				rhs: [ user.possDeterminer ],
				semantic: possSemantic,
			}),
			// For now, prevent this symbol's insertion, which would enable  "my" -> "my repos", because it halves performance. (Benchmark excludes `no-legal-trees` tests, which remain disproportionately slow until fixed.)
			{ symbol: this.possessable, noInsert: true },
		],
	})

	// If `possSemantic` is defined with `forbidsMultipleIntersection`, use `[of-poss-users+-disjunction]` instead of `[of-poss-users+]` to prevent multiple instances of the semantic function within an `intersect()`.
	var ofPossUsersPlus = possSemantic[0].semantic.forbidsMultipleIntersection
		? user.ofPossUsersPlusDisjunction
		: user.ofPossUsersPlus

	// (followers) of `[poss-users]` [and/or `[poss-users+]`]
	// (repos) of `[poss-users]` [or `[poss-users+-disjunction]`]
	this.head.addRule({
		rhs: [
			this.headMayPoss,
			/**
			 * Use a separate rule for `possSemantic` to ensure only semantics `ofPossUsersPlus` produces, and not semantics `this.headMayPoss` produces (e.g., `repositories-type(fork)` for "forks"), are added to `possSemantic`.
			 *
			 * Note: Not all categories have `this.headMayPoss` produce any semantics, rendering this additional unary rule unnecessary for those categories. If `RHSSymbolWrapper` (in `NSymbol`) is extended to enable specifying semantics for a specific symbol in a rule's RHS, this extra rule can be removed.
			 */
			g.newSymbol(this.nameSg, ofPossUsersPlus.name).addRule({
				rhs: [ ofPossUsersPlus ],
				semantic: possSemantic,
			}),
		],
	})

	return this
}

/**
 * Checks if `categoryOptions`, which was passed to `Category()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} categoryOptions The `Category` options object to inspect.
 * @returns {boolean} Returns `true` if `categoryOptions` is ill-formed, else `false`.
 */
function isIllFormedCategoryOptions(categoryOptions) {
	// Check `agentNounOptions.headTerm` is a term sequence of type 'invariable'.
	if (isIllFormedTermSequence(categoryOptions, 'headTerm', g.termTypes.INVARIABLE)) {
		return true
	}

	return false
}

/**
 * Adds nonterminal rules to this `Category` that represent relationships characterized by an action, represented by a verb, between users and instances of this `Category`.
 *
 * Adds the following rules for `options.catVerbSemantic`, which represent instances of this `Category` on which specified users perform this action:
 * 1. `[cat-passive]`    -> `[verb]` `[by-obj-users+]`           => (repos) liked by `[obj-users+]`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb]`              => (repos) `[nom-users+]` like(s)
 * 3. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb]`     => (repos) `[nom-users+]` have/has liked
 * 4. `[cat-obj-filter]` -> `[nom-users+]` `[do-not]` `[verb]`   => (repos) `[nom-users+]` do/does not like
 * 5. `[cat-obj-filter]` -> `[nom-users+]` `[have-not]` `[verb]` => (repos) `[nom-users+]` have/has not liked
 *
 * If `options.catVerbSemantic` has the property `forbidsMultipleIntersection` defined as `true`, then forbids conjunctions of user subjects (via `intersect()`) and restricts `options.catVerbSemantic` to disjunctions (i.e., only `union()`) with the following changes to the preceding rules:
 * 1.   `[obj-users+-disjunction]` replaces `[obj-users+]
 * 2-5. `[nom-users+-disjunction]` replaces `[nom-users+]
 * For use by semantics that represent a database object property that can only have one value. For example, `repositories-created()` can only have one value because a repository can only have one creator; i.e., no two people can create the same repository.
 *
 * Adds the following rules for `options.userVerbSemantic`, which represent users that perform this action on specified instances of this `Category`:
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`             => (people who) like `[repositories+]`
 * 7. `[user-subj-filter]` -> `[have]` `[verb]` `[cats+]`    => (people who) have liked `[repositories+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) do not like `[repositories+]`
 * 9. `[user-subj-filter]` -> `[have-not] `[verb]` `[cats+]` => (people who) have not liked `[repositories+]`
 *
 * If `options.acceptPastTenseIfInput` is `true`, the following present tense rules from above are also accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. For use by verbs that represent actions that can be expressed in present or past tense without semantic differences:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` like(s)/liked
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) like/liked `[repositories+]`
 *
 * If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. The following rules from above will be different:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` forked
 * 4. `[cat-obj-filter]`   -> `[nom-users+]` `[do-not]` `[verb]` => (repos) `[nom-users+]` did not fork
 * 6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) forked `[repositories+]`
 * 8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`       => (people who) did not fork `[repositories+]`
 *
 * If `options.noPresentPerfect` is `true`, omits all present perfect rules from the verb rule set: #3, #5, #7, and #9. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express instances of this `Category` both in currently in this state/action or were previously but are no longer in this state/action. The latter is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example, prevents the following queries:
 * 3. Stop: "(people) `[nom-users+]` have/has followed"
 * 5. Stop: "(people) `[nom-users+]` have/has not followed"
 * 7. Stop: "(people who) have followed `[obj-users+]`"
 * 9. Stop: "(people who) have not followed `[obj-users+]`"
 *
 * If `options.noPresentPerfectNegative` is `true`, omits only the present perfect negative rules #5 and #9 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example, prevents the following queries:
 * 5. Stop: "(repos) `[nom-users+-disjunction]` have/has not created"
 * 9. Stop: "(people who) have not created `[repositories+]`"
 *
 * If `options.agentNoun` is provided, adds the following rules for `options.userVerbSemantic`, which uses an agent noun to represent users that perform this action on instances of this `Category`:
 * 10. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => likers of `[repositories+]`
 * 11. `[user-head]` -> `[cat]` `[agent-noun]`            => `{repository}` likers
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * If `options.catDateSemantic` is provided, adds the following rule for the semantic, which represents instances of this `Category` for which the action occurred within a specified date range:
 * 12. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`
 *
 * `options.agentNounSemantic` must be defined with the property `isPeople` when created to enable the verb's use as an antecedent for anaphora. For example:
 * • "(people who follow) people who like `[repositories+]` (and their followers)"
 * • "(people who follow) `{repository}` likers (and their followers)"
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {boolean} [options.acceptPastTenseIfInput] Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {boolean} [options.noPresentPerfect] Specify omitting all present perfect rules (i.e., rules #3, #5, #7, and #9) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
 * @param {boolean} [options.noPresentPerfectNegative] Specify omitting present perfect negative rules #5 and #9 from this verb rule set, which otherwise suggest past occurrences of this action can reoccur for the same objects.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which specified users perform this action.
 * @param {NSymbol} [options.objectSym=this.plPlus] The symbol for the object that receives this action and produces the semantic arguments for `options.userVerbSemantic`. If omitted, default to this `Category` instance's `this.plPlus` (i.e., `[cats+]`).
 * @param {Object[]} options.userVerbSemantic The semantic that returns users who perform this action on specified instances of this `Category`.
 * @param {Object} [options.agentNoun] The agent-noun options object.
 * @param {NSymbol} [options.agentNoun.agentNounTerm] The term sequence of type 'invariable' that produces the terminal rules for the agent noun, created by `g.newTermSequence()` with `type` 'invariable'.
 * @param {NSymbol} [options.agentNoun.prepTerm] The term sequence of type 'invariable' that produces the terminal rules for the preposition that follows `options.agentNoun.agentNounTerm` in rule #10 of the second section of this method description, created by `g.newTermSequence()` with `type` 'invariable'.
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
	if (util.illFormedOpts(verbRuleSetSchema, options)) {
		throw new Error('Ill-formed verb rule set')
	}

	// (repos) liked by `[obj-users+]`
	// (repos) `[nom-users+]` like(s)
	// (repos) `[nom-users+]` have/has liked
	// (repos) `[nom-users+]` do/does not like
	// (repos) `[nom-users+]` have/has not liked
	this.addObjectVerbRuleSet({
		verbTerm: options.verbTerm,
		// If `options.acceptPastTenseIfInput` is `true`, the following rule is accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions:
		//   "(repos) `[nom-users+]` like(s)/liked"
		acceptPastTenseIfInput: !!options.acceptPastTenseIfInput,
		// If `options.onlyPastTense` is `true`, the following rules will be in past tense:
		//   "(repos) `[nom-users+]` forked"
		//   "(repos) `[nom-users+]` did not fork"
		onlyPastTense: !!options.onlyPastTense,
		// If `options.noPresentPerfect` is true, omits the following rules:
		//   Stop: "(people) `[nom-users+]` have/has followed"
		//   Stop: "(people) `[nom-users+]` have/has not followed"
		noPresentPerfect: !!options.noPresentPerfect,
		// If `options.noPresentPerfectNegative` is `true`, omits the following rule:
		//   Stop: "(repos) `[nom-users+-disjunction]` have/has not created"
		noPresentPerfectNegative: !!options.noPresentPerfectNegative,
		catVerbSemantic: options.catVerbSemantic,
	})

	// Check `options.userVerbSemantic` represents a set of people.
	if (!isPeopleSemantic(options.userVerbSemantic)) {
		throw new Error('Ill-formed user verb semantic')
	}

	// Load `user` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')

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
		//   Stop: "(people who) have not followed `[obj-users+]`"
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
 * Adds nonterminal rules to this `Category` that represent instances of this `Category` (i.e., the object) on which specified users (i.e., the subject) perform this action.
 *
 * Adds the following rules for `options.catVerbSemantic`:
 * 1. `[cat-passive]`    -> `[verb]` `[by-obj-users+]`           => (repos) liked by `[obj-users+]`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb]`              => (repos) `[nom-users+]` like(s)
 * 3. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb]`     => (repos) `[nom-users+]` have/has liked
 * 4. `[cat-obj-filter]` -> `[nom-users+]` `[do-not]` `[verb]`   => (repos) `[nom-users+]` do/does not like
 * 5. `[cat-obj-filter]` -> `[nom-users+]` `[have-not]` `[verb]` => (repos) `[nom-users+]` have/has not liked
 *
 * If `options.catVerbSemantic` has the property `forbidsMultipleIntersection` defined as `true`, then forbids conjunctions of user subjects (via `intersect()`) and restricts `options.catVerbSemantic` to disjunctions (i.e., only `union()`) with the following changes to the preceding rules:
 * 1.   `[obj-users+-disjunction]` replaces `[obj-users+]
 * 2-5. `[nom-users+-disjunction]` replaces `[nom-users+]
 * For use by semantics that represent a database object property that can only have one value. For example, `repositories-created()` can only have one value because a repository can only have one creator; i.e., no two people can create the same repository.
 *
 * If `options.acceptPastTenseIfInput` is `true`, the following present tense rule from above is also accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. For use by verbs that represent actions that can be expressed in present or past tense without semantic differences:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` like(s)/liked
 *
 * If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. The following rules from above will be different:
 * 2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` forked
 * 4. `[cat-obj-filter]`   -> `[nom-users+]` `[do-not]` `[verb]` => (repos) `[nom-users+]` did not fork
 *
 * If `options.noPresentPerfect` is `true`, it omits all present perfect rules from the verb rule set: #3, #5. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express instances of this `Category` both in currently in this state/action or were previously but are no longer in this state/action. The latter is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example, prevents the following queries:
 * 3. Stop: "(people) `[nom-users+]` have/has followed"
 *    `users-followed()` would return a list of users which the specified users currently follow; however, the rule's present perfect positive tense suggests the list includes both of the following:
 *      1. Users which the specified users currently follow.
 *      2. Users which the specified users have previously followed but no longer follow.
 *    The latter implication is unlikely the user's intent, and is also unsatisfiable because there is no data for accounts a user previously follows and no longer follows.
 * 5. Stop: "(people) `[nom-users+]` have/has not followed"
 *    `not(users-followed())` would return a list of users which the specified users do not currently follow; however, the rule's present perfect negative tense suggests the list is the following:
 *      1. Users which the specified users do not currently follow *and* have never followed.
 *    The latter property is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 *
 * If `options.noPresentPerfectNegative` is `true`, omits only the present perfect negative rule #5 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example, prevents the following query:
 * 5. Stop: "(repos) `[nom-users+-disjunction]` have/has not created"
 *    `not(repositories-created())` would return a list of repositories which the specified users did not create; however, the rule's present perfect negative tense suggests the specified users can create those same repositories in the future. This implication is false because a repository's creation can not reoccur.
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {boolean} [options.acceptPastTenseIfInput] Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {boolean} [options.noPresentPerfect] Specify omitting all present perfect rules (i.e., rules #3 and #5) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
 * @param {boolean} [options.noPresentPerfectNegative] Specify omitting the present perfect negative rule #5 from this verb rule set, which otherwise suggests past occurrences of this action can reoccur for the same objects.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which specified users perform this action.
 * @returns {Category} Returns this `Category` instance.
 */
var objectVerbRuleSetSchema = {
	verbTerm: { type: NSymbol, required: true },
	acceptPastTenseIfInput: Boolean,
	onlyPastTense: Boolean,
	noPresentPerfect: Boolean,
	noPresentPerfectNegative: Boolean,
	catVerbSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addObjectVerbRuleSet = function (options) {
	if (util.illFormedOpts(objectVerbRuleSetSchema, options) || isIllFormedVerbRuleSetOptions(options)) {
		throw new Error('Ill-formed object verb rule set')
	}

	/**
	 * When `options.catVerbSemantic` has `forbidsMultipleIntersection` defined as `true`, the parser only permits one instance of `options.catVerbSemantic` within the semantic arguments of a parent `intersect()`, irrespective of the semantic children of each `options.catVerbSemantic`. This restriction is necessary for database object properties for which each object can only have one value for the property.
	 * • For example, a repository database object can only have one value for `repositories-created()` because a repository can only have one creator. This means the query "repos created by me and`{user}`" would return an empty set for the intersection because no repository can have both entities as its creator.
	 *
	 * `pfsearch` -> `semantic.reduce()` detects such `intersect()` instances with illegal RHS semantic arrays that contain multiple instances of a semantic defined with `forbidsMultipleIntersection`, and discards the associated parse trees.
	 *
	 * Below, grammar rules with semantics that have `forbidsMultipleIntersection` are designed to limit the possible constructions of such semantically illegal trees, which prevents `pfsearch` from having to construct (and then discard) the trees in the first place.
	 * • By using `[obj-users+-disjunction]` and `[nom-users+-disjunction]` below in place of `[obj-users+]` and `[nom-users+]`, respectively, it prevents subject conjunctions that use `intersect()` with `options.verbTerm`, which prevents the illegal query example above, and only enables logical disjunctions by using `union()`.
	 *   • In addition, the disjunction sets enable the substitution of "and" -> "or" when matched in input.
	 * • Semantically illegal parse trees with such semantics can still be constructed via other rules (e.g., "repos created by me that are created by `{user}`"), however, this grammar design still reduces some of the possible illegal constructions and hence improves performance.
	 */
	var noSubjectConjunctions = options.catVerbSemantic[0].semantic.forbidsMultipleIntersection

	// Check `options.onlyPastTense` is `true` for a semantic with `forbidsMultipleIntersection`, because semantics with `forbidsMultipleIntersection` almost certainly represent past actions.
	if (noSubjectConjunctions && !options.onlyPastTense) {
		util.logErrorAndPath('The semantic', semantic.toStylizedString(options.catVerbSemantic), 'was defined with `forbidsMultipleIntersection`, but its associated verb rule set', util.stylize(options.verbTerm.name), 'lacks `onlyPastTense`. Semantics with `forbidsMultipleIntersection` represent past events.', options)
		throw new Error('Ill-formed object verb rule set')
	}

	// Load `user` here, instead of at file top, to avoid cyclical dependence when instantiating `user` `Category`.
	var user = require('./user/user')

	// (repos) liked by me/`{user}`/people-who... [and/or `[obj-users+]`]
	this.passive.addRule({
		rhs: [ {
				symbol: options.verbTerm,
				// Dictates inflection of `options.verbTerm`:
				//   "(repos) `[verb-like]` by me" -> "(repos) liked by me"
				grammaticalForm: 'past',
			},
			noSubjectConjunctions ? user.byObjUsersPlusDisjunction : user.byObjUsersPlus,
		],
		semantic: options.catVerbSemantic,
	})

	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] forked
		this.objFilter.addRule({
			rhs: [
				// The grammatical person-number in `[nom-users+]` is not used.
				noSubjectConjunctions ? user.nomUsersPlusDisjunction : user.nomUsersPlus,
				{
					symbol: options.verbTerm,
					// Dictates inflection of `options.verbTerm`:
					//   "(repos) I `[verb-fork]`" -> "(repos) I forked"
					grammaticalForm: 'past',
			} ],
			semantic: options.catVerbSemantic,
		})
	} else if (options.acceptPastTenseIfInput) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] like(s)/liked
		this.objFilter.addRule({
			rhs: [
				// If `options.verbTerm` is not input in past tense, the grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbTerm`:
				//   "(repos) I `[verb-like]`" -> "(repos) I like"
				noSubjectConjunctions ? user.nomUsersPlusDisjunction : user.nomUsersPlus,
				{
					symbol: options.verbTerm,
					// Accept the past tense form of `options.verbTerm` if input is past tense, while still defaulting to correct present tense form according to `[nom-users+]` grammatical person-number:
					//   "(repos) I/`{user}`/people-who... liked"
					// Default to `[nom-users+]` person-number for insertions created from this rule.
					acceptedTense: 'past',
			} ],
			semantic: options.catVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] like(s)
		this.objFilter.addRule({
			// The grammatical person-number in `[nom-users+]` dictates the inflection of `options.verbTerm`:
			//   "(repos) I `[verb-like]`" -> "(repos) I like"
			rhs: [ noSubjectConjunctions ? user.nomUsersPlusDisjunction : user.nomUsersPlus, options.verbTerm ],
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
			rhs: [
				// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
				//   "(repos) `{user}` `[have]` liked" -> "(repos) `{user}` has liked"
				// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were the insertion of `[have]` enabled, it would enable the following additional, wasteful suggestion:
				//   Stop: "(repos) I like" -> "(repos) I have liked"
				noSubjectConjunctions ? user.nomUsersPlusDisjunctionHaveNoInsert : user.nomUsersPlusHaveNoInsert,
				{
					symbol: options.verbTerm,
					// Dictates inflection of `options.verbTerm`:
					//   "(repos) I have `[verb-like]`" -> "(repos) I have liked"
					grammaticalForm: 'past',
			} ],
			semantic: options.catVerbSemantic,
		})
	}

	var notCatVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.catVerbSemantic)

	/**
	 * The following two rules have a structure that requires creating a unique binary rule for every verb:
	 *   `[nom-users+] [ [do] [verb] ]`
	 * In contrast, an alternate structure would yield less rules by sharing the rule for the axillary verb, `[do]`:
	 *   `[ [nom-users+] [do] ] [verb]`
	 *
	 * Despite the former structure requiring more grammar rules, which yields slightly more parser reductions, it enables more term sequence flattening, which reduces the number of paths `pfsearch` creates and text objects it conjugates, and is ultimately favorable.
	 * • It is difficult to compare the performance of these trade-offs. `Parser` shift-reduce operations consume 67% of total parse time, while `pfsearch` consumes 20% (10% garbage collection, 3% other).
	 * • Might need to restructure these rules to pair `[do-negation]` with the preceding `[nom-users+]`, reducing the grammar and limiting the term sequence flattening. This current structure might grow detrimental as the grammar grows, and neither `[have]` nor `[by]` follow this model.
	 */
	if (options.onlyPastTense) {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] did not fork
		this.objFilter.addRule({
			rhs: [
				// The grammatical person-number in `[nom-users+]` is not used.
				noSubjectConjunctions ? user.nomUsersPlusDisjunction : user.nomUsersPlus,
				[ {
						symbol: auxVerbs.doNegation,
						// Dictates inflection of `[do]`:
						//   "(repos) I `[do]` not fork" -> "(repos) I did not fork"
						grammaticalForm: 'past',
					}, {
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(repos) I did not `[verb-fork]`" -> "(repos) I did not fork"
						grammaticalForm: 'infinitive',
				} ],
			],
			semantic: notCatVerbSemantic,
		})
	} else {
		// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] do/does not like
		this.objFilter.addRule({
			rhs: [
				// The grammatical person-number in `[nom-users+]` dictates the inflection of `[do]`:
				//   "(repos) `{user}` `[do]` not like" -> "(repos) `{user}` does not like"
				noSubjectConjunctions ? user.nomUsersPlusDisjunction : user.nomUsersPlus,
				[
					auxVerbs.doNegation,
					{
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(repos) I do not `[verb-like]`" -> "(repos) I do not like"
						grammaticalForm: 'infinitive',
				} ],
			],
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
			rhs: [
				// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
				//   "(repos) I `[have]` liked" -> "(repos) I have liked"
				// No insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion enabled, it would (wastefully) enable the following semantically duplicate suggestions:
				//   Stop:  "(repos) I not" -> "(repos) I have not", "(repos) I do not"
				noSubjectConjunctions ? user.nomUsersPlusDisjunctionHaveNoInsertNegation : user.nomUsersPlusHaveNoInsertNegation,
				{
					symbol: options.verbTerm,
					// Dictates inflection of `options.verbTerm`:
					//   "(repos) I have not `[verb-like]`" -> "(repos) I have not liked"
					grammaticalForm: 'past',
			} ],
			semantic: notCatVerbSemantic,
		})
	}

	return this
}

/**
 * Adds nonterminal rules to this `Category` that represent instances of this `Category` (i.e., the subject) that perform this action on `options.objectSym` (i.e., the object).
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
 * If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. The following rules from above will be different:
 * 1. `[cat-subj-filter]` -> `[verb]` `[cats+]`             => (people who) forked `[repositories+]`
 * 2. `[cat-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) did not fork `[repositories+]`
 *
 * If `options.noPresentPerfect` is `true`, it omits all present perfect rules from the verb rule set: #2, #4. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express instances of this `Category` both in currently in this state/action or were previously but are no longer in this state/action. The latter is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example, prevents the following queries:
 * 2. Stop: "(people who) have followed `[obj-users+]`"
 *    `followers()` would return a list of users that currently follow the specified users; however, the rule's present perfect positive tense suggests the list includes both of the following:
 *      1. Users that currently follow the specified users.
 *      2. Users that have previously and no longer follow the specified users.
 *    The latter implication is unlikely the user's intent, and is also unsatisfiable because there is no data for accounts a user previously follows and no longer follows.
 * 4. Stop: "(people who) have not followed `[obj-users+]`"
 *    `not(followers())` would return a list of users that do not currently follow the specified users; however, the rule's present perfect negative tense suggests the list is the following:
 *      1. Users that do not currently follow *and* have never followed the specified users.
 *    The latter property is unlikely the user's intent, and is also unsatisfiable because this data is unavailable.
 *
 * If `options.noPresentPerfectNegative` is `true`, it omits only the present perfect negative rule #4 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example, prevents the following query:
 * 4. Stop: "(people who) have not created `[repositories+]`"
 *    `not(repository-creators())` would return a list of users that did not create the specified repositories; however, the rule's present perfect tense suggests those same users can create the specified repositories in the future. This implication is false because a repository's creation can not reoccur.
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbTerm The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
 * @param {boolean} [options.acceptPastTenseIfInput] Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
 * @param {boolean} [options.onlyPastTense] Specify only using the past tense form of `options.verbTerm`.
 * @param {boolean} [options.noPresentPerfect] Specify omitting all present perfect rules (i.e., rules #2 and #4) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
 * @param {boolean} [options.noPresentPerfectNegative] Specify omitting the present perfect negative rule #4 from this verb rule set, which otherwise suggests past occurrences of this action can reoccur for the same objects.
 * @param {NSymbol} options.objectSym The symbol for the object that receives this action and produces the semantic arguments for `options.catVerbSemantic`.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` that perform this action on `options.objectSym`.
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

	if (options.onlyPastTense) {
		// (people who) forked `[repositories+]`
		this.subjFilter.addRule({
			rhs: [ {
					// Dictates inflection of `options.verbTerm`:
					//   "(people who) `[verb-fork]` `[repositories+]`" -> "(people who) forked `[repositories+]`"
					symbol: options.verbTerm,
					grammaticalForm: 'past',
				},
				options.objectSym,
			],
			semantic: options.catVerbSemantic,
		})
	} else if (options.acceptPastTenseIfInput) {
		// (people who) like/liked `[repositories+]`
		this.subjFilter.addRule({
			rhs: [ {
					symbol: options.verbTerm,
					// Accept the past tense form of `options.verbTerm` if input is past tense, while defaulting to `grammaticalForm` infinitive form for insertions created from this rule.
					//   "(people who) liked `[repositories+]`"
					acceptedTense: 'past',
					// If `options.verbTerm` is not input in past tense, `grammaticalForm` dictates the inflection of `options.verbTerm`:
					//   "(people who) `[verb-like]` (`[repositories+]`)" -> "(people who) like (`[repositories+]`)"
					grammaticalForm: 'infinitive',
				},
				options.objectSym,
			],
			semantic: options.catVerbSemantic,
		})
	} else {
		// (people who) like `[repositories+]`
		this.subjFilter.addRule({
			rhs: [ {
					symbol: options.verbTerm,
					// Dictates inflection of `options.verbTerm`:
					//   "(people who) `[verb-like]` (`[repositories+]`)" -> "(people who) like (`[repositories+]`)"
					grammaticalForm: 'infinitive',
				},
				options.objectSym,
			],
			semantic: options.catVerbSemantic,
		})
	}

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
			rhs: [
				[ {
						symbol: auxVerbs.have,
						// No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were this insertion enabled, it would enable the following additional, wasteful suggestion:
						//   Stop: "(people who) liked" ->  "(people who) have liked"
						noInsert: true,
						// Dictates inflection of `[have]`:
						//   "(people who) `[have]` liked (...)" -> "(people who) have liked (...)"
						grammaticalForm: 'infinitive',
					}, {
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(people who) have `[verb-like]` (...)" -> "(people who) have liked (...)"
						grammaticalForm: 'past',
				} ],
				options.objectSym,
			],
			semantic: options.catVerbSemantic,
		})
	}

	var notCatVerbSemantic = g.reduceSemantic(auxVerbs.notSemantic, options.catVerbSemantic)

	if (options.onlyPastTense) {
		// (people who) did not fork `[repositories+]`
		this.subjFilter.addRule({
			rhs: [
				[ {
						symbol: auxVerbs.doNegation,
						// Dictates inflection of `[do]`:
						//   "(people who) `[do]` not fork (...)" -> "(people who) did not fork (...)"
						grammaticalForm: 'past',
					}, {
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(people who) did not `[verb-fork]` (...)" -> "(people who) did not fork (...)"
						grammaticalForm: 'infinitive',
				}	],
				options.objectSym,
			],
			semantic: notCatVerbSemantic,
		})
	} else {
		// (people who) do not like `[repositories+]`
		this.subjFilter.addRule({
			rhs: [
				[ {
						symbol: auxVerbs.doNegation,
						// Dictates inflection of `[do]`:
						//   "(people who) `[do]` not like" -> "(people who) do not like"
						grammaticalForm: 'infinitive',
					}, {
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(people who) do not `[verb-like]`" -> "(people who) do not like"
						grammaticalForm: 'infinitive',
				} ],
				options.objectSym,
			],
			semantic: notCatVerbSemantic,
		})
	}

	/**
	 * Do not assign the present perfect negative rule if either option is true:
	 * • `options.noPresentPerfect` - Verbs that represent ongoing present actions or states. For example,
	 *   above the following rule for the state of accounts following specified users:
	 *     Stop: "(people who) have not followed `[obj-users+]`"
	 *
	 *   This rule suggests the results are users that do not currently follow *and* have never followed the
	 *   specified users. The latter property is unlikely the user's intent.
	 *
	 * • `options.noPresentPerfectNegative` - Verbs that represent past actions that can not reoccur for the
	 *   same objects. For example, avoid the following rule, which has the false implication that the
	 *   associated action (repository creation) can reoccur for the objects it returns:
	 *     Stop: "(people who) have not created `[repositories+]`"
	 *
	 *   Though, for this example, it *is* possible for the same users which the query returns to meet the same
	 *   specified criteria in the future (e.g., "repos `{user}` likes"), it will not be for the same objects
	 *   (i.e., "`{user}`" must "like" different repositories in the future).
	 *
	 *   Moreover, this rule's past-perfect implication can be absolutely false for other queries; e.g.,
	 *   "people who have not created Node.js". Hence, avoid this rule to prevent the queries that are
	 *   absolutely false. Also, the same query semantics remain possible via the simple-present-negative rule;
	 *   e.g., "(people who) did not create `[repositories+]`".
	 */
	if (!options.noPresentPerfect && !options.noPresentPerfectNegative) {
		// (people who) have not liked `[repositories+]`
		this.subjFilter.addRule({
			rhs: [
				[ {
						// Prevent `[have]` insertion `pfsearch` from wastefully creating multiple semantically identical trees, which it ultimately discard. For example, were this insertion enabled, it would yield the following semantically duplicate suggestions:
						//   Stop:  "(people who) not like" -> "(people who) do not like", "(people who) have not liked"
						symbol: auxVerbs.haveNoInsertNegation,
						// Dictates inflection of `[have]`:
						//   "(people who) `[have]` not liked (...)" -> "(people who) have not liked (...)"
						grammaticalForm: 'infinitive',
					}, {
						symbol: options.verbTerm,
						// Dictates inflection of `options.verbTerm`:
						//   "(people who) have not `[verb-like]` (...)" -> "(people who) have not liked (...)"
						grammaticalForm: 'past',
				} ],
				options.objectSym,
			],
			semantic: notCatVerbSemantic,
		})
	}

	return this
}

/**
 * Checks if `ruleSetOptions`, which was passed to `Category.prototype.addObjectVerbRuleSet()` or `Category.prototype.addSubjectVerbRuleSet()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} ruleSetOptions The verb rule set options object to inspect.
 * @returns {boolean} Returns `true` if `ruleSetOptions` is ill-formed, else `false`.
 */
function isIllFormedVerbRuleSetOptions(ruleSetOptions) {
	/**
	 * Check `ruleSetOptions.verbTerm` is either:
	 * 1. A verb terminal rule set created by `g.newVerb()` or a verb sequence created by `g.newTermSequence()` that produces sequences that each contain a verb created by `g.newVerb()`.
	 * 2. A verb created by `g.newVerbSet()` or `NSymbol.prototype.addVerb()` that has inflected text for past tense.
	 */
	if (!g.isTermSequenceType(ruleSetOptions.verbTerm, g.termTypes.VERB) && !g.isVerb(ruleSetOptions, 'verbTerm')) {
		throw new Error('Ill-formed verb')
	}

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
 * 1. `[cat-passive]`    -> `[verb-past]` `[by-obj-users+]`
 *                       => (companies) worked at by `[obj-users+]`, `ever()`
 * 2. `[cat-obj-filter]` -> `[nom-users+]` `[verb-present]`
 *                       => (companies) `[nom-users+]` work(s) at, `present()`
 * 3. `[cat-obj-filter]` -> `[nom-users+]` `[verb-past]`
 *                       => (companies) `[nom-users+]` worked at, `ever-past()`
 * 4. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb-past]`
 *                       => (companies) `[nom-users+]` have/has worked at, `ever()`
 * 5. `[cat-obj-filter]` -> `[nom-users+]` `[previously]` `[verb-past]`
 *                       => (companies) `[nom-users+]` previously worked at, `past()`
 *
 * Demands the verb be two separate rule sets with distinct rules (i.e., not intersection of rule sets) to prevent a given input generating multiple similar suggestions, scarcely distinguished by grammatical tense (though different semantics). For example, this prevents the following:
 *   "companies I work at"
 *   -> "companies I work at", `present(companies-worked-at(me))`
 *   -> "companies I worked at", `ever-past(companies-worked-at(me))`
 *
 * `options.verbPresentTerm` and `options.verbPastTerm` can only produce terminal rules for their respective grammatical tenses and lack rules for the opposite tense:
 * • Each is created by `g.newVerb(verbOptions)` with matching `verbOptions.tense` or `g.newTermSequence(termSeqOptions)` with matching `termSeqOptions.type`.
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.verbPresentTerm The term sequence of type 'verb-present' that produces the present tense verb forms, created by `g.newVerb()` with `tense` 'present' or `g.newTermSequence()` with `type` 'verb-present'.
 * @param {NSymbol} options.verbPastTerm The term sequence of type 'verb-past' that produces the past tense verb forms, created by `g.newVerb()` with `tense` 'past' or `g.newTermSequence()` with `type` 'verb-past'.
 * @param {Object[]} options.catVerbSemantic The semantic that returns instances of this `Category` on which specified users perform this action.
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

	// (companies) I/`{user}`/people-who... [and/or `[nom-users+]`] worked at, `ever-past(companies-worked-at())`
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` is not used.
		rhs: [ user.nomUsersPlus, options.verbPastTerm ],
		semantic: g.reduceSemantic(userTense.everPastSemantic, options.catVerbSemantic),
	})

	// (companies) I/`{user}`/people-who... [and/or `[nom-users+]`] have/has worked at, `ever(companies-worked-at())`
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` dictates the inflection of `[have]`:
		//   "(companies) I `[have]` worked at" -> "(companies) I have worked at"
		// No insertion for `[have]` to prevent multiple similar suggestions, scarcely distinguished by grammatical tense (though different semantics). For example, were the insertion of `[have]` enabled, it would enable the following scarcely distinguishable suggestions:
		//   "companies I worked at"
		//         -> "companies I worked at",      `ever-past(companies-worked-at(me))`
		//   Stop: -> "companies I have worked at", `past(companies-worked-at(me))`
		rhs: [ user.nomUsersPlusHaveNoInsert, options.verbPastTerm ],
		semantic: g.reduceSemantic(userTense.everSemantic, options.catVerbSemantic),
	})

	// (companies) I/`{user}`/people-who... [and/or `[nom-users+]`] previously worked at, `past(companies-worked-at())`
	this.objFilter.addRule({
		// The grammatical person-number in `[nom-users+]` is not used.
		rhs: [ userTense.nomUsersPlusPreviously, options.verbPastTerm ],
		semantic: g.reduceSemantic(userTense.pastSemantic, options.catVerbSemantic),
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
	// Check `ruleSetOptions.verbPresentTerm` is a present tense verb terminal rule set created by `g.newVerb()` or a present tense verb sequence created by `g.newTermSequence()`.
	if (isIllFormedTermSequence(ruleSetOptions, 'verbPresentTerm', g.termTypes.VERB_PRESENT)) {
		return true
	}

	// Check `ruleSetOptions.verbPastTerm` is a past tense verb terminal rule set created by `g.newVerb()` or a past tense verb sequence created by `g.newTermSequence()`.
	if (isIllFormedTermSequence(ruleSetOptions, 'verbPastTerm', g.termTypes.VERB_PAST)) {
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
 * Adds nonterminal rules to the `user` `Category` for an agent noun that represents users that perform this action on instances of this `Category`.
 *
 * Adds the following rules for `options.agentNounSemantic`:
 * 1. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => founders of `[companies+]`
 * 2. `[user-head]` -> `[cat]` `[agent-noun]`            => `{company}` founders
 *   • Only creates this rule if this `Category` has an associated entity category.
 *
 * An agent noun is a word derived from another word denoting an action, and that identifies an entity that does that action.
 *
 * `options.agentNounSemantic` must have been defined with the property `isPeople` when created to enable the agent noun's use as an antecedent for anaphora. For example:
 *   "(people who follow) `{company}` founders (and their followers)"
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.agentNounTerm The term sequence of type 'invariable' that produces the terminal rules for the agent noun, created by `g.newTermSequence()` with `type` 'invariable'.
 * @param {NSymbol} options.prepTerm The term sequence of type 'invariable' that produces the terminal rules for the preposition that follows `options.agentNounTerm` in rule #1 of the method description, created by `g.newTermSequence()` with `type` 'invariable'.
 * @param {Object[]} options.agentNounSemantic The semantic that returns users that perform this action on specified instances of this `Category`.
 * @returns {Category} Returns this `Category` instance.
 */
var agentNounSchema = {
	agentNounTerm: { type: NSymbol, required: true },
	prepTerm: { type: NSymbol, required: true },
	agentNounSemantic: { type: Array, arrayType: Object, required: true },
}

Category.prototype.addAgentNoun = function (options) {
	if (util.illFormedOpts(agentNounSchema, options) || isIllFormedAgentNounOptions(options)) {
		throw new Error('Ill-formed agent noun')
	}

	// Load `user` here instead of at file top to avoid cyclical module dependence when instantiating `user` `Category`.
	var user = require('./user/user')

	// founders of `[companies+]`
	user.head.addRule({
		rhs: [ {
				symbol: options.agentNounTerm,
				// Prevent head noun insertion, which otherwise disproportionally hurts performance for its benefit.
				noInsert: true,
			},
			[ options.prepTerm, this.plPlus ],
		],
		// Enable transposition:
		//   "companies with `<int>` employees founders" -> "founders of companies with `<int>` employees"
		// Note: This edit might be removed because it hurts performance by significantly increasing the size of the state table.
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
 * Checks if `agentNounOptions`, which was passed to `Category.prototype.addAgentNoun()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} agentNounOptions The  `Category.prototype.addAgentNoun()` options object to inspect.
 * @returns {boolean} Returns `true` if `agentNounOptions` is ill-formed, else `false`.
 */
function isIllFormedAgentNounOptions(agentNounOptions) {
	// Check `agentNounOptions.agentNounSemantic` represents a set of people.
	if (!isPeopleSemantic(agentNounOptions.agentNounSemantic)) {
		return true
	}

	// Check `agentNounOptions.agentNounTerm` is a term sequence of type 'invariable'.
	if (isIllFormedTermSequence(agentNounOptions, 'agentNounTerm', g.termTypes.INVARIABLE)) {
		return true
	}

	// Check `agentNounOptions.agentNounTerm` is a term sequence of type 'invariable'.
	if (isIllFormedTermSequence(agentNounOptions, 'prepTerm', g.termTypes.INVARIABLE)) {
		return true
	}

	return false
}

/**
 * Adds a nonterminal rule to this `Category` that represents instances of this `Category` for which the action, `options.verbTerm`, occurred within a specified date range.
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
 * @param {NSymbol} options.verbTerm The term sequence of type 'verb' that represents this action, created by `g.newVerb()` or `g.newTermSequence()`.
 * @param {Object[]} options.catDateSemantic The semantic that returns instances of this `Category` for which this action occurred within a specified date range.
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

	// Check `options.verbTerm` is a tense-less verb terminal rule set created by `g.newVerb()` or a tense-less verb sequence created by `g.newTermSequence()`.
	if (isIllFormedTermSequence(options, 'verbTerm', g.termTypes.VERB)) {
		throw new Error('Ill-formed verb')
	}

	// (companies) founded `[date]`
	// (companies not) founded `[date]`
	this.inner.addRule({
		rhs: [ {
				symbol: options.verbTerm,
				// Dictates inflection of `options.verbTerm`:
				//   "(companies) `[found]` in `[year]`" -> "(companies) founded in `[year]`"
				grammaticalForm: 'past',
			},
			date,
		],
		semantic: options.catDateSemantic,
	})

	return this
}

/**
 * Adds nonterminal rules to this `Category` that represent instances of this `Category` with a specified quantity of `options.itemTerm`.
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
 * @param {Object[]} options.catCountSemantic The semantic that returns instances of this `Category` with a specified quantity of `options.itemTerm`.
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
			rhs: [ {
					symbol: auxVerbs.have,
					// Dictates inflection of `[have]`:
					//   "(issues that) `[have]` `<int>` comments" -> "(issues that) have `<int>` comments"
					grammaticalForm: 'infinitive',
				},
				itemCount,
			],
			semantic: options.catCountSemantic,
		})

		// (issues that) do not have `<int>` comments
		this.subjFilter.addRule({
			// The `grammaticalForm` property defined on `auxVerbs.doPresentNegationHave` conjugates the term sequence.
			rhs: [ auxVerbs.doPresentNegationHave, itemCount ],
			semantic: g.reduceSemantic(auxVerbs.notSemantic, options.catCountSemantic),
		})
	}

	return this
}

/**
 * Adds a nonterminal rule to this `Category` that represents instances of this `Category` with a specified measurement of `options.unitTerm`.
 *
 * Adds the following rule for `options.catMeasurementSemantic`:
 * 1. `[cat-post-modifier]` -> `[item-count]` => (repos that are) `<int>` KB
 *                                               (repos that are not) `<int>` KB
 *
 * @memberOf Category
 * @param {Object} options The options object.
 * @param {NSymbol} options.unitTerm The symbol that produces the terminal rule set for the measurement unit.
 * @param {Object[]} options.catCountSemantic The semantic that returns instances of this `Category` with a specified measurement of `options.unitTerm`.
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

/**
 * Checks if `semanticNodeArray` has a semantic that represents a set of people. If not, prints an error.
 *
 * To represent a set of people (as an agent noun), a semantic function must have been defined with the property `isPeople` when created.
 *
 * @private
 * @static
 * @param {Object[]} semanticNodeArray The semantic node array to inspect.
 * @param {Object} options The options object owner of `semanticNodeArray`, for inclusion in the error message.
 * @returns {boolean} Returns `true` if `semanticNodeArray` represents a set of people, else `false`.
 */
function isPeopleSemantic(semanticNodeArray, options) {
	// Check `semanticNodeArray` has a semantic function in its first level with the property `anaphoraPersonNumber`, defined as 'threePl', which indicates the function represents a set of people and can serve as an antecedent for anaphora.
	if (!semantic.hasAntecedent(semanticNodeArray)) {
		util.logError('Semantic does not represent a set of people (as an agent noun). Semantic was defined without `isPeople` property:', semanticNodeArray)
		util.logPathAndObject(options)
		return false
	}

	return true
}

/**
 * Checks if `options[paramName]` is not a term sequence of type `termSequenceType`. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object with the term sequence property to inspect.
 * @param {string} paramName The `options` property name for the term sequence to inspect.
 * @param {string} termSequenceType The desired term sequence type of `options[paramName]`.
 * @returns {boolean} Returns `true` if `options[paramName]` is not a term sequence of type `termSequenceType`, else `false`.
 */
function isIllFormedTermSequence(options, paramName, termSequenceType) {
	var termSequence = options[paramName]
	if (!g.isTermSequenceType(termSequence, termSequenceType)) {
		util.logErrorAndPath(`Provided \`${paramName}\` is not a term sequence of type ${util.stylize(termSequenceType)}:`, util.stylize(termSequence.name), '->', util.stylize(termSequence.termSequenceType), options)
		return true
	}

	return false
}

// Export `Category`.
module.exports = Category