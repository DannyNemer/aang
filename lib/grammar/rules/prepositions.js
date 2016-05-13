var g = require('../grammar')


var prepSymNamePrefix = 'prep'

// (people followed) by (me)
exports.agent = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'agent'),
	insertionCost: 0.5,
	acceptedTerms: [ 'by' ],
	substitutedTerms: [
		{ term: 'from', costPenalty: 1 },
		{ term: 'via', costPenalty: 1 },
		{ term: 'of', costPenalty: 0.5 },
		// NOTE: Temporarily implement preposition substitutions until finalizing its design.
		{ costPenalty: 3, term: g.newTermSequence({
			symbolName: g.hyphenate(prepSymNamePrefix, 'agent', 'substitutions'),
			acceptedTerms: [ 'aboard', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'at', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'for', 'given', 'in', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'off', 'on', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'to', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'with', 'within', 'without', 'worth' ],
		}) },
	],
})

// (followers) of (mine)
exports.possessor = g.newSymbol(prepSymNamePrefix, 'possessor').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
	substitutions: [
		{ symbol: 'with', costPenalty: 1 },
		{ symbol: 'to', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|within|without|worth', costPenalty: 2 },
	],
})

// (likers) of (`[repositories+]`)
exports.participant = g.newSymbol(prepSymNamePrefix, 'participant').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
	substitutions: [
		{ symbol: 'at|for|in|with', costPenalty: 1 },
	],
})

// (contributors) to (`[repositories+]`)
exports.receiver = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'receiver'),
	insertionCost: 0.5,
	acceptedTerms: [ 'to', 'of' ],
})

// (people who work) on (`[repositories+]`)
exports.surface = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'surface'),
	insertionCost: 0.5,
	acceptedTerms: [ 'on' ],
})

// (followers {user} shares) with (me)
exports.associative = g.newSymbol(prepSymNamePrefix, 'associative').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [
		{ symbol: 'alongside|of|to', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|amid|amidst|among|amongst|around|aside|astride|at|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|for|from|given|in|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|on|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 3 },
	],
})

// (repos written) in ({language})
exports.language = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'language'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in' ],
	substitutedTerms: [
		{ term: 'with', costPenalty: 0.5 },
		{ term: 'using', costPenalty: 0.5 },
	],
})

// (repos created) in (`[year]`)
exports.container = g.newSymbol(prepSymNamePrefix, 'container').addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [
		{ symbol: 'on', costPenalty: 0.8 },
		{ symbol: 'from', costPenalty: 0.8 },
		{ symbol: 'of', costPenalty: 1 },
		{ symbol: 'inside |of', costPenalty: 1 },
		{ symbol: 'into', costPenalty: 1 },
		{ symbol: 'aboard|about|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|at|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|by|despite|down|except|excluding|failing|following|for|given|including|lest|like|minus|modulo|near|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|to|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|without|worth', costPenalty: 2 },
	],
})

// (repos created) on ([month] [day] `[year]`)
exports.day = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'day'),
	insertionCost: 0.5,
	acceptedTerms: [ 'on' ],
	substitutedTerms: [
		{ term: 'in', costPenalty: 0.5 },
		{ term: 'within', costPenalty: 0.5 },
		{ term: 'during', costPenalty: 0.5 },
	],
})

