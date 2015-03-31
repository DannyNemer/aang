// Confirm best-first search parser has identical output and function calls to breadth-first search (BFS) parser

module.exports = function (parserOld, parserNew) {
	compCounters(parserOld, parserNew, 'addNodeCalls')
	compCounters(parserOld, parserNew, 'addSubCalls')
	if (parserOld.testCounter) compCounters(parserOld, parserNew, 'testCounter')


	var stackOld = stringifyStack(parserOld)
	var stackNew = stringifyStack(parserNew)
	diffArrays(stackOld, stackNew, 'stack missing')
	diffArrays(stackNew, stackOld, 'stack extra')

	var forestOld = stringifyForest(parserOld.nodeTabs)
	var forestNew = stringifyForest(parserNew.nodeTabs)
	diffArrays(forestOld, forestNew, 'forest missing')
	diffArrays(forestNew, forestOld, 'forest extra')
}

function compCounters(parserOld, parserNew, counterName) {
	if (parserOld[counterName] === parserNew[counterName]) {
		// console.log(counterName + ':', parserNew[counterName])
	} else {
		console.log('Err:', counterName, '(want ' + parserOld[counterName] + '):', parserNew[counterName])
	}
}

function diffArrays(arrayA, arrayB, msg) {
	var diff = arrayA.filter(function (el) {
		return arrayB.indexOf(el) === -1
	})

	if (diff.length) {
		console.log('Err:', msg + ' (of ' + arrayA.length + '):', diff.length)
	} else {
		// console.log(msg + ':', diff.length)
	}
}

function stringifyForest(nodeTabs) {
	var forest = []

	nodeTabs.forEach(function (nodeTab) {
		nodeTab.forEach(function (node) {
			if (!node.sym.isLiteral && node.subs.length > 0) {
				var toPrint = stringifyNode(node)

				toPrint += node.subs[0].node.sym.isLiteral ? ':' : ' ='

				node.subs.forEach(function (sub, S) {
					forest.push(toPrint + stringifyNode(sub.node) + (sub.next ? stringifyNode(sub.next.node) : ''))
				})
			}
		})
	})

	return forest
}

function stringifyStack(parser) {
	var shifts = parser.stateTable.shifts

	var stack = []
	parser.vertTabs.forEach(function (vertTab) {
		vertTab.forEach(function (vertex) {
			vertex.zNodes.forEach(function (zNode) {
				var toPrint = 'v_' + vertex.start + '_' + shifts.indexOf(vertex.state) + ' <=\t'
				toPrint += ' [' + stringifyNode(zNode.node) + ' ] <='

				zNode.vertices.forEach(function (subVertex) {
					stack.push(toPrint + ' v_' + subVertex.start + '_' + shifts.indexOf(subVertex.state))
				})
			})
		})
	})

	return stack
}

function stringifyNode(node) {
	if (node.sym.isLiteral) {
		return ' \"' + node.sym.name + '\"'
	} else {
		return ' ' + node.sym.name + '_' + node.start + '_' + (node.start + node.size)
	}
}