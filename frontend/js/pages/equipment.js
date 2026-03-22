/* Hotel OS — Equipment V2 — Familles / Types / Items */
const EquipmentPage = {
  families: [],
  types: [],
  items: [],
  rooms: [],
  zones: [],
  familyFilter: 'all',
  statusFilter: 'all',

  async render() {
    var el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      var results = await Promise.all([
        Api.equipmentFamilies().catch(function(){ return []; }),
        Api.equipmentTypes().catch(function(){ return []; }),
        Api.equipmentItems().catch(function(){ return []; }),
        Api.rooms().catch(function(){ return []; }),
        Api.zones().catch(function(){ return []; }),
      ]);
      this.families = results[0];
      this.types = results[1];
      this.items = results[2];
      this.rooms = results[3];
      this.zones = results[4];
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw: function() {
    var self = this;

    // Family filter chips
    var famChips = '<button class="filter-chip ' + (self.familyFilter === 'all' ? 'active' : '') + '" data-eq-fam="all">Toutes familles (' + self.items.length + ')</button>';
    self.families.forEach(function(f) {
      var cnt = self.items.filter(function(i){ return i.family_id === f.id; }).length;
      if (cnt > 0) {
        famChips += '<button class="filter-chip ' + (self.familyFilter === String(f.id) ? 'active' : '') + '" data-eq-fam="' + f.id + '">' + f.name + ' (' + cnt + ')</button>';
      }
    });

    // Status filter
    var statuses = ['all','ok','en_panne','maintenance','hors_service'];
    var statusLabels = { all: 'Tous statuts', ok: '✅ OK', en_panne: '🔴 En panne', maintenance: '🟠 Maintenance', hors_service: '⚫ Hors service' };
    var statusChips = statuses.map(function(s) {
      var cnt = s === 'all' ? self.items.length : self.items.filter(function(i){ return i.status === s; }).length;
      return '<button class="filter-chip ' + (self.statusFilter === s ? 'active' : '') + '" data-eq-stat="' + s + '">' + statusLabels[s] + ' (' + cnt + ')</button>';
    }).join('');

    // Apply filters
    var visible = this.items;
    if (this.familyFilter !== 'all') visible = visible.filter(function(i){ return i.family_id === parseInt(self.familyFilter); });
    if (this.statusFilter !== 'all') visible = visible.filter(function(i){ return i.status === self.statusFilter; });

    // Build cards
    var list = '';
    if (visible.length > 0) {
      for (var idx = 0; idx < visible.length; idx++) {
        var item = visible[idx];
        var fam = self.families.find(function(f){ return f.id === item.family_id; });
        var tp = self.types.find(function(t){ return t.id === item.type_id; });
        var room = item.room_id ? self.rooms.find(function(r){ return r.id === item.room_id; }) : null;

        var statusIcon = { ok: '✅', en_panne: '🔴', maintenance: '🟠', hors_service: '⚫' };
        var sLabel = { ok: 'OK', en_panne: 'En panne', maintenance: 'Maintenance', hors_service: 'Hors service' };

        list += '<div class="inv-card" data-eq-open="' + item.id + '">' +
          '<div class="inv-card-header">' +
          '<div class="inv-card-icon">' + (statusIcon[item.status] || '🔧') + '</div>' +
          '<div class="inv-card-title-wrap">' +
          '<div class="inv-card-title">' + self._esc(item.name) + '</div>' +
          '<div class="inv-card-meta">' + (fam ? fam.name : '—') + ' · ' + (tp ? tp.name : '—') + '</div>' +
          '</div>' +
          '</div>' +
          '<div class="inv-card-body">' +
          '<div class="inv-card-badges">' +
          '<span class="badge badge-' + (item.status === 'ok' ? 'basse' : item.status === 'en_panne' ? 'urgente' : 'normale') + '">' + (sLabel[item.status] || item.status) + '</span>' +
          (item.brand ? ' <span class="badge badge-normale">' + self._esc(item.brand) + '</span>' : '') +
          '</div>' +
          (room ? '<div class="inv-card-assigned">📍 Ch. ' + room.number + '</div>' : '') +
          (item.floor ? '<div style="font-size:12px;color:#6B7280">Étage ' + self._esc(item.floor) + '</div>' : '') +
          '</div></div>';
      }
    } else {
      list = Utils.emptyState('🔧', 'Aucun équipement' + (this.familyFilter !== 'all' || this.statusFilter !== 'all' ? ' avec ces filtres' : '') + '. Ajoutez-en un !');
    }

    document.getElementById('page-content').innerHTML =
      '<div class="page-header">' +
      '<div><div class="page-h1">Équipements</div>' +
      '<div class="page-sub">' + this.items.length + ' au total · ' + this.families.length + ' familles</div></div>' +
      '<button class="btn btn-primary btn-sm" id="eq-new-btn">+ Ajouter</button>' +
      '</div>' +
      '<div class="filter-bar" style="overflow-x:auto;flex-wrap:nowrap">' + famChips + '</div>' +
      '<div class="filter-bar" style="margin-top:-8px">' + statusChips + '</div>' +
      '<div class="inv-cards-list">' + list + '</div>';

    // Bind events
    var el = document.getElementById('page-content');
    el.querySelectorAll('[data-eq-fam]').forEach(function(b) {
      b.addEventListener('click', function() { self.familyFilter = b.dataset.eqFam; self._draw(); });
    });
    el.querySelectorAll('[data-eq-stat]').forEach(function(b) {
      b.addEventListener('click', function() { self.statusFilter = b.dataset.eqStat; self._draw(); });
    });
    el.querySelectorAll('[data-eq-open]').forEach(function(c) {
      c.addEventListener('click', function() { self.openItem(parseInt(c.dataset.eqOpen)); });
    });
    var newBtn = document.getElementById('eq-new-btn');
    if (newBtn) newBtn.addEventListener('click', function() { self.newItem(); });
  },

  newItem: function() {
    var self = this;
    var famOpts = this.families.map(function(f) { return { value: String(f.id), label: f.name }; });
    // Start with all types, will be filtered dynamically
    var firstFamId = famOpts.length > 0 ? famOpts[0].value : '';
    var filteredTypes = firstFamId ? this.types.filter(function(t){ return String(t.family_id) === firstFamId; }) : this.types;
    var typeOpts = filteredTypes.map(function(t) { return { value: String(t.id), label: t.name }; });

    var roomOpts = [{ value: '', label: '— Aucune —' }].concat(
      this.rooms.map(function(r) { return { value: String(r.id), label: 'Ch. ' + r.number }; })
    );
    var zoneOpts = [{ value: '', label: '— Aucune —' }].concat(
      this.zones.map(function(z) { return { value: String(z.id), label: z.name }; })
    );

    Modal.form('Nouvel équipement', [
      { key: 'family_id', label: 'Famille', type: 'select', options: famOpts },
      { key: 'type_id', label: 'Type', type: 'select', options: typeOpts },
      { key: 'name', label: 'Nom', placeholder: 'Ex: Climatiseur chambre 201' },
      { key: 'room_id', label: 'Chambre', type: 'select', options: roomOpts },
      { key: 'zone_id', label: 'Zone', type: 'select', options: zoneOpts },
      { key: 'asset_code', label: 'Code interne', placeholder: 'Ex: CLIM-201' },
      { key: 'brand', label: 'Marque', placeholder: 'Ex: Daikin' },
      { key: 'model', label: 'Modèle', placeholder: 'Ex: FTXM35' },
      { key: 'floor', label: 'Étage', placeholder: 'Ex: 2' },
      { key: 'status', label: 'Statut', type: 'select', value: 'ok',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'en_panne', label: 'En panne' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'hors_service', label: 'Hors service' },
        ] },
      { key: 'notes', type: 'textarea', label: 'Notes' },
    ], async function(data) {
      if (!data.name) throw new Error('Nom requis');
      if (!data.family_id) throw new Error('Famille requise');
      if (!data.type_id) throw new Error('Type requis');
      await Api.createEquipmentItem({
        family_id: parseInt(data.family_id),
        type_id: parseInt(data.type_id),
        name: data.name,
        room_id: data.room_id ? parseInt(data.room_id) : null,
        zone_id: data.zone_id ? parseInt(data.zone_id) : null,
        asset_code: data.asset_code || null,
        brand: data.brand || null,
        model: data.model || null,
        floor: data.floor || null,
        status: data.status || 'ok',
        notes: data.notes || null,
      });
      Toast.success('Équipement ajouté');
      await self.render();
    });

    // Dynamic type filtering when family changes
    setTimeout(function() {
      var famSelect = document.querySelector('[name="family_id"]');
      var typeSelect = document.querySelector('[name="type_id"]');
      if (famSelect && typeSelect) {
        famSelect.addEventListener('change', function() {
          var famId = famSelect.value;
          var filtered = self.types.filter(function(t) { return String(t.family_id) === famId; });
          typeSelect.innerHTML = filtered.map(function(t) {
            return '<option value="' + t.id + '">' + t.name + '</option>';
          }).join('');
        });
      }
    }, 100);
  },

  openItem: function(id) {
    var item = this.items.find(function(x) { return x.id === id; });
    if (!item) return;
    var self = this;
    var fam = this.families.find(function(f){ return f.id === item.family_id; });
    var tp = this.types.find(function(t){ return t.id === item.type_id; });
    var room = item.room_id ? this.rooms.find(function(r){ return r.id === item.room_id; }) : null;

    var statusIcon = { ok: '✅', en_panne: '🔴', maintenance: '🟠', hors_service: '⚫' };
    var sLabel = { ok: 'OK', en_panne: 'En panne', maintenance: 'Maintenance', hors_service: 'Hors service' };

    var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
      '<span class="badge badge-' + (item.status === 'ok' ? 'basse' : item.status === 'en_panne' ? 'urgente' : 'normale') + '">' + (statusIcon[item.status] || '') + ' ' + (sLabel[item.status] || item.status) + '</span>' +
      (fam ? '<span class="badge badge-normale">' + fam.name + '</span>' : '') +
      '</div>' +
      '<p style="font-size:15px;font-weight:600;color:#0F1F3D;margin-bottom:8px">' + this._esc(item.name) + '</p>' +
      '<div style="font-size:13px;color:#6B7280;line-height:2">' +
      '<b>Famille :</b> ' + (fam ? fam.name : '—') + '<br/>' +
      '<b>Type :</b> ' + (tp ? tp.name : '—') + '<br/>' +
      (room ? '<b>Chambre :</b> ' + room.number + '<br/>' : '') +
      (item.floor ? '<b>Étage :</b> ' + item.floor + '<br/>' : '') +
      (item.asset_code ? '<b>Code :</b> ' + this._esc(item.asset_code) + '<br/>' : '') +
      (item.brand ? '<b>Marque :</b> ' + this._esc(item.brand) + '<br/>' : '') +
      (item.model ? '<b>Modèle :</b> ' + this._esc(item.model) + '<br/>' : '') +
      (item.notes ? '<b>Notes :</b> ' + this._esc(item.notes) + '<br/>' : '') +
      '</div>';

    var actions = '<button class="btn btn-warning btn-sm" data-eq-action="status" data-eq-id="' + item.id + '">Changer statut</button> ' +
      '<button class="btn btn-error btn-sm" data-eq-action="delete" data-eq-id="' + item.id + '">Supprimer</button>';

    Modal.open('Équipement #' + item.id, body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button> ' + actions
    );

    setTimeout(function() {
      document.querySelectorAll('[data-eq-action]').forEach(function(b) {
        b.addEventListener('click', function() {
          var action = b.dataset.eqAction;
          var eqId = parseInt(b.dataset.eqId);
          if (action === 'status') {
            Modal.close();
            Modal.form('Changer le statut', [
              { key: 'status', label: 'Nouveau statut', type: 'select', value: item.status,
                options: [
                  { value: 'ok', label: 'OK' },
                  { value: 'en_panne', label: 'En panne' },
                  { value: 'maintenance', label: 'Maintenance' },
                  { value: 'hors_service', label: 'Hors service' },
                ] },
            ], async function(data) {
              await Api.updateEquipmentItem(eqId, { status: data.status });
              Toast.success('Statut mis à jour');
              await self.render();
            });
          } else if (action === 'delete') {
            if (confirm('Supprimer cet équipement ?')) {
              Modal.close();
              Api.deleteEquipmentItem(eqId).then(function() {
                Toast.success('Équipement supprimé');
                self.render();
              }).catch(function(e) { Toast.error(e.message); });
            }
          }
        });
      });
    }, 50);
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  destroy: function() { this.familyFilter = 'all'; this.statusFilter = 'all'; }
};
