// Might be able to be accomplished in search.js, but here we are proving accuracy and performance improvements

var semantic = require('../grammar/Semantic')
var util = require('../util')

module.exports = function (startNode) {
	for (var s = 0, subs = startNode.subs, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]
		clean(sub, sub.node.subs)
	}
}

function clean(parentSub, subs) {
	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		var childSubs = sub.node.subs
		if (childSubs) clean(sub, childSubs)

		var subNext = sub.next
		if (subNext) {
			var nextChildSubs = sub.next.node.subs
			if (nextChildSubs) clean(sub, nextChildSubs)
		}
	}

	if (subsLen === 1) {
		if (parentSub.next || sub.next) return

		var parentRuleProps = parentSub.ruleProps
		var ruleProps = sub.ruleProps

		if (Array.isArray(parentRuleProps) || Array.isArray(ruleProps)) return

		if (parentRuleProps.gramCase || ruleProps.gramCase) return
		if (parentRuleProps.personNumber || ruleProps.personNumber) return
		if (parentRuleProps.verbForm || ruleProps.verbForm) return
		if (parentRuleProps.insertedSemantic || ruleProps.insertedSemantic) return
		if (parentRuleProps.insertionIdx !== undefined || ruleProps.insertionIdx !== undefined) return
		if (parentRuleProps.semantic && ruleProps.semantic) return


		var newRuleProps = {
			cost: parentRuleProps.cost + ruleProps.cost,
			semantic: parentRuleProps.semantic || ruleProps.semantic
		}

		if (parentRuleProps.insertionIdx !== undefined || ruleProps.insertionIdx !== undefined) {
			// only time both can have text
			// where two semantics
		}

		// if (parentSub.next) {
		// 	console.log(parentSub)
		// 	console.log(sub)
		// }


		newRuleProps.text = parentRuleProps.text || ruleProps.text
		parentSub.ruleProps = newRuleProps
		parentSub.node = sub.node

		// if (parentSub.next) {
		// 	console.log(parentSub)
		// 	console.log()
		// }
	}
}