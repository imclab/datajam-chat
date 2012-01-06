/**
 * Single-file build of all Datajam Chat modules (excl. templates)
 * Include this in production code instead of the src
 */

// App.js Common modules
(function($, define, require){

  define('chat/common', [
    , 'js!chat/plugins/underscore_mixins.js'
    , 'js!chat/plugins/jquery.imagesloaded.js'
    , 'js!chat/plugins/jquery.scrollTo-1.4.2-min.js'
    , 'js!chat/plugins/moment.min.js'
    ]
  , function(){
      window.Datajam || (Datajam = {});
      Datajam.Chat = {
          Models: {}
        , Views: {}
        , Collections: {}
      };
      Datajam.Chat.csrf = {
          csrf_param: $('meta[name=csrf-param]').attr('content')
        , csrf_token: $('meta[name=csrf-token]').attr('content')
      };
      // ensure we have the real token
      $('document').bind('csrfloaded', function(){
        Datajam.Chat.csrf.csrf_token = $('meta[name=csrf-token]').attr('content');
      });
    });

  define('chat/upload', ['js!chat/plugins/jquery.form.js'], $.noop);

  define('chat/tweet', ['js!//platform.twitter.com/widgets.js'], $.noop);


// Collections
  define('chat/collections/message', ['chat/common'], function(){
    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Collections.Message = Backbone.Collection.extend({
          add: function(models, options){
            if(_.isArray(models)){
              $.each(models, _.bind(function(idx, model){
                model = this._clean(model);
                this.add_or_replace(model, options);
              }, this));
            }else{
              models = this._clean(models);
              this.add_or_replace(model, options);
            }
            return this;
          }
        , add_or_replace: function(model, options){
            var existing = this.get(model.id);
            if(!existing){
              this._add(model, options);
            }else if(model.updated_at > existing.get('updated_at')){
              existing.set(model)
            }
          }
        , comparator: function(obj){
            return Date.parse(obj.get('updated_at'));
          }
        , parse: function(resp, xhr) {
            var page = '/chats/' + resp.chat._id + '/pages/' + resp.page._id + '.json';
            // if we are on the oldest seen page, bump it back one;
            // otherwise if there's a newer page, set it forward.
            if(page == this._oldest_seen_page){
              this._oldest_seen_page = resp.page.prev_page;
            }else if(page == this._newest_seen_page){
              if(resp.page.next_page){
                this.url = resp.page.next_page;
                this._newest_seen_page = resp.page.next_page;
              }
            }
            // Separation of concerns (n). Not this.
            if(!resp.chat.is_open && !_.isEqual(resp.chat, this.view.model.toJSON())){
              this.view.model.set(resp.chat);
              this.view.pause();
            }
            return resp.page.messages;
          }
        , _clean: function(model) {
            model.id = model._id;
            delete model._id;
            return model;
          }
      });

  });

  define('chat/collections/moderator_message', ['chat/common'], function(){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Collections.ModeratorMessage = Backbone.Collection.extend({
          comparator: function(obj){
            return Date.parse(obj.get('updated_at'));
          }
        , parse: function(resp, xhr) {
            _(resp.messages).each(function(message, idx){
              resp.messages[idx].id = message._id;
              delete resp.messages[idx]['_id'];
            });
            return resp.messages;
          }
      });

  });


// Models
  define('chat/models/chat', ['chat/common'], function(){
    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Models.Chat = Backbone.Model.extend({
          defaults: {}
        , initialize: function(){}
        , parse: function(data){
            var model;
            data.chat.id = data.chat._id;
            delete data.chat._id;
            model = data.chat;
            try{
              model._newest_seen_page = '/chats/' + data.chat.id + '/pages/' + data.page._id + '.json';
              model._oldest_seen_page = data.page.prev_page || model._newest_seen_page;
            }catch(e){
              model._newest_seen_page = null;
              model._oldest_seen_page = null;
            }
            model._submit_url = this.url.replace('.json', '/messages.json');
            return model;
          }

      });
  });

  define('chat/models/message', ['chat/common'], function(){
    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Models.Message = Backbone.Model.extend({

      });

  });

  define('chat/models/moderator_chat', ['chat/common'], function(){
    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Models.ModeratorChat = Backbone.Model.extend({
          defaults: {}
        , initialize: function(){}
        , parse: function(data){
            var model;
            data.chat.id = data.chat._id;
            delete data.chat._id;
            model = data.chat;
            model._submit_url = this.url.replace('.json', '/messages/');
            return model;
          }

      });

  });


// Views
  define('chat/views/message', [
      'text!chat/templates/message/show.html'
    , 'chat/common'
    , 'chat/tweet'
    , 'js!chat/plugins/md5.js'
    , 'chat/models/message' ], function(showtmpl){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Views.Message = Backbone.View.extend({
          linkP: /https?:\/\/[\w\-\/#\.%\?=&:,|]+[\w\-\/#=&]/g
        , imageP: /\.(jpe?g|gif|png|bmp|tiff?)$/
        , events: {
              'click': 'handleClick'
          }
        , tagName: 'li'
        , className: 'message clearfix'
        , initialize: function(args){
            _.bindAll(this
                    , 'getLinks'
                    , 'getImages'
                    , 'handleClick'
                    , 'parentModel'
                    , 'parentView'
                    , 'render'
                    );

            this.model || (this.model = new App.Models.Message);
            this.model.bind('change', this.render);
          }
        , getLinks: function(){
            return this.model.get('text').match(this.linkP);
          }
        , getImages: function(){
            var links = this.getLinks();
            return _(links).filter(_.bind(function(link){
              return link.search(this.imageP);
            }, this));
          }
        , handleClick: function(evt){
            var parent_model = this.parentModel();
            if(parent_model && parent_model.get('is_admin') && $(this.el).parents('.datajamChatAdmin').length){
              evt.preventDefault();
              var text = prompt("Enter the new text", this.model.get('text'));
              if(text && text != this.model.get('text')){
                this.model.url = this._url();
                this.model.set({text: text});
                this.model.save();
              }
            }
          }
        , parentModel: function(){
            return (this.parentView() && this.parentView().model) || null;
          }
        , parentView: function(){
            // gets the chat that this message belongs to
            return $(this.el).parents('.datajamChatThread').data('chat') || null;
          }
        , render: function(){
            var data = this.model.toJSON()
              , parent_model = this.parentModel();
            data.text = _(data.text).chain()
              .striptags()
              .linkify(this.linkP)
              .imgify(this.imageP)
              .spaceify()
              .linebreaks()
              .value()
            // set up the container element because replacing it is too painful
            $(this.el).attr('id', 'message_' + data.id)
                      .attr('data-timestamp', data.updated_at);
            if(parent_model && parent_model.get('is_admin')) $(this.el).addClass('sunlight');
            $(this.el).html(_.template(showtmpl, data));
            this.delegateEvents();
            return this;
          }
        , _imgify: function(text){
            var html = $('<div>' + text + '</div>')
              , imageP = this.imageP;
            html.find('a').each(function(){
              if($(this).text().search(imageP) > -1){
                $(this).html('<img src="' + $(this).html() + '" />');
              }
            });
            return html.html();
          }
        , _linebreaks: function(text){
            return text.replace(/\n/g, '<br>');
          }
        , _linkify: function(text){
            var text = text.replace(this.linkP, function(match,offset){return match.link(match)});
            return text.replace('<a ', '<a target="_blank" ');
          }
        , _spaceify: function(text){
            return text.replace(/(\s)\s/g, '$1&nbsp;')
          }
        , _strip_tags: function(text){
            return $('<div>' + text + '</div>').text();
          }
        , _url: function(){
            return this.parentModel().url.replace(/\.json*/, '/messages/' + this.model.id + '.json');
          }
      });

  });

  define('chat/views/chat', [
      'text!chat/templates/chat/show.html'
    , 'text!chat/templates/chat/closed.html'
    , 'text!chat/templates/chat/error.html'
    , 'text!chat/templates/chat/identity.html'
    , 'text!chat/templates/common/flash.html'
    , 'text!chat/templates/message/new.html'
    , 'chat/common'
    , 'chat/upload'
    , 'chat/models/chat'
    , 'chat/models/message'
    , 'chat/views/message'
    , 'chat/collections/message' ], function(showtmpl, closedtmpl, errortmpl, identitytmpl, flashtmpl, newmessagetmpl){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Views.Chat = Backbone.View.extend({
          events: {
              "submit form[name=new_message]": "submit"
            , "submit form[name=identify]": "identify"
            , "blur textarea": "handleBlur"
            , "click .destroyIdentity": "destroyIdentity"
            , "click .attachFile": "uploadDialog"
            , "change #chat_asset": "uploadFile"
            , "focus textarea": "handleFocus"
            , "keydown textarea": "handleKeyDown"
            , "chatWindow:scroll": "handleScroll"
          }
        , initialize: function(){
            //scope class methods
            _.bindAll(this, 'addMessage'
                          , 'destroy'
                          , 'destroyIdentity'
                          , 'disableSubmit'
                          , 'enableSubmit'
                          , 'error'
                          , 'handleBlur'
                          , 'handleFocus'
                          , 'handleKeyDown'
                          , 'handleScroll'
                          , 'identify'
                          , 'loading'
                          , 'loaded'
                          , 'pause'
                          , 'pollForContent'
                          , 'pollForOpenness'
                          , 'prevPage'
                          , 'render'
                          , 'resume'
                          , 'submit'
                          , 'uploadDialog'
                          , 'uploadFile'
                          );
            this.loading();

            this.el.data('chat', this);
            this.model = new App.Models.Chat;
            this.model.url = this.el.attr('data-url');
            this.model.set({interval: this.el.attr('data-interval'), _scroll_anchored: true});
            this.model.bind('change', this.render);

            // get identity if available
            $.ajax({
              'url': '/chats/identity.json',
              'dataType': 'json'
            }).success(_.bind(function(data){
              if (data.display_name){
                this.model.set({
                    'display_name': data.display_name
                  , 'is_admin': data.is_admin
                });
              }
            }, this));

            this.pollForOpenness();

          }
        , addMessage: function(model){
            var clipper = this.el.find('.commentsClip')
              , scroller = clipper.find('.comments')
              , items = scroller.find('li')
              , message = new App.Views.Message({
                     model: model
                });

            // make sure the polling timeout is something sane
            this.model.set({interval:this.el.attr('data-interval')}, {'slient': true});

            // append in order
            if(items.length && this.collection.indexOf(model) < items.length){
              items.eq(this.collection.indexOf(model)).before(message.render().el)
            }else{
              scroller.append(message.render().el);
            }

            // fire a scroll message if the window is too short to scroll
            if(scroller.height() < clipper.height()) clipper.trigger('scroll');

            // scroll to bottom of window if we are anchored
            if(this.model.get('_scroll_anchored')){
              scroller.find('img').imagesLoaded(_.bind(function(){
                clipper.stop().scrollTo('100%', 100, 'swing');
              }, this));
            }else if(this.anchor){
              scroller.find('img').imagesLoaded(_.bind(function(){
                clipper.stop().scrollTo(this.anchor, _.bind(function(){
                  this.anchor = null;
                }, this));
              }, this));
            }
          }
        , destroy: function(){
            this.pause();
            this.el.html('');
          }
        , destroyIdentity: function(evt){
            evt.preventDefault();
            if(this.model.get('display_name')){
              $.ajax({
                  url: '/chats/identity.json'
                , type: 'post'
                , dataType: 'json'
                , data: {display_name: this.model.get('display_name'), _method: 'delete'}
              });
            }
            this.model.set({'display_name': null});
          }
        , disableSubmit: function(){
            this.el.find('form').addClass('disabled');
          }
        , enableSubmit: function(){
            this.el.find('form').removeClass('disabled');
          }
        , error: function(){
            this.el.html(_.template(errortmpl, {}));
          }
        , flash: function(data){
            var msg = $(_.template(flashtmpl, data));
            this.el.find('form').eq(0).prepend(msg);
            msg.hide()
               .fadeIn()
               .delay(4000)
               .fadeOut(function(){$(this).remove()});
          }
        , handleBlur: function(evt){
            this._focusTimeout = setTimeout(_.bind(function(){
              this.model.set({'_keep_focus': false}, {'silent': true})
              }, this), 1500);
          }
        , handleFocus: function(evt){
            if(this._focusTimeout){
              clearTimeout(this._focusTimeout);
            }
            this.model.set({'_keep_focus': true}, {'silent': true});
          }
        , handleKeyDown: function(evt){
            switch(evt.keyCode){
              case 13:
                if(! evt.altKey){
                  this.submit(evt);
                }
              break;
              default:
              break;
            }
          }
        , handleScroll: function(evt){
            var clipper, scroller;
            clipper = this.el.find('div.commentsClip');
            scroller = clipper.find('.comments');
            // anchor if user scrolls to the bottom of the range
            if(clipper.height() + clipper.scrollTop() >= scroller.height()){
              this.model.set({'_scroll_anchored': true}, {'silent': true});
            }else{
              this.model.set({'_scroll_anchored': false}, {'silent': true});
            }
            // page back if user scrolls to the top of the range
            if(clipper.scrollTop() == 0){
              this.loading();
              this.anchor = scroller.find('li:first');
              $.when(this.prevPage()).then(this.loaded());
            }
          }
        , identify: function(evt){
            evt.preventDefault();
            evt.stopPropagation();
            var display_name = $('input[name=display_name]').val();
            if(display_name){
              $.ajax({
                  url: '/chats/identity.json'
                , type: 'post'
                , dataType: 'json'
                , data: {
                      display_name: display_name
                  }
              }).success(_.bind(function(data){
                if(data.errors){
                  this.flash({type:'error', message:data.errors.join("<br/>")});
                }else if(data.display_name){
                  this.model.set({'display_name':data.display_name, '_keep_focus': true});
                }
              }, this)
              ).error(_.bind(function(data){
                this.flash({type:'error', message:'There was an error identifying you, please try again.'});
              }, this));
            }
          }
        , loading: function(){
            this.el.addClass('loading');
          }
        , loaded: function(){
            this.el.removeClass('loading');
          }
        , pause: function(){
            this.model.set({'paused': true}, {'silent': true});
          }
        , pollForContent: function(){
            if(this._timeout){
              clearTimeout(this._timeout);
              this._timeout = null;
            }
            this.collection.fetch($.extend({'add':true}, this.model.get('ajaxOptions')))
            // trigger scroll if we opened to a blank page
            if(!this.el.children('ul.comments > li').length){
              this.el.children('.commentsClip').trigger('scroll');
            }
            if(!this.model.get('paused')){
              this._timeout = setTimeout(this.pollForContent, this.model.get('interval'));
            }
          }
        , pollForOpenness: function(){
            if(this._timeout){
              clearTimeout(this._timeout);
              this._timeout = null;
            }
            this.model.fetch()
              .success(_.bind(function(model){
                if(model.chat.is_open || model.chat.is_archived){ //there will be a page in the api response
                  this.collection = new App.Collections.Message;
                  this.collection.view = this;
                  this.collection.bind('add', this.addMessage);
                  this.collection.url = this.model.url.replace('.json', '/pages/' + model.page._id + '.json');
                  this.collection._newest_seen_page = this.collection.url;
                  this.collection._oldest_seen_page = model.page.prev_page;
                  this.collection.ajaxOptions = model.ajaxOptions;
                  this.pollForContent();
                  if(model.chat.is_archived){
                    this.pause();
                  }
                }else{
                  this.render();
                  this._timeout = setTimeout(this.pollForOpenness, this.model.get('interval'))
                }
              }, this))
              .error(this.error)
              .complete(this.loaded);
          }
        , prevPage: function(){
            if(this.collection._oldest_seen_page){
              var dfd = $.Deferred();
              this.collection.fetch($.extend({
                    'add':true
                  , 'url': this.collection._oldest_seen_page
                }
                , this.model.get('ajaxOptions')));
              return dfd.promise();
            }else{
              return true;
            }
          }
        , render: function(){
            var data = _(this.model.toJSON()).extend(App.csrf)
              , html = _.template(showtmpl)
              , closedmessage = _.template(closedtmpl)
              , identityform = _.template(identitytmpl)
              , submitform = _.template(newmessagetmpl)

            // if the model doesn't have an id, skip for now
            if(!data.id) return this;

            // if the model is closed, render the closed message
            if(!data.is_open && !data.is_archived){
              this.el.html(closedmessage);
              return this;
            }

            // only redraw the thread if we aren't identified...
            if(! this.el.children().not('.closed').length){
              this.el.html('');

              this.el.append(html(data));
              // use jquery to synthesize scroll events, triggering an event
              // on an element via backbone builtin handler requires the event to bubble
              this.el.find('.commentsClip').scroll(_.bind(function(){
                this.el.trigger('chatWindow:scroll');
              }, this));
            }
            // draw the correct form, if needed
            this.el.find('form, .archived').remove();
            if(data.is_open){
              if(this.model.get('display_name')){
                this.el.append(submitform(data));
              }else{
                this.el.append(identityform(data))
              }
            }
            if(data.is_archived){
              this.el.append('<p class="archived">This is an archived event, comments are closed.</p>');
            }
            // focus if focus is sticky
            if(this.model.get('_keep_focus')){
              this.el.find('textarea, input[type=text]').focus();
            }
            this.delegateEvents();
            return this;
          }
        , resume: function(){
            this.model.set({'paused': false}, {'silent': true});
            this.pollForContent();
          }
        , submit: function(evt){
            evt.preventDefault();
            evt.stopPropagation();
            if(this.el.find('form').eq(0).hasClass('disabled')){
              return;
            }
            var text;
            text = this.el.find('textarea').val();
            if(text){
              this.disableSubmit();
              message = new App.Models.Message({text: text});
              message.url = this.model.get('_submit_url');
              message.save(null, {
                  dataType: 'json'
                , success: _.bind(function(data){
                    this.el.find('textarea').val('');
                    if(!data.is_public){
                      this.flash({type: 'info', message: 'Your message is awaiting moderation.'});
                    }else{
                      // fast-poll 'til the message comes back down
                      this.model.set({interval:500}, {'slient': true});
                    }
                    this.pollForContent();
                  }, this)
                , error: _.bind(function(model, xhr){
                    var errors;
                    if((errors = JSON.parse(xhr.responseText).errors) && errors.text){
                      this.flash({type: 'error', message: 'Text ' + errors.text[0]});
                    }else{
                      this.flash({type: 'error', message: 'There was a problem posting your message.'});
                    }
                  }, this)
                , complete: this.enableSubmit
              });
            }
          }
        , uploadDialog: function(evt){
            evt.preventDefault();
            $($(evt.target).attr('href')).trigger('click');
          }
        , uploadFile: function(evt){
            if($(evt.target).val()){
              $(evt.target).parents('form')
                .ajaxSubmit({
                    dataType: 'json'
                  , success: _.bind(function(response){
                      // iframe transport w/ jquery.form doesn't seem to be aware of status codes.
                      // so, we check for a url attribute to know if it worked.
                      if(response && response.url){
                        var textarea = $(evt.target).parents('.inputArea').find('textarea');
                        textarea.val(textarea.val() + location.protocol + '//' + location.host + response.url);
                        $(evt.target).val('');
                        textarea.focus();
                      }else{
                        this.flash({type:'error', message:'Upload failed. Accepted file types are png, jpg, gif.'});
                      }
                    }, this)
                });
            };
          }
      });
  });

  define('chat/views/chat_controls', [
      'text!chat/templates/chat/controls.html'
    , 'chat/common'
    , 'chat/models/chat' ], function(controlstmpl){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Views.ChatControls = Backbone.View.extend({
          events: {
              "change select": "submit"
          }
        , initialize: function(){
            _.bindAll(this, 'submit'
                          , 'render'
                          );
            this.el.data('chat-controls', this);
            this.statuses = [
                {is_open: false, is_archived: false}
              , {is_open: true, is_archived: false}
              , {is_open: false, is_archived: true}
            ]
            var modal = this.el.parents('.modal')
              , areaId = modal.attr('id').replace('modal-', '');
            try{
              this.model = $('#chat_area_' + areaId).data('chat').model;
            }catch(e){
              return;
            }
          }
        , render: function(){
            this.el.html(controlstmpl);
            var status = {
                    is_open: this.model.get('is_open')
                  , is_archived: this.model.get('is_archived')
                }
              , val = null;
            _(this.statuses).each(function(obj, idx, statuses){
              if(_.isEqual(obj, status)){
                val = idx + 1;
              }
            }, this);
            val && this.el.find('select').val(val);
            return this;
          }
        , submit: function(){
            var select = this.el.find('select')
              , idx = (select.length) ? (select.first().val()) : null;
            idx && this.model.save(this.statuses[idx-1], {data: this.statuses[idx-1]});
          }
      });
  });

  define('chat/views/incoming_message', [
      'text!chat/templates/message/incoming.html'
    , 'chat/common'
    , 'chat/views/message'
    , 'chat/models/message' ], function(showtmpl){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Views.IncomingMessage = App.Views.Message.extend({
          events: {
              "click .approve": "approve"
            , "click .reject": "reject"
          }
        , initialize: function(args){
            _.bindAll(this
                    , 'approve'
                    , 'empty'
                    , 'getImages'
                    , 'getLinks'
                    , 'loading'
                    , 'parentModel'
                    , 'parentView'
                    , 'reject'
                    , 'render'
                    , '_url');

            this.model || (this.model = new App.Models.Message);
            this.model.bind('change', this.render);
          }
        , approve: function(evt){
            evt.preventDefault();
            this.loading();
            this.model.url = this._url();
            this.model.set({is_moderated:true, is_public: true}, {silent: true});
            this.model.save()
              .success(_.bind(function(){
                $('#' + $(this.el).attr('id')).remove();
              }, this))
              .error(function(){
                alert('There was an error approving this message.');
              });

          }
        , empty: function(){
            $(this.el).html('');
          }
        , loading: function(){
            $(this.el).addClass('loading');
          }
        , reject: function(evt){
            evt.preventDefault();
            this.loading();
            this.model.url = this._url();
            this.model.set({is_moderated:true, is_public: false}, {silent: true});
            this.model.save()
              .success(_.bind(function(){
                $('#' + $(this.el).attr('id')).remove();
              }, this))
              .error(function(){
                alert('There was an error rejecting this message.');
              });
          }
        , render: function(){
            var data = this.model.toJSON()
              , parent_model = this.parentModel();
            data.text = this._strip_tags(data.text);
            data.text = this._linkify(data.text);
            data.text = this._imgify(data.text);
            data.text = this._spaceify(data.text);
            data.text = this._linebreaks(data.text);
            // set up the container element because replacing it is too painful
            $(this.el).attr('id', 'message_' + data.id)
                      .attr('data-timestamp', data.updated_at);
            if(parent_model && parent_model.get('is_admin')) $(this.el).addClass('sunlight');
            $(this.el).html(_.template(showtmpl, data));
            this.delegateEvents();
            return this;
          }
      });

  });

  define('chat/views/rejected_message', [
      'text!chat/templates/message/rejected.html'
    , 'chat/common'
    , 'chat/views/message'
    , 'chat/models/message' ], function(showtmpl){

    var $ = jQuery
      , App = Datajam.Chat
      ;

      App.Views.RejectedMessage = App.Views.Message.extend({
          className: 'message rejected'
        , events: {
              "click .approve": "approve"
            , "click .deleteAttachments": "deleteAttachments"
          }
        , initialize: function(args){
            _.bindAll(this
                    , 'approve'
                    , 'deleteAttachments'
                    , 'empty'
                    , 'getImages'
                    , 'getLinks'
                    , 'loading'
                    , 'parentModel'
                    , 'parentView'
                    , 'render'
                    , '_url');

            this.model || (this.model = new App.Models.Message);
            this.model.bind('change', this.render);
          }
        , approve: function(evt){
            evt.preventDefault();
            this.loading();
            this.model.url = this._url();
            this.model.set({is_moderated:true, is_public: true}, {silent: true});
            this.model.save()
              .success(_.bind(function(){
                $('#' + $(this.el).attr('id')).remove();
              }, this))
              .error(function(){
                alert('There was an error approving this message.');
              });

          }
        , deleteAttachments: function(evt){
            evt.preventDefault();
            var urls = this.getImages()
              , filenames = []
            _(urls).each(function(url, idx){
              filenames.push(_.last(url.split('/')));
            });
            filenames = _(filenames).compact();
            if(filenames.length){
              $.ajax({
                  url: '/chats/upload.json'
                , type: 'POST'
                , dataType: 'json'
                , data: {
                      _method: 'delete'
                    , filenames: filenames
                  }
                , success: _.bind(function(response){
                    if(response){
                      var text = this.model.get('text');
                      _(urls).each(function(url, idx){
                        text = text.replace(url, '');
                      });
                      this.model.url = this._url();
                      this.model.set({text: text});
                      this.model.save();
                    }
                  }, this)
              });
            }
          }
        , empty: function(){
            $(this.el).html('');
          }
        , loading: function(){
            $(this.el).addClass('loading');
          }
        , render: function(){
            var data = this.model.toJSON()
              , parent_model = this.parentModel();
            data.text = this._strip_tags(data.text);
            data.text = this._linkify(data.text);
            data.text = this._imgify(data.text);
            data.text = this._spaceify(data.text);
            data.text = this._linebreaks(data.text);
            // set up the container element because replacing it is too painful
            $(this.el).attr('id', 'message_' + data.id)
                      .attr('data-timestamp', data.updated_at);
            if(parent_model && parent_model.get('is_admin')) $(this.el).addClass('sunlight');
            $(this.el).html(_.template(showtmpl, data));
            this.delegateEvents();
            return this;
          }
      });

  });

  define('chat/views/moderator_chat', [
      'text!chat/templates/chat/show.html'
    , 'text!chat/templates/chat/closed.html'
    , 'text!chat/templates/chat/error.html'
    , 'text!chat/templates/common/flash.html'
    , 'chat/common'
    , 'chat/models/moderator_chat'
    , 'chat/models/message'
    , 'chat/views/incoming_message'
    , 'chat/views/rejected_message'
    , 'chat/collections/moderator_message' ], function(showtmpl, closedtmpl, errortmpl, flashtmpl){

    var $ = jQuery
      , App = Datajam.Chat
      , message_klasses = {
            'incoming': App.Views.IncomingMessage
          , 'rejected': App.Views.RejectedMessage
        }
      ;

      App.Views.ModeratorChat = Backbone.View.extend({
          events: {

          }
        , initialize: function(){
            //scope class methods
            _.bindAll(this, 'destroy'
                          , 'error'
                          , 'loading'
                          , 'loaded'
                          , 'pause'
                          , 'poll'
                          , 'render'
                          , 'renderCollection'
                          , 'resume'
                          , 'updateTopbarBadge'
                          );

            this.loading();

            this.el.data('chat', this);

            this.model = new App.Models.ModeratorChat;
            this.model.url = this.el.attr('data-url');
            this.model.set({interval: this.el.attr('data-interval')
                          , _scroll_anchored: true
                          });
            this.model.bind('change', this.render);

            this.collection  = new App.Collections.ModeratorMessage;
            this.collection.url = this.model.url.replace('.json', '/messages.json') + '?status=' + this.el.attr('data-status');
            this.collection.view = this;
            this.collection.bind('reset', this.renderCollection);

            // total hack to keep from zombie-ing collection views
            this.views = {};

            // reverse sort for rejected queue
            if(this.el.attr('data-status') == 'rejected'){
              _.extend(this.collection, {
                comparator: function(obj){
                  return Date.parse(obj.get('updated_at')) * -1; // reverse chron
                }
              });
            }

            this.model.fetch()
              .success(_.bind(function(model){
                this.collection.ajaxOptions = _.extend({}, model.ajaxOptions, {});
                this.model.set({name: _(this.el.attr('data-status')).capitalize()});
                this.poll();
              }, this))
              .error(this.error)
              .complete(this.loaded);

          }
        , destroy: function(){
            this.pause();
            this.el.html('');
          }
        , error: function(){
            this.el.html(_.template(errortmpl, {}));
          }
        , loading: function(){
            this.el.addClass('loading');
          }
        , loaded: function(){
            this.el.removeClass('loading');
          }
        , pause: function(){
            this.model.set({'paused': true}, {'silent': true});
          }
        , poll: function(){
            if(this._timeout){
              clearTimeout(this._timeout);
              this._timeout = null;
            }
            if(!this.model.get('paused')){
              this.collection.fetch();
              this._timeout = setTimeout(this.poll, this.model.get('interval'));
            }
          }
        , render: function(){
            var data = this.model.toJSON()
              , html = _.template(showtmpl)

            $(this.el).html(html(data));
            return this;
          }
        , renderCollection: function(){
            var scroller = this.el.find('.commentsClip')
              , content = scroller.find('.comments');

            content.empty();
            this.collection.each(_.bind(function(model, idx){
              var message = this.views[model.id];
              if(!message){
                message = new message_klasses[this.el.attr('data-status')]({ model: model });
                this.views[model.id] = message;
              }
              content.append(message.render().el);
            }, this));
            this.updateTopbarBadge();
          }
        , resume: function(){
            this.model.set({'paused': false}, {'silent': true});
            this.poll();
          }
        , updateTopbarBadge: function(){
            if(!this.collection.url.match('incoming')) return;

            var parentDoc = $(window.parent.document)
              , modal = parentDoc.find('.chat-modal[data-chat-id=' + this.model.get('id') + ']');
            if(!modal.length) return;

            var navLink = parentDoc.find('.nav a[data-controls-modal=' + modal.attr('id') + ']').eq(0)
              , badge = navLink.find('.badge')
              , count = $(this.el).find('li').length;
            if(!badge.length){
              badge = navLink.append('<span class="badge"></span>').find('.badge');
            }
            badge.html(count);
            if(count == 0){
              badge.hide();
            }else{
              badge.show();
            }
          }
      });
  });

// App.js - bootstrap
  require(['chat/common', 'chat/views/chat'], function(){

    // Emulate HTTP via _method param
    Backbone.emulateHTTP = true;
    Backbone.emulateJSON = true;

    $(function(){
      var App = Datajam.Chat;
      $('.datajamChatThread').not('.moderator').each(function(){
        new App.Views.Chat({ el: $(this) });
      });
      $('.datajamChatThread.moderator').each(function(){
        require(['chat/views/moderator_chat'], _.bind(function(){
          new App.Views.ModeratorChat({ el: $(this) });
        }, this));
      });
    });

  });


})(jQuery, curl.define, curl);