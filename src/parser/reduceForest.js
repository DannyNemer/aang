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
		if (parentRuleProps.insertedSemantic || ruleProps.insertedSemantic) return
		if (parentRuleProps.semantic && ruleProps.semantic) return
		if (parentRuleProps.personNumber) return
		if (parentRuleProps.verbForm || ruleProps.verbForm) return

		if (ruleProps.insertionIdx === 0 && parentRuleProps.insertionIdx === 0) return
		if (parentRuleProps.insertionIdx === 1 || ruleProps.insertionIdx === 1) return


		parentSub.node = sub.node
		var newRuleProps = parentSub.ruleProps = {
			cost: parentRuleProps.cost + ruleProps.cost,
			semantic: parentRuleProps.semantic || ruleProps.semantic
		}

		if (ruleProps.personNumber) {
			newRuleProps.personNumber = ruleProps.personNumber
		}

		var subText = ruleProps.text
		var parentText = parentRuleProps.text
		if (parentRuleProps.insertionIdx === 0) {
			if (subText) {
				newRuleProps.text = parentText.concat(subText)
			} else {
				newRuleProps.text = parentText
			}
		} else if (ruleProps.insertionIdx === 0) {
			if (parentText) {
				newRuleProps.text = subText.concat(parentText)
			} else {
				newRuleProps.text = subText
			}
		} else {
			var parentGramCase = parentRuleProps.gramCase
			if (parentGramCase && subText[parentGramCase]) {
				newRuleProps.text = subText[parentGramCase]
			} else {
				if (ruleProps.gramCase) newRuleProps.gramCase = ruleProps.gramCase
				newRuleProps.text = parentText || subText
			}
		}
	}
}