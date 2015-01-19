'use strict';

var fs = require('fs');
var events = require('events');
var inherits = require('inherits');
var extend = require('extend');
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var watchify = require('watchify');
var uglifyify = require('uglifyify');
var envify = require('envify/custom');
var debug = require('debug')('bundler:js');

module.exports = Bundler;
inherits(Bundler, events.EventEmitter);

function Bundler( i, o, opts ){
	if (!(this instanceof Bundler))
		return new Bundler(i, o, opts);

	opts = opts || {};

	this.b = browserify(i, extend({
		// speedier rebuilds
		insertGlobals: (opts.watch && !opts.uglify),

		debug: !!opts.sourceMaps,
	}, opts.browserify, opts.watch && watchify.args));

	// replace or purge references to process.env
	this.b.transform(envify(extend({
		_: 'purge',
	}, opts.env)), { global: true });

	if (opts.uglify)
		this.b.transform(uglifyify, { global: true });

	this.o = o;

	mkdirp.sync(o);

	var script = o + '/' + (opts.scriptName || 'script') + '.js';
	var tmpScript = opts.tmp && script + '.part';

	this.bundle = function(){
		this.state = 'updating';
		this.emit('updating');

		this.b
			.bundle()
				.on('error', function( err ){
					console.error(String(err));
				})
				.on('end', end.bind(this))
				.pipe(fs.createWriteStream(tmpScript || script));

		return this;
	};

	if (opts.watch) {
		watchify(this.b, extend({ delay: 300 }, opts.watch))
			.on('update', this.bundle.bind(this))
			.on('bytes', setBytes.bind(this))
			.on('time', setTime.bind(this));
	}

	this.on('update', onUpdate.bind(this));

	function end(){
		if (tmpScript)
			fs.rename(tmpScript, script, function( err ){
				if (err)
					console.error(err);
				else
					this.emit('update');
			});
		else
			this.emit('update');
	}

	return this;
}

function onUpdate(){
	this.state = 'ready';

	if (this._bytes || this._time)
		debug('%d bytes written to %s (%d seconds)',
			this._bytes,
			this.o,
			this._time / 1000);
	else
		debug('bundle written to %s', this.o);
}

function setBytes( b ){ this._bytes = b; }
function setTime( t ){ this._time = t; }
