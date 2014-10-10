'use strict';

var http = require('http');
var herokuHttps = require('heroku-https');

// from express
var serveStatic = require('serve-static');
var finalhandler = require('finalhandler');

module.exports = BundleServer;

function BundleServer( bundler, opts, cb ){
	if (!(this instanceof BundleServer))
		throw Error('Use the new keyword');

	this.hostname = opts.hostname;
	this.herokuSecure = opts.herokuSecure;

	http
		.createServer(onRequest.bind(this))
		.listen(opts.listen || opts.port, cb);

	this.bundler = bundler;
	this.serveStatic = serveStatic(this.bundler.o);
}

function onRequest( req, res ){
	if (this.herokuSecure && herokuHttps(req, res, this.hostname))
		return;

	if (this.bundler.state !== 'ready') {
		var serveStatic = this.serveStatic.bind(this);

		this.bundler.once('update', function(){
			serveStatic(req, res, finalhandler(req, res));
		});
	} else {
		this.serveStatic(req, res, finalhandler(req, res));
	}
};
