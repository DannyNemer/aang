/**
 * Initializes the entities in the grammar for parsing by replacing multiple instances of the same entity in `entitySets` with references to the same object. I.e., this is only applicate to multi-token entities where there are multiple maps to the same entity. This enables equality checks by object reference instead of checking their `id` properties.
 *
 * @param {Object} entitySets The map of tokens to entities.
 */
module.exports = function (entitySets) {
	// The entities in the grammar.
	var entityTab = []

	// Initializes the entities by replacing multiple instances of the same entity in `entitySets` with references to the same object.
	for (var entToken in entitySets) {
		var entities = entitySets[entToken]

		for (var e = 0, entitiesLen = entities.length; e < entitiesLen; ++e) {
			var entity = entities[e]
			var entityId = entity.id

			entities[e] = entityTab[entityId] || (entityTab[entityId] = entity)
		}
	}
}