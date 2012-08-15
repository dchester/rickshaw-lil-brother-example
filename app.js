/**
 * Module dependencies.
 */

var express = require('express')
  , config = require('config')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || config.port);
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var aggregates = {};

var vivify = function() {

	var root = Array.prototype.shift.call(arguments);
	var init = Array.prototype.pop.call(arguments);

	for (var i = 0; i < arguments.length; i++) {

		var a = arguments[i];

		root[a] = root[a] || (i == arguments.length - 1 ? init : {});	
		root = root[a];
	};
};

var aggregate = function(options) { 

	var topic = options.topic;
	var event = options.event;

	var timestamp = new Date().getTime();
	var timeInterval = config.timeInterval;

	var segmentations = Object.keys(event);

	segmentations.forEach( function(segmentation) {

		vivify(aggregates,topic,'keys',segmentation,{});

		if (Object.keys(aggregates[topic].keys[segmentation]).length < config.keysThreshold) {

			vivify(aggregates,topic,'counts',segmentation,event[segmentation],0);
			vivify(aggregates,topic,'keys',segmentation,event[segmentation], true);

			aggregates[topic].counts[segmentation][event[segmentation]] += 1;
		}
	} );
}

var io = require('socket.io').listen(config.wsPort);

var zmq = require('zmq')
  , sock = zmq.socket('sub');

sock.connect(config.zmq);
sock.subscribe('');

sock.on('message', function(topic, msg) {

	var data = JSON.parse(msg.toString('utf8'));

	aggregate({
		topic: topic, 
		event: data, 
	});
});

var sockets = [];

setInterval(function() {

	sockets.forEach( function(s) {
		s.emit('data', aggregates);
	});

	aggregates = {};

}, config.timeInterval);


io.sockets.on('connection', function(io) {
	sockets.push(io);
});

