***Note**: This documentation is temporary and incomplete as I evaluate the best method to present the material. See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).*

# `Category`

### `Category(options)`
The `Category` constructor, which adds several base symbols and rules for a new database object category to the grammar.

#### Arugments
- `options` *(Object)*: The options object.
- `options.nameSg` *(string)*: The singular form of the category's name.
- `options.namePl` *(string)*: The plural form of the category's name.
- `[options.isPerson]` *(boolean)*: Specify the category is person. This is used for relative pronouns (i.e., "that" vs. "who").
- `options.headNoun` *(NSymbol)*: The term sequence of type 'noun' for the category head.
- `[options.possSemantic]` *(Object[])*: The semantic that returns instances of this `Category` that the specified users own/possess.
- `[options.entities]` *((Object|string)[])*: The entities with which to create an associated entity category. Defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "JavaScript", "JS").

### `Category.prototype.addVerbRuleSet(options)`
Adds nonterminal rules to this `Category` that represent relationships characterized by an action, represented by a verb, between users and instances of this `Category`.

Adds the following rules for `options.catVerbSemantic`, which represent instances of this `Category` on which specified users perform this action:

	1. `[cat-passive]`    -> `[verb]` `[by-obj-users+]`           => (repos) liked by `[obj-users+]`
	2. `[cat-obj-filter]` -> `[nom-users+]` `[verb]`              => (repos) `[nom-users+]` like(s)
	3. `[cat-obj-filter]` -> `[nom-users+]` `[have]` `[verb]`     => (repos) `[nom-users+]` have/has liked
	4. `[cat-obj-filter]` -> `[nom-users+]` `[do-not]` `[verb]`   => (repos) `[nom-users+]` do/does not like
	5. `[cat-obj-filter]` -> `[nom-users+]` `[have-not]` `[verb]` => (repos) `[nom-users+]` have/has not liked

If `options.catVerbSemantic` has the property `forbidsMultipleIntersection` defined as `true`, then forbids conjunctions of user subjects (via `intersect()`) and restricts `options.catVerbSemantic` to disjunctions (i.e., only `union()`) with the following changes to the preceding rules:

	1.   `[obj-users+-disjunction]` replaces `[obj-users+]`
	2-5. `[nom-users+-disjunction]` replaces `[nom-users+]`

For use by semantics that represent a database object property that can only have one value. For example, `repositories-created()` can only have one value because a repository can only have one creator; i.e., no two people can create the same repository.

Adds the following rules for `options.userVerbSemantic`, which represent users that perform this action on specified instances of this `Category`:

	6. `[user-subj-filter]` -> `[verb]` `[cats+]`             => (people who) like `[repositories+]`
	7. `[user-subj-filter]` -> `[have]` `[verb]` `[cats+]`    => (people who) have liked `[repositories+]`
	8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`   => (people who) do not like `[repositories+]`
	9. `[user-subj-filter]` -> `[have-not] `[verb]` `[cats+]` => (people who) have not liked `[repositories+]`

If `options.acceptPastTenseIfInput` is `true`, the following present tense rules from above are also accepted as past tense if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. For use by verbs that represent actions that can be expressed in present or past tense without semantic differences:

	2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` like(s)/liked
	6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) like/liked `[repositories+]`

If `options.onlyPastTense` is `true`, all rules in this set will be in past tense. For use by verbs that represent actions that only occur in the past. The following rules from above will be different:

	2. `[cat-obj-filter]`   -> `[nom-users+]` `[verb]`            => (repos) `[nom-users+]` forked
	4. `[cat-obj-filter]`   -> `[nom-users+]` `[do-not]` `[verb]` => (repos) `[nom-users+]` did not fork
	6. `[user-subj-filter]` -> `[verb]` `[cats+]`                 => (people who) forked `[repositories+]`
	8. `[user-subj-filter]` -> `[do-not] `[verb]` `[cats+]`       => (people who) did not fork `[repositories+]`

