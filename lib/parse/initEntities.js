var util = require('../util/util')


/**
 * Initializes the entities in the grammar for parsing by replacing multiple instances of the same entity in `entitySets` with references to the same object. This is only applicable to multi-token entities, for which multiple tokens map to the same entity. Enables equality checks by object reference instead of their `id` properties.
 *
 * @param {Object} entitySets The map of tokens to entities.
 */
module.exports = function (entitySets) {
	// The sets of entity objects for each entity in the grammar. Each set contains objects with unique `tokens` (which is matched to input) for the same entity (i.e., same `id` and `display` text).
	var entityTab = []

	// Initialize the entities by replacing multiple instances of the same entity object in `entitySets` with references to the same object.
	for (var entToken in entitySets) {
		var entities = entitySets[entToken]

		for (var e = 0, entitiesLen = entities.length; e < entitiesLen; ++e) {
			var entity = entities[e]
			var entityId = entity.id

			var existingEntities = entityTab[entityId]
			if (existingEntities) {
				// Check for the entity object (with the same `tokens`) for this entity (`id`).
				var entityTokens = entity.tokens
				for (var i = 0, existingEntitiesLen = existingEntities.length; i < existingEntitiesLen; ++i) {
					var existingEntity = existingEntities[i]

					if (util.arraysEqual(existingEntity.tokens, entityTokens)) {
						entities[e] = existingEntity
						break
					}
				}

				// Add new entity object for `entityId`.
				if (i === existingEntitiesLen) {
					existingEntities.push(entity)
				}
			} else {
				entityTab[entityId] = [ entity ]
			}
		}
	}
}