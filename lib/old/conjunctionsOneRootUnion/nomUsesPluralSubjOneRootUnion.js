// Produces only plural subjects.
// Nearly identical rule structure to rules that `conjunctions.create()` defines, however, prevents `union()` with semantic arguments representing single users (and incorporates `[nom-pl-users+]` from above).
user.nomUsersPluralSubj = g.newSymbol(nomUsersPlural.name, 'subj')
// (followers) `[user-plural]` (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (repos created by my followers) followers they share like
user.nomUsersPluralSubj.addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	personNumber: 'pl',
	anaphoraPersonNumber: 'threePl',
})
// (followers) `[nom-users-plural]` and `[nom-users-plural]` [and `[nom-users-plural]` ...] (share)
user.nomUsersPluralSubj.addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
	personNumber: 'pl',
})

// Only permit semantic arguments in `union()` for multiple users; i.e., prevent "`{users}` or ``{user}``".
// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnion = g.newSymbol(user.nomUsersPluralSubj.name, 'no', 'union')
// (followers) my followers (or I and `{user}` share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ user.plural ],
})
// (repos created by my followers followers) they (or I and `{user}` share like)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	anaphoraPersonNumber: 'threePl',
})
// (followers) I and `{user}` (or `{user}` and `{user}` share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
})

// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnionOr = g.newBinaryRule({
	rhs: [ nomUsersPluralSubjNoUnion, conjunctions.union ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.intersectSemantic,
})

// When a conjunction subtree involves `union()`, there is one `union()` semantic at the root of the subtree, with instances of `intersect()` separating the arguments.
var nomUsersPluralSubjNoUnionSemantic = g.newSymbol(user.nomUsersPluralSubj.name, 'no', 'union', 'semantic')
nomUsersPluralSubjNoUnionSemantic.addRule({
	rhs: [ user.plural ],
	semantic: conjunctions.intersectSemantic,
}).addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	anaphoraPersonNumber: 'threePl',
}).addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
	semantic: conjunctions.intersectSemantic,
}).addRule({
	rhs: [ nomUsersPluralSubjNoUnionOr, nomUsersPluralSubjNoUnionSemantic ],
	noInsertionIndexes: [ 0, 1 ],
})

// (followers) `[nom-pl-users-subj]` [and `[nom-pl-users-subj]` ...] or `[nom-pl-users-subj+]` (share)
// (followers) I and `{user}` or `{user}` and `{user}` (share); (followers) my followers or people I follow (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ nomUsersPluralSubjNoUnionOr, nomUsersPluralSubjNoUnionSemantic ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.unionSemantic,
	personNumber: 'pl',
})