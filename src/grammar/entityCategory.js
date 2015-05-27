var util = require('../util')

exports.entityCategories = {}
var entityCount = 0

// Schema for an entity category
var entityCategoryOptsSchema = {
	name: String,
	entities: { type: Array, arrayType: String }
}

// Create a new entity category containing the passed entities
exports.newEntityCategory = function (opts) {
	if (util.illFormedOpts(entityCategoryOptsSchema, opts)) {
		throw 'ill-formed entity category'
	}

	var categoryName = '{' + opts.name + '}'

	if (exports.entityCategories.hasOwnProperty(categoryName)) {
		util.printErrWithLine('Duplicate entity category', categoryName)
		throw 'duplicate entity category'
	}

	exports.entityCategories[categoryName] = opts.entities.map(function (entity) {
		return {
			name: entity,
			// Save id as String for semantic arguments ordering
			id: String(entityCount++)
		}
	})

	return categoryName
}