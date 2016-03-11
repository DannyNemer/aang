var http = require('http')
var fs = require('fs')
var os = require('os')
var util = require('../util/util')

// Generate state table.
var parse = require('../parse/parseExported')

http.createServer(function (req, res) {
	if (req.method === 'GET' && req.url === '/') {
		// Serve page
		fs.readFile(__dirname + '/index.html', function (err, file) {
			res.end(err ? err + '\n' : file)
		})
	} else if (req.method === 'POST' && req.url === '/parse') {
		var data = ''
		req.on('data', function (chunk) {
			data += chunk
		})

		// Parse query
		req.on('end', function () {
			data = JSON.parse(data)

			var parseResults = parse(data.query, Number(data.k))
			res.end(JSON.stringify(parseResults))
		})
	} else {
		util.logError('Unrecognized request:', util.stylize(req.method + ' ' + req.url))
	}
}).listen(5000, function () {
	// Get address if server running locally (`true` expression) or hosted (latter).
	var netInterfaces = os.networkInterfaces()
	var address = netInterfaces.en0 ? netInterfaces.en0[1].address : netInterfaces.eth0[0].address

	util.log('Server listening at http://' + address + ':' + this.address().port)
})