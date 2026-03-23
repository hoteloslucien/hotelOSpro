/* Hotel OS — app.js
 * Navigation + filtrage par permissions dynamiques
 * Le menu et les boutons s'adaptent aux permissions réelles du rôle connecté.
 */
const App = {
  currentUser: null,
  permissions: [],   // liste des codes de permission chargés depuis l'API

  /* Modules core affichés dans la bottom nav */
  CORE_MODULES: ['dashboard', 'interventions', 'tasks', 'rooms', 'messages'],

  /* Modules secondaires (menu latéral uniquement) */
  ADVANCED_MODULES: ['rounds', 'attendance', 'reviews', 'equipment', 'stock', 'notifications', 'settings'],

  /* Permission requise pour voir chaque module dans le menu */
  MODULE_PERMS: {
    dashboard:     null,
    interventions: 'interventions.view',
    tasks:         'tasks.view',
    rooms:         'rooms.view',
    messages:      'messages.view',
    rounds:        'rounds.view',
    attendance:    'attendance.view',
    reviews:       'reviews.view',
    equipment:     'equipment.view',
    stock:         'stock.view',
    notifications: 'notifications.view',
    settings:      'settings.view',
  },

  // ── Init ─────────────────────────────────────────────────────────
  _unreadTimer: null,
  _navHistory: [],
  _hotels: [],
  _currentHotel: null,

  async init() {
    const token = Api.getToken();
    if (token) {
      try {
        this.currentUser = await Api.me();
        await this.loadPermissions();
        this._showApp();
        this.navigate('dashboard');
        this._startUnreadPolling();
      } catch (e) {
        // Only clear token if it's truly expired (401), not a network error
        if (e.message && e.message.indexOf('Session expirée') >= 0) {
          Api.clearToken();
        }
        this._showLogin();
      }
    } else {
      this._showLogin();
    }

    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });
  },

  _startUnreadPolling() {
    this._updateUnreadBadge();
    this._updateNotifBadge();
    this._updateShiftTimer();

    if (this._unreadTimer) clearInterval(this._unreadTimer);
    this._unreadTimer = setInterval(() => {
      this._updateUnreadBadge();
      this._updateNotifBadge();
    }, 15000);

    // Shift timer ticks every second
    if (this._shiftTimerInterval) clearInterval(this._shiftTimerInterval);
    this._shiftTimerInterval = null;
    this._shiftStart = null;
    this._shiftStatus = null;
    this._initShiftTimer();
  },

  async _initShiftTimer() {
    try {
      // Always clear previous timer first
      if (this._shiftTimerInterval) {
        clearInterval(this._shiftTimerInterval);
        this._shiftTimerInterval = null;
      }

      var sh = await Api.attendanceMyShift();
      var widget = document.getElementById('shift-timer-widget');
      if (!widget) return;

      if (!sh || !sh.actual_start || sh.status === 'scheduled' || sh.status === 'absent') {
        widget.classList.add('hidden');
        this._shiftStart = null;
        return;
      }

      this._shiftStart = new Date(sh.actual_start);
      this._shiftStatus = sh.status;
      widget.classList.remove('hidden');
      widget.className = 'shift-timer-widget' + (
        sh.status === 'on_break'
          ? ' on-break'
          : sh.status === 'finished'
            ? ' finished'
            : ''
      );
      widget.onclick = function () { App.navigate('attendance'); };
      this._tickShiftTimer();

      if (sh.status !== 'finished') {
        this._shiftTimerInterval = setInterval(() => this._tickShiftTimer(), 1000);
      }
    } catch (_) {}
  },

  _tickShiftTimer() {
    var el = document.getElementById('shift-timer-text');
    var widget = document.getElementById('shift-timer-widget');
    if (!el || !this._shiftStart) return;

    var now = new Date();
    var diff = Math.floor((now - this._shiftStart) / 1000);
    if (diff < 0) diff = 0;

    var h = Math.floor(diff / 3600);
    var m = Math.floor((diff % 3600) / 60);
    var s = diff % 60;

    el.textContent =
      (h < 10 ? '0' : '') + h + ':' +
      (m < 10 ? '0' : '') + m + ':' +
      (s < 10 ? '0' : '') + s;

    if (widget && this._shiftStatus === 'on_break') {
      widget.className = 'shift-timer-widget on-break';
    }
  },

  _updateShiftTimer() {
    this._initShiftTimer();
  },

  async _updateUnreadBadge() {
    try {
      try {
        var uc = await Api.convUnreadCount();
        var cnt = uc.unread || 0;
      } catch (e) {
        var cnt = 0;
      }

      var unread = cnt;
      const badge = document.getElementById('msg-unread-badge');
      const badgeMenu = document.getElementById('msg-unread-badge-menu');

      if (badge) {
        if (unread > 0) {
          badge.textContent = unread > 99 ? '99+' : unread;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      if (badgeMenu) {
        if (unread > 0) {
          badgeMenu.textContent = unread > 99 ? '99+' : unread;
          badgeMenu.classList.remove('hidden');
        } else {
          badgeMenu.classList.add('hidden');
        }
      }
    } catch (_) { /* ignore */ }
  },

  async _updateNotifBadge() {
    try {
      var res = await Api.notificationsUnread();
      var count = res.count || 0;
      var badge = document.getElementById('notif-badge');
      var badgeMenu = document.getElementById('notif-unread-badge-menu');

      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      if (badgeMenu) {
        if (count > 0) {
          badgeMenu.textContent = count > 99 ? '99+' : count;
          badgeMenu.classList.remove('hidden');
        } else {
          badgeMenu.classList.add('hidden');
        }
      }
    } catch (_) { /* ignore */ }
  },

  async loadPermissions() {
    try {
      const res = await Api.myPermissions();
      this.permissions = res.permissions || [];
    } catch {
      // Fallback : pas de permissions (vue minimale)
      this.permissions = [];
    }
  },

  has(permCode) {
    return this.permissions.includes(permCode);
  },

  // ── Login ────────────────────────────────────────────────────────
  async login() {
    const email = document.getElementById('login-email')?.value.trim() || '';
    const password = document.getElementById('login-password')?.value || '';
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (errEl) errEl.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Connexion…';
    }

    try {
      const res = await Api.login(email, password);
      Api.setToken(res.access_token);
      this.currentUser = res.user;
      await this.loadPermissions();
      this._showApp();
      this._startUnreadPolling();
      await new Promise(r => setTimeout(r, 80));
      this.navigate('dashboard');
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Se connecter';
      }
    }
  },

  // ── Logout ───────────────────────────────────────────────────────
  logout() {
    Api.clearToken();
    this.currentUser = null;
    this.permissions = [];
    this._navHistory = [];

    if (this._unreadTimer) {
      clearInterval(this._unreadTimer);
      this._unreadTimer = null;
    }

    if (this._shiftTimerInterval) {
      clearInterval(this._shiftTimerInterval);
      this._shiftTimerInterval = null;
    }

    if (this._currentPage) {
      const prev = this._getPageObject(this._currentPage);
      if (prev && typeof prev.destroy === 'function') prev.destroy();
      this._currentPage = null;
    }

    // Clear UI immediately
    const headerUserName = document.getElementById('header-user-name');
    if (headerUserName) headerUserName.textContent = '';

    const menuName = document.getElementById('menu-name');
    if (menuName) menuName.textContent = '';

    const menuRole = document.getElementById('menu-role');
    if (menuRole) menuRole.textContent = '';

    const menuAvatar = document.getElementById('menu-avatar');
    if (menuAvatar) menuAvatar.textContent = '?';

    var nb = document.getElementById('notif-badge');
    if (nb) nb.classList.add('hidden');

    var mb = document.getElementById('msg-unread-badge');
    if (mb) mb.classList.add('hidden');

    var sw = document.getElementById('shift-timer-widget');
    if (sw) sw.classList.add('hidden');

    this._showLogin();

    const loginPassword = document.getElementById('login-password');
    if (loginPassword) loginPassword.value = '';

    const loginError = document.getElementById('login-error');
    if (loginError) loginError.classList.add('hidden');
  },

  // ── UI ───────────────────────────────────────────────────────────
  _showLogin() {
    const login = document.getElementById('screen-login');
    const app = document.getElementById('screen-app');
    if (!login || !app) return;

    login.style.display = 'flex';
    login.classList.remove('hidden');
    login.classList.add('active');

    app.style.display = 'none';
    app.classList.add('hidden');
    app.classList.remove('active');
  },

  _showApp() {
    const login = document.getElementById('screen-login');
    const app = document.getElementById('screen-app');
    if (!login || !app) return;

    // Cacher login complètement
    login.style.display = 'none';
    login.classList.add('hidden');
    login.classList.remove('active');

    // Montrer app — forcer display + classes
    app.classList.remove('hidden');
    app.classList.add('active');
    app.style.display = 'block';

    this._updateUI();
    this._applyRoleFilter();
  },

  _updateUI() {
    const u = this.currentUser;
    if (!u) return;

    const initials = (u.name || '')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const headerUserName = document.getElementById('header-user-name');
    if (headerUserName) headerUserName.textContent = (u.name || '').split(' ')[0] || '';

    const menuName = document.getElementById('menu-name');
    if (menuName) menuName.textContent = u.name || '';

    const menuRole = document.getElementById('menu-role');
    if (menuRole) menuRole.textContent = Utils.label(u.role) + (u.service ? ' · ' + Utils.label(u.service) : '');

    const menuAvatar = document.getElementById('menu-avatar');
    if (menuAvatar) menuAvatar.textContent = initials || '?';
  },

  _applyRoleFilter() {
    /* Bottom nav : modules core autorisés par permission */
    document.querySelectorAll('#bottom-nav [data-page]').forEach(el => {
      const page = el.dataset.page;
      const perm = this.MODULE_PERMS[page];
      const allowed = this.CORE_MODULES.includes(page) && (!perm || this.has(perm));
      el.style.display = allowed ? '' : 'none';
    });

    /* Menu latéral : tous modules autorisés, avec séparateur avancés */
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;

    navLinks.querySelectorAll('[data-page]').forEach(el => {
      const page = el.dataset.page;
      const perm = this.MODULE_PERMS[page];
      const isAllowed = !perm || this.has(perm);
      const isAdvanced = this.ADVANCED_MODULES.includes(page);
      const li = el.parentElement;

      if (!isAllowed) {
        li.style.display = 'none';
        return;
      }

      li.style.display = '';
      li.style.opacity = isAdvanced ? '0.7' : '';
      li.title = isAdvanced ? 'Module avancé' : '';
    });

    /* Séparateur "Modules avancés" */
    const existingSep = navLinks.querySelector('.advanced-sep');
    if (existingSep) existingSep.remove();

    const hasVisibleAdvanced = this.ADVANCED_MODULES.some(m => {
      const perm = this.MODULE_PERMS[m];
      return !perm || this.has(perm);
    });

    if (hasVisibleAdvanced) {
      const sep = document.createElement('li');
      sep.className = 'advanced-sep';
      sep.style.cssText =
        'font-size:10px;color:var(--text-3);text-transform:uppercase;' +
        'letter-spacing:.08em;padding:10px 12px 4px;cursor:default;pointer-events:none;';
      sep.textContent = '— Modules avancés';

      const firstAdv = [...navLinks.querySelectorAll('[data-page]')]
        .find(el => {
          const page = el.dataset.page;
          const perm = this.MODULE_PERMS[page];
          return this.ADVANCED_MODULES.includes(page) && (!perm || this.has(perm));
        });

      if (firstAdv) navLinks.insertBefore(sep, firstAdv.parentElement);
    }
  },

  // ── Navigation ───────────────────────────────────────────────────
  _currentPage: null,

  navigate(page, filterParam = null) {
    this.closeMenu();

    /* ── Cleanup page précédente ── */
    if (this._currentPage && this._currentPage !== page) {
      const prev = this._getPageObject(this._currentPage);
      if (prev && typeof prev.destroy === 'function') prev.destroy();
      this._navHistory.push(this._currentPage);
      if (this._navHistory.length > 20) this._navHistory.shift();
    }

    this._currentPage = page;
    this._updateBackButton();

    const titles = {
      dashboard: 'Dashboard',
      rooms: 'Chambres',
      tasks: 'Tâches',
      interventions: 'Interventions',
      rounds: 'Tournées',
      attendance: 'Présence & Poste',
      conversations: 'Messages',
      messages: 'Messagerie',
      reviews: 'Avis clients',
      equipment: 'Équipements',
      notifications: 'Notifications',
      stock: 'Stock',
      settings: 'Réglages',
    };

    const headerTitle = document.getElementById('header-page-title');
    if (headerTitle) headerTitle.textContent = titles[page] || page;

    // Breadcrumb
    var bc = document.getElementById('breadcrumb');
    if (bc) {
      if (page === 'dashboard') {
        bc.innerHTML = '';
        bc.style.display = 'none';
      } else {
        var trail = '<span class="bc-link" data-bc="dashboard">Accueil</span>';

        if (this._navHistory.length > 0) {
          var parent = this._navHistory[this._navHistory.length - 1];
          if (parent !== 'dashboard' && parent !== page) {
            trail += ' <span class="bc-sep">›</span> <span class="bc-link" data-bc="' + parent + '">' + (titles[parent] || parent) + '</span>';
          }
        }

        trail += ' <span class="bc-sep">›</span> <span class="bc-current">' + (titles[page] || page) + '</span>';
        bc.innerHTML = trail;
        bc.style.display = '';

        bc.querySelectorAll('[data-bc]').forEach(function (link) {
          link.addEventListener('click', function () { App.navigate(link.dataset.bc); });
        });
      }
    }

    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Vérifier la permission avant de charger
    const perm = this.MODULE_PERMS[page];
    const container = document.getElementById('page-content');
    if (!container) return;

    if (perm && !this.has(perm)) {
      container.innerHTML =
        `<div class="empty-state"><div class="empty-icon">🔒</div>
          <p>Vous n'avez pas accès à ce module.</p></div>`;
      return;
    }

    const pages = {
      dashboard: () => DashboardPage.render(),
      rooms: () => RoomsPage.render(filterParam),
      tasks: () => TasksPage.render(),
      interventions: () => InterventionsPage.render(),
      rounds: () => RoundsPage.render(),
      attendance: () => AttendancePage.render(),
      conversations: () => ConversationsPage.render(),
      messages: () => ConversationsPage.render(),
      reviews: () => ReviewsPage.render(),
      equipment: () => EquipmentPage.render(),
      notifications: () => NotificationsPage.render(),
      stock: () => StockPage.render(),
      settings: () => SettingsPage.render(),
    };

    // Close modal if open
    try { Modal.close(); } catch (_) {}

    // Reset scroll
    window.scrollTo(0, 0);

    // Nettoyer avant affichage
    container.innerHTML = '';

    if (pages[page]) {
      pages[page]();
    } else {
      container.innerHTML = Utils.emptyState('🔍', 'Page introuvable');
    }
  },

  _getPageObject(page) {
    const map = {
      dashboard: DashboardPage,
      rooms: RoomsPage,
      tasks: TasksPage,
      interventions: InterventionsPage,
      rounds: RoundsPage,
      attendance: AttendancePage,
      conversations: ConversationsPage,
      messages: ConversationsPage,
      reviews: ReviewsPage,
      equipment: EquipmentPage,
      stock: StockPage,
      settings: SettingsPage,
      notifications: NotificationsPage,
    };
    return map[page] || null;
  },

  // ── Menu ─────────────────────────────────────────────────────────
  goBack() {
    // If inside a sub-view (conversations chat, group info), go back within the module first
    if (this._currentPage === 'messages' || this._currentPage === 'conversations') {
      if (typeof ConversationsPage !== 'undefined' && ConversationsPage._view !== 'list') {
        ConversationsPage._convId = null;
        ConversationsPage._view = 'list';
        ConversationsPage._stopPolling();
        ConversationsPage.render();
        return;
      }
    }

    if (this._navHistory.length > 0) {
      var prev = this._navHistory.pop();
      var cur = this._getPageObject(this._currentPage);
      if (cur && typeof cur.destroy === 'function') cur.destroy();
      this._currentPage = null;
      this.navigate(prev);
    } else {
      this.navigate('dashboard');
    }
  },

  _updateBackButton() {
    var b = document.getElementById('header-back-btn');
    var m = document.getElementById('header-menu-btn');
    if (!b || !m) return;

    var showBack = this._currentPage !== 'dashboard' && this._navHistory.length > 0;
    b.classList.toggle('hidden', !showBack);

    // Menu button always visible
    m.classList.remove('hidden');
  },

  toggleMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    if (!menu || !overlay) return;

    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    menu.classList.toggle('hidden', isOpen);
    overlay.classList.toggle('hidden', isOpen);
  },

  closeMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    if (menu) {
      menu.classList.remove('open');
      menu.classList.add('hidden');
    }
    if (overlay) overlay.classList.add('hidden');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();

  /* Bannière hors-ligne */
  function updateOnline() {
    const id = 'offline-banner';
    let banner = document.getElementById(id);

    if (!navigator.onLine) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = id;
        banner.textContent = '⚠️ Hors connexion — certaines données peuvent ne pas être à jour';
        banner.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:9999;' +
          'background:var(--warning);color:#000;font-size:12px;font-weight:600;' +
          'text-align:center;padding:6px;';
        document.body.prepend(banner);
      }
    } else {
      if (banner) banner.remove();
    }
  }

  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();
});