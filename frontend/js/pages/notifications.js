/* Hotel OS — Notifications — navigation entité complète */
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
    var chips = ['all','unread'].map(function(f) {
      var cnt = f === 'all' ? self.items.length : unread;
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

    // Navigation map: entity_type → page (and optional open function)
    var NAV = {
      intervention: 'interventions',
      task:         'tasks',
      stock:        'stock',
      equipment:    'equipment',
      room:         'rooms',
      conversation: 'messages',
      review:       'reviews',
    };

    var list = visible.length ? visible.map(function(n) {
      var icon = ICONS[n.type] || '🔔';
      var isRead = n.is_read;
      var pColor = n.priority === 'critical' || n.priority === 'high' ? 'rgba(239,68,68,.1)' : 'rgba(59,130,246,.1)';
      return '<div class="list-item notif-item ' + (isRead ? '' : 'notif-unread') + '" '
        + 'data-notif-id="' + n.id + '" '
        + 'data-notif-entity="' + (n.entity_type || '') + '" '
        + 'data-notif-eid="' + (n.entity_id || 0) + '" '
        + 'style="' + (isRead ? 'opacity:0.6' : '') + ';cursor:pointer">'
        + '<div class="list-item-icon" style="background:' + pColor + '">' + icon + '</div>'
        + '<div class="list-item-body">'
        + '<div class="list-item-title">' + self._esc(n.title)
        + (!isRead ? ' <span style="display:inline-block;width:8px;height:8px;background:var(--primary);border-radius:50%;margin-left:6px;vertical-align:middle"></span>' : '')
        + '</div>'
        + '<div class="list-item-sub">' + self._esc(n.message) + '</div>'
        + '<div style="font-size:11px;color:var(--text-3);margin-top:3px">' + Utils.timeAgo(n.created_at) + '</div>'
        + '</div>'
        + '<div class="list-item-right">' + Utils.badge(n.priority) + '</div>'
        + '</div>';
    }).join('') : Utils.emptyState('🔔', 'Aucune notification');

    document.getElementById('page-content').innerHTML =
      '<div class="page-header">'
      + '<div><div class="page-h1">Notifications</div>'
      + '<div class="page-sub">' + unread + ' non lue' + (unread > 1 ? 's' : '') + '</div></div>'
      + (unread > 0 ? '<button class="btn btn-secondary btn-sm" id="notif-read-all">Tout lire</button>' : '')
      + '</div>'
      + '<div class="filter-bar" id="notif-filter-bar">' + chips + '</div>'
      + '<div id="notif-list">' + list + '</div>';

    document.getElementById('notif-filter-bar').querySelectorAll('[data-nf]').forEach(function(b) {
      b.addEventListener('click', function() { self.filter = b.dataset.nf; self._draw(); });
    });

    document.getElementById('notif-list').querySelectorAll('[data-notif-id]').forEach(function(item) {
      item.addEventListener('click', async function() {
        var nid = parseInt(item.dataset.notifId);
        var entity = item.dataset.notifEntity;
        var eid = parseInt(item.dataset.notifEid) || 0;

        // Mark as read
        try { await Api.markNotificationRead(nid); } catch(e) {}
        var n = self.items.find(function(x){ return x.id === nid; });
        if (n) n.is_read = true;
        App._updateNotifBadge();

        // Navigate to entity
        var targetPage = NAV[entity];
        if (targetPage) {
          App.navigate(targetPage);
          // Deep-link into specific item
          if (eid > 0) {
            if (entity === 'intervention') {
              setTimeout(function() {
                if (typeof InterventionsPage !== 'undefined' && InterventionsPage.open) {
                  InterventionsPage.open(eid);
                }
              }, 400);
            } else if (entity === 'task') {
              setTimeout(function() {
                if (typeof TasksPage !== 'undefined' && TasksPage.openTask) {
                  TasksPage.openTask(eid);
                }
              }, 400);
            } else if (entity === 'equipment') {
              setTimeout(function() {
                if (typeof EquipmentPage !== 'undefined' && EquipmentPage.openItem) {
                  EquipmentPage.openItem(eid);
                }
              }, 400);
            } else if (entity === 'conversation') {
              setTimeout(function() {
                if (typeof ConversationsPage !== 'undefined') {
                  ConversationsPage._convId = eid;
                  ConversationsPage._view = 'chat';
                  ConversationsPage.render();
                }
              }, 400);
            }
          }
        } else {
          // Just refresh the list
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
        Toast.success('Toutes les notifications lues ✓');
      } catch(e) { Toast.error(e.message); }
    });
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  destroy: function() { this.filter = 'all'; },
};
