/* Hotel OS — modal.js V2 — Handle + Swipe-to-dismiss + Escape */
const Modal = {
  _startY: 0,
  _currentY: 0,
  _isDragging: false,

  open(title, body, footer = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    const fEl = document.getElementById('modal-footer');
    fEl.innerHTML = footer;
    fEl.style.display = footer ? '' : 'none';

    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');
    overlay.classList.remove('hidden');
    box.style.transform = '';
    box.style.transition = '';

    // Bind swipe
    this._bindSwipe();
    // Bind escape
    this._escHandler = (e) => { if (e.key === 'Escape') Modal.close(); };
    document.addEventListener('keydown', this._escHandler);
  },

  close(instant) {
    const overlay = document.getElementById('modal-overlay');
    const box = document.getElementById('modal-box');

    if (instant) {
      // Instant close — no animation, for chaining to another modal
      overlay.classList.add('hidden');
      document.getElementById('modal-body').innerHTML = '';
      document.getElementById('modal-footer').innerHTML = '';
      box.style.transform = '';
      box.style.transition = '';
    } else {
      // Animate out
      box.style.transition = 'transform .2s ease';
      box.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.classList.add('hidden');
        document.getElementById('modal-body').innerHTML = '';
        document.getElementById('modal-footer').innerHTML = '';
        box.style.transform = '';
        box.style.transition = '';
      }, 200);
    }

    // Cleanup
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    this._unbindSwipe();
  },

  _bindSwipe() {
    const handle = document.getElementById('modal-handle');
    if (!handle) return;

    this._onTouchStart = (e) => {
      this._startY = e.touches[0].clientY;
      this._isDragging = true;
      document.getElementById('modal-box').style.transition = 'none';
    };
    this._onTouchMove = (e) => {
      if (!this._isDragging) return;
      this._currentY = e.touches[0].clientY;
      const diff = this._currentY - this._startY;
      if (diff > 0) {
        document.getElementById('modal-box').style.transform = 'translateY(' + diff + 'px)';
      }
    };
    this._onTouchEnd = () => {
      if (!this._isDragging) return;
      this._isDragging = false;
      const diff = this._currentY - this._startY;
      const box = document.getElementById('modal-box');
      if (diff > 100) {
        Modal.close();
      } else {
        box.style.transition = 'transform .2s ease';
        box.style.transform = 'translateY(0)';
      }
    };

    handle.addEventListener('touchstart', this._onTouchStart, { passive: true });
    handle.addEventListener('touchmove', this._onTouchMove, { passive: true });
    handle.addEventListener('touchend', this._onTouchEnd);
  },

  _unbindSwipe() {
    const handle = document.getElementById('modal-handle');
    if (!handle) return;
    if (this._onTouchStart) handle.removeEventListener('touchstart', this._onTouchStart);
    if (this._onTouchMove) handle.removeEventListener('touchmove', this._onTouchMove);
    if (this._onTouchEnd) handle.removeEventListener('touchend', this._onTouchEnd);
  },

  confirm(msg, onOk, label = 'Confirmer', danger = false) {
    Modal.open('Confirmation',
      `<p style="font-size:15px;line-height:1.55;color:#374151">${msg}</p>`,
      `<button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
       <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="_mc">${label}</button>`
    );
    document.getElementById('_mc').onclick = () => { Modal.close(); onOk(); };
  },

  form(title, fields, onSubmit, submitLabel = 'Enregistrer') {
    const body = fields.map(f => {
      if (f.type === 'select') {
        const opts = f.options.map(o =>
          `<option value="${o.value}" ${o.value === (f.value||'') ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        return `<div class="form-group"><label>${f.label}</label>
          <select id="mf-${f.key}" name="${f.key}">${opts}</select></div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="form-group"><label>${f.label}</label>
          <textarea id="mf-${f.key}" name="${f.key}" placeholder="${f.placeholder||''}">${f.value||''}</textarea></div>`;
      }
      return `<div class="form-group"><label>${f.label}</label>
        <input type="${f.type||'text'}" id="mf-${f.key}" name="${f.key}"
          value="${f.value||''}" placeholder="${f.placeholder||''}"/></div>`;
    }).join('');

    const footer = `
      <button class="btn btn-secondary" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" id="_mf-submit">${submitLabel}</button>`;

    Modal.open(title, body, footer);

    document.getElementById('_mf-submit').onclick = async () => {
      const data = {};
      fields.forEach(f => {
        const el = document.getElementById(`mf-${f.key}`);
        if (el) data[f.key] = el.value || null;
      });
      const btn = document.getElementById('_mf-submit');
      btn.disabled = true; btn.textContent = '…';
      try {
        await onSubmit(data);
        Modal.close();
      } catch(e) {
        Toast.error(e.message);
        btn.disabled = false; btn.textContent = submitLabel;
      }
    };
  },
};
