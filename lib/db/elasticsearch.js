var elasticsearch = require('elasticsearch')
var util = require('../util/util')
var grammarUtil = require('../grammar/grammarUtil')
var grammar = require('../grammar.json')

var client = new elasticsearch.Client({
	host: 'localhost:9200',
	// log: 'trace',
})

var indexName = 'aang'

client.ping({
  requestTimeout: 30000,
}).then(deleteExistingIndex, function (error) {
  util.logError('Elasticsearch cluster is down')
  process.exit(1)
})

function deleteExistingIndex() {
	client.indices.exists({
		index: indexName,
	}).then(function (indexExists) {
		if (indexExists) {
			client.indices.delete({
				index: indexName,
			}).then(function (body) {
				util.log('Deleted existing index:', util.stylize(indexName))
				createIndex()
			}, function (error) {
				util.logError('Failed to delete existing index:', util.stylize(indexName))
				util.log(error)
			})
		} else {
			createIndex()
		}
	}, function (error) {
		util.logError('Failed to check if index exists:', util.stylize(indexName))
		util.log(error)
	})
}

function createIndex() {
	client.indices.create({
		index: indexName,
	}).then(function (body) {
		util.log('Created index:', util.stylize(indexName))
		addTerminalSymbols()
		addEntities()
	}, function (error) {
		util.log(error)
	})
}

function addTerminalSymbols() {
	var terminalSymbols = getTerminalSymbols()
	terminalSymbols.sort().forEach(function (terminalSymbol, id) {
		client.index({
			index: indexName,
			type: 'terminal_symbol',
			id: id,
			body: {
				name: terminalSymbol,
			},
		})
	})
}

function addEntities() {
	var entities = getEntities()
	entities.forEach(function (entity) {
		client.index({
			index: indexName,
			type: entity.category,
			id: entity.id,
			body: {
				name: entity.text,
			},
		})
	})
}

function getTerminalSymbols() {
	var terminalSymbols = []
	grammarUtil.forEachRule(grammar.ruleSets, function (rule) {
		if (rule.isTerminal) {
			var terminalSymbol = rule.rhs[0]
			if (terminalSymbols.indexOf(terminalSymbol) === -1) {
				terminalSymbols.push(terminalSymbol)
			}
		}
	})
	return terminalSymbols
}

function getEntities() {
	var entities = []
	for (var entToken in grammar.entitySets) {
		grammar.entitySets[entToken].forEach(function (entity) {
			if (entities[entity.id] === undefined) {
				entities[entity.id] = entity
			}
		})
	}
	return entities
}