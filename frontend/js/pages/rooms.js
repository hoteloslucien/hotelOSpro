/* Hotel OS — Page Chambres V2 — Sélection visuelle, suppression, zones */
const RoomsPage = {
  filter: 'all',
  rooms: [],
  zones: [],
  _selectedId: null,

  async render(filterParam) {
    if (filterParam) this.filter = filterParam;
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      [this.rooms, this.zones] = await Promise.all([
        Api.rooms(),
        Api.zones().catch(function() { return []; }),
      ]);
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw() {
    var self = this;
    var filters = ['all','libre','prete','occupee','en_menage','sale','bloquee'];
    var counts = {};
    filters.forEach(function(f) {
      counts[f] = f === 'all' ? self.rooms.length : self.rooms.filter(function(r) { return r.status === f; }).length;
    });

    var chips = filters.map(function(f) {
      return '<button class="filter-chip ' + (self.filter === f ? 'active' : '') + '" data-rf="' + f + '">' +
        (f === 'all' ? 'Toutes' : Utils.label(f)) + ' (' + counts[f] + ')</button>';
    }).join('');

    var visible = this.filter === 'all' ? this.rooms : this.rooms.filter(function(r) { return r.status === self.filter; });

    var grid = visible.length ? visible.map(function(r) {
      var zone = self.zones.find(function(z) { return z.id === r.zone_id; });
      var isSelected = self._selectedId === r.id;
      return '<div class="room-cell ' + r.status + (isSelected ? ' room-selected' : '') + '" data-room-id="' + r.id + '">' +
        '<div class="room-num">' + r.number + '</div>' +
        '<div class="room-floor">Ét.' + r.floor + (zone ? ' · ' + zone.name : ' · ' + r.type) + '</div>' +
        '<div class="room-status-dot"></div>' +
        '</div>';
    }).join('') : Utils.emptyState('🛏️', 'Aucune chambre');

    document.getElementById('page-content').innerHTML =
      '<div class="page-header">' +
      '<div><div class="page-h1">Chambres</div>' +
      '<div class="page-sub">' + this.rooms.length + ' chambres</div></div>' +
      '<button class="btn btn-primary btn-sm" id="room-add-btn">+ Ajouter</button>' +
      '</div>' +
      '<div class="filter-bar" id="room-filter-bar">' + chips + '</div>' +
      (this._selectedId ? '<div class="selection-banner" id="room-sel-banner">' +
        '✅ Chambre sélectionnée — <b>cliquez à nouveau</b> pour ouvrir · <button class="btn btn-sm btn-secondary" id="room-sel-cancel">✕ Désélectionner</button>' +
        '</div>' : '') +
      '<div class="room-grid" id="room-grid">' + grid + '</div>';

    document.getElementById('room-filter-bar').querySelectorAll('[data-rf]').forEach(function(b) {
      b.addEventListener('click', function() { self.filter = b.dataset.rf; self._selectedId = null; self._draw(); });
    });

    document.getElementById('room-grid').querySelectorAll('[data-room-id]').forEach(function(cell) {
      cell.addEventListener('click', function() {
        var id = parseInt(cell.dataset.roomId);
        if (self._selectedId === id) {
          self.openRoom(id);
        } else {
          self._selectedId = id;
          self._draw();
        }
      });
    });

    var cancelBtn = document.getElementById('room-sel-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { self._selectedId = null; self._draw(); });

    var addBtn = document.getElementById('room-add-btn');
    if (addBtn) addBtn.addEventListener('click', function() { self.newRoom(); });
  },

  newRoom: function() {
    var self = this;
    var zoneOpts = [{ value: '', label: '— Aucune zone —' }].concat(
      this.zones.map(function(z) { return { value: String(z.id), label: z.name }; })
    );
    Modal.form('Nouvelle chambre', [
      { key: 'number', label: 'Numéro *', placeholder: 'Ex: 101' },
      { key: 'floor', label: 'Étage', placeholder: '1' },
      { key: 'type', label: 'Type', type: 'select', value: 'standard',
        options: [{value:'standard',label:'Standard'},{value:'superieure',label:'Supérieure'},
                  {value:'suite',label:'Suite'},{value:'duplex',label:'Duplex'},{value:'familiale',label:'Familiale'}] },
      { key: 'zone_id', label: 'Zone', type: 'select', options: zoneOpts },
    ], async function(data) {
      if (!data.number) throw new Error('Numéro requis');
      await Api.createRoom({
        number: data.number, floor: data.floor ? parseInt(data.floor) : 1,
        type: data.type || 'standard',
        zone_id: data.zone_id ? parseInt(data.zone_id) : null, status: 'sale',
      });
      Toast.success('Chambre créée');
      await self.render();
    });
  },

  async openRoom(id) {
    var r = this.rooms.find(function(x) { return x.id === id; });
    if (!r) return;
    var self = this;
    var statuses = ['libre','occupee','en_menage','sale','prete','bloquee'];
    var opts = statuses.map(function(s) {
      return '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + Utils.label(s) + '</option>';
    }).join('');
    var avail = r.is_available;
    var zoneOpts = [{ value: '', label: '— Aucune zone —' }].concat(
      this.zones.map(function(z) { return { value: String(z.id), label: z.name }; })
    );
    var zoneSelect = zoneOpts.map(function(o) {
      return '<option value="' + o.value + '"' + (String(r.zone_id || '') === o.value ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');
    var currentZone = this.zones.find(function(z) { return z.id === r.zone_id; });
    var me = App.currentUser;
    var canDelete = me && (me.role === 'responsable' || me.role === 'responsable_technique' || me.role === 'direction');

    Modal.open('Chambre ' + r.number,
      '<div style="margin-bottom:16px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      Utils.badge(r.status) +
      '<span class="badge ' + (avail ? 'badge-libre' : 'badge-bloquee') + '">' + (avail ? 'Disponible client' : 'Indisponible') + '</span>' +
      (currentZone ? '<span class="badge badge-normale">📍 ' + currentZone.name + '</span>' : '') +
      '</div>' +
      '<div style="font-size:13px;color:#6B7280">Étage ' + r.floor + ' · Type : ' + r.type + '</div>' +
      (r.last_cleaned ? '<div style="font-size:12px;color:#6B7280;margin-top:4px">Dernier ménage : ' + Utils.formatDate(r.last_cleaned) + '</div>' : '') +
      (r.notes ? '<div class="alert alert-info" style="margin-top:10px">' + r.notes + '</div>' : '') +
      '</div>' +
      '<div class="form-group"><label>Statut</label><select id="room-status-sel">' + opts + '</select></div>' +
      '<div class="form-group"><label>Zone</label><select id="room-zone-sel">' + zoneSelect + '</select></div>' +
      '<div class="form-group"><label>Disponibilité client</label><select id="room-avail-sel">' +
      '<option value="true"' + (avail ? ' selected' : '') + '>Disponible</option>' +
      '<option value="false"' + (!avail ? ' selected' : '') + '>Indisponible</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Notes</label><textarea id="room-notes">' + (r.notes || '') + '</textarea></div>',
      '<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>' +
      (canDelete ? '<button class="btn btn-secondary" style="color:var(--danger)" id="room-del-btn">🗑 Supprimer</button>' : '') +
      '<button class="btn btn-primary" id="room-save-btn">Enregistrer</button>'
    );

    setTimeout(function() {
      var saveBtn = document.getElementById('room-save-btn');
      if (saveBtn) saveBtn.addEventListener('click', function() { self.saveRoom(id); });
      var delBtn = document.getElementById('room-del-btn');
      if (delBtn) delBtn.addEventListener('click', function() {
        Modal.close(true);
        Modal.confirm('Supprimer la chambre ' + r.number + ' ? Irréversible.', async function() {
          try {
            await Api.deleteRoom(id);
            Toast.success('Chambre supprimée');
            self._selectedId = null;
            await self.render();
          } catch(e) { Toast.error(e.message); }
        }, 'Supprimer', true);
      });
    }, 50);
  },

  async saveRoom(id) {
    try {
      var status = document.getElementById('room-status-sel').value;
      var zone_id_val = document.getElementById('room-zone-sel').value;
      var is_available = document.getElementById('room-avail-sel').value === 'true';
      var notes = document.getElementById('room-notes').value;
      var me = App.currentUser;
      var finalNotes = notes;
      if (status === 'bloquee' && me && (me.role === 'gouvernante' || me.role === 'technicien' || me.role === 'responsable_technique')) {
        finalNotes = '⏳ Blocage demandé par ' + me.name + (notes ? ' — ' + notes : '');
      }
      await Api.updateRoom(id, {
        status: status, zone_id: zone_id_val ? parseInt(zone_id_val) : null,
        is_available: is_available, notes: finalNotes,
      });
      Modal.close();
      if (status === 'bloquee' && me && me.role !== 'reception' && me.role !== 'direction') {
        Toast.success('Demande de blocage envoyée à la réception');
      } else {
        Toast.success('Chambre mise à jour');
      }
      this._selectedId = null;
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  destroy: function() { this.filter = 'all'; this._selectedId = null; },
};