// (repos created) before (`[year]`)
exports.before = g.newSymbol(prepSymNamePrefix, 'before').addWord({
	insertionCost: 0.5,
	accepted: [ 'before', 'until', 'earlier than', 'prior|up to', '<' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created) after (`[year]`)
exports.after = g.newSymbol(prepSymNamePrefix, 'after').addWord({
	insertionCost: 1,
	accepted: [ 'after', 'since', 'later than', 'subsequent to', '>' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created) from (`[year]` to `[year]`)
exports.start = g.newSymbol(prepSymNamePrefix, 'start').addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [
		{ symbol: 'in', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (repos created from `[year]`) to (`[year]`)
// (issues with `<int>`) to (`<int>` comments)
exports.end = g.newSymbol(prepSymNamePrefix, 'end').addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues) with (`<int>` comments)
exports.possessed = g.newSymbol(prepSymNamePrefix, 'possessed').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [
		{ symbol: 'have', costPenalty: 1 },
		{ symbol: 'having', costPenalty: 1 },
		{ symbol: 'containing', costPenalty: 1 },
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) between (`<int>` and `<int>` comments)
exports.between = g.newSymbol(prepSymNamePrefix, 'between').addWord({
	insertionCost: 2,
	accepted: [ 'between' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|from|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) over (`<int>` comments)
exports.over = g.newSymbol(prepSymNamePrefix, 'over').addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above', 'beyond', 'greater|more than', '>' ],
	substitutions: [
		{ symbol: 'aboard|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|below|beneath|beside|besides|between|betwixt|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|under|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (issues with) under (`<int>` comments)
exports.under = g.newSymbol(prepSymNamePrefix, 'under').addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'fewer|less than', '<' ],
	substitutions: [
		{ symbol: 'aboard|above|absent|across|afore|after|against|along|alongside|amid|amidst|among|amongst|around|aside|astride|athwart|atop|barring|before|behind|beneath|beside|besides|between|betwixt|beyond|but|despite|down|during|except|excluding|failing|following|given|including|inside|into|lest|like|minus|modulo|near|next|notwithstanding|off|onto|opposite|out|outside|over|pace|past|per|plus|pro|qua|sans|save|since|than|through|thru|throughout|thruout|till|times|toward|towards|underneath|unlike|until|unto|up|upon|versus|vs|via|with|within|without|worth', costPenalty: 2 },
	],
})

// (companies that raised `<int>`) in (funding)
exports.medium = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'medium'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in', 'of' ],
})

// The benefactive case expresses the person/thing (i.e., the referent of the noun) that benefits from the action of the verb (or the situation expressed by the clause). E.g., "for", "for the benefit of", and "intended for".
// (people who work) at|for (`[company]`)
exports.benefactive = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'benefactive'),
	insertionCost: 0.5,
	acceptedTerms: [ 'at', 'for' ],
	substitutedTerms: [
		// NOTE: Temporarily implement preposition substitutions until finalizing its design.
		{ term: 'aboard', costPenalty: 3 },
		{ term: 'above', costPenalty: 3 },
		{ term: 'absent', costPenalty: 3 },
		{ term: 'across', costPenalty: 3 },
		{ term: 'afore', costPenalty: 3 },
		{ term: 'after', costPenalty: 3 },
		{ term: 'against', costPenalty: 3 },
		{ term: 'along', costPenalty: 3 },
		{ term: 'alongside', costPenalty: 3 },
		{ term: 'amid', costPenalty: 3 },
		{ term: 'amidst', costPenalty: 3 },
		{ term: 'among', costPenalty: 3 },
		{ term: 'amongst', costPenalty: 3 },
		{ term: 'around', costPenalty: 3 },
		{ term: 'aside', costPenalty: 3 },
		{ term: 'astride', costPenalty: 3 },
		{ term: 'athwart', costPenalty: 3 },
		{ term: 'atop', costPenalty: 3 },
		{ term: 'barring', costPenalty: 3 },
		{ term: 'before', costPenalty: 3 },
		{ term: 'behind', costPenalty: 3 },
		{ term: 'below', costPenalty: 3 },
		{ term: 'beneath', costPenalty: 3 },
		{ term: 'beside', costPenalty: 3 },
		{ term: 'besides', costPenalty: 3 },
		{ term: 'between', costPenalty: 3 },
		{ term: 'betwixt', costPenalty: 3 },
		{ term: 'beyond', costPenalty: 3 },
		{ term: 'but', costPenalty: 3 },
		{ term: 'despite', costPenalty: 3 },
		{ term: 'down', costPenalty: 3 },
		{ term: 'during', costPenalty: 3 },
		{ term: 'except', costPenalty: 3 },
		{ term: 'excluding', costPenalty: 3 },
		{ term: 'failing', costPenalty: 3 },
		{ term: 'following', costPenalty: 3 },
		{ term: 'from', costPenalty: 3 },
		{ term: 'given', costPenalty: 3 },
		{ term: 'including', costPenalty: 3 },
		{ term: 'inside', costPenalty: 3 },
		{ term: 'into', costPenalty: 3 },
		{ term: 'lest', costPenalty: 3 },
		{ term: 'like', costPenalty: 3 },
		{ term: 'minus', costPenalty: 3 },
		{ term: 'modulo', costPenalty: 3 },
		{ term: 'near', costPenalty: 3 },
		{ term: 'next', costPenalty: 3 },
		{ term: 'notwithstanding', costPenalty: 3 },
		{ term: 'off', costPenalty: 3 },
		{ term: 'onto', costPenalty: 3 },
		{ term: 'opposite', costPenalty: 3 },
		{ term: 'out', costPenalty: 3 },
		{ term: 'outside', costPenalty: 3 },
		{ term: 'over', costPenalty: 3 },
		{ term: 'pace', costPenalty: 3 },
		{ term: 'past', costPenalty: 3 },
		{ term: 'per', costPenalty: 3 },
		{ term: 'plus', costPenalty: 3 },
		{ term: 'pro', costPenalty: 3 },
		{ term: 'qua', costPenalty: 3 },
		{ term: 'sans', costPenalty: 3 },
		{ term: 'save', costPenalty: 3 },
		{ term: 'since', costPenalty: 3 },
		{ term: 'than', costPenalty: 3 },
		{ term: 'through', costPenalty: 3 },
		{ term: 'thru', costPenalty: 3 },
		{ term: 'throughout', costPenalty: 3 },
		{ term: 'thruout', costPenalty: 3 },
		{ term: 'till', costPenalty: 3 },
		{ term: 'times', costPenalty: 3 },
		{ term: 'toward', costPenalty: 3 },
		{ term: 'towards', costPenalty: 3 },
		{ term: 'under', costPenalty: 3 },
		{ term: 'underneath', costPenalty: 3 },
		{ term: 'unlike', costPenalty: 3 },
		{ term: 'until', costPenalty: 3 },
		{ term: 'unto', costPenalty: 3 },
		{ term: 'up', costPenalty: 3 },
		{ term: 'upon', costPenalty: 3 },
		{ term: 'versus', costPenalty: 3 },
		{ term: 'vs', costPenalty: 3 },
		{ term: 'via', costPenalty: 3 },
		{ term: 'with', costPenalty: 3 },
		{ term: 'within', costPenalty: 3 },
		{ term: 'without', costPenalty: 3 },
		{ term: 'worth', costPenalty: 3 },
	],
})

// (followers I and `{user}` have) in (common)
// (followers I have) in (common with `{user}`)
exports.in = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'in'),
	insertionCost: 0.5,
	acceptedTerms: [ 'in' ],
})

// (people who contribute) to (`[repositories+]`)
exports.to = g.newTermSequence({
	symbolName: g.hyphenate(prepSymNamePrefix, 'to'),
	insertionCost: 0.5,
	acceptedTerms: [ 'to' ],
})