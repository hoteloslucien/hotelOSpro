/* Hotel OS — Interventions V2 — Cartes premium, filtres, modal clôture */
const InterventionsPage = {
  filter: 'all',
  priorityFilter: 'all',
  onlyMine: false,
  items: [],
  rooms: [],
  users: [],
  equipItems: [],
  equipFamilies: [],
  equipTypes: [],
  zones: [],
  invTypes: [],

  async render() {
    var el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      var results = await Promise.all([
        Api.interventions(),
        Api.rooms().catch(function(){ return []; }),
        Api.users().catch(function(){ return []; }),
        Api.equipmentItems().catch(function(){ return []; }),
        Api.equipmentFamilies().catch(function(){ return []; }),
        Api.equipmentTypes().catch(function(){ return []; }),
        Api.zones().catch(function(){ return []; }),
        Api.interventionTypes().catch(function(){ return []; }),
      ]);
      this.items = results[0];
      this.rooms = results[1];
      this.users = results[2];
      this.equipItems = results[3];
      this.equipFamilies = results[4];
      this.equipTypes = results[5];
      this.zones = results[6];
      this.invTypes = results[7];
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw: function() {
    var me = App.currentUser;
    var self = this;

    // Status filters
    var statusFilters = ['all','nouvelle','en_cours','pause','terminee','cloturee','duplicate'];
    var statusChips = statusFilters.map(function(f) {
      var count = f === 'all' ? self.items.length : self.items.filter(function(i){ return i.status === f; }).length;
      return '<button class="filter-chip ' + (self.filter === f ? 'active' : '') + '" data-inv-status="' + f + '">' +
        (f === 'all' ? 'Toutes' : f === 'duplicate' ? 'Doublons' : Utils.label(f)) + ' (' + count + ')</button>';
    }).join('');

    // Priority filters
    var prioChips = '<button class="filter-chip ' + (self.priorityFilter === 'all' ? 'active' : '') + '" data-inv-prio="all">Toutes priorités</button>';
    ['urgente','haute','normale','basse'].forEach(function(p) {
      var cnt = self.items.filter(function(i){ return i.priority === p; }).length;
      if (cnt > 0) {
        prioChips += '<button class="filter-chip ' + (self.priorityFilter === p ? 'active' : '') + '" data-inv-prio="' + p + '">' + Utils.label(p) + '</button>';
      }
    });

    // "Mes interventions" toggle
    var mineToggle = me ? '<button class="filter-chip ' + (self.onlyMine ? 'active' : '') + '" data-inv-mine="1">🎯 Mes interventions</button>' : '';

    // Apply filters
    var visible = this.items;
    if (this.filter !== 'all') visible = visible.filter(function(i){ return i.status === self.filter; });
    if (this.priorityFilter !== 'all') visible = visible.filter(function(i){ return i.priority === self.priorityFilter; });
    if (this.onlyMine && me) visible = visible.filter(function(i){ return i.taken_by_id === me.id || i.created_by_id === me.id; });

    var iconMap = { urgente:'🔴', haute:'🟠', normale:'🟡', basse:'🟢' };

    var list = '';
    if (visible.length > 0) {
      for (var i = 0; i < visible.length; i++) {
        var inv = visible[i];
        var room = this.rooms.find(function(r){ return r.id === inv.room_id; });
        var takenBy = inv.taken_by_id ? this.users.find(function(u){ return u.id === inv.taken_by_id; }) : null;

        list += '<div class="inv-card" data-inv-open="' + inv.id + '">' +
          '<div class="inv-card-header">' +
          '<div class="inv-card-icon">' + (iconMap[inv.priority] || '🔧') + '</div>' +
          '<div class="inv-card-title-wrap">' +
          '<div class="inv-card-title">' + this._esc(inv.title) + '</div>' +
          '<div class="inv-card-meta">' + (inv.zone || (room ? 'Ch. ' + room.number : '—')) + ' · ' + Utils.timeAgo(inv.created_at) + '</div>' +
          '</div>' +
          '</div>' +
          '<div class="inv-card-body">';

        if (inv.description) {
          list += '<div class="inv-card-desc">' + this._esc(inv.description).substring(0, 120) + (inv.description.length > 120 ? '…' : '') + '</div>';
        }

        list += '<div class="inv-card-badges">' + Utils.badge(inv.priority) + ' ' + Utils.badge(inv.status);
        if (inv.source === 'client') list += ' <span class="badge badge-normale">Client</span>';
        if (inv.is_duplicate) list += ' <span class="badge" style="background:#fef3c7;color:#92400e">Doublon</span>';
        if (inv.duplicate_of_id) list += ' <span style="font-size:11px;color:#6B7280"> · Doublon de #' + inv.duplicate_of_id + '</span>';
        list += '</div>';

        var eqItem = inv.equipment_item_id ? self.equipItems.find(function(e){ return e.id === inv.equipment_item_id; }) : null;

        if (takenBy) {
          list += '<div class="inv-card-assigned">👤 ' + takenBy.name + '</div>';
        }
        if (eqItem) {
          list += '<div style="font-size:12px;color:#6B7280;margin-top:2px">⚙️ ' + self._esc(eqItem.name) + '</div>';
        }

        list += '</div></div>';
      }
    } else {
      var emptyMsg = 'Aucune intervention';
      if (self.onlyMine) emptyMsg = 'Aucune intervention créée ou prise par vous';
      else if (this.filter !== 'all' || this.priorityFilter !== 'all') emptyMsg = 'Aucune intervention avec ces filtres';
      list = Utils.emptyState('🔧', emptyMsg);
    }

    document.getElementById('page-content').innerHTML =
      '<div class="page-header">' +
      '<div><div class="page-h1">Interventions</div>' +
      '<div class="page-sub">' + this.items.length + ' au total</div></div>' +
      '<button class="btn btn-primary btn-sm" id="inv-new-btn">+ Nouvelle</button>' +
      '</div>' +
      '<div class="filter-bar">' + statusChips + '</div>' +
      '<div class="filter-bar" style="margin-top:-8px">' + prioChips + mineToggle + '</div>' +
      '<div class="inv-cards-list">' + list + '</div>';

    // Bind events
    var el = document.getElementById('page-content');
    el.querySelectorAll('[data-inv-status]').forEach(function(b) {
      b.addEventListener('click', function() { self.filter = b.dataset.invStatus; self._draw(); });
    });
    el.querySelectorAll('[data-inv-prio]').forEach(function(b) {
      b.addEventListener('click', function() { self.priorityFilter = b.dataset.invPrio; self._draw(); });
    });
    var mineBtn = el.querySelector('[data-inv-mine]');
    if (mineBtn) mineBtn.addEventListener('click', function() { self.onlyMine = !self.onlyMine; self._draw(); });
    el.querySelectorAll('[data-inv-open]').forEach(function(c) {
      c.addEventListener('click', function() { self.open(parseInt(c.dataset.invOpen)); });
    });
    var newBtn = document.getElementById('inv-new-btn');
    if (newBtn) newBtn.addEventListener('click', function() { self.newItem(); });
  },

  newItem: function() {
    var self = this;
    // Build unified "Lieu" options: zones + rooms
    var lieuOpts = [{ value: '', label: '— Aucun lieu —' }];
    if (this.zones.length > 0) {
      this.zones.forEach(function(z) { lieuOpts.push({ value: 'zone:' + z.name, label: '📍 ' + z.name }); });
    }
    if (this.rooms.length > 0) {
      this.rooms.forEach(function(r) { lieuOpts.push({ value: 'room:' + r.id, label: '🛏️ Ch. ' + r.number + ' (ét. ' + r.floor + ')' }); });
    }
    var eqOpts = [{ value: '', label: '— Aucun équipement —' }].concat(
      this.equipItems.map(function(e) {
        var fam = self.equipFamilies.find(function(f){ return f.id === e.family_id; });
        return { value: String(e.id), label: e.name + (fam ? ' (' + fam.name + ')' : '') };
      })
    );
    // Types depuis le référentiel
    var typeOpts = [{ value: '', label: '— Aucun type —' }].concat(
      this.invTypes.map(function(t) { return { value: t.name, label: t.name }; })
    );

    Modal.form('Nouvelle intervention', [
      { key: 'title', label: 'Titre *', placeholder: 'Ex: Fuite robinet' },
      { key: 'description', type: 'textarea', label: 'Description' },
      { key: 'type', label: 'Type', type: 'select', options: typeOpts },
      { key: 'lieu', label: 'Lieu', type: 'select', options: lieuOpts },
      { key: 'priority', label: 'Priorité', type: 'select', value: 'normale',
        options: ['basse','normale','haute','urgente'].map(function(v) { return { value: v, label: Utils.label(v) }; }) },
      { key: 'equipment_item_id', label: 'Équipement concerné', type: 'select', options: eqOpts },
      { key: 'source', label: 'Source', type: 'select', value: 'staff',
        options: [{ value:'staff', label:'Staff' },{ value:'client', label:'Client' },{ value:'qr', label:'QR Code' }] },
    ], async function(data) {
      if (!data.title) throw new Error('Titre requis');
      var zone = null, room_id = null;
      if (data.lieu) {
        if (data.lieu.indexOf('zone:') === 0) zone = data.lieu.substring(5);
        else if (data.lieu.indexOf('room:') === 0) room_id = parseInt(data.lieu.substring(5));
      }
      await Api.createIntervention({
        title: data.title,
        description: data.description || null,
        zone: zone || (data.type || null),
        priority: data.priority,
        source: data.source,
        room_id: room_id,
        equipment_item_id: data.equipment_item_id ? parseInt(data.equipment_item_id) : null,
      });
      Toast.success('Intervention créée');
      await self.render();
    });
  },

  open: function(id) {
    var inv = this.items.find(function(x) { return x.id === id; });
    if (!inv) return;
    var self = this;
    var room = this.rooms.find(function(r) { return r.id === inv.room_id; });
    var takenBy = inv.taken_by_id ? this.users.find(function(u) { return u.id === inv.taken_by_id; }) : null;
    var createdBy = inv.created_by_id ? this.users.find(function(u) { return u.id === inv.created_by_id; }) : null;
    var eqItem = inv.equipment_item_id ? this.equipItems.find(function(e) { return e.id === inv.equipment_item_id; }) : null;
    var eqFam = eqItem ? this.equipFamilies.find(function(f) { return f.id === eqItem.family_id; }) : null;

    var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
      Utils.badge(inv.priority) + ' ' + Utils.badge(inv.status) +
      (inv.source === 'client' ? ' <span class="badge badge-normale">Client</span>' : '') +
      '</div>' +
      '<p style="font-size:15px;font-weight:600;color:#0F1F3D;margin-bottom:8px">' + this._esc(inv.title) + '</p>' +
      (inv.description ? '<p style="font-size:13px;color:#374151;margin-bottom:12px">' + this._esc(inv.description) + '</p>' : '') +
      '<div style="font-size:13px;color:#6B7280;line-height:2">' +
      '<b>Zone :</b> ' + (inv.zone || '—') + '<br/>' +
      (room ? '<b>Chambre :</b> ' + room.number + '<br/>' : '') +
      (eqItem ? '<b>Équipement :</b> ' + this._esc(eqItem.name) + (eqFam ? ' (' + eqFam.name + ')' : '') + '<br/>' : '') +
      (takenBy ? '<b>Pris par :</b> ' + takenBy.name + '<br/>' : '') +
      (createdBy ? '<b>Créé par :</b> ' + createdBy.name + '<br/>' : '') +
      '<b>Coût :</b> ' + (inv.cost ? inv.cost.toFixed(2) + ' €' : '—') + '<br/>' +
      '<b>Créée :</b> ' + Utils.formatDate(inv.created_at) + '<br/>' +
      (inv.started_at ? '<b>Prise en charge :</b> ' + Utils.formatDate(inv.started_at) + '<br/>' : '') +
      (inv.completed_at ? '<b>Clôturée :</b> ' + Utils.formatDate(inv.completed_at) + '<br/>' : '') +
      (inv.resolution_note ? '<b>Résolution :</b> ' + this._esc(inv.resolution_note) + '<br/>' : '') +
      (inv.is_duplicate ? '<div style="margin-top:8px;padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:13px"><b>⚠️ Doublon</b> de l\'intervention <b>#' + inv.duplicate_of_id + (function() { var linked = this.items ? this.items.find(function(x){ return x.id === inv.duplicate_of_id; }) : null; return linked ? ' — ' + linked.title : ''; }).call(this) + '</b>' + (inv.duplicate_reason ? '<br/>Raison : ' + this._esc(inv.duplicate_reason) : '') + '</div>' : '') +
      '</div>';

    // Contact buttons
    var me = App.currentUser;
    if (takenBy && takenBy.id !== me.id) {
      body += '<button class="btn btn-sm btn-secondary btn-full" style="margin-top:12px" data-contact-uid="' + takenBy.id + '">💬 Contacter ' + takenBy.name.split(' ')[0] + ' (technicien)</button>';
    }
    if (createdBy && createdBy.id !== me.id && (!takenBy || createdBy.id !== takenBy.id)) {
      body += '<button class="btn btn-sm btn-secondary btn-full" style="margin-top:8px" data-contact-uid="' + createdBy.id + '">💬 Contacter ' + createdBy.name.split(' ')[0] + ' (créateur)</button>';
    }

    var actions = this._buildActions(inv);

    Modal.open('Intervention #' + inv.id, body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>' + actions
    );

    // Bind contact buttons
    setTimeout(function() {
      document.querySelectorAll('[data-contact-uid]').forEach(function(b) {
        b.addEventListener('click', async function() {
          var uid = parseInt(b.dataset.contactUid);
          Modal.close();
          try {
            var conv = await Api.createDirectConv(uid);
            App.navigate('messages');
            setTimeout(function() {
              if (ConversationsPage) {
                ConversationsPage._convId = conv.id;
                ConversationsPage._view = 'chat';
                ConversationsPage.render();
              }
            }, 100);
          } catch(e) { Toast.error(e.message); }
        });
      });
    }, 50);
  },

  _buildActions: function(inv) {
    var s = inv.status;
    var me = App.currentUser;
    var canDelete = me && (me.role === 'responsable' || me.role === 'responsable_technique' || me.role === 'direction');
    var btn = function(label, cls, fn) {
      return '<button class="btn ' + cls + ' btn-sm" data-inv-action="' + inv.id + '" data-inv-fn="' + fn + '">' + label + '</button>';
    };
    var actions = '';

    // Édition toujours accessible (sauf clôturée/doublon)
    if (s !== 'cloturee' && s !== 'duplicate') {
      actions += btn('✏️ Modifier', 'btn-secondary', 'edit');
    }

    // Primary actions by status
    if (s === 'nouvelle' || s === 'en_attente') {
      actions += btn('Prendre en charge', 'btn-primary', 'take');
      actions += btn('Clôturer', 'btn-success', 'close');
    } else if (s === 'en_cours' || s === 'prise') {
      actions += btn('Pause','btn-warning','pause');
      actions += btn('Clôturer','btn-success','close');
    } else if (s === 'pause') {
      actions += btn('Reprendre','btn-primary','resume');
      actions += btn('Clôturer','btn-success','close');
    } else if (s === 'terminee') {
      actions += btn('Clôturer','btn-success','close');
    }

    // Duplicate actions
    if (s !== 'cloturee' && s !== 'duplicate') {
      actions += btn('🔁 Doublon','btn-secondary','mark_dup');
    }
    if (s === 'duplicate' && inv.is_duplicate) {
      actions += btn('↩ Retirer doublon','btn-warning','unmark_dup');
    }

    // Suppression (managers seulement)
    if (canDelete) {
      actions += btn('🗑 Supprimer','btn-secondary','delete');
    }

    // Bind after a tick
    var self = this;
    setTimeout(function() {
      document.querySelectorAll('[data-inv-action]').forEach(function(b) {
        b.addEventListener('click', function() { self.action(parseInt(b.dataset.invAction), b.dataset.invFn); });
      });
    }, 50);

    return actions;
  },

  action: async function(id, type) {
    var self = this;
    try {
      if (type === 'edit') {
        var inv = this.items.find(function(x) { return x.id === id; });
        if (!inv) return;
        Modal.close(true);
        var prioOpts = [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}];
        var statusOpts = [{value:'nouvelle',label:'Nouvelle'},{value:'en_attente',label:'En attente'},{value:'prise',label:'Prise'},{value:'en_cours',label:'En cours'},{value:'pause',label:'En pause'},{value:'terminee',label:'Terminée'}];
        var roomOpts = [{value:'',label:'— Aucune chambre —'}].concat(
          this.rooms.map(function(r) { return {value:String(r.id), label:'Ch. '+r.number}; })
        );
        Modal.form('Modifier intervention #' + id, [
          { key:'title',           label:'Titre *',         value:inv.title||'',           placeholder:'Titre' },
          { key:'description',     label:'Description',     value:inv.description||'',     placeholder:'Détails…', type:'textarea' },
          { key:'priority',        label:'Priorité',        value:inv.priority||'normale',  type:'select', options:prioOpts },
          { key:'status',          label:'Statut',          value:inv.status||'nouvelle',   type:'select', options:statusOpts },
          { key:'zone',            label:'Zone/Lieu',       value:inv.zone||'',            placeholder:'Ex: Hall, Piscine…' },
          { key:'room_id',         label:'Chambre',         value:inv.room_id?String(inv.room_id):'', type:'select', options:roomOpts },
          { key:'resolution_note', label:'Note résolution', value:inv.resolution_note||'', placeholder:'Ce qui a été fait…', type:'textarea' },
        ], async function(data) {
          if (!data.title) throw new Error('Titre requis');
          await Api.updateIntervention(id, {
            title:data.title, priority:data.priority, status:data.status,
            zone:data.zone||null, room_id:data.room_id?parseInt(data.room_id):null,
            resolution_note:data.resolution_note||null,
          });
          Toast.success('Intervention modifiée');
          await self.render();
        }, 'Enregistrer');
      } else if (type === 'take') {
        await Api.takeIntervention(id);
        Modal.close();
        Toast.success('Intervention prise en charge');
        await this.render();
      } else if (type === 'close') {
        Modal.close(true);
        Modal.form('Clôturer l\'intervention', [
          { key: 'resolution_note', type: 'textarea', label: 'Note de résolution', placeholder: 'Décrivez ce qui a été fait...' },
          { key: 'cost', label: 'Coût (€)', placeholder: '0.00', type: 'text' },
        ], async function(data) {
          await Api.closeIntervention(id, {
            resolution_note: data.resolution_note || null,
            cost: data.cost ? parseFloat(data.cost) : null,
          });
          Toast.success('Intervention clôturée');
          await self.render();
        }, 'Clôturer');
      } else if (type === 'pause') {
        await Api.updateIntervention(id, { status: 'pause' });
        Modal.close();
        Toast.success('Intervention en pause');
        await this.render();
      } else if (type === 'resume') {
        await Api.updateIntervention(id, { status: 'en_cours' });
        Modal.close();
        Toast.success('Intervention reprise');
        await this.render();
      } else if (type === 'mark_dup') {
        Modal.close(true);
        var others = this.items.filter(function(x) { return x.id !== id && x.status !== 'duplicate'; });
        var opts = others.map(function(x) { return { value: String(x.id), label: '#' + x.id + ' — ' + x.title.substring(0, 50) }; });
        Modal.form('Marquer comme doublon', [
          { key: 'duplicate_of_id', label: 'Doublon de', type: 'select', options: opts },
          { key: 'duplicate_reason', type: 'textarea', label: 'Raison (optionnel)', placeholder: 'Ex: Même problème signalé par un autre agent' },
        ], async function(data) {
          if (!data.duplicate_of_id) throw new Error('Sélectionnez l\'intervention principale');
          await Api.markDuplicate(id, {
            duplicate_of_id: parseInt(data.duplicate_of_id),
            duplicate_reason: data.duplicate_reason || null,
          });
          Toast.success('Intervention marquée comme doublon');
          await self.render();
        }, 'Confirmer');
      } else if (type === 'unmark_dup') {
        await Api.unmarkDuplicate(id);
        Modal.close();
        Toast.success('Doublon retiré');
        await this.render();
      } else if (type === 'delete') {
        Modal.close(true);
        Modal.confirm('Supprimer définitivement cette intervention ?', async function() {
          try {
            await Api.deleteIntervention(id);
            Toast.success('Intervention supprimée');
            await self.render();
          } catch(e) { Toast.error(e.message); }
        }, 'Supprimer', true);
      }
    } catch(e) { Toast.error(e.message); }
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  destroy: function() { this.filter = 'all'; this.priorityFilter = 'all'; this.onlyMine = false; }
};
