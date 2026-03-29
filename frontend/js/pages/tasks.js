/* Hotel OS — Page Tâches V2 — avec Lieu + Équipement */
const TasksPage = {
  filter: 'all',
  tasks: [],
  users: [],
  rooms: [],
  zones: [],
  equipItems: [],
  equipFamilies: [],

  taskCats: [],

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      var results = await Promise.all([
        Api.tasks(),
        Api.users().catch(function(){ return []; }),
        Api.rooms().catch(function(){ return []; }),
        Api.zones().catch(function(){ return []; }),
        Api.equipmentItems().catch(function(){ return []; }),
        Api.equipmentFamilies().catch(function(){ return []; }),
        Api.taskCategories().catch(function(){ return []; }),
      ]);
      this.tasks = results[0];
      this.users = results[1];
      this.rooms = results[2];
      this.zones = results[3];
      this.equipItems = results[4];
      this.equipFamilies = results[5];
      this.taskCats = results[6];
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw() {
    var self = this;
    var filters = ['all','a_faire','en_cours','urgente','terminee','validee'];
    var chips = filters.map(function(f) {
      var count = f === 'all' ? self.tasks.length :
        f === 'urgente' ? self.tasks.filter(function(t){ return t.priority === 'urgente'; }).length :
        self.tasks.filter(function(t){ return t.status === f; }).length;
      return '<button class="filter-chip ' + (self.filter === f ? 'active' : '') + '" data-task-filter="' + f + '">' +
        (f === 'all' ? 'Toutes' : f === 'urgente' ? 'Urgentes' : Utils.label(f)) + ' (' + count + ')</button>';
    }).join('');

    var visible = this.tasks;
    if (this.filter === 'urgente') visible = visible.filter(function(t){ return t.priority === 'urgente'; });
    else if (this.filter !== 'all') visible = visible.filter(function(t){ return t.status === self.filter; });

    var list = visible.length ? visible.map(function(t) {
      var user = self.users.find(function(u){ return u.id === t.assigned_to_id; });
      var room = t.room_id ? self.rooms.find(function(r){ return r.id === t.room_id; }) : null;
      var lieu = room ? 'Ch. ' + room.number : (t.service || 'Général');
      return '<div class="list-item" data-task-open="' + t.id + '">' +
        '<div class="list-item-icon" style="background:var(--blue-pale)">📋</div>' +
        '<div class="list-item-body">' +
        '<div class="list-item-title">' + t.title + '</div>' +
        '<div class="list-item-sub">' + lieu + ' · ' + (user ? user.name : 'Non assigné') + '</div>' +
        '</div>' +
        '<div class="list-item-right">' + Utils.badge(t.priority) + ' ' + Utils.badge(t.status) + '</div>' +
        '</div>';
    }).join('') : Utils.emptyState('📋', 'Aucune tâche');

    document.getElementById('page-content').innerHTML =
      '<div class="page-header"><div><div class="page-h1">Tâches</div></div>' +
      '<button class="btn btn-primary btn-sm" id="task-new-btn">+ Nouvelle</button></div>' +
      '<div class="filter-bar">' + chips + '</div>' + list;

    // Bind events
    var el = document.getElementById('page-content');
    el.querySelectorAll('[data-task-filter]').forEach(function(b) {
      b.addEventListener('click', function() { self.filter = b.dataset.taskFilter; self._draw(); });
    });
    el.querySelectorAll('[data-task-open]').forEach(function(c) {
      c.addEventListener('click', function() { self.openTask(parseInt(c.dataset.taskOpen)); });
    });
    var nb = document.getElementById('task-new-btn');
    if (nb) nb.addEventListener('click', function() { self.newTask(); });
  },

  setFilter: function(f) { this.filter = f; this._draw(); },

  newTask: function() {
    var self = this;
    var userOpts = [{ value: '', label: '— Non assigné —' }].concat(
      this.users.map(function(u) { return { value: String(u.id), label: u.name + ' (' + Utils.label(u.role) + ')' }; })
    );
    // Lieu: zones + rooms
    var lieuOpts = [{ value: '', label: '— Aucun lieu —' }];
    this.zones.forEach(function(z) { lieuOpts.push({ value: 'zone:' + z.id, label: '📍 ' + z.name }); });
    this.rooms.forEach(function(r) { lieuOpts.push({ value: 'room:' + r.id, label: '🛏️ Ch. ' + r.number + ' (ét. ' + r.floor + ')' }); });
    // Equipement
    var eqOpts = [{ value: '', label: '— Aucun —' }].concat(
      this.equipItems.map(function(e) {
        var fam = self.equipFamilies.find(function(f){ return f.id === e.family_id; });
        return { value: String(e.id), label: e.name + (fam ? ' (' + fam.name + ')' : '') };
      })
    );
    // Catégories depuis le référentiel
    var catOpts = [{ value: '', label: '— Aucune catégorie —' }].concat(
      this.taskCats.map(function(c) { return { value: String(c.id), label: c.name }; })
    );

    Modal.form('Nouvelle tâche', [
      { key: 'title', label: 'Titre *', placeholder: 'Ex: Changer ampoules couloir' },
      { key: 'description', type: 'textarea', label: 'Description (optionnel)' },
      { key: 'priority', label: 'Priorité', type: 'select', value: 'normale',
        options: ['basse','normale','haute','urgente'].map(function(v) { return { value: v, label: Utils.label(v) }; }) },
      { key: 'category', label: 'Catégorie', type: 'select', options: catOpts },
      { key: 'lieu', label: 'Lieu', type: 'select', options: lieuOpts },
      { key: 'service', label: 'Service', type: 'select', value: '',
        options: [{ value:'', label:'— Tous services —' }].concat(
          ['technique','housekeeping','reception','general'].map(function(v) { return { value:v, label:Utils.label(v) }; })
        ) },
      { key: 'assigned_to_id', label: 'Assigner à', type: 'select', options: userOpts },
    ], async function(data) {
      if (!data.title) throw new Error('Titre requis');
      var room_id = null;
      if (data.lieu && data.lieu.indexOf('room:') === 0) room_id = parseInt(data.lieu.substring(5));
      await Api.createTask({
        title: data.title, description: data.description, priority: data.priority,
        service: data.service || null,
        room_id: room_id,
        assigned_to_id: data.assigned_to_id ? parseInt(data.assigned_to_id) : null,
      });
      Toast.success('Tâche créée');
      await self.render();
    });
  },

  openTask: function(id) {
    var t = this.tasks.find(function(x) { return x.id === id; });
    if (!t) return;
    var self = this;
    var me = App.currentUser;
    var user = this.users.find(function(u){ return u.id === t.assigned_to_id; });
    var creator = this.users.find(function(u){ return u.id === t.created_by_id; });
    var room = t.room_id ? this.rooms.find(function(r){ return r.id === t.room_id; }) : null;
    var actions = this._actions(t);

    var contactBtns = '';
    if (user && user.id !== me.id) {
      contactBtns += '<button class="btn btn-sm btn-secondary btn-full" style="margin-top:12px" data-task-contact="' + user.id + '">💬 Contacter ' + user.name.split(' ')[0] + '</button>';
    }
    if (creator && creator.id !== me.id && (!user || creator.id !== user.id)) {
      contactBtns += '<button class="btn btn-sm btn-secondary btn-full" style="margin-top:8px" data-task-contact="' + creator.id + '">💬 Contacter ' + creator.name.split(' ')[0] + '</button>';
    }

    var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      Utils.badge(t.priority) + ' ' + Utils.badge(t.status) + '</div>' +
      (t.description ? '<p style="font-size:14px;color:#374151;margin-bottom:12px">' + t.description + '</p>' : '') +
      '<div style="font-size:13px;color:#6B7280;line-height:1.8">' +
      '<b>Service :</b> ' + (t.service || '—') + '<br/>' +
      (room ? '<b>Lieu :</b> Ch. ' + room.number + '<br/>' : '') +
      '<b>Assigné à :</b> ' + (user ? user.name : 'Non assigné') + '<br/>' +
      '<b>Créée :</b> ' + Utils.formatDate(t.created_at) + '<br/>' +
      (t.started_at ? '<b>Démarrée :</b> ' + Utils.formatDate(t.started_at) + '<br/>' : '') +
      (t.completed_at ? '<b>Terminée :</b> ' + Utils.formatDate(t.completed_at) + '<br/>' : '') +
      (t.pause_reason ? '<b>Raison pause :</b> ' + t.pause_reason + '<br/>' : '') +
      '</div>' + contactBtns;

    Modal.open('Tâche : ' + t.title, body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>' + actions
    );

    setTimeout(function() {
      document.querySelectorAll('[data-task-contact]').forEach(function(b) {
        b.addEventListener('click', async function() {
          var uid = parseInt(b.dataset.taskContact);
          Modal.close();
          try {
            var conv = await Api.createDirectConv(uid);
            App.navigate('messages');
            setTimeout(function() {
              if (typeof ConversationsPage !== 'undefined') {
                ConversationsPage._convId = conv.id;
                ConversationsPage._view = 'chat';
                ConversationsPage.render();
              }
            }, 100);
          } catch(e) { Toast.error(e.message); }
        });
      });
      document.querySelectorAll('[data-task-action]').forEach(function(b) {
        b.addEventListener('click', function() { self.action(parseInt(b.dataset.taskId), b.dataset.taskFn); });
      });
    }, 50);
  },

  _actions: function(t) {
    var s = t.status;
    var me = App.currentUser;
    var btn = function(label, cls, fn) {
      return '<button class="btn ' + cls + ' btn-sm" data-task-id="' + t.id + '" data-task-fn="' + fn + '">' + label + '</button>';
    };
    var actions = '';
    // Modifier toujours accessible (sauf validée)
    if (s !== 'validee' && s !== 'refusee') {
      actions += btn('✏️ Modifier', 'btn-secondary', 'edit');
    }
    if (s === 'a_faire')   actions += btn('Démarrer','btn-primary','start');
    if (s === 'en_cours')  actions += btn('Pause','btn-warning','pause') + btn('Terminer','btn-success','done');
    if (s === 'pause')     actions += btn('Reprendre','btn-primary','resume');
    if (s === 'terminee')  actions += btn('Valider','btn-success','validate') + btn('Refuser','btn-danger','refuse');
    var canDelete = me && (me.role === 'responsable' || me.role === 'responsable_technique' || me.role === 'direction');
    if (canDelete && s !== 'validee') {
      actions += btn('🗑 Supprimer', 'btn-secondary', 'delete');
    }
    return actions;
  },

  action: async function(id, type) {
    var self = this;
    var map = { start:'en_cours', pause:'pause', resume:'en_cours', done:'terminee', validate:'validee', refuse:'refusee' };
    try {
      if (type === 'edit') {
        var t = this.tasks.find(function(x) { return x.id === id; });
        if (!t) return;
        Modal.close(true);
        var prioOpts = [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}];
        var userOpts = [{value:'',label:'— Non assigné —'}].concat(
          this.users.map(function(u) { return {value:String(u.id), label:u.name + ' (' + Utils.label(u.role) + ')'}; })
        );
        var roomOpts = [{value:'',label:'— Aucune chambre —'}].concat(
          this.rooms.map(function(r) { return {value:String(r.id), label:'Ch. '+r.number+' (ét.'+r.floor+')'}; })
        );
        Modal.form('Modifier la tâche', [
          { key:'title',          label:'Titre *',      value:t.title||'',              placeholder:'Titre' },
          { key:'description',    label:'Description',  value:t.description||'',        placeholder:'Détails…', type:'textarea' },
          { key:'priority',       label:'Priorité',     value:t.priority||'normale',    type:'select', options:prioOpts },
          { key:'service',        label:'Service',      value:t.service||'',            placeholder:'Ex: housekeeping' },
          { key:'assigned_to_id', label:'Assigné à',    value:t.assigned_to_id?String(t.assigned_to_id):'', type:'select', options:userOpts },
          { key:'room_id',        label:'Chambre',      value:t.room_id?String(t.room_id):'',               type:'select', options:roomOpts },
        ], async function(data) {
          if (!data.title) throw new Error('Titre requis');
          await Api.updateTask(id, {
            title: data.title,
            description: data.description || null,
            priority: data.priority,
            service: data.service || null,
            assigned_to_id: data.assigned_to_id ? parseInt(data.assigned_to_id) : null,
            room_id: data.room_id ? parseInt(data.room_id) : null,
          });
          Toast.success('Tâche modifiée');
          await self.render();
        }, 'Enregistrer');
        return;
      }
      if (type === 'delete') {
        Modal.confirm('Supprimer cette tâche ?', async function() {
          try {
            await Api.deleteTask(id);
            Modal.close();
            Toast.success('Tâche supprimée');
            await self.render();
          } catch(e) { Toast.error(e.message); }
        }, 'Supprimer', true);
        return;
      }
      if (type === 'pause') {
        Modal.close(true);
        Modal.form('Mettre en pause', [
          { key: 'pause_reason', type: 'textarea', label: 'Raison de la pause', placeholder: 'Ex: En attente de pièce, consigne reçue...' },
        ], async function(data) {
          await Api.updateTask(id, { status: 'pause', pause_reason: data.pause_reason || null });
          Toast.success('Tâche en pause');
          await self.render();
        }, 'Confirmer');
        return;
      }
      if (type === 'refuse') {
        Modal.close(true);
        Modal.form('Refuser cette tâche', [
          { key: 'validation_note', type: 'textarea', label: 'Motif du refus', placeholder: 'Ex: Travail incomplet, critères non respectés...' },
        ], async function(data) {
          await Api.updateTask(id, { status: 'refusee', validation_note: data.validation_note || null });
          Toast.success('Tâche refusée');
          await self.render();
        }, 'Refuser');
        return;
      }
      await Api.updateTask(id, { status: map[type] });
      Modal.close();
      Toast.success('Tâche mise à jour');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  destroy: function() { this.filter = 'all'; }
};