If `options.noPresentPerfect` is `true`, omits all present perfect rules from the verb rule set: #3, #5, #7, and #9. For use by verbs that represent ongoing present actions or states, for which present perfect tense would express instances of this `Category` both in currently in this state/action or were previously but are no longer in this state/action. The latter is unlikely the user's intent. Further, there is no data for past occurrences of such actions or states. For example, prevents the following queries:

	3. Stop: "(people) `[nom-users+]` have/has followed"
	5. Stop: "(people) `[nom-users+]` have/has not followed"
	7. Stop: "(people who) have followed `[obj-users+]`"
	9. Stop: "(people who) have not followed `[obj-users+]`"

If `options.noPresentPerfectNegative` is `true`, omits only the present perfect negative rules #5 and #9 from the verb rule set. For use by verbs that represent past actions that can not reoccur for the same objects, which these rules would otherwise suggest. For example, prevents the following queries:

	5. Stop: "(repos) `[nom-users+-disjunction]` have/has not created"
	9. Stop: "(people who) have not created `[repositories+]`"

If `options.agentNoun` is provided, adds the following rules for `options.userVerbSemantic`, which uses an agent noun to represent users that perform this action on instances of this `Category`:

	10. `[user-head]` -> `[agent-noun]` `[prep]` `[cats+]` => likers of `[repositories+]`
	11. `[user-head]` -> `[cat]` `[agent-noun]`            => `{repository}` likers
	  • Only creates this rule if this `Category` has an associated entity category.

If `options.catDateSemantic` is provided, adds the following rule for the semantic, which represents instances of this `Category` for which the action occurred within a specified date range:

	12. `[cat-inner]` -> `[verb]` `[date]` => (repos) created `[date]`

`options.agentNounSemantic` must be defined with the property `isPeople` when created to enable the verb's use as an antecedent for anaphora. For example:

	• "(people who follow) people who like `[repositories+]` (and their followers)"
	• "(people who follow) `{repository}` likers (and their followers)"

#### Arguments
- `options` *(Object)*: The options object.
- `options.verbTerm` *(NSymbol)*: The symbol that produces the terminal rule set for the verb that represents this action, created by `g.newVerbSet()`.
- `[options.acceptPastTenseIfInput]` *(boolean)*: Specify accepting the past tense form of `options.verbTerm` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions.
- `[options.onlyPastTense]` *(boolean)*: Specify only using the past tense form of `options.verbTerm`.
- `[options.noPresentPerfect]` *(boolean)*: Specify omitting all present perfect rules (i.e., rules #3, #5, #7, and #9) from this verb rule set, which otherwise express both the current state and past occurrences of this action/state, the latter of which is unlikely the user's intent if this action represents an ongoing state.
- `[options.noPresentPerfectNegative]` *(boolean)*: Specify omitting present perfect negative rules #5 and #9 from this verb rule set, which otherwise suggest past occurrences of this action can reoccur for the same objects.
- `options.catVerbSemantic` *(Object[])*: The semantic that returns instances of this `Category` on which specified users perform this action.
- `[options.objectSym=this.plPlus]` *(NSymbol)*: The symbol for the object that receives this action and produces the semantic arguments for `options.userVerbSemantic`. If omitted, default to this `Category` instance's `this.plPlus` (i.e., `[cats+]`).
- `options.userVerbSemantic` *(Object[])*: The semantic that returns users who perform this action on specified instances of this `Category`.
- `[options.agentNoun]` *(Object)*: The agent-noun options object.
- `[options.agentNoun.agentNounTerm]` *(NSymbol)*: The term sequence of type 'noun' for the agent noun.
- `[options.agentNoun.prepTerm]` *(NSymbol)*: The term sequence of type 'invariable' that produces the terminal rules for the preposition that follows `options.agentNoun.agentNounTerm` in rule #10 of the second section of this method description, created by `g.newTermSequence()` with `type` 'invariable'.
- `[options.catDateSemantic]` *(Object[])*: The semantic that identifies instances of this `Category` for which this action occurred within a specified date range.

#### Returns
*(Category)*: Returns this `Category` instance.
