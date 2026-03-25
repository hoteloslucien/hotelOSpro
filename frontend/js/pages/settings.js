/* Hotel OS — Page Réglages
 * Sections : Utilisateurs · Rôles & Permissions · Hôtel · Modules
 */
const SettingsPage = {

  // ── Rendu principal ─────────────────────────────────────────────
  async render() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    const perms = App.permissions || [];

    const canSettings = perms.includes('settings.view');
    const canUsers    = perms.includes('users.view');
    const canRoles    = perms.includes('roles.view');

    if (!canSettings) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div>
        <p>Accès réservé à la direction et aux responsables.</p></div>`;
      return;
    }

    const cards = [
      canUsers ? { icon:'👥', title:'Utilisateurs',       sub:'Comptes & accès',               fn:'SettingsPage.showUsers()' }    : null,
      canRoles ? { icon:'🔐', title:'Rôles & permissions',sub:'Droits par rôle',                fn:'SettingsPage.showRoles()' }    : null,
      { icon:'🏨', title:'Hôtel', sub:'Infos établissement', fn:'SettingsPage._showHotelsManager()' },
      { icon:'📍', title:'Zones & Lieux',                   sub:'Espaces, étages, zones',         fn:"SettingsPage.showModuleInfo('zones')" },
      { icon:'🛏️', title:'Chambres', sub:'Inventaire & statuts', fn:'SettingsPage._showRoomsManager()' },
      { icon:'🛠️', title:'Interventions', sub:'Types & règles', fn:'SettingsPage._showInterventionsManager()' },
      { icon:'📋', title:'Tâches',                         sub:'Services & statuts',             fn:"SettingsPage.showModuleInfo('tâches')" },
      { icon:'💬', title:'Messagerie',                     sub:'Canaux de communication',        fn:"SettingsPage.showModuleInfo('messagerie')" },
      { icon:'🔔', title:'Notifications',                  sub:'Alertes & rappels',              fn:"SettingsPage.showModuleInfo('notifications')" },
      { icon:'📦', title:'Stock',                          sub:'Seuils & catégories',            fn:"SettingsPage.showModuleInfo('stock')" },
    ].filter(Boolean);

    const grid = cards.map(c => `
      <div class="settings-card" onclick="${c.fn}">
        <div class="settings-card-icon">${c.icon}</div>
        <div class="settings-card-body">
          <div class="settings-card-title">${c.title}</div>
          <div class="settings-card-sub">${c.sub}</div>
        </div>
        <svg class="settings-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>
      </div>`).join('');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-h1">⚙️ Réglages</div>
          <div class="page-sub">Configuration de l'application</div>
        </div>
      </div>
      <div class="settings-grid">${grid}</div>`;
  },

  // ── Utilisateurs ────────────────────────────────────────────────
  async showUsers() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      const [users, roles] = await Promise.all([
        Api.settingsUsers(),
        Api.roles(),
      ]);
      const perms = App.permissions || [];
      const canCreate = perms.includes('users.create');
      const canUpdate = perms.includes('users.update');

      const list = users.map(u => {
        const roleBadge = `<span class="badge badge-${u.role}">${Utils.label(u.role)}</span>`;
        const activeBadge = u.is_active
          ? `<span class="badge badge-operationnel">Actif</span>`
          : `<span class="badge badge-bloquee">Inactif</span>`;
        return `
          <div class="list-item">
            <div class="list-item-icon" style="background:var(--amber-dim);font-size:18px;font-weight:700;color:var(--amber)">
              ${u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div class="list-item-body">
              <div class="list-item-title">${u.name}</div>
              <div class="list-item-sub">${u.email}${u.service ? ' · ' + u.service : ''}</div>
            </div>
            <div class="list-item-right" style="gap:6px">
              ${roleBadge} ${activeBadge}
              ${canUpdate ? `<button class="btn btn-secondary btn-sm" onclick="SettingsPage.editUser(${u.id}, '${u.role}', ${u.is_active})">✏️</button>` : ''}
            </div>
          </div>`;
      }).join('');

      el.innerHTML = `
        <div class="page-header">
          <div>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>
            <div class="page-h1">👥 Utilisateurs</div>
            <div class="page-sub">${users.length} comptes</div>
          </div>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="SettingsPage.newUser()">+ Nouveau</button>` : ''}
        </div>
        ${list || Utils.emptyState('👥', 'Aucun utilisateur')}`;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  },

  async newUser() {
    let roles = [];
    try { roles = await Api.roles(); } catch(e) {}
    const roleOpts = roles.filter(r => r.is_active).map(r =>
      `<option value="${r.name}">${r.label}</option>`).join('');

    Modal.open('Nouveau compte', `
      <div class="form-group"><label>Nom complet</label>
        <input type="text" id="nu-name" placeholder="Ex: Marie Dupont" /></div>
      <div class="form-group"><label>Email</label>
        <input type="email" id="nu-email" placeholder="marie@hotel.fr" /></div>
      <div class="form-group"><label>Mot de passe</label>
        <input type="password" id="nu-pwd" placeholder="••••••••" /></div>
      <div class="form-group"><label>Rôle</label>
        <select id="nu-role">${roleOpts}</select></div>
      <div class="form-group"><label>Service (optionnel)</label>
        <input type="text" id="nu-service" placeholder="Ex: technique, housekeeping…" /></div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="nu-submit">Créer</button>`
    );
    document.getElementById('nu-submit').onclick = async () => {
      const btn = document.getElementById('nu-submit');
      btn.disabled = true; btn.textContent = '…';
      try {
        const name    = document.getElementById('nu-name').value.trim();
        const email   = document.getElementById('nu-email').value.trim();
        const pwd     = document.getElementById('nu-pwd').value;
        const role    = document.getElementById('nu-role').value;
        const service = document.getElementById('nu-service').value.trim();
        if (!name || !email || !pwd) throw new Error('Nom, email et mot de passe requis');
        await Api.settingsCreateUser({ name, email, password: pwd, role, service: service || null });
        Modal.close();
        Toast.success('Compte créé');
        await SettingsPage.showUsers();
      } catch(e) {
        Toast.error(e.message);
        btn.disabled = false; btn.textContent = 'Créer';
      }
    };
  },

  async editUser(userId, currentRole, isActive) {
    let roles = [];
    try { roles = await Api.roles(); } catch(e) {}
    const roleOpts = roles.filter(r => r.is_active).map(r =>
      `<option value="${r.name}" ${r.name === currentRole ? 'selected' : ''}>${r.label}</option>`).join('');

    Modal.open('Modifier le compte', `
      <div class="form-group"><label>Rôle</label>
        <select id="eu-role">${roleOpts}</select></div>
      <div class="form-group"><label>Statut</label>
        <select id="eu-active">
          <option value="true"  ${isActive ? 'selected':''}>Actif</option>
          <option value="false" ${!isActive ? 'selected':''}>Inactif</option>
        </select></div>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="eu-submit">Enregistrer</button>`
    );
    document.getElementById('eu-submit').onclick = async () => {
      const btn = document.getElementById('eu-submit');
      btn.disabled = true; btn.textContent = '…';
      try {
        const role      = document.getElementById('eu-role').value;
        const is_active = document.getElementById('eu-active').value === 'true';
        await Api.settingsUpdateUser(userId, { role, is_active });
        Modal.close();
        Toast.success('Compte mis à jour');
        await SettingsPage.showUsers();
      } catch(e) {
        Toast.error(e.message);
        btn.disabled = false; btn.textContent = 'Enregistrer';
      }
    };
  },

  // ── Rôles & Permissions ──────────────────────────────────────────
  async showRoles() {
    const el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      const roles = await Api.roles();
      const perms = App.permissions || [];
      const canUpdate = perms.includes('roles.update');

      const list = roles.map(r => `
        <div class="list-item">
          <div class="list-item-icon" style="background:var(--amber-dim);color:var(--amber);font-size:20px">🔐</div>
          <div class="list-item-body">
            <div class="list-item-title">${r.label}</div>
            <div class="list-item-sub">${r.name}${r.is_system ? ' · Rôle système' : ''}</div>
          </div>
          <div class="list-item-right" style="gap:6px">
            <span class="badge ${r.is_active ? 'badge-operationnel' : 'badge-bloquee'}">${r.is_active ? 'Actif' : 'Inactif'}</span>
            ${canUpdate ? `<button class="btn btn-primary btn-sm" onclick="SettingsPage.showPermMatrix(${r.id},'${r.label}')">Permissions</button>` : ''}
            ${canUpdate && !r.is_system ? `<button class="btn btn-secondary btn-sm" onclick="SettingsPage.toggleRole(${r.id}, ${r.is_active})">${r.is_active ? 'Désactiver' : 'Activer'}</button>` : ''}
          </div>
        </div>`).join('');

      el.innerHTML = `
        <div class="page-header">
          <div>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>
            <div class="page-h1">🔐 Rôles & Permissions</div>
            <div class="page-sub">${roles.length} rôles configurés</div>
          </div>
        </div>
        <div class="alert alert-info" style="margin-bottom:16px;font-size:13px">
          💡 Cliquez sur <b>Permissions</b> pour ouvrir la matrice d'accès d'un rôle.
        </div>
        ${list || Utils.emptyState('🔐', 'Aucun rôle')}`;
    } catch(e) {
      el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
  },

  async toggleRole(roleId, currentlyActive) {
    try {
      await Api.updateRole(roleId, { is_active: !currentlyActive });
      Toast.success(currentlyActive ? 'Rôle désactivé' : 'Rôle activé');
      await SettingsPage.showRoles();
    } catch(e) { Toast.error(e.message); }
  },

  // ── Matrice permissions ──────────────────────────────────────────
  async showPermMatrix(roleId, roleLabel) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = `Permissions — ${roleLabel}`;
    document.getElementById('modal-body').innerHTML = Utils.loader();
    document.getElementById('modal-footer').innerHTML =
      `<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>
       <button class="btn btn-primary" id="pm-save">Enregistrer</button>`;
    document.getElementById('modal-footer').style.display = '';
    overlay.classList.remove('hidden');

    try {
      const [roleData, allPerms] = await Promise.all([
        Api.rolePermissions(roleId),
        Api.permissions(),
      ]);

      const activeSet = new Set(roleData.permissions.map(p => p.code));

      // Grouper les permissions par module
      const modules = {};
      for (const p of allPerms) {
        if (!modules[p.module]) modules[p.module] = [];
        modules[p.module].push(p);
      }

      // Actions dans l'ordre d'affichage
      const ACTIONS_ORDER = ['view','create','update','assign','take','validate','pause','complete','send','manage','disable'];
      const ACTION_LABELS = {
        view:'Voir', create:'Créer', update:'Modifier', assign:'Assigner',
        take:'Prendre', validate:'Valider', pause:'Pause', complete:'Clôturer',
        send:'Envoyer', manage:'Gérer', disable:'Désactiver',
      };
      const MODULE_LABELS = {
        dashboard:'Dashboard', users:'Utilisateurs', roles:'Rôles',
        rooms:'Chambres', interventions:'Interventions', tasks:'Tâches',
        messages:'Messages', settings:'Réglages', notifications:'Notifications',
        rounds:'Tournées', reviews:'Avis', equipment:'Équipements', stock:'Stock',
      };
      const MODULE_ORDER = ['dashboard','users','roles','rooms','interventions',
        'tasks','messages','settings','notifications','rounds','reviews','equipment','stock'];

      // Construire la matrice
      let rows = '';
      for (const mod of MODULE_ORDER) {
        if (!modules[mod]) continue;
        const modPerms = modules[mod];
        const actions = ACTIONS_ORDER.filter(a => modPerms.find(p => p.action === a));
        if (!actions.length) continue;
        const cells = actions.map(action => {
          const perm = modPerms.find(p => p.action === action);
          if (!perm) return '';
          const checked = activeSet.has(perm.code) ? 'checked' : '';
          return `
            <td style="text-align:center;padding:6px 4px">
              <label title="${perm.label || perm.code}" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div class="perm-toggle ${checked ? 'on' : ''}" data-code="${perm.code}" onclick="SettingsPage._togglePerm(this)"></div>
                <span style="font-size:9px;color:var(--text-3);white-space:nowrap">${ACTION_LABELS[action]||action}</span>
              </label>
            </td>`;
        }).join('');

        rows += `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;font-weight:600;color:var(--text-1);white-space:nowrap">
              ${MODULE_LABELS[mod] || mod}
            </td>
            ${cells}
          </tr>`;
      }

      document.getElementById('modal-body').innerHTML = `
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table style="width:100%;border-collapse:collapse;min-width:340px">
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="font-size:11px;color:var(--text-3);margin-top:12px">
          Appuyez sur un toggle pour activer / désactiver une permission, puis Enregistrer.
        </p>`;

      // Sauvegarder
      document.getElementById('pm-save').onclick = async () => {
        const btn = document.getElementById('pm-save');
        btn.disabled = true; btn.textContent = '…';
        try {
          const codes = [...document.querySelectorAll('.perm-toggle.on')]
            .map(el => el.dataset.code);
          await Api.setRolePermissions(roleId, codes);
          Modal.close();
          Toast.success('Permissions mises à jour ✓');
          // Recharger les permissions si c'est le rôle de l'utilisateur connecté
          if (App.currentUser?.role === roleData.name) {
            await App.loadPermissions();
            App._applyRoleFilter();
          }
        } catch(e) {
          Toast.error(e.message);
          btn.disabled = false; btn.textContent = 'Enregistrer';
        }
      };

    } catch(e) {
      document.getElementById('modal-body').innerHTML =
        `<div class="alert alert-error">${e.message}</div>`;
    }
  },

  _togglePerm(el) {
    el.classList.toggle('on');
  },

  // ── Sections informatives ────────────────────────────────────────
  async _showHotelsManager() {
    const el = document.getElementById('page-content');
    if (!el) return;
  
    el.innerHTML = Utils.loader();
  
    try {
      const hotels = await Api.hotels();
  
      let h = ''
        + '<div class="page-header"><div>'
        + '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>'
        + '<div class="page-h1">🏨 Hôtel</div>'
        + '<div class="page-sub">' + ((hotels && hotels.length) || 0) + ' hôtel(s) configuré(s)</div>'
        + '</div>'
        + '</div>';
  
      if (hotels && hotels.length > 0) {
        h += '<div class="activity-list">';
        for (let i = 0; i < hotels.length; i++) {
          const hotel = hotels[i];
          h += ''
            + '<div class="list-item" data-hotel-id="' + hotel.id + '">'
            +   '<div class="list-item-icon" style="background:rgba(59,130,246,.12)">🏨</div>'
            +   '<div class="list-item-body">'
            +     '<div class="list-item-title">' + (hotel.name || 'Hôtel sans nom') + '</div>'
            +     '<div class="list-item-sub">' + ((hotel.city || '') + (hotel.address ? ' · ' + hotel.address : '')) + '</div>'
            +   '</div>'
            + '</div>';
        }
        h += '</div>';
      } else {
        h += Utils.emptyState('🏨', 'Aucun hôtel configuré');
        h += '<div style="margin-top:12px;color:var(--text-2);font-size:13px">La création d’hôtel sera branchée ensuite.</div>';
      }
  
      el.innerHTML = h;
  
    } catch (e) {
      el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>';
    }
  },
  
  async _showRoomsManager() {
    const el = document.getElementById('page-content');
    if (!el) return;
  
    el.innerHTML = Utils.loader();
  
    try {
      const rooms = await Api.rooms();
  
      let h = ''
        + '<div class="page-header"><div>'
        + '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>'
        + '<div class="page-h1">🛏️ Chambres</div>'
        + '<div class="page-sub">' + ((rooms && rooms.length) || 0) + ' chambre(s) configurée(s)</div>'
        + '</div>'
        + '</div>';
  
      if (rooms && rooms.length > 0) {
        h += '<div class="activity-list">';
        for (let i = 0; i < rooms.length; i++) {
          const room = rooms[i];
          h += ''
            + '<div class="list-item" data-room-id="' + room.id + '">'
            +   '<div class="list-item-icon" style="background:rgba(16,185,129,.12)">🛏️</div>'
            +   '<div class="list-item-body">'
            +     '<div class="list-item-title">' + (room.number || room.name || ('Chambre #' + room.id)) + '</div>'
            +     '<div class="list-item-sub">'
            +       + (room.floor ? ('Étage ' + room.floor) : '')
            +       + (room.status ? ((room.floor ? ' · ' : '') + room.status) : '')
            +     '</div>'
            +   '</div>'
            + '</div>';
        }
        h += '</div>';
      } else {
        h += Utils.emptyState('🛏️', 'Aucune chambre configurée');
        h += '<div style="margin-top:12px;color:var(--text-2);font-size:13px">Tu pourras ajouter tes vraies chambres ensuite.</div>';
      }
  
      el.innerHTML = h;
  
    } catch (e) {
      el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>';
    }
  },    
  
  async _showInterventionsManager() {
    const el = document.getElementById('page-content');
    if (!el) return;
  
    el.innerHTML = Utils.loader();
  
    try {
      const interventions = await Api.interventions();
  
      let h = ''
        + '<div class="page-header"><div>'
        + '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>'
        + '<div class="page-h1">🛠️ Interventions</div>'
        + '<div class="page-sub">' + ((interventions && interventions.length) || 0) + ' intervention(s)</div>'
        + '</div>'
        + '</div>';
  
      if (interventions && interventions.length > 0) {
        h += '<div class="activity-list">';
        for (let i = 0; i < interventions.length; i++) {
          const it = interventions[i];
          h += ''
            + '<div class="list-item" data-intervention-id="' + it.id + '">'
            +   '<div class="list-item-icon" style="background:rgba(245,158,11,.12)">🛠️</div>'
            +   '<div class="list-item-body">'
            +     '<div class="list-item-title">' + (it.title || ('Intervention #' + it.id)) + '</div>'
            +     '<div class="list-item-sub">'
            +       + (it.priority ? ('Priorité ' + it.priority) : '')
            +       + (it.status ? ((it.priority ? ' · ' : '') + it.status) : '')
            +     '</div>'
            +   '</div>'
            + '</div>';
        }
        h += '</div>';
      } else {
        h += Utils.emptyState('🛠️', 'Aucune intervention');
        h += '<div style="margin-top:12px;color:var(--text-2);font-size:13px">Tu pourras créer de vraies interventions ensuite.</div>';
      }
  
      el.innerHTML = h;
  
    } catch (e) {
      el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>';
    }
  },

  showModuleInfo(module) {
    if (module === 'notifications') { this._showNotifPrefs(); return; }
    if (module === 'zones') { this._showZonesManager(); return; }
    Modal.open('⚙️ ' + module.charAt(0).toUpperCase() + module.slice(1),
      '<div class="alert alert-info" style="font-size:13px">La configuration avancée du module <b>' + module + '</b> sera disponible dans une prochaine version.</div>',
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>'
    );
  },

  // ── Notification preferences ─────────────────────────────────────
  _showNotifPrefs: function() {
    var me = App.currentUser;
    var canManage = me && (me.role === 'direction' || me.role === 'responsable' || me.role === 'responsable_technique');
    if (!canManage) {
      Modal.open('🔔 Notifications', '<p style="font-size:13px;color:var(--text-2)">Les préférences de notification sont réservées à la direction et aux responsables.</p>',
        '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>');
      return;
    }

    var prefs = JSON.parse(localStorage.getItem('notif_prefs') || '{}');
    var types = [
      { key: 'intervention', label: 'Interventions', icon: '🔧' },
      { key: 'task', label: 'Tâches', icon: '📋' },
      { key: 'message', label: 'Messages', icon: '💬' },
      { key: 'attendance', label: 'Présence', icon: '🕐' },
      { key: 'stock', label: 'Alertes stock', icon: '📦' },
      { key: 'equipment', label: 'Alertes équipement', icon: '⚙️' },
    ];

    var body = '<div style="font-size:13px;color:var(--text-2);margin-bottom:16px">Activez ou désactivez les notifications par catégorie :</div>';
    types.forEach(function(t) {
      var enabled = prefs[t.key] !== false;
      body += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;align-items:center;gap:10px"><span>' + t.icon + '</span><span style="font-weight:600;font-size:14px">' + t.label + '</span></div>' +
        '<label style="position:relative;width:44px;height:24px;cursor:pointer">' +
        '<input type="checkbox" class="notif-pref-toggle" data-notif-type="' + t.key + '" ' + (enabled ? 'checked' : '') +
        ' style="opacity:0;width:0;height:0;position:absolute" />' +
        '<span style="position:absolute;inset:0;background:' + (enabled ? 'var(--success)' : 'var(--surface-4)') +
        ';border-radius:12px;transition:background .2s"></span>' +
        '<span style="position:absolute;top:2px;left:' + (enabled ? '22px' : '2px') +
        ';width:20px;height:20px;background:#fff;border-radius:10px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></span>' +
        '</label></div>';
    });

    Modal.open('🔔 Préférences de notification', body,
      '<button class="btn btn-secondary" onclick="Modal.close()">Fermer</button>' +
      '<button class="btn btn-primary" id="notif-prefs-save">Enregistrer</button>'
    );

    setTimeout(function() {
      document.querySelectorAll('.notif-pref-toggle').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var span = cb.nextElementSibling;
          var dot = span.nextElementSibling;
          if (cb.checked) { span.style.background = 'var(--success)'; dot.style.left = '22px'; }
          else { span.style.background = 'var(--surface-4)'; dot.style.left = '2px'; }
        });
      });
      var saveBtn = document.getElementById('notif-prefs-save');
      if (saveBtn) saveBtn.addEventListener('click', function() {
        var newPrefs = {};
        document.querySelectorAll('.notif-pref-toggle').forEach(function(cb) {
          newPrefs[cb.dataset.notifType] = cb.checked;
        });
        localStorage.setItem('notif_prefs', JSON.stringify(newPrefs));
        Modal.close();
        Toast.success('Préférences enregistrées');
      });
    }, 50);
  },

  // ── Zones management ─────────────────────────────────────────────
  async _showZonesManager() {
    var el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      var zones = await Api.zones();
      var h = '<div class="page-header"><div>' +
        '<button class="btn btn-secondary btn-sm" onclick="SettingsPage.render()" style="margin-bottom:8px">← Réglages</button>' +
        '<div class="page-h1">📍 Zones & Lieux</div>' +
        '<div class="page-sub">' + zones.length + ' zones configurées</div></div>' +
        '<button class="btn btn-primary btn-sm" id="zone-add-btn">+ Ajouter</button></div>';

      if (zones.length > 0) {
        h += '<div class="activity-list">';
        for (var i = 0; i < zones.length; i++) {
          var z = zones[i];
          h += '<div class="list-item" data-zone-id="' + z.id + '">' +
            '<div class="list-item-icon" style="background:rgba(14,165,160,.08)">📍</div>' +
            '<div class="list-item-body"><div class="list-item-title">' + z.name + '</div>' +
            '<div class="list-item-sub">' + (z.code || '—') + '</div></div>' +
            '<button class="btn btn-sm" style="color:var(--danger)" data-zone-del="' + z.id + '">Supprimer</button>' +
            '</div>';
        }
        h += '</div>';
      } else { h += Utils.emptyState('📍', 'Aucune zone configurée'); }

      el.innerHTML = h;

      var self = this;
      var addBtn = document.getElementById('zone-add-btn');
      if (addBtn) addBtn.addEventListener('click', function() {
        Modal.form('Nouvelle zone', [
          { key: 'name', label: 'Nom', placeholder: 'Ex: Spa, Parking, Étage 4...' },
          { key: 'code', label: 'Code (optionnel)', placeholder: 'Ex: SPA, PARK...' },
        ], async function(data) {
          if (!data.name) throw new Error('Nom requis');
          var me = App.currentUser;
          await Api.createZone({ name: data.name, code: data.code || null, hotel_id: me.hotel_id || 1 });
          Toast.success('Zone ajoutée');
          await self._showZonesManager();
        });
      });

      el.querySelectorAll('[data-zone-del]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.stopPropagation();
          var zid = parseInt(b.dataset.zoneDel);
          Modal.confirm('Supprimer cette zone ?', async function() {
            try {
              await Api.deleteZone(zid);
              Toast.success('Zone supprimée');
              await self._showZonesManager();
            } catch(err) { Toast.error(err.message); }
          }, 'Supprimer', true);
        });
      });
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },
};
