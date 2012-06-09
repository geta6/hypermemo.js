(function () {

  // jQuery Handleable

  var target, select, inipos = {};


  $.fn.handleable = function () {

    this.resizable({
      handles : 'se',
      start   : function (e) {
        sockets.lock(e.target, true);
      },
      resize  : function (e) {
        sockets.size(e.target, false);
      },
      stop    : function (e) {
        sockets.size(e.target, true );
        sockets.lock(e.target, false);
      }
    });

    var drag = false;

    this.draggable({
      handle : '.paper',
      start : function () {
        target = this;
        select = $('#area .ui-selected').length ? $('#area .ui-selected') : $(this);
        select.each(function (i) {
          if ($(this).hasClass('lockdrag')) {
            select.splice(i, 1);
          } else {
            inipos[i] = { t : this.offsetTop, l : this.offsetLeft };
            sockets.lock(this, true);
          }
        });
        inipos['main'] = { t : target.offsetTop, l : target.offsetLeft };
      },
      drag : function () {
        drag = true;
        select.each(function (i) {
          var x  = inipos[i].l + (target.offsetLeft - inipos['main'].l)
            , y  = inipos[i].t + (target.offsetTop  - inipos['main'].t);
          if (target != this) {
            this.style.left = x + 'px';
            this.style.top  = y + 'px';
          }
          sockets.move(this, false);
        });
      },
      stop : function (e, ui) {
        setTimeout(function () {
          drag = false;
        }, 120);
        var max = { x : window.innerWidth - 50, y : window.innerHeight - 50 };
        select.each(function (i) {
          var x   = inipos[i].l + (target.offsetLeft - inipos['main'].l)
            , y   = inipos[i].t + (target.offsetTop  - inipos['main'].t)
            , d   = false
            , dst = $('#stashbind').css('display')
            , min = { x : -1 * (this.clientWidth - 50), y : -1 * (this.clientHeight - 50) };
          if (x < min.x) { x = min.x; d = true; }
          if (max.x < x) { x = max.x; d = true; }
          if (y < min.y) { y = min.y; d = true; }
          if (max.y < y) { y = max.y; d = true; }
          this.style.left = x + 'px';
          this.style.top  = y + 'px';
          sockets.lock(this, false);
          if (d) {
            if ('none' == dst) {
              sockets.drop(this, true);
            } else {
              sockets.drop(this, false);
            }
          } else {
            sockets.move(this, true);
          }
        });
      }
    });

    return this;

  }


  // Socket.io

  var socket = io.connect('http://localhost');

  // SET
  var sockets = {
    lock : function (target, lock) {
      socket.emit('lock', { lockdrag : lock, id : target.id });
    },
    deep : function (target, write) {
      socket.emit('deep', { z : $(target).css('z-index'), id : target.id, write : write });
    },
    size : function (target, write) {
      socket.emit('size', { w : target.clientWidth, h : target.clientHeight, id : target.id, write : write });
    },
    move : function (target, write) {
      socket.emit('move', { x : target.offsetLeft, y : target.offsetTop, id : target.id, write : write });
    },
    edit : function (target, write) {
      socket.emit('edit', { text : $(target).find('span').text(), id : target.id, write : write });
    },
    drop : function (target, drop) {
      var v = drop ? 0 : 1;
      socket.emit('drop', { v : v, id : target.id });
    }
  }

  // GET
  socket.on('create', function (req) {
    $.ajax({
      url : '/create',
      type : 'POST',
      data : req,
      complete : function (res) {
        $('#area').append($(res.responseText).hide());
        $('#item' + req.id).fadeIn(120).handleable().trigger('mousedown');
      }
    });
  });

  socket.on('delete', function (data) {
    $('#' + data.id).fadeOut(120, function () {
      $(this).remove();
    });
  });

  socket.on('edit', function (data) {
    $('#' + data.id).find('span').text(data.text);
  });

  socket.on('move', function (data) {
    $('#' + data.id).css({ top : data.y + 'px', left : data.x + 'px' });
  });

  socket.on('size', function (data) {
    $('#' + data.id).css({ width  : data.w + 'px', height : data.h + 'px' });
  });

  socket.on('deep', function (data) {
    $('#' + data.id).css({ zIndex : data.z });
  });

  socket.on('type', function (data) {
    $('#' + data.id).attr({ 'x-type' : data.type });
  });

  socket.on('drop', function (data) {
    var rock = $('#' + data.id)
      , tick = $('#' + data.type).find('span')
      , tack = parseInt(tick.text())
    rock.remove();
    if (data.v) {
      $.ajax({
        url  : '/callee',
        type : 'POST',
        data : { id : data.id},
        complete : function (data) {
          tick.text(tack-1);
          $('#area').append($(data.responseText).handleable());
        }
      });
    } else {
      tick.text(tack+1);
    }
  });

  socket.on('lock', function (data) {
    var target = $('#' + data.id);
    if (data.lockdrag) {
      target.addClass('lockdrag');
    } else {
      target.removeClass('lockdrag');
    }
    target.draggable('option', 'disabled', data.lockdrag);
    target.resizable('option', 'disabled', data.lockdrag);
  });


  // Method Apply

  $('.paper').handleable();

  // Selectable

  var dblobj = null;
  $('#area').selectable({
    filter : '.paper',
    start : function () {
      $(window).trigger('comreturn');
    },
    stop   : function (e) {
      if (null != dblobj && e.target == dblobj) {
        socket.emit('create', { x : e.clientX, y : e.clientY });
      } else {
        dblobj = e.target;
        setTimeout(function () {
          dblobj = null;
        }, 360);
      }
    }
  });

  // TODO:dropimage
  var tmpcd;
  $(document).on({
    drop: function (e) {
      e.preventDefault();
      console.log(tmpcd, e, e.originalEvent.dataTransfer.files);
    },
    dragenter: function (e) {
      e.preventDefault();
      console.log('enter', e);
    },
    dragover: function (e) {
      e.preventDefault();
      console.log('over', e)
    },
    dragleave: function (e) {
      e.preventDefault();
      console.log('leave', e);
    },
    mousemove: function (e) {
      tmpcd = { x : e.pageX, y : e.pageY };
    }
  });


  // Fix zIndex

  $(document).on('mousedown', '.paper', function (e) {
    var maximum = 0;
    $('.paper').each(function () {
      var z = parseInt($(this).css('z-index'));
      if (maximum < z) maximum = z;
    });
    $(this).css({ zIndex : maximum + 1 });
    sockets.deep(this, true);
  });


  $(document).on('scroll', '.paper span', function (e) {
    console.log(e.target);
  });

  $(document).on('mouseover mousemove mouseout', '.paper, .paper div', function (e) {
    if ('mouseout' != e.type && candel) {
      $(this).find('.delbtn, .date').show();
    } else {
      $(this).find('.delbtn, .date').hide();
    }
  });

  $(document).on('click', '.delbtn', function (e) {
    var self = this.parentNode;
    if (self.parentNode.id == 'stashzone') {
      var tick = $('#' + $('#stashhead').text()).find('span')
        , tack = parseInt(tick.text());
      tick.text(tack - 1);
    }
    socket.emit('delete', { id : self.id });
  });


  // Change Types (Droppable)

  var last;
  $('#atrib .cell').droppable({
    tolerance : 'pointer',
    over      : function () {
      var type = this.id;
      this.style.opacity = 1;
      select.each(function () {
        this.setAttribute('x-type', type);
        socket.emit('type', { type : type, id : this.id, write: true });
      });
    },
    out       : function () {
      this.style.opacity = '.24';
    }
  });

  $('#atrib .cell').on('click', function (e) {
    var pick = $(this).css('background-color')
      , text = this.id
      , stash = { bind : $('#stashbind'), head : $('#stashhead'), zone : $('#stashzone') }
    stash.bind.fadeOut(240, function () {
      $.ajax({
        url  : '/types',
        type : 'POST',
        data : { type : text.toLowerCase() },
        beforeSend : function () {
          stash.zone.find('.paper').remove();
        },
        complete : function (data) {
          stash.zone.append($(data.responseText).handleable());
        }
      });
      stash.head.text(text);
      stash.bind.css({ backgroundColor: pick }).slideDown(240).on('click', function (e) {
        if (e.target.id == 'stashzone') {
          stash.bind.off('click').slideUp(240, function () {
            stash.head.text('');
          });
        }
      });
    });
  });

  $(document).on('dblclick', '.paper', function (e) {
    $(window).trigger('comreturn');
    var self = $(this);
    if (!self.hasClass('editing')) {
      self.addClass('editing');
      var span = self.find('span')
        , text = $('<textarea>').text(span.text());
      span.hide();
      self.append(text);
      text.focus();
      sockets.lock(self[0], true);
    }
  });

  $(window).on('comreturn', function () {
    var text = $('textarea');
    if (0 < text.size()) {
      var self = text.parent();
      self.removeClass('editing');
      var span = self.find('span');
      span.text(text.val());
      span.show();
      text.remove();
      sockets.lock(self[0], false);
      sockets.edit(self[0], true);
      $(':focus').blur();
    }
  });

  var candel = false, command = false;
  $(document).on('keydown keyup', function (e) {
    console.log(e.keyCode);
    if (91 == e.keyCode || 93 == e.keyCode || 224 == e.keyCode) {
      command = 'keydown' == e.type;
    }
    if (18 == e.keyCode) {
      candel  = 'keydown' == e.type;
    }
    if (command && 13 == e.keyCode) {
      $(window).trigger('comreturn');
    }
  });

}());
