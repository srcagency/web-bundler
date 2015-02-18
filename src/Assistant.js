'use strict';

var exec = require('child_process').exec;
var events = require('events');
var path = require('path');
var open = require('open');
var inherits = require('inherits');
var findParentDir = require('find-parent-dir');
var debug = require('debug')('Assistant');

var Bundler = require('./Bundler');
var BundleServer = require('./BundleServer');

module.exports = Assistant;

inherits(Assistant, events.EventEmitter);

function Assistant( opts ){
	if (!(this instanceof Assistant))
		throw Error('Use the new keyword');

	this.appDir = findParentDir.sync(opts.i || opts.o || path.dirname(require.main.filename), 'package.json');

	this.i = opts.i || path.join(this.appDir, 'src');
	this.o = opts.o || path.join(this.appDir, 'build');

	opts.dev = opts.dev || opts.dev !== false;

	this.bundler = new Bundler(this.i, this.o, {
		dev: opts.dev,
		uglify: !opts.dev,
	})
		.on('update', buildReady.bind(this))
		.on('updating', building.bind(this));

	this.app = path.join(this.o, 'index.html');

	this.once('ready', function(){
		debug('ready at ' + this.app);
	});

	debug('bundling from %s to %s', this.i, this.o);
}

Assistant.prototype.build = function(){
	this.bundler.bundle();
	return this;
};

Assistant.prototype.live = function(){
	if (this.isLive)
		return;

	this.bundler.live();
	this.isLive = true;

	process.stdin.setEncoding('utf8');

	if (process.stdin.setRawMode)
		process.stdin.setRawMode(true);

	process.stdin.on('readable', readStdin.bind(this));

	return this;
};

Assistant.prototype.server = function( opts ){
	if (this.bundleServer)
		return;

	opts = opts || {};

	opts.port = opts.port || process.env.PORT || 8030;

	this.app = 'http://localhost:' + opts.port;

	this.isServerReady = false;
	this.bundleServer = new BundleServer(this.bundler, opts, serverReady.bind(this));

	return this;
};

Assistant.prototype.test = function(){
	debug('running "npm test"');
	return cmd('npm test', { cwd: this.appDir });
};

Assistant.prototype.edit = function(){
	debug('opening your default editor');
	return cmd(process.env.EDITOR + ' ' + assistant.appDir);
};

function cmd( cmd, opts ){
	exec(cmd, opts, function( err, stdout, stderr ){
		if (err)
			return console.error(err);

		process.stdout.write(stdout);
		process.stdout.write(stderr);
	});

	return this;
}

Assistant.prototype.open = function(){
	debug('opening app');

	if (this.state === 'ready')
		open(this.app);
	else
		this.once('ready', _open.bind(this));

	return this;
};

function _open(){
	open(this.app);
}

function serverReady(){
	this.isServerReady = true;
	checkState.call(this);
}

function building(){
	this.isBuildReady = false;
	checkState.call(this);
}

function buildReady(){
	this.isBuildReady = true;
	checkState.call(this);
}

function checkState(){
	if (this.isBuildReady && (this.isServerReady || !this.bundleServer)) {
		if (this.state === 'updating')
			this.emit('update');

		if (this.state !== 'ready')
			this.emit(this.state = 'ready');
	} else {
		this.emit(this.state = 'updating');
	}
}

function readStdin( chunk ){
	chunk = chunk || process.stdin.read();

	switch (chunk) {
		case 'o':
			this.open();
			break;

		case 'b':
			this.build();
			break;

		case 't':
			this.test();
			break;

		case 'e':
			this.edit();
			debug('editing');
			break;

		case 'q':
			process.exit();
			break;
		case '\u0003':	// Ctrl + C
			process.exit();
			break;
	}
}
