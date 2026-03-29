/* Hotel OS — Page Avis Clients */
const ReviewsPage = {
  items: [],
  filter: 'all',

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      this.items = await Api.reviews();
      this._draw();
    } catch(e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  },

  _draw() {
    const filters = ['all','nouveau','traite','clos'];
    const chips = filters.map(f => {
      const count = f === 'all' ? this.items.length : this.items.filter(i => i.status === f).length;
      return `<button class="filter-chip ${this.filter === f ? 'active':''}"
        onclick="ReviewsPage.setFilter('${f}')">
        ${f === 'all' ? 'Tous' : Utils.label(f)} (${count})</button>`;
    }).join('');

    const visible = this.filter === 'all' ? this.items : this.items.filter(i => i.status === this.filter);
    const avg = this.items.length
      ? (this.items.reduce((s,i) => s + i.rating, 0) / this.items.length).toFixed(1) : '—';

    const list = visible.length ? visible.map(r => `
      <div class="list-item" onclick="ReviewsPage.open(${r.id})">
        <div class="list-item-icon" style="background:var(--gold-l);font-size:20px">${r.rating >= 4 ? '😊' : r.rating <= 2 ? '😞' : '😐'}</div>
        <div class="list-item-body">
          <div class="list-item-title">${r.guest_name || 'Anonyme'}</div>
          <div class="list-item-sub">
            <span class="stars">${Utils.stars(r.rating)}</span>
            ${r.category ? ` · ${r.category}` : ''} · ${Utils.timeAgo(r.created_at)}
          </div>
          ${r.comment ? `<div style="font-size:12px;color:#374151;margin-top:4px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.comment}</div>` : ''}
        </div>
        <div class="list-item-right">${Utils.badge(r.status)}</div>
      </div>`).join('') : Utils.emptyState('⭐', 'Aucun avis');

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><div class="page-h1">Avis clients</div>
        <div class="page-sub">Note moyenne : ★ ${avg} / 5 · ${this.items.length} avis</div></div>
      </div>
      <div class="filter-bar">${chips}</div>
      ${list}`;
  },

  setFilter(f) { this.filter = f; this._draw(); },

  open(id) {
    const r = this.items.find(x => x.id === id);
    if (!r) return;
    const me = App.currentUser;
    const canDelete = me && (me.role === 'responsable' || me.role === 'direction');
    const actionBtns = r.status === 'nouveau'
      ? `<button class="btn btn-primary" onclick="ReviewsPage.handle(${r.id})">Traiter</button>`
      : r.status === 'traite'
      ? `<button class="btn btn-success" onclick="ReviewsPage.close(${r.id})">Clôturer</button>` : '';
    const deleteBtn = canDelete
      ? `<button class="btn btn-secondary" style="color:var(--danger)" onclick="ReviewsPage.remove(${r.id})">🗑 Supprimer</button>` : '';

    Modal.open(`Avis de ${r.guest_name || 'Anonyme'}`, `
      <div style="margin-bottom:12px">
        <div class="stars" style="font-size:24px">${Utils.stars(r.rating)}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px">${Utils.label(r.status)}</div>
      </div>
      ${r.category ? `<div class="badge badge-normale" style="margin-bottom:10px">${r.category}</div>` : ''}
      ${r.comment ? `<p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:14px">"${r.comment}"</p>` : ''}
      <div style="font-size:12px;color:#6B7280">
        ${r.room_id ? `Chambre #${r.room_id} · ` : ''}${Utils.formatDate(r.created_at)}
      </div>
      ${r.action_taken ? `<div class="alert alert-success" style="margin-top:12px">
        <b>Action :</b> ${r.action_taken}</div>` : ''}`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>${deleteBtn}${actionBtns}`
    );
  },

  async handle(id) {
    var self = this;
    Modal.close(true);
    Modal.form('Traiter cet avis', [
      { key: 'action_taken', type: 'textarea', label: 'Action prise', placeholder: 'Décrivez ce qui a été fait pour ce client...' },
    ], async function(data) {
      if (!data.action_taken) throw new Error('Décrivez l\'action prise');
      await Api.updateReview(id, { status: 'traite', action_taken: data.action_taken });
      Toast.success('Avis traité');
      await self.render();
    }, 'Valider');
  },

  async close(id) {
    try {
      await Api.updateReview(id, { status: 'clos' });
      Modal.close(); Toast.success('Avis clôturé');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  async remove(id) {
    const self = this;
    Modal.close(true);
    Modal.confirm('Supprimer définitivement cet avis client ?', async function() {
      try {
        await Api.deleteReview(id);
        Toast.success('Avis supprimé');
        await self.render();
      } catch(e) { Toast.error(e.message); }
    }, 'Supprimer', true);
  },

  destroy: function() {},
};
