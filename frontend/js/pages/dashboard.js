/* Hotel OS — Dashboard V2 Premium — Présence + Équipe + Rôle adapté */
const DashboardPage = {

  _pollInterval: null,

  async render() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
    await this._load();
    // Rafraîchir les stats toutes les 60 secondes si la page est active
    this._pollInterval = setInterval(() => {
      if (App._currentPage === 'dashboard') this._load();
    }, 30000);
  },

  async _load() {
    const el = document.getElementById('page-content');
    if (!el) return;

    const firstName = this._firstName();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    el.innerHTML = Utils.loader();

    try {
      var me = App.currentUser;
      var role = me ? me.role : 'technicien';
      var isManager = (role === 'responsable' || role === 'direction' || role === 'gouvernante');

      // Parallel data fetch — ALL with individual catches
      var promises = [
        Api.stats().catch(function(){ return null; }),
        Api.interventions().catch(function(){ return []; }),
        Api.tasks().catch(function(){ return []; }),
        Api.attendanceMyShift().catch(function(){ return null; }),
        Api.convUnreadCount().catch(function(){ return {unread:0}; }),
      ];
      if (isManager) {
        promises.push(Api.attendanceTeam().catch(function(){ return []; }));
      }
      var results = await Promise.all(promises);
      var s = results[0] || {}, recentInterv = results[1] || [], recentTasks = results[2] || [],
          myShift = results[3], unreadData = results[4] || {},
          teamShifts = isManager ? (results[5] || []) : [];

      var urgent = this._n(s.interventions_nouvelles) + this._n(s.interventions_en_cours) + this._n(s.tasks_urgentes);
      var unread = this._n(unreadData.unread);
      var activity = this._buildActivity(recentInterv, recentTasks);

      var h = '<div class="dashboard">';
      h += '<div class="dashboard-header">'
        + '<div><h1>' + greet + ', ' + firstName + ' 👋</h1><p>' + dateStr + '</p></div>'
        + '<button class="btn btn-secondary btn-sm" id="dash-refresh-btn" title="Actualiser" style="flex-shrink:0">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
        + '</div></div>';

      // ── Présence personnelle ──
      if (myShift && myShift.status) {
        h += this._renderMyShiftCard(myShift);
      } else {
        h += '<div class="dash-shift-card"><div class="dash-shift-header">'
          + '<div class="dash-shift-status"><span class="dash-shift-dot" style="background:var(--text-3)"></span>'
          + '<span style="color:var(--text-3);font-weight:700;font-size:13px">Aucun poste prévu</span></div></div></div>';
      }

      // ── Priorités ──
      h += '<div class="dash-section-title">Priorités</div>';
      h += '<div class="priority-card"><div class="priority-pill"><span class="priority-dot' + (urgent > 0 ? ' urgent' : '') + '"></span>';
      if (urgent > 0) {
        var parts = [];
        var ni = this._n(s.interventions_nouvelles);
        var ci = this._n(s.interventions_en_cours);
        var ut = this._n(s.tasks_urgentes);
        if (ni > 0) parts.push(ni + ' intervention' + (ni > 1 ? 's' : '') + ' nouvelle' + (ni > 1 ? 's' : ''));
        if (ci > 0) parts.push(ci + ' en cours');
        if (ut > 0) parts.push(ut + ' tâche' + (ut > 1 ? 's' : '') + ' urgente' + (ut > 1 ? 's' : ''));
        h += '<span>' + parts.join(' · ') + '</span>';
      } else {
        h += '<span>Tout est à jour ✓</span>';
      }
      h += '</div></div>';

      // ── Équipe du jour (managers) ──
      if (isManager && teamShifts.length > 0) {
        h += this._renderTeamOverview(teamShifts, s);
      }

      // ── Actions rapides ──
      h += '<div class="dash-section-title">Actions rapides</div>';
      h += '<div class="grid-actions">';
      h += this._actionCard('interventions', '🔧', 'Intervention',
        this._n(s.interventions_nouvelles) + ' nouvelle' + (this._n(s.interventions_nouvelles) > 1 ? 's' : ''),
        this._n(s.interventions_nouvelles) > 0 ? 'badge-red-soft' : 'badge-green-soft');
      h += this._actionCard('tasks', '📋', 'Tâche',
        this._n(s.tasks_a_faire) + ' à faire',
        this._n(s.tasks_urgentes) > 0 ? 'badge-red-soft' : 'badge-blue-soft');
      h += this._actionCard('messages', '💬', 'Messages',
        unread > 0 ? unread + ' non lu' + (unread > 1 ? 's' : '') : 'Messagerie',
        unread > 0 ? 'badge-red-soft' : 'badge-blue-soft');
      h += this._actionCard('rooms', '🛏️', 'Chambres',
        this._n(s.rooms_libre) + '/' + this._n(s.rooms_total) + ' libre' + (this._n(s.rooms_libre) > 1 ? 's' : ''),
        'badge-green-soft');

      // Extra cards for managers
      if (isManager) {
        h += this._actionCard('attendance', '🕐', 'Présence',
          this._n(s.attendance_present) + ' présent' + (this._n(s.attendance_present) > 1 ? 's' : ''),
          this._n(s.attendance_absent) > 0 ? 'badge-red-soft' : 'badge-green-soft');
        h += this._actionCard('reviews', '⭐', 'Avis',
          this._n(s.reviews_nouveau) + ' nouveau' + (this._n(s.reviews_nouveau) > 1 ? 'x' : ''),
          this._n(s.reviews_nouveau) > 0 ? 'badge-red-soft' : 'badge-green-soft');
      }
      h += '</div>';

      // ── Alertes ──
      var alerts = this._buildAlerts(s);
      if (alerts.length > 0) {
        h += '<div class="dash-section-title">Alertes</div>';
        h += '<div class="activity-list">';
        for (var a = 0; a < alerts.length; a++) {
          h += '<div class="activity-item" onclick="App.navigate(\'' + alerts[a].page + '\')">' +
            '<div class="activity-avatar" style="background:' + alerts[a].bg + '">' + alerts[a].icon + '</div>' +
            '<div class="activity-body"><div class="activity-title">' + alerts[a].title + '</div>' +
            '<div class="activity-subtitle">' + alerts[a].sub + '</div></div></div>';
        }
        h += '</div>';
      }

      // ── Activité récente ──
      h += '<div class="dash-section-title">Activité récente</div>';
      h += '<div class="activity-list">';
      if (activity.length > 0) {
        for (var i = 0; i < activity.length; i++) {
          var item = activity[i];
          h += '<div class="activity-item" data-dash-page="' + item.page + '" data-dash-eid="' + (item.entityId || '') + '">' +
            '<div class="activity-avatar">' + item.icon + '</div>' +
            '<div class="activity-body"><div class="activity-title">' + this._esc(item.title) + '</div>' +
            '<div class="activity-subtitle">' + this._esc(item.subtitle) + '</div></div>' +
            '<div class="activity-time">' + item.time + '</div></div>';
        }
      } else {
        h += '<div class="activity-item"><div class="activity-avatar">📭</div>' +
          '<div class="activity-body"><div class="activity-title">Aucune activité récente</div>' +
          '<div class="activity-subtitle">Tout est calme pour le moment</div></div></div>';
      }
      h += '<div class="see-all-link" onclick="App.navigate(\'interventions\')">Voir tout ›</div>';
      h += '</div></div>';

      el.innerHTML = h;

      // Bind refresh button
      var refreshBtn = document.getElementById('dash-refresh-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', function() {
        refreshBtn.style.opacity = '0.4';
        DashboardPage._load().then(function() {
          var rb = document.getElementById('dash-refresh-btn');
          if (rb) rb.style.opacity = '';
        });
      });

      // Bind activity item deep-link clicks
      el.querySelectorAll('[data-dash-page]').forEach(function(item) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function() {
          var page = item.dataset.dashPage;
          var eid = item.dataset.dashEid;
          App.navigate(page);
          if (eid && page === 'interventions') {
            setTimeout(function() {
              if (typeof InterventionsPage !== 'undefined' && InterventionsPage.open) InterventionsPage.open(parseInt(eid));
            }, 300);
          }
        });
      });

    } catch (e) {
      el.innerHTML = '<div class="dashboard"><div class="dashboard-header"><h1>' + greet + ', ' + firstName + ' 👋</h1><p>Impossible de charger les données.</p></div></div>';
    }
  },

  _renderMyShiftCard: function(sh) {
    var sl = {scheduled:'Prévu',present:'Présent',late:'En retard',on_break:'En pause',finished:'Terminé',absent:'Absent'};
    var sc = {scheduled:'#9CA3AF',present:'#10B981',late:'#EF4444',on_break:'#F59E0B',finished:'#14B8A6',absent:'#EF4444'};
    var c = sc[sh.status] || '#9CA3AF';
    var l = sl[sh.status] || sh.status;
    var tf = function(dt) { return dt ? new Date(dt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'; };

    var h = '<div class="dash-shift-card">';
    h += '<div class="dash-shift-header">';
    h += '<div class="dash-shift-status"><span class="dash-shift-dot" style="background:' + c + '"></span><span style="color:' + c + ';font-weight:700;font-size:13px">' + l + '</span></div>';
    h += '<div class="dash-shift-times">' + (sh.scheduled_start || '—') + ' → ' + (sh.scheduled_end || '—') + '</div>';
    h += '</div>';
    if (sh.late_minutes > 0) {
      h += '<div class="dash-shift-late">⏱ Retard : ' + sh.late_minutes + ' min</div>';
    }
    if (sh.actual_start) {
      h += '<div class="dash-shift-real">Arrivée réelle : ' + tf(sh.actual_start) + (sh.actual_end ? ' · Départ : ' + tf(sh.actual_end) : '') + '</div>';
    }
    h += '</div>';
    return h;
  },

  _renderTeamOverview: function(shifts, stats) {
    var present = 0, absent = 0, late = 0, onBreak = 0, finished = 0;
    for (var i = 0; i < shifts.length; i++) {
      var st = shifts[i].status;
      if (st === 'present') present++;
      else if (st === 'late') { present++; late++; }
      else if (st === 'absent') absent++;
      else if (st === 'on_break') onBreak++;
      else if (st === 'finished') finished++;
    }

    var h = '<div class="dash-section-title">Équipe du jour</div>';
    h += '<div class="dash-team-grid">';
    h += '<div class="dash-team-kpi green"><div class="dash-team-val">' + present + '</div><div class="dash-team-label">Présents</div></div>';
    h += '<div class="dash-team-kpi red"><div class="dash-team-val">' + absent + '</div><div class="dash-team-label">Absents</div></div>';
    h += '<div class="dash-team-kpi orange"><div class="dash-team-val">' + late + '</div><div class="dash-team-label">Retards</div></div>';
    h += '<div class="dash-team-kpi blue"><div class="dash-team-val">' + onBreak + '</div><div class="dash-team-label">En pause</div></div>';
    h += '<div class="dash-team-kpi" style="background:rgba(20,184,166,.08)"><div class="dash-team-val" style="color:var(--teal)">' + finished + '</div><div class="dash-team-label">Terminés</div></div>';
    h += '</div>';

    // List late/absent (max 3)
    var flagged = shifts.filter(function(s) { return s.status === 'late' || s.status === 'absent'; }).slice(0, 3);
    if (flagged.length > 0) {
      h += '<div class="activity-list" style="margin-bottom:8px">';
      for (var j = 0; j < flagged.length; j++) {
        var f = flagged[j];
        var nm = f.user_name || 'Employé';
        var ico = f.status === 'absent' ? '🔴' : '🟠';
        var lab = f.status === 'absent' ? 'Absent' : 'En retard (' + (f.late_minutes || 0) + ' min)';
        h += '<div class="activity-item" onclick="App.navigate(\'attendance\')">' +
          '<div class="activity-avatar" style="background:rgba(239,68,68,.08)">' + ico + '</div>' +
          '<div class="activity-body"><div class="activity-title">' + nm + '</div>' +
          '<div class="activity-subtitle">' + lab + '</div></div></div>';
      }
      h += '</div>';
    }
    return h;
  },

  _actionCard: function(page, icon, label, badge, badgeCls) {
    var cssMap = {interventions:'intervention',tasks:'task',messages:'message',rooms:'room',attendance:'attendance',reviews:'review'};
    var cls = cssMap[page] || '';
    return '<div class="action-card ' + cls + '" onclick="App.navigate(\'' + page + '\')">' +
      '<div class="action-icon-wrap"><div class="action-icon">' + icon + '</div></div>' +
      '<div class="action-label">' + label + '</div>' +
      '<div class="action-badge ' + badgeCls + '">' + badge + '</div></div>';
  },

  _buildAlerts: function(s) {
    var alerts = [];
    if (this._n(s.stock_alerts) > 0) {
      alerts.push({icon:'📦', title: s.stock_alerts + ' alerte' + (s.stock_alerts > 1 ? 's' : '') + ' stock', sub:'Seuil minimum atteint', page:'stock', bg:'rgba(245,158,11,.08)'});
    }
    if (this._n(s.equipment_en_panne) > 0) {
      alerts.push({icon:'⚠️', title: s.equipment_en_panne + ' équipement' + (s.equipment_en_panne > 1 ? 's' : '') + ' en panne', sub:'Maintenance requise', page:'equipment', bg:'rgba(239,68,68,.08)'});
    }
    if (this._n(s.reviews_nouveau) > 0) {
      alerts.push({icon:'⭐', title: s.reviews_nouveau + ' avis non traité' + (s.reviews_nouveau > 1 ? 's' : ''), sub:'Note moyenne : ' + (s.reviews_avg_rating || '—') + '/5', page:'reviews', bg:'rgba(245,158,11,.08)'});
    }
    return alerts;
  },

  _buildActivity: function(interventions, tasks) {
    var items = [];
    var icons = { urgente: '🔴', haute: '🟠', normale: '🔧', basse: '🟢' };

    var sorted = interventions.slice().sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at); });
    for (var i = 0; i < Math.min(sorted.length, 3); i++) {
      var inv = sorted[i];
      items.push({
        icon: icons[inv.priority] || '🔧',
        title: inv.title || 'Intervention',
        subtitle: (inv.zone || 'Sans zone') + ' · ' + Utils.label(inv.status),
        time: Utils.timeAgo(inv.created_at),
        page: 'interventions',
        entityId: inv.id,
        date: new Date(inv.created_at),
      });
    }

    var urgTasks = tasks.filter(function(t){ return t.priority === 'urgente' && ['a_faire','en_cours'].indexOf(t.status) >= 0; });
    urgTasks.sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at); });
    for (var j = 0; j < Math.min(urgTasks.length, 2); j++) {
      var t = urgTasks[j];
      items.push({
        icon: '📋', title: t.title || 'Tâche urgente',
        subtitle: (t.service || 'Général') + ' · ' + Utils.label(t.status),
        time: Utils.timeAgo(t.created_at), page: 'tasks',
        entityId: t.id,
        date: new Date(t.created_at),
      });
    }

    items.sort(function(a,b){ return b.date - a.date; });
    return items.slice(0, 5);
  },

  _firstName: function() {
    var full = (App && App.currentUser) ? App.currentUser.name : '';
    return String(full).trim().split(' ')[0] || 'vous';
  },

  _n: function(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; },

  _esc: function(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  destroy: function() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
  },
};
