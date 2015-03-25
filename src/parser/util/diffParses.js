module.exports = function (parserOld, parserNew) {
	compCounters(parserOld, parserNew, 'addNodeCalls')
	compCounters(parserOld, parserNew, 'addSubCalls')


	var stackOld = stringifyStack(parserOld)
	var stackNew = stringifyStack(parserNew)

	diffArrays(stackOld, stackNew, 'stack missing')
	diffArrays(stackNew, stackOld, 'stack extra')
}

function compCounters(parserOld, parserNew, counterName) {
	if (parserOld[counterName] === parserNew[counterName]) {
		console.log(counterName + ':', parserNew[counterName])
	} else {
		console.log('Err:', addNodeCalls, '(want ' + parserOld[counterName] + ' ):', parserNew[counterName])
	}
}

function diffArrays(arrayA, arrayB, msg) {
	var diff = arrayA.filter(function (el) {
		return arrayB.indexOf(el) === -1
	})

	if (diff.length) {
		console.log(msg + ' (want ' + arrayA.length + '):', diff.length)
	} else {
		console.log(msg + ':', diff.length)
	}
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