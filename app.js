/**
 * Module dependencies.
 */

var express = require('express')
  , app = module.exports = express.createServer()
  , sq3 = require('sqlite3').verbose()
  , db = new sq3.Database(__dirname + '/db')
  , io = require('socket.io').listen(app);

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('db', db);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  //app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function (req, res) {
  db.serialize(function () {
    //db.run()
    var types;
    db.all('SELECT type, COUNT(*) AS count FROM items WHERE v = ? GROUP BY type', [0], function (e, items) {
      types = { work : 0, todo : 0, idea : 0, none : 0, misc : 0, done : 0 };
      for (var i = 0; i < items.length; i++) {
        types[items[i].type] = items[i].count;
      }
    });
    db.all('SELECT * FROM items WHERE v = "1"', function (e, items) {
      for (var i = 0; i < items.length; i++) {
        var d = new Date(items[i].date * 1000);
        items[i].date = [d.getYear()+1900,d.getMonth()+1,d.getDate()].map(function (a) {
          return 2 > String(a).length ? '0' + String(a) : a
        }).join('.') + ' ' + [d.getHours(),d.getMinutes()].map(function (a) {
          return 2 > String(a).length ? '0' + String(a) : a;
        }).join(':');
      }
      res.render('index', {
        title: 'Express',
        items: items,
        types: types
      });
    });
  });
});

app.post('/create', function (req, res) {
  var d = new Date(req.body.date * 1000);
  req.body.date = [d.getYear()+1900,d.getMonth()+1,d.getDate()].map(function (a) {
    return 2 > String(a).length ? '0' + String(a) : a
  }).join('.') + ' ' + [d.getHours(),d.getMinutes()].map(function (a) {
    return 2 > String(a).length ? '0' + String(a) : a;
  }).join(':');
  res.render('index', {
    layout: false,
    items: [req.body]
  });
});

app.post('/types', function (req, res) {
  db.all('SELECT * FROM items WHERE type = ? AND v = ?', [req.body.type, 0], function (e, items) {
    res.render('index', {
      layout: false,
      items: items
    });
  });
});

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

// Socket.io
var lock = { on: [], ls : []};

io.sockets.on('connection', function (socket) {

  lock.ls.push(socket.store.id);

  socket.on('disconnect', function (e, sock) {
    lock.ls.splice(lock.ls.indexOf(socket.store.id), 1);
  });

  // Create Text

  socket.on('create', function (data) {
    db.serialize(function () {
      var stm = db.prepare('INSERT INTO items (text,type,date,v,x,y,z,w,h) VALUES (?,?,?,?,?,?,?,?,?)');
      stm.run(['empty', 'none', parseInt(new Date().getTime()/1000), 1, data.x, data.y, 60, 180, 160]);
      stm.finalize();
      db.each('SELECT * FROM items ORDER BY id DESC LIMIT 1', function (e, data) {
        io.sockets.emit('create', data);
      });
    });
  });

  socket.on('delete', function (data) {
    db.serialize(function () {
      var stm = db.prepare('DELETE FROM items WHERE id = ?');
      stm.run([data.id.substr(4)]);
      stm.finalize();
      io.sockets.emit('delete', data);
    });
  });


  // Edit Text

  socket.on('edit', function (data) {
    if (true == data.write) {
      var stm = db.prepare('UPDATE items SET text = ?, date = ? WHERE id = ?');
      stm.run(data.text, parseInt(new Date().getTime()/1000), data.id.substr(4));
      stm.finalize();
    }
    socket.broadcast.emit('edit', data);
  });

  // Change Z-INDEX

  socket.on('deep', function (data) {
    if (true == data.write) {
      var stm = db.prepare('UPDATE items SET z = ? WHERE id = ?');
      stm.run(data.z, data.id.substr(4));
      stm.finalize();
    }
    socket.broadcast.emit('deep', data);
  });

  // Change Size

  socket.on('size', function (data) {
    if (true == data.write) {
      var stm = db.prepare('UPDATE items SET w = ?, h = ? WHERE id = ?');
      stm.run(data.w, data.h, data.id.substr(4));
      stm.finalize();
    }
    socket.broadcast.emit('size', data);
  });

  // Moving Object

  socket.on('move', function (data) {
    if (true == data.write) {
      var stm = db.prepare('UPDATE items SET x = ?, y = ? WHERE id = ?');
      stm.run(data.x, data.y, data.id.substr(4));
      stm.finalize();
    }
    socket.broadcast.emit('move', data);
  });

  // Change Type of Object

  socket.on('type', function (data) {
    if (true == data.write) {
      var stm = db.prepare('UPDATE items SET type = ?, date = ? WHERE id = ?');
      stm.run(data.type, parseInt(new Date().getTime()/1000), data.id.substr(4));
      stm.finalize();
    }
    socket.broadcast.emit('type', data);
  });

  socket.on('drop', function (data) {
    var stm = db.prepare('UPDATE items SET v = ? WHERE id = ?');
    stm.run(data.v, data.id.substr(4));
    stm.finalize();
    io.sockets.emit('drop', data);
  });


  // While Moving, Restrict Others Drag.

  socket.on('lock', function (data) {
    if (data.lockdrag) {
      lock.on.push({ belong : socket.store.id, target : data.id });
    } else {
      for (var i = 0; i < lock.on.length; i++) {
        if (lock.on[i].target == data.id) {
          lock.on.splice(i, 1);
        }
      }
    }
    socket.broadcast.emit('lock', data);
  });

  for (var i = 0; i < lock.on.length; i++) {
    if (-1 < lock.ls.indexOf(lock.on[i].belong)) {
      socket.emit('lock', { id : lock.on[i].target, lockdrag : true });
    } else {
      io.sockets.emit('lock', { id : lock.on[i].target, lockdrag : false });
      lock.on.splice(i, 1);
    }
  }

});
