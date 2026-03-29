/* Hotel OS — Equipment V2 — Familles / Types / Items — BUG FIXES COMPLETS */
const EquipmentPage = {
  families: [], types: [], items: [], rooms: [], zones: [],
  familyFilter: 'all', statusFilter: 'all',

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
      this.families = results[0]; this.types = results[1]; this.items = results[2];
      this.rooms = results[3]; this.zones = results[4];
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw: function() {
    var self = this;
    var famChips = '<button class="filter-chip ' + (self.familyFilter === 'all' ? 'active' : '') + '" data-eq-fam="all">Toutes familles (' + self.items.length + ')</button>';
    self.families.forEach(function(f) {
      var cnt = self.items.filter(function(i){ return i.family_id === f.id; }).length;
      if (cnt > 0) famChips += '<button class="filter-chip ' + (self.familyFilter === String(f.id) ? 'active' : '') + '" data-eq-fam="' + f.id + '">' + self._esc(f.name) + ' (' + cnt + ')</button>';
    });
    var statuses = ['all','ok','en_panne','maintenance','hors_service'];
    var statusLabels = { all:'Tous statuts', ok:'✅ OK', en_panne:'🔴 En panne', maintenance:'🟠 Maintenance', hors_service:'⚫ Hors service' };
    var statusChips = statuses.map(function(s) {
      var cnt = s === 'all' ? self.items.length : self.items.filter(function(i){ return i.status === s; }).length;
      return '<button class="filter-chip ' + (self.statusFilter === s ? 'active' : '') + '" data-eq-stat="' + s + '">' + statusLabels[s] + ' (' + cnt + ')</button>';
    }).join('');

    var visible = this.items;
    if (this.familyFilter !== 'all') visible = visible.filter(function(i){ return i.family_id === parseInt(self.familyFilter); });
    if (this.statusFilter !== 'all') visible = visible.filter(function(i){ return i.status === self.statusFilter; });

    var list = '';
    if (visible.length > 0) {
      for (var idx = 0; idx < visible.length; idx++) {
        var item = visible[idx];
        var fam = self.families.find(function(f){ return f.id === item.family_id; });
        var tp = self.types.find(function(t){ return t.id === item.type_id; });
        var room = item.room_id ? self.rooms.find(function(r){ return r.id === item.room_id; }) : null;
        var statusIcon = { ok:'✅', en_panne:'🔴', maintenance:'🟠', hors_service:'⚫' };
        var sLabel = { ok:'OK', en_panne:'En panne', maintenance:'Maintenance', hors_service:'Hors service' };
        list += '<div class="inv-card" data-eq-open="' + item.id + '">' +
          '<div class="inv-card-header">' +
          '<div class="inv-card-icon">' + (statusIcon[item.status] || '🔧') + '</div>' +
          '<div class="inv-card-title-wrap">' +
          '<div class="inv-card-title">' + self._esc(item.name) + '</div>' +
          '<div class="inv-card-meta">' + (fam ? self._esc(fam.name) : '—') + ' · ' + (tp ? self._esc(tp.name) : '—') + '</div>' +
          '</div></div>' +
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
    var firstFamId = famOpts.length > 0 ? famOpts[0].value : '';
    var filteredTypes = firstFamId ? this.types.filter(function(t){ return String(t.family_id) === firstFamId; }) : this.types;
    var typeOpts = filteredTypes.map(function(t) { return { value: String(t.id), label: t.name }; });
    var roomOpts = [{ value: '', label: '— Aucune —' }].concat(this.rooms.map(function(r) { return { value: String(r.id), label: 'Ch. ' + r.number }; }));
    var zoneOpts = [{ value: '', label: '— Aucune —' }].concat(this.zones.map(function(z) { return { value: String(z.id), label: z.name }; }));

    Modal.form('Nouvel équipement', [
      { key: 'family_id', label: 'Famille *', type: 'select', options: famOpts },
      { key: 'type_id', label: 'Type *', type: 'select', options: typeOpts },
      { key: 'name', label: 'Nom *', placeholder: 'Ex: Climatiseur chambre 201' },
      { key: 'room_id', label: 'Chambre', type: 'select', options: roomOpts },
      { key: 'zone_id', label: 'Zone', type: 'select', options: zoneOpts },
      { key: 'asset_code', label: 'Code interne', placeholder: 'Ex: CLIM-201' },
      { key: 'brand', label: 'Marque', placeholder: 'Ex: Daikin' },
      { key: 'model', label: 'Modèle', placeholder: 'Ex: FTXM35' },
      { key: 'floor', label: 'Étage', placeholder: 'Ex: 2' },
      { key: 'status', label: 'Statut', type: 'select', value: 'ok',
        options: [{value:'ok',label:'OK'},{value:'en_panne',label:'En panne'},{value:'maintenance',label:'Maintenance'},{value:'hors_service',label:'Hors service'}] },
      { key: 'notes', type: 'textarea', label: 'Notes' },
    ], async function(data) {
      if (!data.name) throw new Error('Nom requis');
      if (!data.family_id) throw new Error('Famille requise');
      if (!data.type_id) throw new Error('Type requis');
      await Api.createEquipmentItem({
        family_id: parseInt(data.family_id), type_id: parseInt(data.type_id),
        name: data.name, room_id: data.room_id ? parseInt(data.room_id) : null,
        zone_id: data.zone_id ? parseInt(data.zone_id) : null,
        asset_code: data.asset_code || null, brand: data.brand || null,
        model: data.model || null, floor: data.floor || null,
        status: data.status || 'ok', notes: data.notes || null,
      });
      Toast.success('Équipement ajouté');
      await self.render();
    });

    setTimeout(function() {
      var famSelect = document.querySelector('[name="family_id"]') || document.getElementById('mf-family_id');
      var typeSelect = document.querySelector('[name="type_id"]') || document.getElementById('mf-type_id');
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
    var statusIcon = { ok:'✅', en_panne:'🔴', maintenance:'🟠', hors_service:'⚫' };
    var sLabel = { ok:'OK', en_panne:'En panne', maintenance:'Maintenance', hors_service:'Hors service' };

    var body = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
      '<span class="badge badge-' + (item.status === 'ok' ? 'basse' : item.status === 'en_panne' ? 'urgente' : 'normale') + '">' + (statusIcon[item.status] || '') + ' ' + (sLabel[item.status] || item.status) + '</span>' +
      (fam ? '<span class="badge badge-normale">' + self._esc(fam.name) + '</span>' : '') +
      '</div>' +
      '<p style="font-size:15px;font-weight:600;color:#0F1F3D;margin-bottom:8px">' + self._esc(item.name) + '</p>' +
      '<div style="font-size:13px;color:#6B7280;line-height:2">' +
      '<b>Famille :</b> ' + (fam ? self._esc(fam.name) : '—') + '<br/>' +
      '<b>Type :</b> ' + (tp ? self._esc(tp.name) : '—') + '<br/>' +
      (room ? '<b>Chambre :</b> ' + room.number + '<br/>' : '') +
      (item.floor ? '<b>Étage :</b> ' + self._esc(item.floor) + '<br/>' : '') +
      (item.asset_code ? '<b>Code :</b> ' + self._esc(item.asset_code) + '<br/>' : '') +
      (item.brand ? '<b>Marque :</b> ' + self._esc(item.brand) + '<br/>' : '') +
      (item.model ? '<b>Modèle :</b> ' + self._esc(item.model) + '<br/>' : '') +
      (item.notes ? '<b>Notes :</b> ' + self._esc(item.notes) + '<br/>' : '') +
      '</div>';

    Modal.open('Équipement #' + item.id, body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>' +
      '<button class="btn btn-secondary btn-sm" id="eq-status-btn">Changer statut</button>' +
      ' <button class="btn btn-primary btn-sm" id="eq-edit-btn">✏️ Modifier</button>' +
      (item.status === 'en_panne' || item.status === 'hors_service'
        ? ' <button class="btn btn-warning btn-sm" id="eq-inv-btn">🛠 Intervention</button>' : '') +
      ' <button class="btn btn-secondary btn-sm" style="color:var(--danger)" id="eq-del-btn">🗑 Supprimer</button>'
    );

    setTimeout(function() {
      // STATUS — ouvre un nouveau modal directement sans close(instant)
      var statusBtn = document.getElementById('eq-status-btn');
      if (statusBtn) statusBtn.addEventListener('click', function() {
        Modal.close(true);
        setTimeout(function() {
          Modal.form('Changer le statut de ' + self._esc(item.name), [
            { key: 'status', label: 'Nouveau statut', type: 'select', value: item.status,
              options: [{value:'ok',label:'OK'},{value:'en_panne',label:'En panne'},{value:'maintenance',label:'Maintenance'},{value:'hors_service',label:'Hors service'}] },
            { key: 'notes', label: 'Observations', value: item.notes || '', placeholder: 'Optionnel', type: 'textarea' },
          ], async function(data) {
            await Api.updateEquipmentItem(item.id, { status: data.status, notes: data.notes || null });
            Toast.success('Statut mis à jour');
            await self.render();
          });
        }, 50);
      });

      // EDIT — ouvre un nouveau modal
      var editBtn = document.getElementById('eq-edit-btn');
      if (editBtn) editBtn.addEventListener('click', function() {
        Modal.close(true);
        setTimeout(function() {
          var famOpts = self.families.map(function(f) { return { value: String(f.id), label: f.name }; });
          var curFamId = String(item.family_id || '');
          var filteredTypes = self.types.filter(function(t) { return String(t.family_id) === curFamId; });
          var typeOpts = filteredTypes.map(function(t) { return { value: String(t.id), label: t.name }; });
          var roomOpts = [{ value: '', label: '— Aucune —' }].concat(self.rooms.map(function(r) { return { value: String(r.id), label: 'Ch. ' + r.number }; }));
          var zoneOpts = [{ value: '', label: '— Aucune —' }].concat(self.zones.map(function(z) { return { value: String(z.id), label: z.name }; }));
          Modal.form('Modifier équipement', [
            { key: 'name',       label: 'Nom *',     value: item.name || '',       placeholder: 'Ex: Climatiseur bureau' },
            { key: 'brand',      label: 'Marque',    value: item.brand || '',      placeholder: 'Ex: Daikin' },
            { key: 'model',      label: 'Modèle',    value: item.model || '',      placeholder: 'Ex: FTXM35M' },
            { key: 'asset_code', label: 'Code parc', value: item.asset_code || '', placeholder: 'Ex: CLIM-001' },
            { key: 'floor',      label: 'Étage',     value: item.floor || '',      placeholder: 'Ex: 2' },
            { key: 'notes',      label: 'Notes',     value: item.notes || '',      placeholder: 'Observations…', type: 'textarea' },
            { key: 'family_id',  label: 'Famille',   value: curFamId,              type: 'select', options: famOpts },
            { key: 'type_id',    label: 'Type',      value: String(item.type_id || ''), type: 'select', options: typeOpts },
            { key: 'room_id',    label: 'Chambre',   value: String(item.room_id || ''), type: 'select', options: roomOpts },
            { key: 'zone_id',    label: 'Zone',      value: String(item.zone_id || ''), type: 'select', options: zoneOpts },
          ], async function(data) {
            if (!data.name) throw new Error('Nom requis');
            await Api.updateEquipmentItem(item.id, {
              name: data.name, brand: data.brand || null, model: data.model || null,
              asset_code: data.asset_code || null, floor: data.floor || null,
              notes: data.notes || null,
              family_id: data.family_id ? parseInt(data.family_id) : null,
              type_id: data.type_id ? parseInt(data.type_id) : null,
              room_id: data.room_id ? parseInt(data.room_id) : null,
              zone_id: data.zone_id ? parseInt(data.zone_id) : null,
            });
            Toast.success('Équipement modifié');
            await self.render();
          }, 'Enregistrer');
        }, 50);
      });

      // INTERVENTION
      var invBtn = document.getElementById('eq-inv-btn');
      if (invBtn) invBtn.addEventListener('click', function() {
        Modal.close(true);
        setTimeout(function() {
          Modal.form('Créer une intervention', [
            { key: 'title', label: 'Titre *', value: 'Panne : ' + self._esc(item.name), placeholder: 'Ex: Panne climatisation' },
            { key: 'description', label: 'Description', value: '', placeholder: 'Décrivez le problème…', type: 'textarea' },
            { key: 'priority', label: 'Priorité', value: item.status === 'hors_service' ? 'urgente' : 'haute', type: 'select',
              options: [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}] },
          ], async function(data) {
            if (!data.title) throw new Error('Titre requis');
            await Api.createIntervention({
              title: data.title, description: data.description || null,
              priority: data.priority || 'haute', source: 'staff',
              equipment_item_id: item.id,
              room_id: item.room_id || null,
            });
            Toast.success('Intervention créée');
            App.navigate('interventions');
          });
        }, 50);
      });

      // DELETE
      var delBtn = document.getElementById('eq-del-btn');
      if (delBtn) delBtn.addEventListener('click', function() {
        Modal.close(true);
        setTimeout(function() {
          Modal.confirm('Supprimer l\'équipement "' + self._esc(item.name) + '" ?', async function() {
            try {
              await Api.deleteEquipmentItem(item.id);
              Toast.success('Équipement supprimé');
              await self.render();
            } catch(e) { Toast.error(e.message); }
          }, 'Supprimer', true);
        }, 50);
      });
    }, 50);
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  destroy: function() { this.familyFilter = 'all'; this.statusFilter = 'all'; }
};
