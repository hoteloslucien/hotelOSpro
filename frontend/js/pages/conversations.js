/* Hotel OS — Conversations V2 (WhatsApp-style: direct + groups) */
var ConversationsPage = {
  _convId: null,
  _convs: [],
  _msgs: [],
  _users: [],
  _view: 'list', // list, chat, group_info
  _pollTimer: null,

  async render() {
    var el = document.getElementById('page-content'); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      this._users = await Api.users().catch(function(){ return []; });
      this._convs = await Api.conversations();
      if (this._convId && this._view === 'chat') { await this._renderChat(); }
      else if (this._convId && this._view === 'group_info') { await this._renderGroupInfo(); }
      else { this._renderList(); }
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ── LIST ───────────────────────────────────────────────────────
  _renderList: function() {
    var el = document.getElementById('page-content');
    var me = App.currentUser;
    var isManager = me && (me.role === 'responsable' || me.role === 'direction' || me.role === 'gouvernante');

    var h = '<div class="page-header"><div><div class="page-h1">Messages</div><div class="page-sub">' + this._convs.length + ' conversation' + (this._convs.length > 1 ? 's' : '') + '</div></div>' +
      '<div style="display:flex;gap:8px">';
    if (isManager) {
      h += '<button class="btn btn-secondary btn-sm" id="new-group-btn">👥 Groupe</button>';
    }
    h += '<button class="btn btn-primary btn-sm" id="new-conv-btn">+ Nouveau</button></div></div>';

    h += '<div class="activity-list">';
    if (this._convs.length === 0) {
      h += Utils.emptyState('💬', 'Aucune conversation');
    } else {
      for (var i = 0; i < this._convs.length; i++) {
        var c = this._convs[i];
        var name = c.name || c.other_user_name || 'Conversation';
        var isGroup = c.type === 'group';
        var ini = isGroup ? '👥' : name.split(' ').map(function(n){return n[0]}).join('').toUpperCase().slice(0,2);
        var time = c.last_message_at ? Utils.timeAgo(c.last_message_at) : '';
        var preview = c.last_message || 'Aucun message';
        var unread = c.unread_count || 0;

        h += '<div class="activity-item conv-item" data-conv-id="' + c.id + '">' +
          '<div class="activity-avatar" style="background:linear-gradient(135deg,' + (isGroup ? 'var(--teal),#0d9488' : 'var(--navy),var(--navy-mid)') + ');color:#fff;font-weight:800;font-size:' + (isGroup ? '16px' : '12px') + '">' + ini + '</div>' +
          '<div class="activity-body"><div class="activity-title"' + (unread > 0 ? ' style="font-weight:800"' : '') + '>' + name +
          (isGroup ? ' <span style="font-size:10px;color:var(--text-3);font-weight:400">' + c.participant_count + ' membres</span>' : '') +
          '</div>' +
          '<div class="activity-subtitle">' + preview + '</div></div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
          '<div class="activity-time">' + time + '</div>' +
          (unread > 0 ? '<span class="badge badge-red-soft" style="min-width:20px;text-align:center">' + unread + '</span>' : '') +
          '</div></div>';
      }
    }
    h += '</div>';
    el.innerHTML = h;

    var self = this;
    el.querySelectorAll('[data-conv-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        self._convId = parseInt(item.dataset.convId);
        self._view = 'chat';
        self.render();
      });
    });

    var btn = document.getElementById('new-conv-btn');
    if (btn) btn.addEventListener('click', function() { self._showNewConv(); });

    var groupBtn = document.getElementById('new-group-btn');
    if (groupBtn) groupBtn.addEventListener('click', function() { self._showNewGroup(); });

    this._startListPolling();
  },

  // ── NEW DIRECT CONV ────────────────────────────────────────────
  _showNewConv: function() {
    var me = App.currentUser;
    var others = this._users.filter(function(u) { return u.id !== me.id && u.is_active; });
    var opts = others.map(function(u) {
      return '<div class="list-item" data-new-conv-user="' + u.id + '" style="cursor:pointer">' +
        '<div class="list-item-icon" style="background:rgba(15,29,53,.06);font-size:14px;font-weight:700;color:var(--navy)">' + u.name[0].toUpperCase() + '</div>' +
        '<div class="list-item-body"><div class="list-item-title">' + u.name + '</div>' +
        '<div class="list-item-sub">' + Utils.label(u.role) + (u.service ? ' · ' + Utils.label(u.service) : '') + '</div></div></div>';
    }).join('');
    Modal.open('Nouvelle conversation', '<div class="section-label">Choisir un contact</div>' + opts, '');
    var self = this;
    document.querySelectorAll('[data-new-conv-user]').forEach(function(item) {
      item.addEventListener('click', async function() {
        Modal.close();
        try {
          var conv = await Api.createDirectConv(parseInt(item.dataset.newConvUser));
          self._convId = conv.id;
          self._view = 'chat';
          self._convs = await Api.conversations();
          self.render();
        } catch(e) { Toast.error(e.message); }
      });
    });
  },

  // ── NEW GROUP ──────────────────────────────────────────────────
  _showNewGroup: function() {
    var me = App.currentUser;
    var others = this._users.filter(function(u) { return u.id !== me.id && u.is_active; });
    var checks = others.map(function(u) {
      return '<label class="group-check-item" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer">' +
        '<input type="checkbox" value="' + u.id + '" class="group-user-check" style="width:18px;height:18px;accent-color:var(--navy)" />' +
        '<div><div style="font-weight:600;font-size:14px">' + u.name + '</div>' +
        '<div style="font-size:12px;color:var(--text-3)">' + Utils.label(u.role) + (u.service ? ' · ' + Utils.label(u.service) : '') + '</div></div></label>';
    }).join('');

    var body = '<div class="form-group"><label>Nom du groupe</label>' +
      '<input type="text" id="group-name-input" placeholder="Ex: Technique, Housekeeping..." /></div>' +
      '<div class="section-label">Sélectionner les membres</div>' +
      '<div style="max-height:300px;overflow-y:auto">' + checks + '</div>';

    Modal.open('Créer un groupe', body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>' +
      '<button class="btn btn-primary" id="group-create-btn">Créer</button>'
    );

    var self = this;
    document.getElementById('group-create-btn').addEventListener('click', async function() {
      var name = document.getElementById('group-name-input').value.trim();
      if (!name) { Toast.error('Nom du groupe requis'); return; }
      var ids = [];
      document.querySelectorAll('.group-user-check:checked').forEach(function(c) {
        ids.push(parseInt(c.value));
      });
      if (ids.length === 0) { Toast.error('Sélectionnez au moins un membre'); return; }
      try {
        var conv = await Api.createGroupConv({ name: name, participant_ids: ids });
        Modal.close();
        Toast.success('Groupe créé');
        self._convId = conv.id;
        self._view = 'chat';
        self._convs = await Api.conversations();
        self.render();
      } catch(e) { Toast.error(e.message); }
    });
  },

  // ── CHAT ───────────────────────────────────────────────────────
  async _renderChat() {
    var el = document.getElementById('page-content'); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      this._msgs = await Api.convMessages(this._convId);
      await Api.markConvRead(this._convId).catch(function(){});
      App._updateUnreadBadge();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; return; }

    var conv = this._convs.find(function(c) { return c.id === this._convId; }.bind(this));
    var name = conv ? (conv.name || conv.other_user_name || 'Conversation') : 'Conversation';
    var isGroup = conv && conv.type === 'group';
    var me = App.currentUser;

    var h = '<div style="margin-bottom:6px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
      '<button class="btn btn-sm btn-secondary" id="conv-back" style="margin-bottom:8px">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour</button>';

    if (isGroup) {
      h += '<button class="btn btn-sm btn-secondary" id="conv-info-btn" style="margin-bottom:8px">👥 Infos</button>';
    }
    h += '</div>';
    h += '<div class="page-h1" style="font-size:20px">' + (isGroup ? '👥 ' : '') + name + '</div>';
    if (isGroup && conv) {
      h += '<div style="font-size:12px;color:var(--text-3);margin-top:2px">' + conv.participant_count + ' membres</div>';
    }
    h += '</div>';

    h += '<div id="conv-thread" style="margin-bottom:80px;overflow-y:auto;max-height:calc(100dvh - 240px)">';
    for (var i = 0; i < this._msgs.length; i++) {
      var m = this._msgs[i];
      var mine = m.sender_id === me.id;
      var sn = m.sender_name || 'Utilisateur';
      if (!mine) h += '<div class="msg-meta" style="text-align:left">' + sn.split(' ')[0] + ' · ' + Utils.timeAgo(m.created_at) + '</div>';
      h += '<div class="msg-bubble ' + (mine ? 'mine' : 'other') + '">' + this._esc(m.body) + '</div>';
      if (mine) h += '<div class="msg-meta" style="text-align:right">' + Utils.timeAgo(m.created_at) + '</div>';
    }
    if (this._msgs.length === 0) h += '<div style="text-align:center;padding:40px;color:var(--text-3)">Commencez la conversation</div>';
    h += '</div>';

    h += '<div style="position:fixed;bottom:calc(var(--bnav-h)+8px);left:12px;right:12px;' +
      'background:#fff;border:1px solid var(--border-mid);border-radius:16px;padding:8px 12px;' +
      'display:flex;gap:8px;align-items:center;z-index:80;box-shadow:var(--shadow-md)">' +
      '<input type="text" id="conv-input" placeholder="Votre message..." ' +
      'style="flex:1;border:none;background:transparent;font-size:14px;font-family:var(--font);outline:none;padding:8px 0" />' +
      '<button class="btn btn-primary btn-sm" id="conv-send" style="padding:10px 16px">Envoyer</button></div>';

    el.innerHTML = h;

    var self = this;
    document.getElementById('conv-back').addEventListener('click', function() { self._convId = null; self._view = 'list'; self._stopPolling(); self.render(); });
    document.getElementById('conv-send').addEventListener('click', function() { self._send(); });
    document.getElementById('conv-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') self._send(); });

    var infoBtn = document.getElementById('conv-info-btn');
    if (infoBtn) infoBtn.addEventListener('click', function() { self._view = 'group_info'; self.render(); });

    requestAnimationFrame(function() {
      var thread = document.getElementById('conv-thread');
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
    this._startChatPolling();
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  async _send() {
    var input = document.getElementById('conv-input');
    var body = (input.value || '').trim();
    if (!body) return;
    input.value = '';
    var sendBtn = document.getElementById('conv-send');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }
    try {
      await Api.sendConvMessage(this._convId, {body: body});
      // Reload messages from server to get correct IDs and avoid duplicates
      this._msgs = await Api.convMessages(this._convId);
      this._rebuildThread();
    } catch(e) {
      Toast.error(e.message);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Envoyer'; }
    }
  },

  // Rebuild just the thread messages without re-rendering the entire page
  _rebuildThread: function() {
    var thread = document.getElementById('conv-thread');
    if (!thread) { this._renderChat(); return; }
    var me = App.currentUser;
    var h = '';
    for (var i = 0; i < this._msgs.length; i++) {
      var m = this._msgs[i];
      var mine = m.sender_id === me.id;
      var sn = m.sender_name || 'Utilisateur';
      if (!mine) h += '<div class="msg-meta" style="text-align:left">' + sn.split(' ')[0] + ' · ' + Utils.timeAgo(m.created_at) + '</div>';
      h += '<div class="msg-bubble ' + (mine ? 'mine' : 'other') + '">' + this._esc(m.body) + '</div>';
      if (mine) h += '<div class="msg-meta" style="text-align:right">' + Utils.timeAgo(m.created_at) + '</div>';
    }
    if (this._msgs.length === 0) h = '<div style="text-align:center;padding:40px;color:var(--text-3)">Commencez la conversation</div>';
    thread.innerHTML = h;
    // Scroll thread to bottom
    requestAnimationFrame(function() { thread.scrollTop = thread.scrollHeight; });
    // Re-enable send button
    var sendBtn = document.getElementById('conv-send');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Envoyer'; }
  },

  // ── GROUP INFO ─────────────────────────────────────────────────
  async _renderGroupInfo() {
    var el = document.getElementById('page-content'); if (!el) return;
    el.innerHTML = Utils.loader();

    var conv = this._convs.find(function(c) { return c.id === this._convId; }.bind(this));
    if (!conv) { this._view = 'list'; this.render(); return; }

    var participants = [];
    try {
      participants = await Api.convParticipants(this._convId);
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; return; }

    var me = App.currentUser;
    var myPart = participants.find(function(p) { return p.user_id === me.id; });
    var isAdmin = myPart && myPart.role_in_conv === 'admin';
    var canManage = isAdmin || (me.role === 'direction' || me.role === 'responsable');

    var h = '<div style="margin-bottom:16px">' +
      '<button class="btn btn-sm btn-secondary" id="group-back-btn">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Retour au chat</button>' +
      '</div>';

    h += '<div class="page-h1" style="font-size:20px;margin-bottom:4px">👥 ' + (conv.name || 'Groupe') + '</div>';
    h += '<div style="font-size:13px;color:var(--text-3);margin-bottom:20px">' + participants.length + ' membres · Créé ' + Utils.timeAgo(conv.created_at) + '</div>';

    if (canManage) {
      h += '<button class="btn btn-primary btn-sm btn-full" id="group-add-btn" style="margin-bottom:16px">+ Ajouter un membre</button>';
    }

    h += '<div class="dash-section-title">Membres</div>';
    h += '<div class="activity-list">';
    for (var i = 0; i < participants.length; i++) {
      var p = participants[i];
      var ini = (p.user_name || '?').split(' ').map(function(n){return n[0]}).join('').toUpperCase().slice(0,2);
      h += '<div class="activity-item">' +
        '<div class="activity-avatar" style="background:linear-gradient(135deg,var(--navy),var(--navy-mid));color:#fff;font-weight:800;font-size:12px">' + ini + '</div>' +
        '<div class="activity-body"><div class="activity-title">' + (p.user_name || 'Utilisateur') +
        (p.role_in_conv === 'admin' ? ' <span class="badge badge-blue-soft" style="font-size:9px">Admin</span>' : '') +
        (p.user_id === me.id ? ' <span style="font-size:11px;color:var(--text-3)">(vous)</span>' : '') +
        '</div>' +
        '<div class="activity-subtitle">' + Utils.label(p.user_role || '') + '</div></div>';

      if (canManage && p.user_id !== me.id) {
        h += '<button class="btn btn-sm" style="color:var(--danger);font-size:12px" data-remove-uid="' + p.user_id + '">Retirer</button>';
      }
      h += '</div>';
    }
    h += '</div>';

    // Leave group
    h += '<button class="btn btn-danger btn-sm btn-full" id="group-leave-btn" style="margin-top:24px">Quitter le groupe</button>';

    el.innerHTML = h;

    var self = this;
    document.getElementById('group-back-btn').addEventListener('click', function() { self._view = 'chat'; self.render(); });

    var addBtn = document.getElementById('group-add-btn');
    if (addBtn) addBtn.addEventListener('click', function() { self._showAddParticipant(participants); });

    el.querySelectorAll('[data-remove-uid]').forEach(function(b) {
      b.addEventListener('click', async function() {
        var uid = parseInt(b.dataset.removeUid);
        var nm = participants.find(function(p){ return p.user_id === uid; });
        Modal.confirm('Retirer ' + (nm ? nm.user_name : 'ce membre') + ' du groupe ?', async function() {
          try {
            await Api.removeConvParticipant(self._convId, uid);
            Toast.success('Membre retiré');
            self._convs = await Api.conversations();
            self.render();
          } catch(e) { Toast.error(e.message); }
        }, 'Retirer', true);
      });
    });

    document.getElementById('group-leave-btn').addEventListener('click', function() {
      Modal.confirm('Voulez-vous vraiment quitter ce groupe ?', async function() {
        try {
          await Api.removeConvParticipant(self._convId, me.id);
          Toast.success('Vous avez quitté le groupe');
          self._convId = null;
          self._view = 'list';
          self._convs = await Api.conversations();
          self.render();
        } catch(e) { Toast.error(e.message); }
      }, 'Quitter', true);
    });
  },

  _showAddParticipant: function(currentParts) {
    var me = App.currentUser;
    var currentIds = currentParts.map(function(p) { return p.user_id; });
    var available = this._users.filter(function(u) {
      return u.id !== me.id && u.is_active && currentIds.indexOf(u.id) === -1;
    });

    if (available.length === 0) {
      Toast.warning('Tous les utilisateurs sont déjà dans le groupe');
      return;
    }

    var checks = available.map(function(u) {
      return '<label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer">' +
        '<input type="checkbox" value="' + u.id + '" class="add-part-check" style="width:18px;height:18px;accent-color:var(--navy)" />' +
        '<div><div style="font-weight:600;font-size:14px">' + u.name + '</div>' +
        '<div style="font-size:12px;color:var(--text-3)">' + Utils.label(u.role) + '</div></div></label>';
    }).join('');

    Modal.open('Ajouter des membres', '<div style="max-height:350px;overflow-y:auto">' + checks + '</div>',
      '<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>' +
      '<button class="btn btn-primary" id="add-parts-confirm">Ajouter</button>'
    );

    var self = this;
    document.getElementById('add-parts-confirm').addEventListener('click', async function() {
      var ids = [];
      document.querySelectorAll('.add-part-check:checked').forEach(function(c) {
        ids.push(parseInt(c.value));
      });
      if (ids.length === 0) { Toast.error('Sélectionnez au moins un membre'); return; }
      try {
        await Api.addConvParticipants(self._convId, { user_ids: ids });
        Modal.close();
        Toast.success(ids.length + ' membre' + (ids.length > 1 ? 's' : '') + ' ajouté' + (ids.length > 1 ? 's' : ''));
        self._convs = await Api.conversations();
        self.render();
      } catch(e) { Toast.error(e.message); }
    });
  },

  // ── POLLING ────────────────────────────────────────────────────
  _startListPolling: function() {
    this._stopPolling();
    var self = this;
    this._pollTimer = setInterval(async function() {
      try { self._convs = await Api.conversations(); self._renderList(); } catch(e) {}
    }, 10000);
  },

  _startChatPolling: function() {
    this._stopPolling();
    var self = this;
    this._pollTimer = setInterval(async function() {
      try {
        var fresh = await Api.convMessages(self._convId);
        var lastOld = self._msgs.length > 0 ? self._msgs[self._msgs.length - 1].id : 0;
        var lastNew = fresh.length > 0 ? fresh[fresh.length - 1].id : 0;
        if (lastNew !== lastOld) {
          self._msgs = fresh;
          await Api.markConvRead(self._convId).catch(function(){});
          self._rebuildThread();
        }
      } catch(e) {}
    }, 5000);
  },

  _stopPolling: function() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  destroy: function() { this._stopPolling(); this._convId = null; this._view = 'list'; }
};
