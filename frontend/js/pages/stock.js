const StockPage = {
  items: [],
  showLow: false,
  catFilter: 'all',

  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      this.items = await Api.stockItems();
      this._draw();
    } catch(e) { el.innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
  },

  _draw() {
    const self = this;
    const lowCount = this.items.filter(i => i.quantity <= i.threshold_min).length;
    const canDelete = App.has ? App.has('stock.update') || App.has('stock.create') : true;

    // Get unique categories
    const cats = ['all'];
    this.items.forEach(function(i) { if (i.category && cats.indexOf(i.category) === -1) cats.push(i.category); });
    const catLabels = { all: 'Tous services', electricite: '⚡ Électricité', nettoyage: '🧹 Nettoyage', linge: '🛏️ Linge', plomberie: '🔧 Plomberie', consommable: '📋 Consommable' };

    let visible = this.showLow ? this.items.filter(i => i.quantity <= i.threshold_min) : this.items;
    if (this.catFilter !== 'all') visible = visible.filter(function(i) { return i.category === self.catFilter; });

    const catChips = cats.map(function(c) {
      const cnt = c === 'all' ? self.items.length : self.items.filter(function(i){ return i.category === c; }).length;
      return '<button class="filter-chip ' + (self.catFilter === c ? 'active' : '') + '" data-stock-cat="' + c + '">' + (catLabels[c] || Utils.label(c)) + ' (' + cnt + ')</button>';
    }).join('');

    const list = visible.length ? visible.map(item => {
      const low = item.quantity <= item.threshold_min;
      return `<div class="list-item ${low ? 'stock-low' : ''}" onclick="StockPage.open(${item.id})">
        <div class="list-item-icon" style="background:${low ? 'var(--red-l)' : 'var(--blue-pale)'}">📦</div>
        <div class="list-item-body">
          <div class="list-item-title">${item.name}</div>
          <div class="list-item-sub">${item.category || '—'} · ${item.location || '—'}</div>
        </div>
        <div class="list-item-right" style="gap:6px">
          <div style="font-size:16px;font-weight:700;color:${low ? 'var(--red)' : 'var(--navy)'}">
            ${item.quantity} <span style="font-size:11px;font-weight:400;color:#6B7280">${item.unit}</span>
          </div>
          ${low ? '<span class="badge badge-urgente">Stock bas</span>' : ''}
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();StockPage.editItem(${item.id})">✏️</button>
          ${canDelete ? `<button class="btn btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();StockPage.deleteItem(${item.id})">🗑</button>` : ''}
        </div>
      </div>`;
    }).join('') : Utils.emptyState('📦', 'Aucun article en stock');

    document.getElementById('page-content').innerHTML = `
      <div class="page-header">
        <div><div class="page-h1">Stock</div>
        <div class="page-sub">${this.items.length} articles · ${lowCount} alertes</div></div>
        <button class="btn btn-primary btn-sm" onclick="StockPage.newItem()">+ Article</button>
      </div>
      <div class="filter-bar">
        <button class="filter-chip ${!this.showLow ? 'active':''}" onclick="StockPage.toggleLow(false)">Tous (${this.items.length})</button>
        <button class="filter-chip ${this.showLow ? 'active':''}" onclick="StockPage.toggleLow(true)">⚠️ Stock bas (${lowCount})</button>
      </div>
      <div class="filter-bar" style="margin-top:-8px">${catChips}</div>
      ${list}`;

    // Bind category filters
    document.querySelectorAll('[data-stock-cat]').forEach(function(b) {
      b.addEventListener('click', function() { self.catFilter = b.dataset.stockCat; self._draw(); });
    });
  },

  toggleLow(v) { this.showLow = v; this._draw(); },

  newItem() {
    Modal.form('Nouvel article', [
      { key: 'name',          label: 'Nom',             placeholder: 'Ex: Ampoules LED E27' },
      { key: 'category',      label: 'Catégorie',       placeholder: 'Ex: electricite, nettoyage...' },
      { key: 'unit',          label: 'Unité',           placeholder: 'Ex: unite, litre, kg' },
      { key: 'quantity',      label: 'Quantité initiale', type: 'number', value: '0' },
      { key: 'threshold_min', label: 'Seuil d\'alerte', type: 'number', value: '5' },
      { key: 'unit_cost',     label: 'Coût unitaire (€)',type: 'number', value: '0' },
      { key: 'location',      label: 'Emplacement',     placeholder: 'Ex: Réserve sous-sol' },
    ], async (data) => {
      if (!data.name) throw new Error('Nom requis');
      await Api.createStockItem({
        name: data.name, category: data.category, unit: data.unit || 'unite',
        quantity: parseFloat(data.quantity) || 0,
        threshold_min: parseFloat(data.threshold_min) || 5,
        unit_cost: parseFloat(data.unit_cost) || 0,
        location: data.location,
        is_active: true,
      });
      Toast.success('Article ajouté');
      await this.render();
    });
  },

  async open(id) {
    const item = this.items.find(x => x.id === id);
    if (!item) return;
    const low = item.quantity <= item.threshold_min;

    // Charger historique des mouvements
    let history = [];
    try { history = await Api.stockMovements(id); } catch(_) {}

    const histHtml = history.length > 0
      ? '<div style="margin-top:16px"><div class="dash-section-title">Historique</div>' +
        history.slice(0, 8).map(function(mv) {
          const sign = mv.type === 'entree' ? '+' : mv.type === 'inventaire' ? '=' : '-';
          const col  = mv.type === 'entree' ? 'var(--success)' : mv.type === 'inventaire' ? 'var(--warning)' : 'var(--danger)';
          return '<div class="activity-item">' +
            '<div class="activity-avatar" style="background:rgba(0,0,0,.04);font-size:13px;font-weight:700;color:' + col + '">' + sign + '</div>' +
            '<div class="activity-body"><div class="activity-title">' + mv.type + (mv.note ? ' — ' + mv.note : '') + '</div></div>' +
            '<div class="activity-time" style="color:' + col + ';font-weight:700">' + sign + mv.quantity + ' ' + item.unit + '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '';

    Modal.open(item.name, `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
        <div style="font-size:32px;font-weight:700;color:${low ? 'var(--red)' : 'var(--navy)'}">
          ${item.quantity} <span style="font-size:14px;color:#6B7280">${item.unit}</span>
        </div>
        ${low ? '<span class="badge badge-urgente">Stock bas</span>' : ''}
      </div>
      <div style="font-size:13px;color:#6B7280;line-height:2;margin-bottom:14px">
        <b>Catégorie :</b> ${item.category || '—'}<br/>
        <b>Seuil d\'alerte :</b> ${item.threshold_min} ${item.unit}<br/>
        <b>Coût unitaire :</b> ${item.unit_cost ? item.unit_cost.toFixed(2) + ' €' : '—'}<br/>
        <b>Emplacement :</b> ${item.location || '—'}
      </div>
      <div class="form-group">
        <label>Mouvement</label>
        <select id="mv-type">
          <option value="entree">Entrée (réception)</option>
          <option value="sortie">Sortie (consommation)</option>
          <option value="inventaire">Inventaire (ajuster)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Quantité</label>
        <input type="number" id="mv-qty" value="1" min="0" step="0.5" />
      </div>
      <div class="form-group">
        <label>Note (optionnel)</label>
        <input type="text" id="mv-note" placeholder="Ex: Utilisé intervention #12" />
      </div>
      ${histHtml}`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="StockPage.move(${id})">Valider mouvement</button>`
    );
  },

  async move(id) {
    try {
      const type = document.getElementById('mv-type').value;
      const quantity = parseFloat(document.getElementById('mv-qty').value);
      const note = document.getElementById('mv-note').value;
      if (!quantity || quantity <= 0) throw new Error('Quantité invalide');
      await Api.addMovement({ item_id: id, type, quantity, note: note || null });
      Modal.close(); Toast.success('Mouvement enregistré');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  deleteItem(id) {
    const item = this.items.find(x => x.id === id);
    if (!item) return;
    Modal.confirm('Supprimer "' + item.name + '" du stock ?', async () => {
      try {
        await Api.deleteStockItem(id);
        Toast.success('Article supprimé');
        await this.render();
      } catch(e) { Toast.error(e.message); }
    }, 'Supprimer', true);
  },

  editItem(id) {
    const item = this.items.find(x => x.id === id);
    if (!item) return;
    const self = this;
    const unitOpts = ['unite','kg','g','litre','ml','boite','rouleau','sac','palette','autre']
      .map(u => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u.charAt(0).toUpperCase() + u.slice(1)}</option>`)
      .join('');

    Modal.open('Modifier — ' + item.name, `
      <div class="form-group"><label>Nom *</label>
        <input type="text" id="ei-name" value="${item.name || ''}" /></div>
      <div class="form-group"><label>Catégorie</label>
        <input type="text" id="ei-category" value="${item.category || ''}" placeholder="Ex: nettoyage, hygiène" /></div>
      <div class="form-group"><label>Unité</label>
        <select id="ei-unit">${unitOpts}</select></div>
      <div class="form-group"><label>Seuil d'alerte</label>
        <input type="number" id="ei-threshold" value="${item.threshold_min}" min="0" step="0.5" /></div>
      <div class="form-group"><label>Emplacement</label>
        <input type="text" id="ei-location" value="${item.location || ''}" placeholder="Ex: Réserve sous-sol" /></div>
      <div class="form-group"><label>Coût unitaire (€)</label>
        <input type="number" id="ei-cost" value="${item.unit_cost || 0}" min="0" step="0.01" /></div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="StockPage.saveItem(${id})">Enregistrer</button>`
    );
  },

  async saveItem(id) {
    try {
      const name = document.getElementById('ei-name').value.trim();
      if (!name) throw new Error('Nom requis');
      await Api.updateStockItem(id, {
        name,
        category: document.getElementById('ei-category').value.trim() || null,
        unit: document.getElementById('ei-unit').value,
        threshold_min: parseFloat(document.getElementById('ei-threshold').value) || 5,
        location: document.getElementById('ei-location').value.trim() || null,
        unit_cost: parseFloat(document.getElementById('ei-cost').value) || 0,
      });
      Modal.close();
      Toast.success('Article modifié');
      await this.render();
    } catch(e) { Toast.error(e.message); }
  },

  destroy: function() { this.catFilter = 'all'; this.showLow = false; },
};
