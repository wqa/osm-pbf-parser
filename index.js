var zlib = require('zlib');
var parsers = require('./lib/parsers.js');
var varint = require('varint');
var Transform = require('readable-stream').Transform;
var inherits = require('inherits');

module.exports = Parser;
inherits(Parser, Transform);

var SIZE = 0, HEADER = 1, BLOB = 2;

function Parser () {
    if (!(this instanceof Parser)) return new Parser;
    Transform.call(this, { objectMode: true });
    this._mode = SIZE;
    this._waiting = 4;
    this._prev = null;
    this._header = null;
    this._osmheader = null;
    this._osmdata = null;
    this._blob = null;
    this._offset = 0;
    this._sizeOffset = null;
}

Parser.prototype._transform = function write (buf, enc, next) {
    var self = this;
    
    if (this._prev) {
        buf = Buffer.concat([ this._prev, buf ]);
        this._prev = null;
    }
    if (buf.length < this._waiting) {
        this._prev = buf;
        return next();
    }
    
    if (this._mode === SIZE) {
        this._sizeOffset = this._offset;
        var len = buf.readUInt32BE(0);
        mode = HEADER;
        this._offset += this._waiting;
        this._waiting = len;
        write.call(this, buf.slice(4), enc, next);
    }
    else if (mode === HEADER) {
        this._header = parsers.header.decode(buf.slice(0, this._waiting));
        this._mode = BLOB;
        var nbuf = buf.slice(this._waiting);
        this._offset += this._waiting;
        this._waiting = this._header.datasize;
        write.call(this, nbuf, enc, next);
    }
    else if (mode === 'blob') {
        this._blob = parsers.blob.decode(buf.slice(0, waiting));
        
        var h = this._header;
        var o = this._offset;
        zlib.inflate(this._blob.zlib_data, function (err, data) {
            if (err) self.emit('error', err);
            
            if (h.type === 'OSMHeader') {
                self._osmheader = parsers.osmheader.decode(data);
            }
            else if (h.type === 'OSMData') {
                self._osmdata = parsers.osmdata.decode(data);
                
                var group = parsers.primitiveGroup.decode(
                    self._osmdata.primitivegroup
                );
                var row = {};
                if (group.dense_nodes) {
                    var dense = parsers.dense.decode(group.dense_nodes);
                    row.points = parsePairs(dense.lat, dense.lon);
                    self.push(row);
                }
            }
        });
        
        this._mode = SIZE;
        var nbuf = buf.slice(this._waiting);
        this._offset += this._waiting;
        this._waiting = 4;
        write.call(this, nbuf, enc, next);
    }
}

function parsePairs (a, b) {
    var pairs = [];
    for (var i = 0; i < a.length;) {
        var x = varint.decode(dense.lat, i);
        var y = varint.decode(dense.lon, i);
        i += varint.decode.bytesRead;
        pairs.push([ x, y ]);
    }
    return pairs;
}