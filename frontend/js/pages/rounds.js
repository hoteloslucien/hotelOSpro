/* Hotel OS — Page Tournées */
const RoundsPage = {
  rounds: [],
  rooms: [],
  users: [],

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      [this.rounds, this.rooms, this.users] = await Promise.all([
        Api.rounds(), Api.rooms(), Api.users().catch(() => [])
      ]);
      this._draw();
    } catch(e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  },

  _draw() {
    const list = this.rounds.length ? this.rounds.map(r => {
      const user = this.users.find(u => u.id === r.assigned_to_id);
      const done = r.rooms ? r.rooms.filter(rr => rr.status === 'fait').length : 0;
      const total = r.rooms ? r.rooms.length : 0;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `<div class="list-item" onclick="RoundsPage.open(${r.id})">
        <div class="list-item-icon" style="background:var(--teal-light)">🗺️</div>
        <div class="list-item-body">
          <div class="list-item-title">${r.name}</div>
          <div class="list-item-sub">${Utils.formatDate(r.date)} · ${user ? user.name : 'Non assigné'}</div>
          ${total > 0 ? `
            <div class="progress" style="margin-top:6px">
              <div class="progress-fill" style="width:${pct}%;background:var(--teal)"></div>
            </div>
            <div style="font-size:10px;color:#6B7280;margin-top:2px">${done}/${total} chambres</div>` : ''}
        </div>
        <div class="list-item-right">${Utils.badge(r.status)}</div>
      </div>`;
    }).join('') : Utils.emptyState('🗺️', 'Aucune tournée planifiée');

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><div class="page-h1">Tournées</div></div>
        <button class="btn btn-primary btn-sm" onclick="RoundsPage.newRound()">+ Nouvelle</button>
      </div>
      ${list}`;
  },

  async newRound() {
    const userOpts = [{ value: '', label: '— Non assigné —' },
      ...this.users.filter(u => ['gouvernante','technicien'].includes(u.role))
        .map(u => ({ value: String(u.id), label: u.name }))];
    const roomCheckboxes = this.rooms
      .sort((a,b) => a.floor - b.floor || a.number.localeCompare(b.number))
      .map(r => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px">
          <input type="checkbox" value="${r.id}" class="round-room-cb" />
          Ch. ${r.number} — ét. ${r.floor} — ${Utils.label(r.status)}
        </label>`).join('');

    Modal.open('Nouvelle tournée', `
      <div class="form-group">
        <label>Nom</label>
        <input type="text" id="round-name" placeholder="Ex: Ménage matin étage 2" />
      </div>
      <div class="form-group">
        <label>Date & heure</label>
        <input type="datetime-local" id="round-date" value="${new Date().toISOString().slice(0,16)}" />
      </div>
      <div class="form-group">
        <label>Assignée à</label>
        <select id="round-user">
          ${userOpts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Chambres à inclure</label>
        <div style="max-height:200px;overflow-y:auto;border:1.5px solid #E5E7EB;border-radius:8px;padding:8px">
          ${roomCheckboxes}
        </div>
      </div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="RoundsPage.saveRound()">Créer</button>`
    );
  },

  async saveRound() {
    try {
      const name = document.getElementById('round-name').value;
      if (!name) throw new Error('Nom requis');
      const date = document.getElementById('round-date').value;
      if (!date) throw new Error('Date requise');
      const userId = document.getElementById('round-user').value;
      const checked = [...document.querySelectorAll('.round-room-cb:checked')];
      const rooms = checked.map((cb, idx) => ({ room_id: parseInt(cb.value), order: idx }));
      await Api.createRound({
        name, date: new Date(date).toISOString(),
        assigned_to_id: userId ? parseInt(userId) : null,
        rooms,
      });
      Modal.close();
      Toast.success('Tournée créée');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  open(id) {
    const rnd = this.rounds.find(x => x.id === id);
    if (!rnd) return;
    const user = this.users.find(u => u.id === rnd.assigned_to_id);
    const steps = (rnd.rooms || []).map((rr, i) => {
      const room = this.rooms.find(r => r.id === rr.room_id);
      const icon = rr.status === 'fait' ? '✅' : rr.status === 'refuse' ? '⛔' : rr.status === 'en_cours' ? '⏳' : String(i + 1);
      const cls = rr.status === 'fait' ? 'done' : rr.status === 'refuse' ? 'skip' : '';
      const actionBtns = rr.status === 'en_attente' || rr.status === 'en_cours' ? `
        <button class="btn btn-success btn-sm" onclick="RoundsPage.stepAction(${rnd.id},${rr.id},'fait')">✓</button>
        <button class="btn btn-danger btn-sm" onclick="RoundsPage.stepAction(${rnd.id},${rr.id},'refuse')">✗</button>
        <button class="btn btn-warning btn-sm" title="Signaler anomalie" onclick="RoundsPage.reportAnomaly(${rnd.id},${rr.id},${rr.room_id})">⚠️</button>` : '';
      return `<div class="round-step">
        <div class="step-num ${cls}">${icon}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">Ch. ${room ? room.number : rr.room_id}</div>
          <div style="font-size:12px;color:#6B7280">${Utils.label(rr.status)}${rr.note ? ' · ' + rr.note : ''}</div>
        </div>
        <div style="display:flex;gap:6px">${actionBtns}</div>
      </div>`;
    }).join('') || '<p style="color:#6B7280;font-size:13px">Aucune chambre dans cette tournée</p>';

    const startBtn = rnd.status === 'planifiee' ?
      `<button class="btn btn-primary" onclick="RoundsPage.setStatus(${rnd.id},'en_cours')">▶ Démarrer</button>` :
      rnd.status === 'en_cours' ?
      `<button class="btn btn-success" onclick="RoundsPage.setStatus(${rnd.id},'terminee')">✓ Terminer</button>` : '';

    Modal.open(rnd.name, `
      <div style="display:flex;gap:8px;margin-bottom:12px">${Utils.badge(rnd.status)}</div>
      <div style="font-size:13px;color:#6B7280;margin-bottom:16px">
        ${user ? user.name : 'Non assigné'} · ${Utils.formatDate(rnd.date)}
      </div>
      <div class="section-label">Progression</div>
      ${steps}`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>${startBtn}`
    );
  },

  async setStatus(id, status) {
    try {
      await Api.updateRoundStatus(id, status);
      Modal.close();
      Toast.success(`Tournée ${Utils.label(status)}`);
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  async stepAction(roundId, rrId, status) {
    try {
      await Api.updateRoundRoom(roundId, rrId, { status });
      Modal.close();
      Toast.success(status === 'fait' ? 'Chambre validée ✓' : 'Chambre refusée');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  reportAnomaly(roundId, rrId, roomId) {
    var room = this.rooms.find(function(r) { return r.id === roomId; });
    var roomLabel = room ? 'Ch. ' + room.number : 'Chambre #' + roomId;
    Modal.close();
    Modal.form('Signaler une anomalie — ' + roomLabel, [
      { key: 'title',       label: 'Anomalie *',  value: 'Anomalie ' + roomLabel, placeholder: 'Ex: Fuite robinet, ampoule grillée…' },
      { key: 'description', label: 'Description', value: '', placeholder: 'Détails de l\'anomalie constatée…' },
      { key: 'priority',    label: 'Priorité',    value: 'normale', type: 'select',
        options: [{value:'basse',label:'Basse'},{value:'normale',label:'Normale'},{value:'haute',label:'Haute'},{value:'urgente',label:'Urgente'}] },
    ], async function(data) {
      if (!data.title) throw new Error('Titre requis');
      await Api.createIntervention({
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'normale',
        source: 'staff',
        zone: null, zone_id: null,
        room_id: roomId || null,
      });
      // Marquer la chambre comme refusée (anomalie constatée)
      try { await Api.updateRoundRoom(roundId, rrId, { status: 'refuse' }); } catch(_) {}
      Toast.success('Anomalie signalée — intervention créée');
      App.navigate('interventions');
    });
  },

  destroy: function() {},
};
