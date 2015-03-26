module.exports = BinaryHeap

// Binary min heap
function BinaryHeap() {
	this.content = []
}

BinaryHeap.prototype.push = function (element) {
	// Add the new element to the end of the array
	this.content.push(element)

	// Allow it to upHeap
	this.upHeap(this.content.length - 1)
}

BinaryHeap.prototype.pop = function () {
	// Store the first element so we can return it later
	var result = this.content[0]

	// Get the element at the end of the array
	var end = this.content.pop()

	// If there are any elements left, put the end element at the start, and downHeap
	if (this.content.length > 0) {
		this.content[0] = end
		this.downHeap(0)
	}

	return result
}

BinaryHeap.prototype.size = function () {
	return this.content.length
}

BinaryHeap.prototype.upHeap = function (nodeIndex) {
	// Fetch the element that has to be moved
	var element = this.content[nodeIndex]
	var score = element.cost

	// When at 0, an element can not go up any further
	while (nodeIndex > 0) {
		// Compute the parent element's index, and fetch it
		var parentN = Math.floor((nodeIndex + 1) / 2) - 1
		var parent = this.content[parentN]

		// If the parent has a lesser score, things are in order and we are done
		if (score >= parent.cost) break

		// Otherwise, swap the parent with the current element and continue
		this.content[parentN] = element
		this.content[nodeIndex] = parent
		nodeIndex = parentN
	}
}

BinaryHeap.prototype.downHeap = function (nodeIndex) {
	// Look up the target element and its score
	var length = this.content.length
	var element = this.content[nodeIndex]
	var elemScore = element.cost

	while (true) {
		// Compute the indices of the child elements
		var child2N = (nodeIndex + 1) * 2
		var child1N = child2N - 1

		// This is used to store the new position of the element, if any
		var swap = null

		// If the first child exists (is inside the array)...
		if (child1N < length) {
			// Look it up and compute its score
			var child1 = this.content[child1N]
			var child1Score = child1.cost

			// If the score is less than our element's, we need to swap
			if (child1Score < elemScore) swap = child1N
		}

		// Do the same checks for the other child
		if (child2N < length) {
			var child2 = this.content[child2N]
			var child2Score = child2.cost

			if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N
		}

		// No need to swap further, we are done
		if (swap === null) break

		// Otherwise, swap and continue
		this.content[nodeIndex] = this.content[swap]
		this.content[swap] = element
		nodeIndex = swap
	}
}