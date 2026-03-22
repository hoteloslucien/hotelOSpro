/* Hotel OS — Page Chambres */
const RoomsPage = {
  filter: 'all',
  rooms: [],

  async render(filterParam = null) {
    if (filterParam) this.filter = filterParam;
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      this.rooms = await Api.rooms();
      this._draw();
    } catch(e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  },

  _draw() {
    const filters = ['all','libre','prete','occupee','en_menage','sale','bloquee'];
    const counts = {};
    filters.forEach(f => counts[f] = f === 'all' ? this.rooms.length :
      this.rooms.filter(r => r.status === f).length);

    const chips = filters.map(f => `
      <button class="filter-chip ${this.filter === f ? 'active' : ''}"
        onclick="RoomsPage.setFilter('${f}')">
        ${f === 'all' ? 'Toutes' : Utils.label(f)} (${counts[f]})
      </button>`).join('');

    const visible = this.filter === 'all' ? this.rooms : this.rooms.filter(r => r.status === this.filter);
    const grid = visible.length ? visible.map(r => `
      <div class="room-cell ${r.status}" onclick="RoomsPage.openRoom(${r.id})">
        <div class="room-num">${r.number}</div>
        <div class="room-floor">Ét.${r.floor} · ${r.type}</div>
        <div class="room-status-dot"></div>
      </div>`).join('') : Utils.emptyState('🛏️', 'Aucune chambre');

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><div class="page-h1">Chambres</div>
        <div class="page-sub">${this.rooms.length} chambres au total</div></div>
      </div>
      <div class="filter-bar">${chips}</div>
      <div class="room-grid">${grid}</div>`;
  },

  setFilter(f) { this.filter = f; this._draw(); },

  async openRoom(id) {
    const r = this.rooms.find(x => x.id === id);
    if (!r) return;
    const statuses = ['libre','occupee','en_menage','sale','prete','bloquee'];
    const opts = statuses.map(s =>
      `<option value="${s}" ${r.status === s ? 'selected':''}>${Utils.label(s)}</option>`).join('');
    const avail = r.is_available;
    Modal.open(`Chambre ${r.number}`, `
      <div style="margin-bottom:16px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          ${Utils.badge(r.status)}
          <span class="badge ${avail ? 'badge-libre' : 'badge-bloquee'}">${avail ? 'Disponible client' : 'Indisponible client'}</span>
        </div>
        <div style="font-size:13px;color:#6B7280">Étage ${r.floor} · Type : ${r.type}</div>
        ${r.last_cleaned ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">Dernier ménage : ${Utils.formatDate(r.last_cleaned)}</div>` : ''}
        ${r.notes ? `<div class="alert alert-info" style="margin-top:10px">${r.notes}</div>` : ''}
      </div>
      <div class="form-group">
        <label>Changer le statut</label>
        <select id="room-status-sel">${opts}</select>
      </div>
      <div class="form-group">
        <label>Disponibilité client</label>
        <select id="room-avail-sel">
          <option value="true" ${avail ? 'selected':''}>Disponible</option>
          <option value="false" ${!avail ? 'selected':''}>Indisponible</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="room-notes">${r.notes || ''}</textarea>
      </div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="RoomsPage.saveRoom(${id})">Enregistrer</button>`
    );
  },

  async saveRoom(id) {
    try {
      const status = document.getElementById('room-status-sel').value;
      const is_available = document.getElementById('room-avail-sel').value === 'true';
      const notes = document.getElementById('room-notes').value;
      const me = App.currentUser;

      // Block request message for housekeeping/technique
      var finalNotes = notes;
      if (status === 'bloquee' && me && (me.role === 'gouvernante' || me.role === 'technicien' || me.role === 'responsable_technique')) {
        finalNotes = '⏳ Blocage demandé par ' + me.name + (notes ? ' — ' + notes : '');
      }

      await Api.updateRoom(id, { status: status, is_available: is_available, notes: finalNotes });
      Modal.close();

      if (status === 'bloquee' && me && me.role !== 'reception' && me.role !== 'direction') {
        Toast.success('Demande de blocage envoyée à la réception');
      } else {
        Toast.success('Chambre mise à jour');
      }
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },
};
