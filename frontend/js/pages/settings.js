/* Hotel OS — Page Réglages V2
 * Architecture 3 niveaux (A/B/C) — 8 onglets
 * Chaque module : liste + créer + modifier + supprimer + rechargement
 */
const SettingsPage = {

  _currentTab: 'etablissement',

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    const perms = App.permissions || [];
    if (!perms.includes('settings.view')) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div>
        <p>Accès réservé à la direction et aux responsables.</p></div>`;
      return;
    }
    this._currentTab = this._currentTab || 'etablissement';
    this._renderTabs(el);
  },

  _renderTabs(el) {
    const tabs = [
      { id:'etablissement', icon:'🏨', label:'Établissement' },
      { id:'structure',     icon:'📍', label:'Structure' },
      { id:'hebergement',   icon:'🛏️', label:'Hébergement' },
      { id:'exploitation',  icon:'✅', label:'Exploitation' },
      { id:'stock',         icon:'📦', label:'Stock' },
      { id:'technique',     icon:'🛠️', label:'Technique' },
      { id:'utilisateurs',  icon:'👥', label:'Utilisateurs' },
      { id:'communication', icon:'💬', label:'Communication' },
    ];
    const self = this;
    const tabBar = tabs.map(t =>
      `<button class="settings-tab-btn${self._currentTab===t.id?' active':''}" onclick="SettingsPage._switchTab('${t.id}')">
        <span>${t.icon}</span><span class="tab-label">${t.label}</span>
      </button>`
    ).join('');
    el.innerHTML = `
      <div class="page-header">
        <div><div class="page-h1">⚙️ Réglages</div><div class="page-sub">Configuration de l'application</div></div>
      </div>
      <div class="settings-tabs-bar">${tabBar}</div>
      <div id="settings-tab-content" class="settings-tab-content"></div>`;
    this._loadTab(this._currentTab);
  },

  _switchTab(tab) {
    this._currentTab = tab;
    document.querySelectorAll('.settings-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('onclick') === `SettingsPage._switchTab('${tab}')`);
    });
    this._loadTab(tab);
  },

  _loadTab(tab) {
    const map = {
      etablissement: '_showHotelsManager',
      structure:     '_showZonesManager',
      hebergement:   '_showRoomsManager',
      exploitation:  '_showExploitationManager',
      stock:         '_showStockManager',
      technique:     '_showTechniqueManager',
      utilisateurs:  '_showUsersManager',
      communication: '_showCommunicationManager',
    };
    if (map[tab]) this[map[tab]]();
  },

  _tabEl() { return document.getElementById('settings-tab-content'); },

  // ═══ ONGLET 1 — ÉTABLISSEMENT ══════════════════════════════════
  async _showHotelsManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var hotels = await Api.hotelsAll();
      var showInactive = SettingsPage._hotelsShowInactive || false;
      var filtered = showInactive ? hotels : hotels.filter(function(h) { return h.is_active; });
      var inactiveCount = hotels.filter(function(h) { return !h.is_active; }).length;

      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">🏨 Hôtels</div>'
        + '<div class="section-sub">' + hotels.length + ' établissement(s) · ' + inactiveCount + ' inactif(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="hotel-add-btn">+ Ajouter</button></div>'
        + '<div class="filter-bar" style="margin-bottom:12px">'
        + '<button class="filter-chip' + (!showInactive?' active':'') + '" id="hotel-filter-active">Actifs (' + (hotels.length - inactiveCount) + ')</button>'
        + '<button class="filter-chip' + (showInactive?' active':'') + '" id="hotel-filter-all">Tous (' + hotels.length + ')</button>'
        + '</div>';

      if (filtered.length > 0) {
        h += '<div class="activity-list">';
        filtered.forEach(function(hotel) {
          var badge = hotel.is_active
            ? '<span class="badge badge-operationnel">Actif</span>'
            : '<span class="badge badge-bloquee">Inactif</span>';
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(59,130,246,.12);font-size:20px">🏨</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + hotel.name + (hotel.brand ? ' · ' + hotel.brand : '') + '</div>'
            + '<div class="list-item-sub">' + [hotel.city, hotel.address].filter(Boolean).join(' · ') + '</div>'
            + '<div class="list-item-sub" style="font-size:11px;color:var(--text-3)">' + hotel.code + (hotel.email ? ' · ' + hotel.email : '') + (hotel.phone ? ' · ' + hotel.phone : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">' + badge
            + '<button class="btn btn-secondary btn-sm" data-hotel-edit="' + hotel.id + '">✏️</button>'
            + (hotel.is_active
                ? '<button class="btn btn-sm" style="color:var(--danger)" data-hotel-disable="' + hotel.id + '">Désactiver</button>'
                : '<button class="btn btn-sm" style="color:var(--success)" data-hotel-reactivate="' + hotel.id + '">Réactiver</button>')
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('🏨', 'Aucun hôtel' + (showInactive ? '' : ' actif') + ' configuré'); }

      el.innerHTML = h;

      document.getElementById('hotel-filter-active') && document.getElementById('hotel-filter-active').addEventListener('click', function() {
        SettingsPage._hotelsShowInactive = false; SettingsPage._showHotelsManager();
      });
      document.getElementById('hotel-filter-all') && document.getElementById('hotel-filter-all').addEventListener('click', function() {
        SettingsPage._hotelsShowInactive = true; SettingsPage._showHotelsManager();
      });
      el.querySelectorAll('[data-hotel-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var hotel = hotels.find(function(x) { return x.id === parseInt(b.dataset.hotelEdit); });
          if (hotel) SettingsPage._editHotel(hotel);
        });
      });
      el.querySelectorAll('[data-hotel-disable]').forEach(function(b) {
        b.addEventListener('click', function() {
          var hotel = hotels.find(function(x) { return x.id === parseInt(b.dataset.hotelDisable); });
          if (!hotel) return;
          Modal.confirm('Désactiver l\'hôtel "' + hotel.name + '" ?', async function() {
            try { await Api.disableHotel(hotel.id); Toast.success('Hôtel désactivé'); SettingsPage._showHotelsManager(); }
            catch(e) { Toast.error(e.message); }
          }, 'Désactiver', true);
        });
      });
      el.querySelectorAll('[data-hotel-reactivate]').forEach(function(b) {
        b.addEventListener('click', function() {
          var hotel = hotels.find(function(x) { return x.id === parseInt(b.dataset.hotelReactivate); });
          if (!hotel) return;
          Modal.confirm('Réactiver l\'hôtel "' + hotel.name + '" ?', async function() {
            try { await Api.reactivateHotel(hotel.id); Toast.success('Hôtel réactivé'); SettingsPage._showHotelsManager(); }
            catch(e) { Toast.error(e.message); }
          }, 'Réactiver', false);
        });
      });
      var addBtn = document.getElementById('hotel-add-btn');
      if (addBtn) addBtn.addEventListener('click', function() { SettingsPage._newHotel(); });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },
  _hotelFields: function(h) {
    return [
      { key:'name',     label:'Nom *',          value:h.name||'',           placeholder:'Ex: Mercure Paris Centre' },
      { key:'code',     label:'Code *',          value:h.code||'',           placeholder:'Ex: MERCURE_PARIS' },
      { key:'brand',    label:'Enseigne/Marque', value:h.brand||'',          placeholder:'Ex: Mercure' },
      { key:'city',     label:'Ville',           value:h.city||'',           placeholder:'Ex: Paris' },
      { key:'address',  label:'Adresse',         value:h.address||'',        placeholder:'12 rue de la Paix' },
      { key:'country',  label:'Pays',            value:h.country||'France',  placeholder:'France' },
      { key:'phone',    label:'Téléphone',       value:h.phone||'',          placeholder:'+33 1 23 45 67 89' },
      { key:'email',    label:'Email',           value:h.email||'',          placeholder:'contact@hotel.fr' },
      { key:'timezone', label:'Fuseau horaire',  value:h.timezone||'Europe/Paris', placeholder:'Europe/Paris' },
      { key:'language', label:'Langue',          value:h.language||'fr',     placeholder:'fr' },
    ];
  },

  _newHotel: function() {
    Modal.form('Nouvel hôtel', SettingsPage._hotelFields({}), async function(data) {
      if (!data.name) throw new Error('Nom requis');
      if (!data.code) throw new Error('Code requis');
      await Api.createHotel(data);
      Toast.success('Hôtel créé');
      SettingsPage._showHotelsManager();
    });
  },

  _editHotel: function(hotel) {
    Modal.form('Modifier hôtel', SettingsPage._hotelFields(hotel), async function(data) {
      if (!data.name) throw new Error('Nom requis');
      if (!data.code) throw new Error('Code requis');
      await Api.updateHotel(hotel.id, data);
      Toast.success('Hôtel modifié');
      SettingsPage._showHotelsManager();
    });
  },

  // ═══ ONGLET 2 — STRUCTURE ══════════════════════════════════════
  async _showZonesManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var zones = await Api.zones();
      var TYPES = ['zone','lieu','etage','secteur','batiment','aile'];
      var TYPE_ICONS = { zone:'📍', lieu:'📌', etage:'🏢', secteur:'🗂️', batiment:'🏗️', aile:'↔️' };
      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">📍 Zones & Lieux</div>'
        + '<div class="section-sub">' + zones.length + ' zone(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="zone-add-btn">+ Ajouter</button></div>';
      if (zones.length > 0) {
        h += '<div class="activity-list">';
        zones.forEach(function(z) {
          var icon = TYPE_ICONS[z.type] || '📍';
          var typeBadge = z.type ? '<span class="badge" style="background:var(--surface-3);color:var(--text-2)">' + z.type + '</span>' : '';
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(14,165,160,.08);font-size:20px">' + icon + '</div>'
            + '<div class="list-item-body"><div class="list-item-title">' + z.name + '</div>'
            + '<div class="list-item-sub">' + (z.code || '—') + '</div></div>'
            + '<div class="list-item-right" style="gap:6px">' + typeBadge
            + '<button class="btn btn-secondary btn-sm" data-zone-edit="' + z.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-zone-del="' + z.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('📍', 'Aucune zone configurée'); }
      el.innerHTML = h;

      var zoneTypeOpts = [{value:'',label:'— Type —'}].concat(TYPES.map(function(t) {
        return {value:t, label:t.charAt(0).toUpperCase()+t.slice(1)};
      }));
      var zoneFields = function(z) {
        z = z || {};
        return [
          { key:'name', label:'Nom *', value:z.name||'', placeholder:'Ex: Spa, Parking, Étage 4' },
          { key:'code', label:'Code',  value:z.code||'', placeholder:'Ex: SPA, PARK' },
          { key:'type', label:'Type',  value:z.type||'', type:'select', options:zoneTypeOpts },
        ];
      };

      var addBtn = document.getElementById('zone-add-btn');
      if (addBtn) addBtn.addEventListener('click', function() {
        Modal.form('Nouvelle zone', zoneFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          var me = App.currentUser;
          var me = App.currentUser;
          var hotelId = (me && me.hotel_id) ? me.hotel_id : 1;
          await Api.createZone({ name:data.name, code:data.code||null, type:data.type||null, hotel_id:hotelId });
          Toast.success('Zone ajoutée');
          SettingsPage._showZonesManager();
        });
      });
      el.querySelectorAll('[data-zone-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var z = zones.find(function(x) { return x.id === parseInt(b.dataset.zoneEdit); });
          if (!z) return;
          Modal.form('Modifier zone', zoneFields(z), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateZone(z.id, { name:data.name, code:data.code||null, type:data.type||null });
            Toast.success('Zone modifiée');
            SettingsPage._showZonesManager();
          });
        });
      });
      el.querySelectorAll('[data-zone-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          var zid = parseInt(b.dataset.zoneDel);
          Modal.confirm('Supprimer cette zone ?', async function() {
            try { await Api.deleteZone(zid); Toast.success('Zone supprimée'); SettingsPage._showZonesManager(); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ═══ ONGLET 3 — HÉBERGEMENT ════════════════════════════════════
  _roomFilterStatus: 'all',
  _roomFilterFloor: 'all',
  _roomFilterZone: 'all',

  async _showRoomsManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var rooms = await Api.rooms();
      var zones = await Api.zones().catch(function() { return []; });
      var fStatus = SettingsPage._roomFilterStatus || 'all';
      var fFloor  = SettingsPage._roomFilterFloor  || 'all';
      var fZone   = SettingsPage._roomFilterZone   || 'all';
      var STATUS_COLORS = { libre:'#10b981',occupee:'#f59e0b',en_menage:'#6366f1',sale:'#ef4444',bloquee:'#64748b',prete:'#22d3ee' };
      var STATUS_LABELS = { libre:'Libre',occupee:'Occupée',en_menage:'En menage',sale:'Sale',bloquee:'Bloquee',prete:'Prete' };
      var floors = Array.from(new Set(rooms.map(function(r){ return r.floor; }))).sort(function(a,b){return a-b;});
      var filterBar = '<div class="settings-filter-bar">'
        + '<select id="room-filter-status"><option value="all">Tous statuts</option>'
        + ['libre','occupee','en_menage','sale','bloquee','prete'].map(function(s){ return '<option value="'+s+'"'+(fStatus===s?' selected':'')+'>'+STATUS_LABELS[s]+'</option>'; }).join('')
        + '</select>'
        + '<select id="room-filter-floor"><option value="all">Tous etages</option>'
        + floors.map(function(f){ return '<option value="'+f+'"'+(fFloor===String(f)?' selected':'')+'>Etage '+f+'</option>'; }).join('')
        + '</select>'
        + '<select id="room-filter-zone"><option value="all">Toutes zones</option>'
        + zones.map(function(z){ return '<option value="'+z.id+'"'+(fZone===String(z.id)?' selected':'')+'>'+z.name+'</option>'; }).join('')
        + '</select></div>';
      var visible = rooms.filter(function(r) {
        if (fStatus !== 'all' && r.status !== fStatus) return false;
        if (fFloor  !== 'all' && String(r.floor) !== fFloor) return false;
        if (fZone   !== 'all' && String(r.zone_id) !== fZone) return false;
        return true;
      });
      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">Chambres</div>'
        + '<div class="section-sub">' + visible.length + '/' + rooms.length + ' chambre(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="room-add-btn">+ Ajouter</button></div>'
        + filterBar;
      if (visible.length > 0) {
        h += '<div class="activity-list">';
        visible.forEach(function(room) {
          var color = STATUS_COLORS[room.status] || '#64748b';
          var label = STATUS_LABELS[room.status] || room.status;
          var zone = zones.find(function(z) { return z.id === room.zone_id; });
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(16,185,129,.08);font-size:18px">bed</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">Chambre ' + room.number + (room.type !== 'standard' ? ' - ' + room.type : '') + '</div>'
            + '<div class="list-item-sub">Etage ' + room.floor + (zone ? ' - ' + zone.name : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span class="badge" style="background:' + color + '22;color:' + color + '">' + label + '</span>'
            + '<button class="btn btn-secondary btn-sm" data-room-edit="' + room.id + '">edit</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-room-del="' + room.id + '">del</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState("bed", 'Aucune chambre' + (fStatus !== 'all' || fFloor !== 'all' || fZone !== 'all' ? ' avec ces filtres' : '')); }
      el.innerHTML = h;
      var statusSel = document.getElementById('room-filter-status');
      var floorSel  = document.getElementById('room-filter-floor');
      var zoneSel   = document.getElementById('room-filter-zone');
      if (statusSel) statusSel.addEventListener('change', function() { SettingsPage._roomFilterStatus = statusSel.value; SettingsPage._showRoomsManager(); });
      if (floorSel)  floorSel.addEventListener('change',  function() { SettingsPage._roomFilterFloor = floorSel.value; SettingsPage._showRoomsManager(); });
      if (zoneSel)   zoneSel.addEventListener('change',   function() { SettingsPage._roomFilterZone = zoneSel.value; SettingsPage._showRoomsManager(); });
      var statusOpts = [{value:'libre',label:'Libre'},{value:'occupee',label:'Occupee'},{value:'en_menage',label:'En menage'},{value:'sale',label:'Sale'},{value:'bloquee',label:'Bloquee'},{value:'prete',label:'Prete'}];
      var typeOpts = [{value:'standard',label:'Standard'},{value:'suite',label:'Suite'},{value:'pmr',label:'PMR'},{value:'double',label:'Double'},{value:'twin',label:'Twin'},{value:'simple',label:'Simple'}];
      var zoneOpts = [{value:'',label:'- Aucune zone -'}].concat(zones.map(function(z) { return {value:String(z.id),label:z.name}; }));
      var roomFields = function(r) {
        r = r || {};
        return [
          { key:'number', label:'Numero *', value:r.number||'', placeholder:'101' },
          { key:'floor',  label:'Etage',    value:r.floor!=null?String(r.floor):'1', placeholder:'1' },
          { key:'type',   label:'Type',     value:r.type||'standard', type:'select', options:typeOpts },
          { key:'status', label:'Statut',   value:r.status||'sale', type:'select', options:statusOpts },
          { key:'zone_id',label:'Zone',     value:r.zone_id?String(r.zone_id):'', type:'select', options:zoneOpts },
          { key:'notes',  label:'Notes',    value:r.notes||'', placeholder:'Informations' },
        ];
      };
      var addBtn = document.getElementById('room-add-btn');
      if (addBtn) addBtn.addEventListener('click', function() {
        Modal.form('Nouvelle chambre', roomFields(), async function(data) {
          if (!data.number) throw new Error('Numero requis');
          await Api.createRoom({ number:data.number, floor:parseInt(data.floor)||1, type:data.type||'standard', notes:data.notes||null, zone_id:data.zone_id?parseInt(data.zone_id):null });
          Toast.success('Chambre ajoutee'); SettingsPage._showRoomsManager();
        });
      });
      el.querySelectorAll('[data-room-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var room = rooms.find(function(x) { return x.id === parseInt(b.dataset.roomEdit); });
          if (!room) return;
          Modal.form('Modifier chambre', roomFields(room), async function(data) {
            if (!data.number) throw new Error('Numero requis');
            await Api.updateRoom(room.id, { number:data.number, floor:parseInt(data.floor)||1, type:data.type||'standard', status:data.status||null, notes:data.notes||null, zone_id:data.zone_id?parseInt(data.zone_id):null });
            Toast.success('Chambre modifiee'); SettingsPage._showRoomsManager();
          });
        });
      });
      el.querySelectorAll('[data-room-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer cette chambre ? Action irreversible.', async function() {
            try { await Api.deleteRoom(parseInt(b.dataset.roomDel)); Toast.success('Chambre supprimee'); SettingsPage._showRoomsManager(); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },
  // ═══ ONGLET 4 — EXPLOITATION : router 3 sous-onglets ═══════════
  _exploitSubTab: 'tasks',

  async _showExploitationManager() {
    var el = this._tabEl(); if (!el) return;
    this._exploitSubTab = this._exploitSubTab || 'tasks';
    this._renderExploitNav(el);
  },

  _renderExploitNav: function(el) {
    var self = this;
    var subTabs = [
      { id:'tasks',        label:'✅ Tâches' },
      { id:'interventions',label:'🛠️ Interventions' },
      { id:'referentiels', label:'📋 Référentiels' },
    ];
    var nav = '<div class="exploit-subnav">'
      + subTabs.map(function(t) {
          return '<button class="exploit-subnav-btn' + (self._exploitSubTab===t.id?' active':'') + '" data-exploit-tab="' + t.id + '">' + t.label + '</button>';
        }).join('')
      + '</div>'
      + '<div id="exploit-sub-content"></div>';
    el.innerHTML = nav;
    el.querySelectorAll('[data-exploit-tab]').forEach(function(b) {
      b.addEventListener('click', function() {
        self._exploitSubTab = b.dataset.exploitTab;
        el.querySelectorAll('[data-exploit-tab]').forEach(function(x) { x.classList.toggle('active', x.dataset.exploitTab===b.dataset.exploitTab); });
        self._loadExploitSub(b.dataset.exploitTab);
      });
    });
    this._loadExploitSub(this._exploitSubTab);
  },

  _loadExploitSub: function(sub) {
    var subEl = document.getElementById('exploit-sub-content');
    if (!subEl) return;
    if (sub === 'tasks')         this._showTasksManager(subEl);
    else if (sub === 'interventions') this._showInterventionsManager(subEl);
    else if (sub === 'referentiels')  this._showReferentielsManager(subEl);
  },

  // ── Manager autonome Tâches ──────────────────────────────────────
  async _showTasksManager(subEl) {
    var el = subEl || this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var tasks  = await Api.tasks();
      var rooms  = await Api.rooms().catch(function() { return []; });
      var users  = await Api.users().catch(function() { return []; });

      var STATUS_TASK = { a_faire:'À faire', en_cours:'En cours', pause:'Pause', terminee:'Terminée', validee:'Validée', refusee:'Refusée' };
      var PRIO_COLORS = { basse:'#64748b', normale:'#3b82f6', haute:'#f59e0b', urgente:'#ef4444' };
      var PRIO_LABELS = { basse:'Basse', normale:'Normale', haute:'Haute', urgente:'Urgente' };

      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">✅ Tâches</div>'
        + '<div class="section-sub">' + tasks.length + ' tâche(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="task-add-btn">+ Créer</button></div>';

      if (tasks.length > 0) {
        h += '<div class="activity-list">';
        tasks.forEach(function(task) {
          var prioColor = PRIO_COLORS[task.priority] || '#64748b';
          var prioLabel = PRIO_LABELS[task.priority] || task.priority;
          var statusLabel = STATUS_TASK[task.status] || task.status;
          var assignee = users.find(function(u) { return u.id === task.assigned_to_id; });
          var room = task.room_id ? rooms.find(function(r) { return r.id === task.room_id; }) : null;
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(34,197,94,.08);font-size:18px">✅</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + task.title + '</div>'
            + '<div class="list-item-sub">' + statusLabel
            + (task.service ? ' · ' + task.service : '')
            + (room ? ' · Ch.' + room.number : '')
            + (assignee ? ' · ' + assignee.name : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span class="badge" style="background:' + prioColor + '22;color:' + prioColor + '">' + prioLabel + '</span>'
            + '<button class="btn btn-secondary btn-sm" data-task-edit="' + task.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-task-del="' + task.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('✅', 'Aucune tâche'); }

      el.innerHTML = h;

      var prioOpts = [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}];
      var statusOpts = [{value:'a_faire',label:'À faire'},{value:'en_cours',label:'En cours'},{value:'pause',label:'Pause'},{value:'terminee',label:'Terminée'},{value:'validee',label:'Validée'}];
      var roomOpts = [{value:'',label:'— Aucune chambre —'}].concat(rooms.map(function(r) { return {value:String(r.id),label:'Ch. ' + r.number}; }));
      var userOpts = [{value:'',label:'— Non assignée —'}].concat(users.map(function(u) { return {value:String(u.id),label:u.name}; }));

      var taskFields = function(t) {
        t = t || {};
        return [
          { key:'title',          label:'Titre *',    value:t.title||'',                                   placeholder:'Ex: Nettoyage chambre 201' },
          { key:'description',    label:'Description',value:t.description||'',                             placeholder:'Détails…' },
          { key:'priority',       label:'Priorité',   value:t.priority||'normale',                         type:'select', options:prioOpts },
          { key:'status',         label:'Statut',     value:t.status||'a_faire',                           type:'select', options:statusOpts },
          { key:'service',        label:'Service',    value:t.service||'',                                 placeholder:'Ex: housekeeping' },
          { key:'room_id',        label:'Chambre',    value:t.room_id?String(t.room_id):'',                type:'select', options:roomOpts },
          { key:'assigned_to_id', label:'Assignée à', value:t.assigned_to_id?String(t.assigned_to_id):'', type:'select', options:userOpts },
        ];
      };

      document.getElementById('task-add-btn') && document.getElementById('task-add-btn').addEventListener('click', function() {
        Modal.form('Nouvelle tâche', taskFields(), async function(data) {
          if (!data.title) throw new Error('Titre requis');
          await Api.createTask({
            title:data.title, description:data.description||null,
            priority:data.priority||'normale', service:data.service||null,
            room_id:data.room_id?parseInt(data.room_id):null,
            assigned_to_id:data.assigned_to_id?parseInt(data.assigned_to_id):null
          });
          Toast.success('Tâche créée');
          SettingsPage._showTasksManager(el);
        });
      });

      el.querySelectorAll('[data-task-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var t = tasks.find(function(x) { return x.id === parseInt(b.dataset.taskEdit); });
          if (!t) return;
          Modal.form('Modifier tâche', taskFields(t), async function(data) {
            if (!data.title) throw new Error('Titre requis');
            await Api.updateTask(t.id, {
              title:data.title, description:data.description||null,
              priority:data.priority||'normale', status:data.status||null,
              service:data.service||null,
              room_id:data.room_id?parseInt(data.room_id):null,
              assigned_to_id:data.assigned_to_id?parseInt(data.assigned_to_id):null
            });
            Toast.success('Tâche modifiée');
            SettingsPage._showTasksManager(el);
          });
        });
      });

      el.querySelectorAll('[data-task-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer cette tâche ?', async function() {
            try { await Api.deleteTask(parseInt(b.dataset.taskDel)); Toast.success('Tâche supprimée'); SettingsPage._showTasksManager(el); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ── Manager autonome Interventions ───────────────────────────────
  async _showInterventionsManager(subEl) {
    var el = subEl || this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var invs   = await Api.interventions();
      var rooms  = await Api.rooms().catch(function() { return []; });
      var users  = await Api.users().catch(function() { return []; });

      var STATUS_INV  = { nouvelle:'Nouvelle', en_attente:'En attente', prise:'Prise', en_cours:'En cours', pause:'Pause', terminee:'Terminée', cloturee:'Clôturée', duplicate:'Doublon' };
      var PRIO_COLORS = { basse:'#64748b', normale:'#3b82f6', haute:'#f59e0b', urgente:'#ef4444' };
      var PRIO_LABELS = { basse:'Basse', normale:'Normale', haute:'Haute', urgente:'Urgente' };

      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">🛠️ Interventions</div>'
        + '<div class="section-sub">' + invs.length + ' intervention(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="inv-add-btn">+ Créer</button></div>';

      if (invs.length > 0) {
        h += '<div class="activity-list">';
        invs.forEach(function(inv) {
          var prioColor = PRIO_COLORS[inv.priority] || '#64748b';
          var prioLabel = PRIO_LABELS[inv.priority] || inv.priority;
          var statusLabel = STATUS_INV[inv.status] || inv.status;
          var room = inv.room_id ? rooms.find(function(r) { return r.id === inv.room_id; }) : null;
          var takenBy = inv.taken_by_id ? users.find(function(u) { return u.id === inv.taken_by_id; }) : null;
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(245,158,11,.08);font-size:18px">🛠️</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + inv.title + '</div>'
            + '<div class="list-item-sub">' + statusLabel
            + (room ? ' · Ch.' + room.number : '')
            + (inv.zone ? ' · ' + inv.zone : '')
            + (takenBy ? ' · ' + takenBy.name : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span class="badge" style="background:' + prioColor + '22;color:' + prioColor + '">' + prioLabel + '</span>'
            + '<button class="btn btn-secondary btn-sm" data-inv-edit="' + inv.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-inv-del="' + inv.id + '" data-inv-title="' + inv.title + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('🛠️', 'Aucune intervention'); }

      el.innerHTML = h;

      var prioOpts = [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}];
      var sourceOpts = [{value:'staff',label:'Staff'},{value:'client',label:'Client'},{value:'technique',label:'Technique'},{value:'direction',label:'Direction'}];
      var statusInvOpts = [{value:'nouvelle',label:'Nouvelle'},{value:'en_attente',label:'En attente'},{value:'prise',label:'Prise'},{value:'en_cours',label:'En cours'},{value:'terminee',label:'Terminée'},{value:'cloturee',label:'Clôturée'}];
      var roomOpts = [{value:'',label:'— Aucune chambre —'}].concat(rooms.map(function(r) { return {value:String(r.id),label:'Ch. ' + r.number}; }));

      var invCreateFields = function() {
        return [
          { key:'title',       label:'Titre *',     value:'', placeholder:'Ex: Fuite robinet' },
          { key:'description', label:'Description', value:'', placeholder:'Détails…' },
          { key:'priority',    label:'Priorité',    value:'normale', type:'select', options:prioOpts },
          { key:'source',      label:'Source',      value:'staff',   type:'select', options:sourceOpts },
          { key:'zone',        label:'Zone/Lieu',   value:'', placeholder:'Ex: Hall, Piscine…' },
          { key:'room_id',     label:'Chambre',     value:'', type:'select', options:roomOpts },
        ];
      };

      document.getElementById('inv-add-btn') && document.getElementById('inv-add-btn').addEventListener('click', function() {
        Modal.form('Nouvelle intervention', invCreateFields(), async function(data) {
          if (!data.title) throw new Error('Titre requis');
          await Api.createIntervention({
            title:data.title, description:data.description||null,
            priority:data.priority||'normale', source:data.source||'staff',
            zone:data.zone||null, zone_id:null,
            room_id:data.room_id?parseInt(data.room_id):null
          });
          Toast.success('Intervention créée');
          SettingsPage._showInterventionsManager(el);
        });
      });

      el.querySelectorAll('[data-inv-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var inv = invs.find(function(x) { return x.id === parseInt(b.dataset.invEdit); });
          if (!inv) return;
          Modal.form('Modifier intervention', [
            { key:'title',           label:'Titre *',         value:inv.title||'',             placeholder:'Titre' },
            { key:'description',     label:'Description',     value:inv.description||'',       placeholder:'Détails…' },
            { key:'priority',        label:'Priorité',        value:inv.priority||'normale',    type:'select', options:prioOpts },
            { key:'status',          label:'Statut',          value:inv.status||'nouvelle',     type:'select', options:statusInvOpts },
            { key:'zone',            label:'Zone/Lieu',       value:inv.zone||'',              placeholder:'Ex: Hall, Piscine…' },
            { key:'resolution_note', label:'Note résolution', value:inv.resolution_note||'',   placeholder:'Ce qui a été fait…' },
          ], async function(data) {
            if (!data.title) throw new Error('Titre requis');
            await Api.updateIntervention(inv.id, {
              title:data.title||null, priority:data.priority||null,
              status:data.status||null, zone:data.zone||null,
              resolution_note:data.resolution_note||null
            });
            Toast.success('Intervention modifiée');
            SettingsPage._showInterventionsManager(el);
          });
        });
      });

      el.querySelectorAll('[data-inv-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          var iid = parseInt(b.dataset.invDel);
          var title = b.dataset.invTitle || 'cette intervention';
          Modal.confirm('Supprimer "' + title + '" ?', async function() {
            try {
              await Api.deleteIntervention(iid);
              Toast.success('Intervention supprimée');
              SettingsPage._showInterventionsManager(el);
            } catch(e) { Toast.error(e.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ── Manager Référentiels (catégories tâches + types interventions) ─
  async _showReferentielsManager(subEl) {
    var el = subEl || this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var taskCats = await Api.taskCategories().catch(function() { return []; });
      var invTypes = await Api.interventionTypes().catch(function() { return []; });
      var prioOpts = [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}];

      var h = '<div class="settings-sub-section">'
        + '<div class="settings-section-header" style="margin-bottom:0">'
        + '<div><div class="section-title" style="font-size:15px">Catégories de tâches</div>'
        + '<div class="section-sub">' + taskCats.length + ' catégorie(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="taskcat-add-btn">+ Ajouter</button></div>';
      if (taskCats.length > 0) {
        h += '<div class="activity-list" style="margin-top:8px">';
        taskCats.forEach(function(c) {
          var dot = c.color ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c.color + ';margin-right:6px"></span>' : '';
          h += '<div class="list-item"><div class="list-item-body">'
            + '<div class="list-item-title">' + dot + c.name + '</div>'
            + '<div class="list-item-sub">' + (c.code||'—') + '</div></div>'
            + '<div class="list-item-right" style="gap:4px">'
            + '<button class="btn btn-secondary btn-sm" data-taskcat-edit="' + c.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-taskcat-del="' + c.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += '<div style="font-size:13px;color:var(--text-3);padding:8px 0">Aucune catégorie</div>'; }
      h += '</div>';

      h += '<div class="settings-sub-section" style="margin-top:16px">'
        + '<div class="settings-section-header" style="margin-bottom:0">'
        + '<div><div class="section-title" style="font-size:15px">Types d\'intervention</div>'
        + '<div class="section-sub">' + invTypes.length + ' type(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="invtype-add-btn">+ Ajouter</button></div>';
      if (invTypes.length > 0) {
        h += '<div class="activity-list" style="margin-top:8px">';
        invTypes.forEach(function(t) {
          h += '<div class="list-item"><div class="list-item-body">'
            + '<div class="list-item-title">' + t.name + '</div>'
            + '<div class="list-item-sub">' + (t.code||'—') + ' · ' + t.default_priority + '</div></div>'
            + '<div class="list-item-right" style="gap:4px">'
            + '<button class="btn btn-secondary btn-sm" data-invtype-edit="' + t.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-invtype-del="' + t.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += '<div style="font-size:13px;color:var(--text-3);padding:8px 0">Aucun type</div>'; }
      h += '</div>';

      el.innerHTML = h;

      var catFields = function(c) {
        c = c || {};
        return [
          { key:'name',  label:'Nom *',   value:c.name||'',  placeholder:'Ex: Ménage' },
          { key:'code',  label:'Code',    value:c.code||'',  placeholder:'MENAGE' },
          { key:'color', label:'Couleur', value:c.color||'', placeholder:'#10b981' },
        ];
      };
      document.getElementById('taskcat-add-btn') && document.getElementById('taskcat-add-btn').addEventListener('click', function() {
        Modal.form('Nouvelle catégorie', catFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          await Api.createTaskCategory({ name:data.name, code:data.code||null, color:data.color||null });
          Toast.success('Catégorie créée'); SettingsPage._showReferentielsManager(el);
        });
      });
      el.querySelectorAll('[data-taskcat-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var c = taskCats.find(function(x) { return x.id === parseInt(b.dataset.taskcatEdit); });
          if (!c) return;
          Modal.form('Modifier catégorie', catFields(c), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateTaskCategory(c.id, { name:data.name, code:data.code||null, color:data.color||null });
            Toast.success('Modifiée'); SettingsPage._showReferentielsManager(el);
          });
        });
      });
      el.querySelectorAll('[data-taskcat-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer ?', async function() {
            try { await Api.deleteTaskCategory(parseInt(b.dataset.taskcatDel)); Toast.success('Supprimée'); SettingsPage._showReferentielsManager(el); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });

      var itFields = function(t) {
        t = t || {};
        return [
          { key:'name',             label:'Nom *',           value:t.name||'',             placeholder:'Ex: Plomberie' },
          { key:'code',             label:'Code',            value:t.code||'',             placeholder:'PLOMB' },
          { key:'default_priority', label:'Priorité défaut', value:t.default_priority||'normale', type:'select', options:prioOpts },
        ];
      };
      document.getElementById('invtype-add-btn') && document.getElementById('invtype-add-btn').addEventListener('click', function() {
        Modal.form("Nouveau type d'intervention", itFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          await Api.createInterventionType({ name:data.name, code:data.code||null, default_priority:data.default_priority||'normale' });
          Toast.success('Type créé'); SettingsPage._showReferentielsManager(el);
        });
      });
      el.querySelectorAll('[data-invtype-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var t = invTypes.find(function(x) { return x.id === parseInt(b.dataset.invtypeEdit); });
          if (!t) return;
          Modal.form("Modifier type", itFields(t), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateInterventionType(t.id, { name:data.name, code:data.code||null, default_priority:data.default_priority||'normale' });
            Toast.success('Modifié'); SettingsPage._showReferentielsManager(el);
          });
        });
      });
      el.querySelectorAll('[data-invtype-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer ce type ?', async function() {
            try { await Api.deleteInterventionType(parseInt(b.dataset.invtypeDel)); Toast.success('Supprimé'); SettingsPage._showReferentielsManager(el); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },



  // ═══ ONGLET 5 — STOCK ══════════════════════════════════════════
  async _showStockManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var items = await Api.stockItems();
      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">📦 Articles de stock</div>'
        + '<div class="section-sub">' + items.length + ' article(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="stock-add-btn">+ Ajouter</button></div>';
      if (items.length > 0) {
        h += '<div class="activity-list">';
        items.forEach(function(item) {
          var isLow = item.quantity <= item.threshold_min;
          var qtyColor = isLow ? 'var(--danger)' : 'var(--success)';
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(168,85,247,.08);font-size:20px">📦</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + item.name + (item.category ? ' · ' + item.category : '') + '</div>'
            + '<div class="list-item-sub">' + (item.reference||'') + ' · ' + (item.unit||'unité') + ' · Seuil: ' + item.threshold_min + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span style="font-size:16px;font-weight:700;color:' + qtyColor + '">' + item.quantity + '</span>'
            + '<button class="btn btn-secondary btn-sm" data-stock-move="' + item.id + '" title="Mouvement">±</button>'
            + '<button class="btn btn-secondary btn-sm" data-stock-edit="' + item.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-stock-del="' + item.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('📦', 'Aucun article de stock'); }
      el.innerHTML = h;

      var unitOpts = ['unite','kg','g','litre','ml','boite','rouleau','sac','palette','autre'].map(function(u) {
        return { value:u, label:u.charAt(0).toUpperCase()+u.slice(1) };
      });
      var stockFields = function(i) {
        i = i || {};
        return [
          { key:'name',          label:'Nom *',         value:i.name||'',                              placeholder:'Ex: Gel douche' },
          { key:'reference',     label:'Référence',     value:i.reference||'',                         placeholder:'GEL-001' },
          { key:'category',      label:'Catégorie',     value:i.category||'',                          placeholder:'Hygiène, Nettoyage…' },
          { key:'unit',          label:'Unité',         value:i.unit||'unite',                         type:'select', options:unitOpts },
          { key:'threshold_min', label:'Seuil minimum', value:i.threshold_min!=null?String(i.threshold_min):'5', placeholder:'5' },
          { key:'location',      label:'Emplacement',   value:i.location||'',                          placeholder:'Réserve RDC' },
          { key:'unit_cost',     label:'Coût unitaire', value:i.unit_cost!=null?String(i.unit_cost):'0', placeholder:'0.00' },
        ];
      };

      var stockAddBtn = document.getElementById('stock-add-btn');
      if (stockAddBtn) stockAddBtn.addEventListener('click', function() {
        Modal.form('Nouvel article', stockFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          await Api.createStockItem({ name:data.name, reference:data.reference||null, category:data.category||null, unit:data.unit||'unite', threshold_min:parseFloat(data.threshold_min)||5, location:data.location||null, unit_cost:parseFloat(data.unit_cost)||0, is_active:true });
          Toast.success('Article créé'); SettingsPage._showStockManager();
        });
      });
      el.querySelectorAll('[data-stock-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var item = items.find(function(x) { return x.id === parseInt(b.dataset.stockEdit); });
          if (!item) return;
          Modal.form('Modifier article', stockFields(item), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateStockItem(item.id, { name:data.name, reference:data.reference||null, category:data.category||null, unit:data.unit||'unite', threshold_min:parseFloat(data.threshold_min)||5, location:data.location||null, unit_cost:parseFloat(data.unit_cost)||0 });
            Toast.success('Article modifié'); SettingsPage._showStockManager();
          });
        });
      });
      el.querySelectorAll('[data-stock-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer cet article ?', async function() {
            try { await Api.deleteStockItem(parseInt(b.dataset.stockDel)); Toast.success('Supprimé'); SettingsPage._showStockManager(); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
      el.querySelectorAll('[data-stock-move]').forEach(function(b) {
        b.addEventListener('click', function() {
          var item = items.find(function(x) { return x.id === parseInt(b.dataset.stockMove); });
          if (item) SettingsPage._stockMovement(item);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _stockMovement: function(item) {
    var moveTypeOpts = [
      {value:'entree',    label:'Entrée (réception)'},
      {value:'sortie',    label:'Sortie (consommation)'},
      {value:'inventaire',label:'Inventaire (correction)'},
    ];
    Modal.form('Mouvement — ' + item.name, [
      { key:'type',     label:'Type',     value:'entree', type:'select', options:moveTypeOpts },
      { key:'quantity', label:'Quantité', value:'',       placeholder:'Ex: 10' },
      { key:'note',     label:'Note',     value:'',       placeholder:'Optionnel' },
    ], async function(data) {
      if (!data.quantity || isNaN(parseFloat(data.quantity))) throw new Error('Quantité invalide');
      await Api.addMovement({ item_id:item.id, type:data.type, quantity:parseFloat(data.quantity), note:data.note||null });
      Toast.success('Mouvement enregistré'); SettingsPage._showStockManager();
    });
  },

  // ═══ ONGLET 6 — TECHNIQUE ══════════════════════════════════════
  async _showTechniqueManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var families = await Api.equipmentFamilies();
      var types    = await Api.equipmentTypes();
      var items    = await Api.equipmentItems();
      var STATUS_EQ = { ok:'✅ OK', en_panne:'❌ En panne', maintenance:'🔧 Maintenance', hors_service:'⛔ Hors service' };

      var h = '<div class="settings-section-header"><div class="section-title">🛠️ Équipements</div></div>';

      // ── Familles (CRUD complet) ──
      h += '<div class="settings-sub-section">'
        + '<div class="settings-section-header" style="margin-bottom:0">'
        + '<div><div class="section-title" style="font-size:15px">Familles</div>'
        + '<div class="section-sub">' + families.length + ' famille(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="fam-add-btn">+ Famille</button></div>';
      if (families.length > 0) {
        h += '<div class="activity-list" style="margin-top:8px">';
        families.forEach(function(f) {
          var cnt = types.filter(function(t) { return t.family_id === f.id; }).length;
          h += '<div class="list-item"><div class="list-item-body">'
            + '<div class="list-item-title">' + f.name + '</div>'
            + '<div class="list-item-sub">' + f.code + ' · ' + cnt + ' type(s)</div></div>'
            + '<div class="list-item-right" style="gap:4px">'
            + '<button class="btn btn-secondary btn-sm" data-fam-edit="' + f.id + '">✏️</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('🏷️', 'Aucune famille'); }
      h += '</div>';

      // ── Types (CRUD complet) ──
      h += '<div class="settings-sub-section" style="margin-top:16px">'
        + '<div class="settings-section-header" style="margin-bottom:0">'
        + '<div><div class="section-title" style="font-size:15px">Types</div>'
        + '<div class="section-sub">' + types.length + ' type(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="eqtype-add-btn">+ Type</button></div>';
      if (types.length > 0) {
        h += '<div class="activity-list" style="margin-top:8px">';
        types.forEach(function(t) {
          var fam = families.find(function(f) { return f.id === t.family_id; });
          h += '<div class="list-item"><div class="list-item-body">'
            + '<div class="list-item-title">' + t.name + '</div>'
            + '<div class="list-item-sub">' + t.code + (fam ? ' · ' + fam.name : '') + '</div></div>'
            + '<div class="list-item-right" style="gap:4px">'
            + (t.is_active ? '' : '<span class="badge badge-bloquee">Inactif</span> ')
            + '<button class="btn btn-secondary btn-sm" data-eqtype-edit="' + t.id + '">✏️</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('🔖', 'Aucun type'); }
      h += '</div>';

      // ── Équipements CRUD ──
      h += '<div class="settings-sub-section" style="margin-top:16px">'
        + '<div class="settings-section-header" style="margin-bottom:0">'
        + '<div><div class="section-title" style="font-size:15px">Équipements</div>'
        + '<div class="section-sub">' + items.length + ' équipement(s)</div></div>'
        + '<button class="btn btn-primary btn-sm" id="eq-add-btn">+ Ajouter</button></div>';
      if (items.length > 0) {
        h += '<div class="activity-list" style="margin-top:8px">';
        items.forEach(function(item) {
          var fam = families.find(function(f) { return f.id === item.family_id; });
          var typ = types.find(function(t) { return t.id === item.type_id; });
          var statusLabel = STATUS_EQ[item.status] || item.status;
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(245,158,11,.08);font-size:18px">⚙️</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + item.name + '</div>'
            + '<div class="list-item-sub">' + (fam ? fam.name : '—') + ' · ' + (typ ? typ.name : '—') + (item.asset_code ? ' · ' + item.asset_code : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span style="font-size:12px">' + statusLabel + '</span>'
            + '<button class="btn btn-secondary btn-sm" data-eq-edit="' + item.id + '">✏️</button>'
            + '<button class="btn btn-sm" style="color:var(--danger)" data-eq-del="' + item.id + '">🗑</button>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('⚙️', 'Aucun équipement'); }
      h += '</div>';

      el.innerHTML = h;

      // ── Handlers Familles ──
      var famFields = function(f) {
        f = f || {};
        return [
          { key:'name', label:'Nom *',  value:f.name||'', placeholder:'Ex: Climatisation' },
          { key:'code', label:'Code *', value:f.code||'', placeholder:'Ex: CLIM' },
          { key:'sort_order', label:'Ordre', value:f.sort_order!=null?String(f.sort_order):'0', placeholder:'0' },
        ];
      };
      document.getElementById('fam-add-btn') && document.getElementById('fam-add-btn').addEventListener('click', function() {
        Modal.form('Nouvelle famille', famFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          if (!data.code) throw new Error('Code requis');
          await Api.createEquipmentFamily({ name:data.name, code:data.code, sort_order:parseInt(data.sort_order)||0 });
          Toast.success('Famille créée'); SettingsPage._showTechniqueManager();
        });
      });
      el.querySelectorAll('[data-fam-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var f = families.find(function(x) { return x.id === parseInt(b.dataset.famEdit); });
          if (!f) return;
          Modal.form('Modifier famille', famFields(f), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateEquipmentFamily(f.id, { name:data.name, code:data.code||null, sort_order:parseInt(data.sort_order)||0 });
            Toast.success('Famille modifiée'); SettingsPage._showTechniqueManager();
          });
        });
      });

      // ── Handlers Types ──
      var famOpts = families.map(function(f) { return {value:String(f.id), label:f.name}; });
      var typeFields = function(t) {
        t = t || {};
        return [
          { key:'name',      label:'Nom *',   value:t.name||'',                           placeholder:'Ex: Split mural' },
          { key:'code',      label:'Code *',  value:t.code||'',                           placeholder:'Ex: SPLIT_MURAL' },
          { key:'family_id', label:'Famille', value:t.family_id?String(t.family_id):'',   type:'select', options:famOpts },
        ];
      };
      document.getElementById('eqtype-add-btn') && document.getElementById('eqtype-add-btn').addEventListener('click', function() {
        Modal.form('Nouveau type', typeFields(), async function(data) {
          if (!data.name) throw new Error('Nom requis');
          if (!data.code) throw new Error('Code requis');
          if (!data.family_id) throw new Error('Famille requise');
          await Api.createEquipmentType({ name:data.name, code:data.code, family_id:parseInt(data.family_id) });
          Toast.success('Type créé'); SettingsPage._showTechniqueManager();
        });
      });
      el.querySelectorAll('[data-eqtype-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var t = types.find(function(x) { return x.id === parseInt(b.dataset.eqtypeEdit); });
          if (!t) return;
          Modal.form('Modifier type', typeFields(t), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateEquipmentType(t.id, { name:data.name, code:data.code||null, family_id:data.family_id?parseInt(data.family_id):null });
            Toast.success('Type modifié'); SettingsPage._showTechniqueManager();
          });
        });
      });

      // ── Handlers Équipements ──
      var typeOpts = types.map(function(t) { return {value:String(t.id), label:t.name}; });
      var eqStatusOpts = [{value:'ok',label:'OK'},{value:'en_panne',label:'En panne'},{value:'maintenance',label:'Maintenance'},{value:'hors_service',label:'Hors service'}];
      var eqFields = function(i) {
        i = i || {};
        return [
          { key:'name',       label:'Nom *',  value:i.name||'',                           placeholder:'Ex: Chaudière principale' },
          { key:'family_id',  label:'Famille',value:i.family_id?String(i.family_id):'',   type:'select', options:famOpts },
          { key:'type_id',    label:'Type',   value:i.type_id?String(i.type_id):'',       type:'select', options:typeOpts },
          { key:'asset_code', label:'Code',   value:i.asset_code||'',                     placeholder:'EQ-2024-001' },
          { key:'status',     label:'Statut', value:i.status||'ok',                       type:'select', options:eqStatusOpts },
          { key:'notes',      label:'Notes',  value:i.notes||'',                          placeholder:'Informations complémentaires' },
        ];
      };
      document.getElementById('eq-add-btn') && document.getElementById('eq-add-btn').addEventListener('click', function() {
        if (families.length === 0) {
          Toast.error('Créez d\'abord une famille d\'équipement avant d\'ajouter un équipement.');
          return;
        }
        if (types.length === 0) {
          Toast.error('Créez d\'abord un type d\'équipement avant d\'ajouter un équipement.');
          return;
        }
        Modal.form('Nouvel équipement', eqFields(), async function(data) {
          if (!data.name) throw new Error('Titre requis');
          var famId = parseInt(data.family_id);
          var typId = parseInt(data.type_id);
          if (!famId || isNaN(famId)) throw new Error('Sélectionnez une famille');
          if (!typId || isNaN(typId)) throw new Error('Sélectionnez un type');
          await Api.createEquipmentItem({ name:data.name, family_id:famId, type_id:typId, asset_code:data.asset_code||null, status:data.status||'ok', notes:data.notes||null });
          Toast.success('Équipement ajouté ✓'); SettingsPage._showTechniqueManager();
        });
        setTimeout(function() {
          var famSel = document.getElementById('mf-family_id');
          var typSel = document.getElementById('mf-type_id');
          if (famSel && typSel) {
            famSel.addEventListener('change', function() {
              var fid = famSel.value;
              var ft = types.filter(function(t){ return String(t.family_id) === fid; });
              typSel.innerHTML = ft.length
                ? ft.map(function(t){ return '<option value="'+t.id+'">'+t.name+'</option>'; }).join('')
                : '<option value="">— Aucun type —</option>';
            });
          }
        }, 100);
      });
      el.querySelectorAll('[data-eq-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          var item = items.find(function(x) { return x.id === parseInt(b.dataset.eqEdit); });
          if (!item) return;
          Modal.form('Modifier équipement', eqFields(item), async function(data) {
            if (!data.name) throw new Error('Nom requis');
            var famId = parseInt(data.family_id);
            var typId = parseInt(data.type_id);
            if (!famId || isNaN(famId)) throw new Error('Sélectionnez une famille');
            if (!typId || isNaN(typId)) throw new Error('Sélectionnez un type');
            await Api.updateEquipmentItem(item.id, { name:data.name, family_id:famId, type_id:typId, asset_code:data.asset_code||null, status:data.status||'ok', notes:data.notes||null });
            Toast.success('Modifié'); SettingsPage._showTechniqueManager();
          });
        });
      });
      el.querySelectorAll('[data-eq-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          Modal.confirm('Supprimer cet équipement ?', async function() {
            try { await Api.deleteEquipmentItem(parseInt(b.dataset.eqDel)); Toast.success('Supprimé'); SettingsPage._showTechniqueManager(); }
            catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ═══ ONGLET 7 — UTILISATEURS & DROITS ══════════════════════════
  _usersShowInactive: false,

  async _showUsersManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var users = await Api.settingsUsers();
      var roles = await Api.roles();
      var perms = App.permissions || [];
      var canCreate = perms.includes('users.create');
      var canUpdate = perms.includes('users.update');
      var canDelete = perms.includes('users.delete') || (App.currentUser && App.currentUser.role === 'direction');
      var canRoles  = perms.includes('roles.view');

      var showInactive = SettingsPage._usersShowInactive || false;
      var visible = showInactive ? users : users.filter(function(u){ return u.is_active; });
      var inactiveCount = users.filter(function(u){ return !u.is_active; }).length;

      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">👥 Utilisateurs</div>'
        + '<div class="section-sub">' + visible.length + '/' + users.length + ' · ' + inactiveCount + ' inactif(s)</div></div>'
        + (canCreate ? '<button class="btn btn-primary btn-sm" id="user-add-btn">+ Nouveau</button>' : '')
        + '</div>'
        + '<div class="filter-bar" style="margin-bottom:12px">'
        + '<button class="filter-chip' + (!showInactive ? ' active' : '') + '" id="users-filter-active">Actifs (' + (users.length - inactiveCount) + ')</button>'
        + '<button class="filter-chip' + (showInactive ? ' active' : '') + '" id="users-filter-all">Tous (' + users.length + ')</button>'
        + '</div>'
        + '<div class="activity-list">';

      visible.forEach(function(u) {
        var initials = u.name.split(' ').map(function(n) { return n[0] || '?'; }).join('').slice(0,2).toUpperCase();
        var activeBadge = u.is_active
          ? '<span class="badge badge-operationnel">Actif</span>'
          : '<span class="badge badge-bloquee">Inactif</span>';
        h += '<div class="list-item" style="' + (!u.is_active ? 'opacity:0.6' : '') + '">'
          + '<div class="list-item-icon" style="background:var(--amber-dim);font-size:14px;font-weight:700;color:var(--amber)">' + initials + '</div>'
          + '<div class="list-item-body">'
          + '<div class="list-item-title">' + u.name + '</div>'
          + '<div class="list-item-sub">' + u.email + (u.service ? ' · ' + Utils.label(u.service) : '') + '</div>'
          + '</div>'
          + '<div class="list-item-right" style="gap:6px">'
          + '<span class="badge">' + Utils.label(u.role) + '</span>'
          + activeBadge
          + (canUpdate ? '<button class="btn btn-secondary btn-sm" data-user-edit="' + u.id + '" data-user-role="' + u.role + '" data-user-active="' + u.is_active + '" data-user-name="' + u.name + '">✏️</button>' : '')
          + (canDelete && !u.is_active ? '<button class="btn btn-sm" style="color:var(--danger)" data-user-del="' + u.id + '" data-user-name="' + u.name + '">🗑</button>' : '')
          + '</div></div>';
      });
      h += '</div>';

      if (canRoles) {
        h += '<div class="settings-section-header" style="margin-top:24px">'
          + '<div><div class="section-title">🔐 Rôles & Permissions</div>'
          + '<div class="section-sub">' + roles.length + ' rôles</div></div></div>'
          + '<div class="activity-list">';
        roles.forEach(function(r) {
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:var(--amber-dim);font-size:18px">🔐</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + r.label + '</div>'
            + '<div class="list-item-sub">' + r.name + (r.is_system ? ' · Système' : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right" style="gap:6px">'
            + '<span class="badge ' + (r.is_active ? 'badge-operationnel' : 'badge-bloquee') + '">' + (r.is_active?'Actif':'Inactif') + '</span>'
            + '<button class="btn btn-primary btn-sm" onclick="SettingsPage.showPermMatrix(' + r.id + ',\'' + r.label + '\')">Permissions</button>'
            + '</div></div>';
        });
        h += '</div>';
      }
      el.innerHTML = h;

      var addBtn = document.getElementById('user-add-btn');
      if (addBtn) addBtn.addEventListener('click', function() { SettingsPage.newUser(); });

      var fa = document.getElementById('users-filter-active');
      var fb = document.getElementById('users-filter-all');
      if (fa) fa.addEventListener('click', function() { SettingsPage._usersShowInactive = false; SettingsPage._showUsersManager(); });
      if (fb) fb.addEventListener('click', function() { SettingsPage._usersShowInactive = true; SettingsPage._showUsersManager(); });

      el.querySelectorAll('[data-user-edit]').forEach(function(b) {
        b.addEventListener('click', function() {
          SettingsPage.editUser(parseInt(b.dataset.userEdit), b.dataset.userRole, b.dataset.userActive === 'true', b);
        });
      });
      el.querySelectorAll('[data-user-del]').forEach(function(b) {
        b.addEventListener('click', function() {
          var uid = parseInt(b.dataset.userDel);
          var uname = b.dataset.userName;
          Modal.confirm('Supprimer définitivement le compte de "' + uname + '" ?\nIrréversible.', async function() {
            try {
              await Api.settingsDeleteUser(uid);
              Toast.success('Compte supprimé');
              SettingsPage._showUsersManager();
            } catch(e) { Toast.error(e.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ═══ ONGLET 8 — COMMUNICATION ══════════════════════════════════
  async _showCommunicationManager() {
    var el = this._tabEl(); if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      var conversations = await Api.conversations().catch(function() { return []; });
      var h = '<div class="settings-section-header">'
        + '<div><div class="section-title">💬 Messagerie</div>'
        + '<div class="section-sub">' + conversations.length + ' conversation(s)</div></div></div>';
      if (conversations.length > 0) {
        h += '<div class="activity-list">';
        conversations.forEach(function(c) {
          var icon = c.type === 'group' ? '👥' : '💬';
          h += '<div class="list-item">'
            + '<div class="list-item-icon" style="background:rgba(99,102,241,.08);font-size:20px">' + icon + '</div>'
            + '<div class="list-item-body">'
            + '<div class="list-item-title">' + (c.name || 'Conversation #' + c.id) + '</div>'
            + '<div class="list-item-sub">' + (c.type === 'group' ? 'Groupe' : 'Direct') + '</div>'
            + '</div></div>';
        });
        h += '</div>';
      } else { h += Utils.emptyState('💬', 'Aucune conversation'); }
      h += '<div class="settings-section-header" style="margin-top:24px">'
        + '<div><div class="section-title">🔔 Notifications</div></div>'
        + '<button class="btn btn-secondary btn-sm" id="notif-prefs-btn">Préférences</button></div>'
        + '<div class="alert alert-info" style="font-size:13px">Notifications actives pour interventions, tâches, stock et équipements.</div>';
      el.innerHTML = h;
      var btn = document.getElementById('notif-prefs-btn');
      if (btn) btn.addEventListener('click', function() { SettingsPage._showNotifPrefs(); });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  // ── Utilisateurs CRUD ────────────────────────────────────────────
  async newUser() {
    var roles = [];
    try { roles = await Api.roles(); } catch(e) {}
    var roleOpts = roles.filter(function(r) { return r.is_active; }).map(function(r) {
      return '<option value="' + r.name + '">' + r.label + '</option>';
    }).join('');
    Modal.open('Nouveau compte',
      '<div class="form-group"><label>Nom complet</label><input type="text" id="nu-name" placeholder="Marie Dupont" /></div>'
      + '<div class="form-group"><label>Email</label><input type="email" id="nu-email" placeholder="marie@hotel.fr" /></div>'
      + '<div class="form-group"><label>Mot de passe</label><input type="password" id="nu-pwd" placeholder="••••••••" /></div>'
      + '<div class="form-group"><label>Rôle</label><select id="nu-role">' + roleOpts + '</select></div>'
      + '<div class="form-group"><label>Service (optionnel)</label><input type="text" id="nu-service" placeholder="technique, housekeeping…" /></div>',
      '<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>'
      + '<button class="btn btn-primary" id="nu-submit">Créer</button>'
    );
    document.getElementById('nu-submit').onclick = async function() {
      var btn = document.getElementById('nu-submit');
      btn.disabled = true; btn.textContent = '…';
      try {
        var name    = document.getElementById('nu-name').value.trim();
        var email   = document.getElementById('nu-email').value.trim();
        var pwd     = document.getElementById('nu-pwd').value;
        var role    = document.getElementById('nu-role').value;
        var service = document.getElementById('nu-service').value.trim();
        if (!name || !email || !pwd) throw new Error('Nom, email et mot de passe requis');
        await Api.settingsCreateUser({ name:name, email:email, password:pwd, role:role, service:service||null });
        Modal.close(); Toast.success('Compte créé'); SettingsPage._showUsersManager();
      } catch(e) { Toast.error(e.message); btn.disabled=false; btn.textContent='Créer'; }
    };
  },

  async editUser(userId, currentRole, isActive, buttonEl) {
    var roles = [];
    try { roles = await Api.roles(); } catch(e) {}
    var roleOpts = roles.filter(function(r) { return r.is_active; }).map(function(r) {
      return '<option value="' + r.name + '"' + (r.name===currentRole?' selected':'') + '>' + r.label + '</option>';
    }).join('');
    var userName = buttonEl ? (buttonEl.dataset.userName || '') : '';
    Modal.open('Modifier le compte',
      '<div class="form-group"><label>Nom complet</label><input type="text" id="eu-name" value="' + userName + '" placeholder="Nom Prénom" /></div>'
      + '<div class="form-group"><label>Rôle</label><select id="eu-role">' + roleOpts + '</select></div>'
      + '<div class="form-group"><label>Statut</label><select id="eu-active">'
      + '<option value="true"' + (isActive?' selected':'') + '>Actif</option>'
      + '<option value="false"' + (!isActive?' selected':'') + '>Inactif</option>'
      + '</select></div>',
      '<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>'
      + '<button class="btn btn-primary" id="eu-submit">Enregistrer</button>'
    );
    document.getElementById('eu-submit').onclick = async function() {
      var btn = document.getElementById('eu-submit');
      btn.disabled = true; btn.textContent = '…';
      try {
        var name      = document.getElementById('eu-name') ? document.getElementById('eu-name').value.trim() : null;
        var role      = document.getElementById('eu-role').value;
        var is_active = document.getElementById('eu-active').value === 'true';
        var payload = { role:role, is_active:is_active };
        if (name) payload.name = name;
        await Api.settingsUpdateUser(userId, payload);
        Modal.close(); Toast.success('Compte mis à jour'); SettingsPage._showUsersManager();
      } catch(e) { Toast.error(e.message); btn.disabled=false; btn.textContent='Enregistrer'; }
    };
  },

  // ── Matrice permissions ──────────────────────────────────────────
  async showPermMatrix(roleId, roleLabel) {
    var overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = 'Permissions — ' + roleLabel;
    document.getElementById('modal-body').innerHTML = Utils.loader();
    document.getElementById('modal-footer').innerHTML =
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>'
      + '<button class="btn btn-primary" id="pm-save">Enregistrer</button>';
    document.getElementById('modal-footer').style.display = '';
    overlay.classList.remove('hidden');
    try {
      var results = await Promise.all([Api.rolePermissions(roleId), Api.permissions()]);
      var roleData = results[0], allPerms = results[1];
      var activeSet = new Set(roleData.permissions.map(function(p) { return p.code; }));
      var modules = {};
      allPerms.forEach(function(p) { if (!modules[p.module]) modules[p.module]=[]; modules[p.module].push(p); });
      var ACTIONS = ['view','create','update','assign','take','validate','pause','complete','send','manage','disable'];
      var AL = {view:'Voir',create:'Créer',update:'Modifier',assign:'Assigner',take:'Prendre',validate:'Valider',pause:'Pause',complete:'Clôturer',send:'Envoyer',manage:'Gérer',disable:'Désactiver'};
      var ML = {dashboard:'Dashboard',users:'Utilisateurs',roles:'Rôles',rooms:'Chambres',interventions:'Interventions',tasks:'Tâches',messages:'Messages',settings:'Réglages',notifications:'Notifications',rounds:'Tournées',reviews:'Avis',equipment:'Équipements',stock:'Stock'};
      var MO = ['dashboard','users','roles','rooms','interventions','tasks','messages','settings','notifications','rounds','reviews','equipment','stock'];
      var rows = '';
      MO.forEach(function(mod) {
        if (!modules[mod]) return;
        var mp = modules[mod];
        var acts = ACTIONS.filter(function(a) { return mp.find(function(p) { return p.action===a; }); });
        if (!acts.length) return;
        var cells = acts.map(function(action) {
          var perm = mp.find(function(p) { return p.action===action; });
          if (!perm) return '';
          return '<td style="text-align:center;padding:6px 4px"><label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px">'
            + '<div class="perm-toggle ' + (activeSet.has(perm.code)?'on':'') + '" data-code="' + perm.code + '" onclick="SettingsPage._togglePerm(this)"></div>'
            + '<span style="font-size:9px;color:var(--text-3);white-space:nowrap">' + (AL[action]||action) + '</span>'
            + '</label></td>';
        }).join('');
        rows += '<tr><td style="padding:8px 12px 8px 0;font-size:13px;font-weight:600;color:var(--text-1);white-space:nowrap">' + (ML[mod]||mod) + '</td>' + cells + '</tr>';
      });
      document.getElementById('modal-body').innerHTML =
        '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;min-width:340px"><tbody>' + rows + '</tbody></table></div>'
        + '<p style="font-size:11px;color:var(--text-3);margin-top:12px">Activez/désactivez puis Enregistrer.</p>';
      document.getElementById('pm-save').onclick = async function() {
        var btn = document.getElementById('pm-save');
        btn.disabled=true; btn.textContent='…';
        try {
          var codes = Array.from(document.querySelectorAll('.perm-toggle.on')).map(function(el) { return el.dataset.code; });
          await Api.setRolePermissions(roleId, codes);
          Modal.close(); Toast.success('Permissions mises à jour ✓');
          // Recharger les permissions dans tous les cas (peuvent affecter l'UI du user actuel)
          await App.loadPermissions();
          App._applyRoleFilter();
          Toast.success('Permissions mises à jour ✓ — rechargez si nécessaire');
        } catch(e) { Toast.error(e.message); btn.disabled=false; btn.textContent='Enregistrer'; }
      };
    } catch(e) {
      document.getElementById('modal-body').innerHTML = '<div class="alert alert-error">' + e.message + '</div>';
    }
  },

  _togglePerm: function(el) { el.classList.toggle('on'); },

  // ── Notifications préférences ────────────────────────────────────
  _showNotifPrefs: function() {
    var prefs = JSON.parse(localStorage.getItem('notif_prefs') || '{}');
    var types = [
      {key:'intervention',label:'Interventions',icon:'🔧'},
      {key:'task',label:'Tâches',icon:'📋'},
      {key:'message',label:'Messages',icon:'💬'},
      {key:'attendance',label:'Présence',icon:'🕐'},
      {key:'stock',label:'Alertes stock',icon:'📦'},
      {key:'equipment',label:'Équipements',icon:'⚙️'},
    ];
    var body = '<div style="font-size:13px;color:var(--text-2);margin-bottom:16px">Activez ou désactivez par catégorie :</div>';
    types.forEach(function(t) {
      var enabled = prefs[t.key] !== false;
      body += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;align-items:center;gap:10px"><span>' + t.icon + '</span><span style="font-weight:600;font-size:14px">' + t.label + '</span></div>'
        + '<label style="position:relative;width:44px;height:24px;cursor:pointer">'
        + '<input type="checkbox" class="notif-pref-toggle" data-notif-type="' + t.key + '" ' + (enabled?'checked':'') + ' style="opacity:0;width:0;height:0;position:absolute" />'
        + '<span style="position:absolute;inset:0;background:' + (enabled?'var(--success)':'var(--surface-4)') + ';border-radius:12px;transition:background .2s"></span>'
        + '<span style="position:absolute;top:2px;left:' + (enabled?'22px':'2px') + ';width:20px;height:20px;background:#fff;border-radius:10px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></span>'
        + '</label></div>';
    });
    Modal.open('🔔 Préférences de notification', body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>'
      + '<button class="btn btn-primary" id="notif-prefs-save">Enregistrer</button>'
    );
    setTimeout(function() {
      document.querySelectorAll('.notif-pref-toggle').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var span = cb.nextElementSibling, dot = span.nextElementSibling;
          if (cb.checked) { span.style.background='var(--success)'; dot.style.left='22px'; }
          else { span.style.background='var(--surface-4)'; dot.style.left='2px'; }
        });
      });
      var saveBtn = document.getElementById('notif-prefs-save');
      if (saveBtn) saveBtn.addEventListener('click', function() {
        var np = {};
        document.querySelectorAll('.notif-pref-toggle').forEach(function(cb) { np[cb.dataset.notifType]=cb.checked; });
        localStorage.setItem('notif_prefs', JSON.stringify(np));
        Modal.close(); Toast.success('Préférences enregistrées');
      });
    }, 50);
  },

  // ── Navigation directe depuis l'extérieur ────────────────────────
  showUsers:  function() { this._currentTab='utilisateurs'; this.render(); },
  showRoles:  function() { this._currentTab='utilisateurs'; this.render(); },
  goToZones:  function() { this._currentTab='structure';    this.render(); },
  goToStock:  function() { this._currentTab='stock';        this.render(); },

  destroy: function() { this._currentTab = 'etablissement'; this._exploitSubTab = 'tasks'; this._usersShowInactive = false; },
};
