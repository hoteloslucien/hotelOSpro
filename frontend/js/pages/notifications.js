/* Hotel OS — Page Notifications — badge dynamique, mark-all, suppression */
const NotificationsPage = {
  items: [],
  filter: 'all',

  async render() {
    var el = document.getElementById('page-content');
    el.innerHTML = Utils.loader();
    try {
      this.items = await Api.notifications(100);
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw: function() {
    var self = this;
    var unread = this.items.filter(function(n) { return !n.is_read; }).length;
    var filters = ['all','unread'];
    var chips = filters.map(function(f) {
      var cnt = f === 'all' ? self.items.length : self.items.filter(function(n){ return !n.is_read; }).length;
      return '<button class="filter-chip ' + (self.filter === f ? 'active' : '') + '" data-nf="' + f + '">' +
        (f === 'all' ? 'Toutes' : 'Non lues') + ' (' + cnt + ')</button>';
    }).join('');

    var visible = this.filter === 'unread' ? this.items.filter(function(n){ return !n.is_read; }) : this.items;

    var ICONS = {
      intervention_created:'🔧', intervention_assigned:'🔧', intervention_urgent:'🚨',
      intervention_closed:'✅', intervention_duplicate:'🔁', intervention_taken:'🔧',
      task_assigned:'📋', task_overdue:'⏰',
      message_received:'💬', conversation_added:'💬',
      attendance_late:'🕐', attendance_missing:'❌',
      stock_alert:'📦', equipment_alert:'⚠️', room_block_request:'🛏️',
    };

    var list = visible.length ? visible.map(function(n) {
      var icon = ICONS[n.type] || '🔔';
      var readStyle = n.is_read ? 'opacity:0.6' : '';
      var dotStyle = n.is_read ? '' : 'display:inline-block;width:8px;height:8px;background:var(--primary);border-radius:50%;margin-left:6px;vertical-align:middle';
      return '<div class="list-item notif-item ' + (n.is_read ? '' : 'notif-unread') + '" data-notif-id="' + n.id + '" data-notif-entity="' + (n.entity_type || '') + '" data-notif-eid="' + (n.entity_id || '') + '" style="' + readStyle + ';cursor:pointer">' +
        '<div class="list-item-icon" style="background:' + (n.priority === 'critical' || n.priority === 'high' ? 'rgba(239,68,68,.1)' : 'rgba(59,130,246,.1)') + '">' + icon + '</div>' +
        '<div class="list-item-body">' +
        '<div class="list-item-title">' + self._esc(n.title) + (n.is_read ? '' : '<span style="' + dotStyle + '"></span>') + '</div>' +
        '<div class="list-item-sub">' + self._esc(n.message) + '</div>' +
        '<div style="font-size:11px;color:var(--text-3);margin-top:3px">' + Utils.timeAgo(n.created_at) + '</div>' +
        '</div>' +
        '<div class="list-item-right">' + Utils.badge(n.priority) + '</div>' +
        '</div>';
    }).join('') : Utils.emptyState('🔔', 'Aucune notification');

    document.getElementById('page-content').innerHTML =
      '<div class="page-header">' +
      '<div><div class="page-h1">Notifications</div>' +
      '<div class="page-sub">' + unread + ' non lue' + (unread > 1 ? 's' : '') + '</div></div>' +
      (unread > 0 ? '<button class="btn btn-secondary btn-sm" id="notif-read-all">Tout lire</button>' : '') +
      '</div>' +
      '<div class="filter-bar" id="notif-filter-bar">' + chips + '</div>' +
      '<div id="notif-list">' + list + '</div>';

    document.getElementById('notif-filter-bar').querySelectorAll('[data-nf]').forEach(function(b) {
      b.addEventListener('click', function() { self.filter = b.dataset.nf; self._draw(); });
    });

    document.getElementById('notif-list').querySelectorAll('[data-notif-id]').forEach(function(item) {
      item.addEventListener('click', async function() {
        var nid = parseInt(item.dataset.notifId);
        var entity = item.dataset.notifEntity;
        var eid = parseInt(item.dataset.notifEid);
        // Mark read
        try { await Api.markNotificationRead(nid); } catch(e) {}
        var n = self.items.find(function(x){ return x.id === nid; });
        if (n) n.is_read = true;
        App._updateNotifBadge();
        // Navigate to entity
        if (entity === 'intervention' && eid) {
          App.navigate('interventions');
          setTimeout(function() {
            if (typeof InterventionsPage !== 'undefined' && InterventionsPage.open) {
              InterventionsPage.open(eid);
            }
          }, 300);
        } else if (entity === 'task' && eid) {
          App.navigate('tasks');
        } else if (entity === 'stock') {
          App.navigate('stock');
        } else if (entity === 'equipment') {
          App.navigate('equipment');
        } else {
          self._draw();
        }
      });
    });

    var readAllBtn = document.getElementById('notif-read-all');
    if (readAllBtn) readAllBtn.addEventListener('click', async function() {
      try {
        await Api.markAllNotificationsRead();
        self.items.forEach(function(n){ n.is_read = true; });
        App._updateNotifBadge();
        self._draw();
        Toast.success('Toutes les notifications lues');
      } catch(e) { Toast.error(e.message); }
    });
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },

  destroy: function() { this.filter = 'all'; },
};
