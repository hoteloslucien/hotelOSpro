/* Hotel OS — utils.js (compatible nouveau CSS + ancien JS) */

const Utils = {
  _labels: {
    libre:'Libre', prete:'Prête', occupee:'Occupée', en_menage:'En ménage',
    sale:'Sale', bloquee:'Bloquée',
    nouvelle:'Nouvelle', prise:'Prise en charge', prise_en_charge:'Prise en charge',
    en_cours:'En cours', en_pause:'En pause', en_attente:'En attente',
    terminee:'Terminée', cloturee:'Clôturée', validee:'Validée',
    refusee:'Refusée', a_faire:'À faire', pause:'Pause',
    duplicate:'Doublon',
    urgente:'Urgente', haute:'Haute', importante:'Importante',
    normale:'Normale', basse:'Basse',
    operationnel:'Opérationnel', en_panne:'En panne',
    maintenance:'Maintenance', hors_service:'Hors service',
    nouveau:'Nouveau', traite:'Traité', clos:'Clos',
    planifiee:'Planifiée', fait:'Fait', refuse:'Refusé',
    general:'Général', technique:'Technique',
    housekeeping:'Housekeeping', reception:'Réception',
    technicien:'Technicien', gouvernante:'Gouvernante',
    responsable:'Responsable', direction:'Direction',
    responsable_technique:'Resp. Technique',
    scheduled:'Prévu', present:'Présent', late:'En retard',
    on_break:'En pause', finished:'Terminé', absent:'Absent',
    client:'Client', personnel:'Personnel', staff:'Staff', qr:'QR',
    entree:'Entrée', sortie:'Sortie', inventaire:'Inventaire',
    // Equipment statuses V2
    ok:'OK',
    // Notification types
    intervention_created:'Intervention créée', intervention_assigned:'Intervention assignée',
    intervention_urgent:'Intervention urgente', intervention_closed:'Intervention clôturée',
    intervention_duplicate:'Doublon', task_assigned:'Tâche assignée',
    task_overdue:'Tâche en retard', message_received:'Message reçu',
    conversation_added:'Ajouté au groupe', attendance_late:'Retard',
    attendance_missing:'Absence', stock_alert:'Alerte stock',
    equipment_alert:'Équipement en panne', room_block_request:'Demande blocage',
    // Priorities
    critical:'Critique', high:'Haute', medium:'Moyenne', low:'Basse',
  },

  label(s)  { return this._labels[s] || s || '—'; },

  badge(status) {
    return `<span class="badge badge-${status}">${this.label(status)}</span>`;
  },

  stars(n) {
    return `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>`;
  },

  timeAgo(d) {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d)) / 60000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h/24)}j`;
  },

  formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  loader() {
    return `<div class="loader"><div class="spinner"></div> Chargement…</div>`;
  },

  emptyState(icon, text) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
  },
};

/* Toast */
const Toast = {
  show(msg, cls = '', ms = 3200) {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), ms);
  },
  success: (m) => Toast.show(m, 'success'),
  error:   (m) => Toast.show(m, 'error', 4500),
  warning: (m) => Toast.show(m, 'warning'),
};
