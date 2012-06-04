var sqlite = require('sqlite3').verbose()
  , db = new sqlite.Database(__dirname + '/../db');

db.serialize(function () {
  db.run(['CREATE TABLE items (id  INTEGER  PRIMARY KEY  AUTOINCREMENT, v  INTEGER, date  DATETIME',
      'text  TEXT, type  TEXT, x  INTEGER, y  INTEGER, z  INTEGER, w  INTEGER, h  INTEGER)'].join(','));
  db.run('CREATE INDEX type ON items (type)');
  var stm = db.prepare('INSERT INTO items (text,type,date,v,x,y,z,w,h) VALUES (?,?,?,?,?,?,?,?,?)');
  stm.run([[
    'optで削除ボタン出現'
    , 'ダブルクリックで編集'
    , '⌘+Returnで保存'
    , '画面外ドロップでメインスタックから追放'
  ].join("\n"), 'misc', parseInt(new Date().getTime()/1000), 1, 120, 120, 60, 200, 180]);
  stm.finalize();
});

db.close();
