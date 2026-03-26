/* Hotel OS — API Client V4
 * - Single wrapper _req() for all calls
 * - Silent mode for polling (no logout on 401)
 * - No trailing slash convention
 * - No legacy methods
 */
const API_BASE = '';

const Api = {
  _token: null,

  setToken(t)  { this._token = t; localStorage.setItem('hotel_os_token', t); },
  getToken()   { return this._token || localStorage.getItem('hotel_os_token'); },
  clearToken() { this._token = null; localStorage.removeItem('hotel_os_token'); },

  /**
   * Central request wrapper.
   * @param {string} method
   * @param {string} path
   * @param {*} body
   * @param {object} opts — { silent: true } suppresses 401 logout (for polling)
   */
  async _req(method, path, body, opts) {
    var silent = opts && opts.silent;
    var headers = { 'Content-Type': 'application/json' };
    var token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var fetchOpts = { method: method, headers: headers };
    if (body !== undefined && body !== null) fetchOpts.body = JSON.stringify(body);
    var res;
    try { res = await fetch(API_BASE + path, fetchOpts); }
    catch(e) {
      if (silent) throw e;
      throw new Error('Serveur injoignable');
    }
    if (res.status === 401) {
      if (!silent) {
        Api.clearToken();
        if (typeof App !== 'undefined' && App.currentUser) {
          App.currentUser = null;
          App.permissions = [];
          App._showLogin();
        }
      }
      throw new Error('Session expirée');
    }
    if (res.status === 403) throw new Error('Accès refusé');
    if (res.status === 422) {
      var d = await res.json().catch(function() { return {}; });
      throw new Error(typeof d.detail === 'string' ? d.detail : 'Données invalides');
    }
    if (!res.ok) {
      var err = await res.json().catch(function() { return {}; });
      throw new Error(err.detail || 'Erreur ' + res.status);
    }
    if (res.status === 204) return null;
    // Safety: detect if service worker returned HTML instead of JSON
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('text/html') >= 0) {
      throw new Error('Réponse inattendue du serveur');
    }
    return res.json();
  },

  _qs: function(p) {
    var parts = [];
    for (var k in p) {
      if (p[k] !== undefined && p[k] !== null && p[k] !== '')
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(p[k]));
    }
    return parts.length ? '?' + parts.join('&') : '';
  },

  get:  function(p, o)    { return Api._req('GET', p, null, o); },
  post: function(p, b, o) { return Api._req('POST', p, b, o); },
  patch:function(p, b, o) { return Api._req('PATCH', p, b, o); },
  put:  function(p, b, o) { return Api._req('PUT', p, b, o); },
  del:  function(p, o)    { return Api._req('DELETE', p, null, o); },

  // ── Auth ──────────────────────────────────────────────────────
  login:         function(email, pw) { return Api.post('/auth/login', {email:email, password:pw}); },
  me:            function()          { return Api.get('/auth/me'); },
  myPermissions: function()          { return Api.get('/auth/my-permissions'); },
  switchHotel:   function(id)        { return Api.post('/auth/switch-hotel?hotel_id=' + id, {}); },

  // ── Dashboard ─────────────────────────────────────────────────
  stats: function() { return Api.get('/dashboard/stats'); },

  // ── Rooms ─────────────────────────────────────────────────────
  rooms:      function(p) { return Api.get('/rooms' + Api._qs(p || {})); },
  room:       function(id) { return Api.get('/rooms/' + id); },
  createRoom: function(d)  { return Api.post('/rooms', d); },
  updateRoom: function(id,d) { return Api.patch('/rooms/' + id, d); },

  // ── Tasks ─────────────────────────────────────────────────────
  tasks:      function(p) { return Api.get('/tasks' + Api._qs(p || {})); },
  createTask: function(d)  { return Api.post('/tasks', d); },
  updateTask: function(id,d) { return Api.patch('/tasks/' + id, d); },
  deleteTask: function(id) { return Api.del('/tasks/' + id); },

  // ── Interventions ─────────────────────────────────────────────
  interventions:      function(p) { return Api.get('/interventions' + Api._qs(p || {})); },
  createIntervention: function(d)  { return Api.post('/interventions', d); },
  updateIntervention: function(id,d) { return Api.patch('/interventions/' + id, d); },
  takeIntervention:   function(id) { return Api.post('/interventions/' + id + '/take', {}); },
  closeIntervention:  function(id,d) { return Api.post('/interventions/' + id + '/close', d); },
  markDuplicate:      function(id,d) { return Api.post('/interventions/' + id + '/mark-duplicate', d); },
  unmarkDuplicate:    function(id) { return Api.post('/interventions/' + id + '/unmark-duplicate', {}); },

  // ── Rounds ────────────────────────────────────────────────────
  rounds:            function()        { return Api.get('/rounds'); },
  createRound:       function(d)       { return Api.post('/rounds', d); },
  updateRoundStatus: function(id, s)   { return Api.patch('/rounds/' + id + '/status?status=' + s); },
  updateRoundRoom:   function(rid,rrid,d) { return Api.patch('/rounds/' + rid + '/rooms/' + rrid, d); },

  // ── Conversations ─────────────────────────────────────────────
  conversations:         function()      { return Api.get('/conversations'); },
  createDirectConv:      function(uid)   { return Api.post('/conversations/direct', {user_id: uid}); },
  createGroupConv:       function(d)     { return Api.post('/conversations/group', d); },
  getConversation:       function(cid)   { return Api.get('/conversations/' + cid); },
  convMessages:          function(cid, l){ return Api.get('/conversations/' + cid + '/messages' + (l ? '?limit=' + l : '')); },
  sendConvMessage:       function(cid,d) { return Api.post('/conversations/' + cid + '/messages', d); },
  markConvRead:          function(cid)   { return Api.post('/conversations/' + cid + '/read', {}); },
  convUnreadCount:       function()      { return Api.get('/conversations/unread-count', {silent:true}); },
  convParticipants:      function(cid)   { return Api.get('/conversations/' + cid + '/participants'); },
  addConvParticipants:   function(cid,d) { return Api.post('/conversations/' + cid + '/participants', d); },
  removeConvParticipant: function(cid,uid) { return Api.del('/conversations/' + cid + '/participants/' + uid); },

  // ── QR ────────────────────────────────────────────────────────
  scanQR:    function(d) { return Api.post('/qr/scan', d); },
  checkouts: function()  { return Api.get('/qr/checkouts'); },

  // ── Reviews ───────────────────────────────────────────────────
  reviews:      function(p) { return Api.get('/reviews' + Api._qs(p || {})); },
  createReview: function(d)  { return Api.post('/reviews', d); },
  updateReview: function(id,d) { return Api.patch('/reviews/' + id, d); },

  // ── Equipment V2 ──────────────────────────────────────────────
  equipmentFamilies:   function()      { return Api.get('/equipment/families'); },
  equipmentTypes:      function(p)     { return Api.get('/equipment/types' + Api._qs(p || {})); },
  equipmentItems:      function(p)     { return Api.get('/equipment/items' + Api._qs(p || {})); },
  createEquipmentItem: function(d)     { return Api.post('/equipment/items', d); },
  updateEquipmentItem: function(id,d)  { return Api.patch('/equipment/items/' + id, d); },
  deleteEquipmentItem: function(id)    { return Api.del('/equipment/items/' + id); },

  // ── Stock ─────────────────────────────────────────────────────
  stockItems:      function(low) { return Api.get('/stock/items' + (low ? '?low_only=true' : '')); },
  createStockItem: function(d)   { return Api.post('/stock/items', d); },
  stockMovements:  function(iid) { return Api.get('/s:tock/movements' + (iid ? '?item_id=' + iid : '')); },
  addMovement:     function(d)   { return Api.post('/stock/movements', d); },

  // ── Users ─────────────────────────────────────────────────────
  users: function() { return Api.get('/users'); },

  // ── Présence ──────────────────────────────────────────────────
  attendanceMyShift:       function()  { return Api.get('/attendance/my-shift', {silent:true}); },
  attendanceAction:        function(d) { return Api.post('/attendance/my-shift/action', d); },
  attendanceMyEvents:      function()  { return Api.get('/attendance/my-shift/events'); },
  attendanceTeam:          function(p) { return Api.get('/attendance/team' + Api._qs(p || {})); },
  attendanceManagerAction: function(d) { return Api.post('/attendance/team/action', d); },
  attendanceStats:         function(p) { return Api.get('/attendance/stats' + Api._qs(p || {})); },

  // ── Socle ─────────────────────────────────────────────────────
  hotels:     function()  { return Api.get('/hotels'); },
  createHotel: function(d) { return Api.post('/hotels/', d); },
  rooms:      function() { return Api.get('/rooms'); },
  interventions: function() { return Api.get('/interventions'); },
  zones:      function(p) { return Api.get('/zones' + Api._qs(p || {})); },
  createZone: function(d) { return Api.post('/zones', d); },
  updateZone: function(id,d) { return Api.patch('/zones/' + id, d); },
  deleteZone: function(id) { return Api.del('/zones/' + id); },
  services:   function(p) { return Api.get('/services' + Api._qs(p || {})); },
  auditLogs:  function(p) { return Api.get('/audit' + Api._qs(p || {})); },

  // ── Rôles ─────────────────────────────────────────────────────
  roles:              function()     { return Api.get('/roles'); },
  createRole:         function(d)    { return Api.post('/roles', d); },
  updateRole:         function(id,d) { return Api.put('/roles/' + id, d); },
  rolePermissions:    function(id)   { return Api.get('/roles/' + id + '/permissions'); },
  setRolePermissions: function(id,c) { return Api.put('/roles/' + id + '/permissions', {permission_codes:c}); },
  permissions:        function()     { return Api.get('/permissions'); },

  // ── Réglages ──────────────────────────────────────────────────
  settingsUsers:      function()     { return Api.get('/settings/users'); },
  settingsCreateUser: function(d)    { return Api.post('/settings/users', d); },
  settingsUpdateUser: function(id,d) { return Api.patch('/settings/users/' + id, d); },

  // ── Notifications ─────────────────────────────────────────────
  notifications:             function(l) { return Api.get('/notifications' + (l ? '?limit=' + l : '')); },
  notificationsUnread:       function()  { return Api.get('/notifications/unread-count', {silent:true}); },
  markNotificationRead:      function(id){ return Api.post('/notifications/' + id + '/read', {}); },
  markNotificationsRead:     function(ids){ return Api.post('/notifications/read', { notification_ids: ids }); },
  markAllNotificationsRead:  function()  { return Api.post('/notifications/read-all', {}); },
};
