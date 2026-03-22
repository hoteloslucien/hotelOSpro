/* Hotel OS — Notifications Page */
var NotificationsPage = {
  items: [],

  async render() {
    var el = document.getElementById('page-content');
    if (!el) return;
    el.innerHTML = Utils.loader();
    try {
      this.items = await Api.notifications(100);
      this._draw();
    } catch(e) { el.innerHTML = '<div class="alert alert-error">' + e.message + '</div>'; }
  },

  _draw: function() {
    var self = this;
    var unread = this.items.filter(function(n) { return !n.is_read; }).length;

    var h = '<div class="page-header">' +
      '<div><div class="page-h1">Notifications</div>' +
      '<div class="page-sub">' + this.items.length + ' au total · ' + unread + ' non lue' + (unread > 1 ? 's' : '') + '</div></div>';
    if (unread > 0) {
      h += '<button class="btn btn-secondary btn-sm" id="notif-read-all">Tout marquer lu</button>';
    }
    h += '</div>';

    h += '<div class="activity-list">';
    if (this.items.length === 0) {
      h += Utils.emptyState('🔔', 'Aucune notification');
    } else {
      for (var i = 0; i < this.items.length; i++) {
        var n = this.items[i];
        var icon = self._icon(n.type);
        var prioCls = self._prioCls(n.priority);
        var unreadDot = n.is_read ? '' : '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0"></div>';

        h += '<div class="activity-item' + (n.is_read ? '' : ' notif-unread') + '" data-notif-id="' + n.id + '" ' +
          (n.entity_type ? 'data-notif-entity="' + n.entity_type + '" data-notif-eid="' + (n.entity_id || '') + '"' : '') +
          ' style="cursor:pointer">' +
          '<div class="activity-avatar" style="background:' + prioCls + '">' + icon + '</div>' +
          '<div class="activity-body">' +
          '<div class="activity-title"' + (n.is_read ? '' : ' style="font-weight:700"') + '>' + self._esc(n.title) + '</div>' +
          '<div class="activity-subtitle">' + self._esc(n.message) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
          '<div class="activity-time">' + Utils.timeAgo(n.created_at) + '</div>' +
          unreadDot +
          '</div></div>';
      }
    }
    h += '</div>';

    document.getElementById('page-content').innerHTML = h;

    // Bind click events
    var el = document.getElementById('page-content');
    el.querySelectorAll('[data-notif-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        var nid = parseInt(item.dataset.notifId);
        var entity = item.dataset.notifEntity;
        var eid = item.dataset.notifEid;
        // Mark as read
        Api.markNotificationRead(nid).then(function() {
          App._updateNotifBadge();
        }).catch(function(){});
        // Navigate to entity — deep link where possible
        if (entity === 'intervention') {
          App.navigate('interventions');
          if (eid) setTimeout(function() {
            if (typeof InterventionsPage !== 'undefined' && InterventionsPage.open) InterventionsPage.open(parseInt(eid));
          }, 300);
        }
        else if (entity === 'task') {
          App.navigate('tasks');
          if (eid) setTimeout(function() {
            if (typeof TasksPage !== 'undefined' && TasksPage.openTask) TasksPage.openTask(parseInt(eid));
          }, 300);
        }
        else if (entity === 'conversation') {
          App.navigate('messages');
          if (eid) setTimeout(function() {
            if (typeof ConversationsPage !== 'undefined') {
              ConversationsPage._convId = parseInt(eid);
              ConversationsPage._view = 'chat';
              ConversationsPage.render();
            }
          }, 300);
        }
        else if (entity === 'attendance') {
          App.navigate('attendance');
          // If it's a specific user's attendance issue, switch to team tab
          if (eid) setTimeout(function() {
            if (typeof AttendancePage !== 'undefined') {
              AttendancePage._tab = 'team';
              AttendancePage.render();
            }
          }, 300);
        }
        else if (entity === 'equipment') {
          App.navigate('equipment');
          // Open specific equipment item if possible
          if (eid) setTimeout(function() {
            if (typeof EquipmentPage !== 'undefined' && EquipmentPage.openItem) EquipmentPage.openItem(parseInt(eid));
          }, 300);
        }
        else if (entity === 'stock') {
          App.navigate('stock');
          // Open specific stock item if possible
          if (eid) setTimeout(function() {
            if (typeof StockPage !== 'undefined' && StockPage.open) StockPage.open(parseInt(eid));
          }, 300);
        }
        else if (entity === 'room') {
          App.navigate('rooms');
          if (eid) setTimeout(function() {
            if (typeof RoomsPage !== 'undefined' && RoomsPage.openRoom) RoomsPage.openRoom(parseInt(eid));
          }, 300);
        }
        else { App.navigate('notifications'); }
      });
    });

    var readAllBtn = document.getElementById('notif-read-all');
    if (readAllBtn) {
      readAllBtn.addEventListener('click', async function() {
        try {
          await Api.markAllNotificationsRead();
          Toast.success('Toutes les notifications marquées lues');
          App._updateNotifBadge();
          await self.render();
        } catch(e) { Toast.error(e.message); }
      });
    }
  },

  _icon: function(type) {
    var map = {
      intervention_created: '🔧', intervention_assigned: '🔧', intervention_urgent: '🔴',
      intervention_closed: '✅', intervention_duplicate: '🔁',
      task_assigned: '📋', task_overdue: '⏰',
      message_received: '💬', conversation_added: '👥',
      attendance_late: '🕐', attendance_missing: '🚫',
      stock_alert: '📦', equipment_alert: '⚙️',
    };
    return map[type] || '🔔';
  },

  _prioCls: function(prio) {
    var map = {
      critical: 'rgba(239,68,68,.1)',
      high: 'rgba(245,158,11,.1)',
      medium: 'rgba(15,29,53,.05)',
      low: 'rgba(20,184,166,.08)',
    };
    return map[prio] || 'rgba(15,29,53,.05)';
  },

  _esc: function(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  destroy: function() {}
};
