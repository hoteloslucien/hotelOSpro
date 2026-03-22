/* Hotel OS — Présence & Poste V2 — Actions manager + feedback */
var AttendancePage = {
  _tab: 'my', _sf: '',

  async render() {
    var el = document.getElementById('page-content'); if (!el) return;
    el.innerHTML = Utils.loader();
    var me = App.currentUser;
    var canTeam = App.has('attendance.team') || App.has('attendance.manage');
    var isManager = me && (me.role === 'direction' || me.role === 'responsable' || me.role === 'gouvernante') && canTeam;

    var h = '<div class="attendance-page">';
    if (isManager) {
      h += '<div class="filter-bar att-tabs">';
      h += '<button class="filter-chip ' + (this._tab === 'my' ? 'active' : '') + '" data-att-tab="my">🧑 Mon poste</button>';
      h += '<button class="filter-chip ' + (this._tab === 'team' ? 'active' : '') + '" data-att-tab="team">👥 Équipe</button>';
      h += '</div>';
    }
    h += '<div id="att-content"></div></div>';
    el.innerHTML = h;
    var self = this;
    el.querySelectorAll('[data-att-tab]').forEach(function(b) {
      b.addEventListener('click', function() { self._tab = b.dataset.attTab; self.render(); });
    });
    if (this._tab === 'my') await this._renderMy();
    else await this._renderTeam();
  },

  async _renderMy() {
    var box = document.getElementById('att-content'); if (!box) return;
    box.innerHTML = Utils.loader();
    try {
      var sh = await Api.attendanceMyShift();
      if (!sh || !sh.status) {
        box.innerHTML = '<div class="att-my-card"><div style="text-align:center;padding:24px;color:var(--text-3)">' +
          '<div style="font-size:32px;margin-bottom:8px">🕐</div>' +
          '<div style="font-weight:600">Aucun poste prévu aujourd\'hui</div>' +
          '<div style="font-size:13px;margin-top:4px">Contactez votre responsable si besoin</div></div></div>';
        return;
      }
      var ev = await Api.attendanceMyEvents().catch(function() { return []; });
      var u = App.currentUser;
      var sl = {scheduled:'Prévu',present:'Présent',late:'En retard',on_break:'En pause',finished:'Terminé',absent:'Absent'};
      var sc = {scheduled:'var(--text-3)',present:'var(--success)',late:'var(--danger)',on_break:'var(--warning)',finished:'var(--teal)',absent:'var(--danger)'};
      var c = sc[sh.status] || 'var(--text-3)', l = sl[sh.status] || sh.status;
      var tf = function(dt) { return dt ? new Date(dt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'; };

      var h = '<div class="att-my-card">';
      h += '<div class="att-my-header"><div class="att-my-avatar">' + (u.name || '?')[0].toUpperCase() + '</div>';
      h += '<div><div class="att-my-name">' + u.name + '</div>';
      h += '<div class="att-my-service">' + Utils.label(u.service || u.role) + ' · ' + new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}) + '</div></div></div>';
      h += '<div class="att-status-ring"><div class="att-status-dot" style="background:' + c + '"></div><span style="color:' + c + '">' + l + '</span></div>';
      h += '<div class="att-time-row"><div class="att-time-block"><div class="att-time-label">Prévu</div><div class="att-time-val">' + (sh.scheduled_start || '—') + ' → ' + (sh.scheduled_end || '—') + '</div></div>';
      h += '<div class="att-time-block"><div class="att-time-label">Réel</div><div class="att-time-val">' + tf(sh.actual_start) + ' → ' + tf(sh.actual_end) + '</div></div></div>';
      if (sh.late_minutes > 0) h += '<div class="att-late-badge">⏱ Retard : ' + sh.late_minutes + ' min</div>';
      h += '<div class="att-actions">' + this._btns(sh.status) + '</div></div>';

      if (ev.length > 0) {
        var evLabels = {clock_in:'Prise de poste',break_start:'Pause',break_end:'Reprise',clock_out:'Fin de poste',absence_declared:'Absence',status_corrected:'Correction'};
        h += '<div class="dash-section-title" style="margin-top:24px">Historique du jour</div><div class="activity-list">';
        for (var i = 0; i < ev.length; i++) {
          var e = ev[i];
          h += '<div class="activity-item"><div class="activity-avatar" style="background:rgba(15,29,53,.04)">⏺</div>';
          h += '<div class="activity-body"><div class="activity-title">' + (evLabels[e.event_type] || e.event_type) + '</div>';
          if (e.notes) h += '<div class="activity-subtitle">' + e.notes + '</div>';
          h += '</div><div class="activity-time">' + tf(e.event_time) + '</div></div>';
        }
        h += '</div>';
      }
      box.innerHTML = h;

      var self = this;
      box.querySelectorAll('[data-att-action]').forEach(function(b) {
        b.addEventListener('click', async function() {
          b.disabled = true;
          b.textContent = '...';
          try {
            await Api.attendanceAction({action: b.dataset.attAction});
            Toast.success('Action enregistrée');
            // Full re-render (replaces entire DOM, so no need to re-enable button)
            await self.render();
            // Refresh header shift timer
            if (typeof App !== 'undefined' && App._initShiftTimer) App._initShiftTimer();
          } catch(e) {
            Toast.error(e.message);
            b.disabled = false;
            b.textContent = b.dataset.attAction === 'clock_in' ? '🟢 Prendre mon poste' : b.dataset.attAction;
          }
        });
      });
    } catch(e) { box.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _btns: function(s) {
    var b = function(a, l, c) {
      return '<button class="btn ' + c + ' btn-full att-action-btn" data-att-action="' + a + '">' + l + '</button>';
    };
    if (s === 'scheduled') return b('clock_in', '🟢  Prendre mon poste', 'btn-primary');
    if (s === 'present' || s === 'late') return b('break_start', '☕  Pause', 'btn-warning') + b('clock_out', '🔴  Fin de poste', 'btn-danger');
    if (s === 'on_break') return b('break_end', '▶  Reprendre', 'btn-success');
    if (s === 'finished') return '<div class="att-done-msg">✓ Poste terminé</div>';
    if (s === 'absent') return '<div class="att-done-msg att-absent-msg">Absence enregistrée</div>';
    return '';
  },

  async _renderTeam() {
    var box = document.getElementById('att-content'); if (!box) return;
    box.innerHTML = Utils.loader();
    try {
      var qs = this._sf ? {status: this._sf} : {};
      var team = await Api.attendanceTeam(qs);
      var stats = await Api.attendanceStats(qs);

      var h = '<div class="kpi-grid" style="margin-bottom:16px">';
      h += '<div class="kpi-card green"><div class="kpi-val">' + ((stats.present || 0) + (stats.late || 0)) + '</div><div class="kpi-label">Présents</div></div>';
      h += '<div class="kpi-card red"><div class="kpi-val">' + (stats.absent || 0) + '</div><div class="kpi-label">Absents</div></div>';
      h += '<div class="kpi-card orange"><div class="kpi-val">' + (stats.late || 0) + '</div><div class="kpi-label">Retards</div></div>';
      h += '<div class="kpi-card teal"><div class="kpi-val">' + (stats.finished || 0) + '</div><div class="kpi-label">Terminés</div></div>';
      h += '</div>';

      h += '<div class="filter-bar">';
      var filters = [['','Tous'],['present','Présents'],['absent','Absents'],['late','Retards'],['on_break','Pauses']];
      var self = this;
      for (var f = 0; f < filters.length; f++) {
        h += '<button class="filter-chip ' + (this._sf === filters[f][0] ? 'active' : '') + '" data-att-sf="' + filters[f][0] + '">' + filters[f][1] + '</button>';
      }
      h += '</div>';

      h += '<div class="activity-list">';
      if (team.length > 0) {
        for (var j = 0; j < team.length; j++) {
          var s = team[j];
          var nm = s.user_name || ('#' + s.user_id);
          var ini = nm.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
          var sl = {scheduled:'Prévu',present:'Présent',late:'En retard',on_break:'En pause',finished:'Terminé',absent:'Absent'};
          var sb = {scheduled:'badge-scheduled',present:'badge-present',late:'badge-late',on_break:'badge-on_break',finished:'badge-finished',absent:'badge-absent'};

          h += '<div class="list-item">';
          h += '<div class="list-item-icon" style="background:linear-gradient(135deg,var(--navy),var(--navy-mid));color:#fff;font-weight:800;font-size:12px;border-radius:14px">' + ini + '</div>';
          h += '<div class="list-item-body"><div class="list-item-title">' + nm + '</div>';
          h += '<div class="list-item-sub">' + Utils.label(s.user_role || '') + ' · ' + (s.service || '—') + '</div>';
          h += '<div style="margin-top:4px;display:flex;align-items:center;gap:8px">';
          h += '<span class="badge ' + (sb[s.status] || 'badge-scheduled') + '">' + (sl[s.status] || s.status) + '</span>';
          if (s.late_minutes > 0) h += '<span style="font-size:11px;color:var(--danger);font-weight:600">' + s.late_minutes + ' min</span>';
          h += '</div></div>';

          // Manager actions
          var me = App.currentUser;
          h += '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">';
          if (s.user_id !== me.id) {
            h += '<button class="btn btn-sm" style="font-size:11px;padding:4px 10px;color:var(--accent)" data-att-contact="' + s.user_id + '">💬</button>';
          }
          if (s.status !== 'absent' && s.status !== 'finished') {
            h += '<button class="btn btn-sm" style="font-size:11px;padding:4px 10px;color:var(--danger)" data-mgr-absent="' + s.user_id + '">Absent</button>';
          }
          if (s.status !== 'finished') {
            h += '<button class="btn btn-sm" style="font-size:11px;padding:4px 10px;color:var(--text-2)" data-mgr-correct="' + s.user_id + '" data-mgr-name="' + nm + '" data-mgr-status="' + s.status + '">Corriger</button>';
          }
          h += '</div>';
          h += '</div>';
        }
      } else {
        h += Utils.emptyState('👥', 'Aucun membre');
      }
      h += '</div>';
      box.innerHTML = h;

      // Bind filter events
      box.querySelectorAll('[data-att-sf]').forEach(function(b) {
        b.addEventListener('click', function() { self._sf = b.dataset.attSf; self._renderTeam(); });
      });

      // Bind contact buttons
      box.querySelectorAll('[data-att-contact]').forEach(function(b) {
        b.addEventListener('click', async function() {
          var uid = parseInt(b.dataset.attContact);
          try {
            var conv = await Api.createDirectConv(uid);
            App.navigate('messages');
            setTimeout(function() {
              if (typeof ConversationsPage !== 'undefined') {
                ConversationsPage._convId = conv.id;
                ConversationsPage._view = 'chat';
                ConversationsPage.render();
              }
            }, 100);
          } catch(e) { Toast.error(e.message); }
        });
      });

      // Bind manager action events
      box.querySelectorAll('[data-mgr-absent]').forEach(function(b) {
        b.addEventListener('click', function() {
          var uid = parseInt(b.dataset.mgrAbsent);
          Modal.confirm('Marquer cet employé comme absent ?', async function() {
            try {
              await Api.attendanceManagerAction({ user_id: uid, action: 'mark_absent', notes: 'Absence déclarée par le responsable' });
              Toast.success('Absence enregistrée');
              await self._renderTeam();
            } catch(e) { Toast.error(e.message); }
          }, 'Marquer absent', true);
        });
      });

      box.querySelectorAll('[data-mgr-correct]').forEach(function(b) {
        b.addEventListener('click', function() {
          var uid = parseInt(b.dataset.mgrCorrect);
          var name = b.dataset.mgrName;
          var currentStatus = b.dataset.mgrStatus;

          var statusOpts = ['scheduled','present','late','on_break','finished','absent']
            .filter(function(s) { return s !== currentStatus; })
            .map(function(s) {
              var labels = {scheduled:'Prévu',present:'Présent',late:'En retard',on_break:'En pause',finished:'Terminé',absent:'Absent'};
              return { value: s, label: labels[s] || s };
            });

          Modal.form('Corriger le statut de ' + name, [
            { key: 'status', label: 'Nouveau statut', type: 'select', options: statusOpts },
            { key: 'notes', label: 'Note (optionnel)', placeholder: 'Raison de la correction...' },
          ], async function(data) {
            if (!data.status) throw new Error('Statut requis');
            await Api.attendanceManagerAction({
              user_id: uid,
              action: 'correct_status',
              status: data.status,
              notes: data.notes || null,
            });
            Toast.success('Statut corrigé');
            await self._renderTeam();
          }, 'Corriger');
        });
      });

    } catch(e) { box.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  destroy: function() { this._tab = 'my'; this._sf = ''; }
};
