'use strict';

var http = require('http');

// from express
var serveStatic = require('serve-static');
var finalhandler = require('finalhandler');

module.exports = BundleServer;

function BundleServer( bundler, listen, cb ){
	if (!(this instanceof BundleServer))
		throw Error('Use the new keyword');

	http
		.createServer(onRequest.bind(this))
		.listen(listen, cb);

	this.bundler = bundler;
	this.serveStatic = serveStatic(this.bundler.o);
}

function onRequest( req, res ){
	if (this.bundler.state !== 'ready') {
		var serveStatic = this.serveStatic.bind(this);

		this.bundler.once('update', function(){
			serveStatic(req, res, finalhandler(req, res));
		});
	} else {
		this.serveStatic(req, res, finalhandler(req, res));
	}
};
