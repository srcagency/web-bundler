'use strict';

var fs = require('fs');
var events = require('events');
var inherits = require('inherits');
var extend = require('extend');
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var watchify = require('watchify');
var uglifyify = require('uglifyify');
var debug = require('debug')('Bundler');

module.exports = Bundler;
inherits(Bundler, events.EventEmitter);

function Bundler( i, o, opts ){
	if (!(this instanceof Bundler))
		throw Error('Use the new keyword');

	opts = opts || {};

	this.b = browserify(i, extend({
		insertGlobals: opts.dev,
	}, opts.browserify, watchify.args));

	if (!opts.dev && opts.uglify !== false)
		this.b.transform(uglifyify, { global: true });

	this.o = o;

	mkdirp.sync(o);

	var script = o + '/' + (opts.scriptName || 'script') + '.js';
	var tmpScript = opts.tmp && script + '.part';

	// https://github.com/substack/watchify/blob/master/bin/cmd.js

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

	this.live = function( watchifyOpts ){
		if (this._watching)
			return;

		watchify(this.b, extend({ delay: 300 }, watchifyOpts))
			.on('update', this.bundle.bind(this))
			.on('bytes', setBytes.bind(this))
			.on('time', setTime.bind(this));

		this._watching = true;

		function setBytes( b ){ this._bytes = b; }
		function setTime( t ){ this._time = t }

		return this;
	};

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
		debug('%d bytes written to %s (%d seconds)', this._bytes, this.o, this._time / 1000);
	else
		debug('bundle written to %s', this.o);
}
