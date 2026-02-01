(function () {
  'use strict';

  const API_BASE = '/api';
  const TOKEN_KEY = 'access';
  const REFRESH_KEY = 'refresh';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setTokens(access, refresh) {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  function clearAllPageData() {
    schoolsCache = [];
    const loadingRow = (colspan, text) => '<tr><td colspan="' + colspan + '" class="empty-state">' + (text || 'Загрузка…') + '</td></tr>';
    const tbody = (id) => document.getElementById(id);
    if (tbody('schoolsTableBody')) tbody('schoolsTableBody').innerHTML = loadingRow(5);
    if (tbody('childrenTableBody')) tbody('childrenTableBody').innerHTML = loadingRow(7);
    if (tbody('usersTableBody')) tbody('usersTableBody').innerHTML = loadingRow(5);
    if (tbody('rolesTableBody')) tbody('rolesTableBody').innerHTML = loadingRow(5);
    const paginationIds = ['schoolsPagination', 'childrenPagination'];
    paginationIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) statsGrid.innerHTML = '<div class="empty-state">Загрузка…</div>';
    const permsEl = document.getElementById('permissionsByModel');
    if (permsEl) permsEl.innerHTML = '<p class="empty-state">Загрузка…</p>';
  }

  async function api(url, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res = await fetch(API_BASE + url, { ...options, headers });

    if (res.status === 401 && url !== '/login/' && url !== '/register/') {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        const refreshRes = await fetch(API_BASE + '/token/refresh/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTokens(data.access, null);
          headers['Authorization'] = 'Bearer ' + data.access;
          res = await fetch(API_BASE + url, { ...options, headers });
        } else {
          clearAuth();
          showAuth();
          return null;
        }
      } else {
        clearAuth();
        showAuth();
        return null;
      }
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {}
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  function getPermissionErrorMsg(err, defaultMsg) {
    if (err && err.status === 403) return 'Недостаточно прав для чтения';
    const detail = err?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object') return Object.values(detail).flat().join(' ') || defaultMsg;
    return defaultMsg || 'Ошибка загрузки';
  }

  function hasModelPermission(model, action) {
    if (!currentUser) return false;
    if (currentUser.is_administrator) return true;
    const perms = currentUser.permissions?.[model] || [];
    return perms.includes(action + '_' + model);
  }

  function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show ' + type;
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
  }

  function showConfirmModal(message, onConfirm) {
    const el = document.getElementById('modalConfirm');
    const msgEl = document.getElementById('modalConfirmMessage');
    const submitBtn = document.getElementById('modalConfirmSubmit');
    if (!el || !msgEl || !submitBtn) return;
    msgEl.textContent = message;
    const handler = function () {
      submitBtn.removeEventListener('click', handler);
      closeModal('modalConfirm');
      if (typeof onConfirm === 'function') onConfirm();
    };
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    const newBtn = document.getElementById('modalConfirmSubmit');
    newBtn.addEventListener('click', handler);
    openModal('modalConfirm');
  }

  function showAuth() {
    clearAllPageData();
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('contentSection').style.display = 'none';
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('headerActions').style.display = 'none';
  }

  let currentUser = null;

  function showApp(user) {
    currentUser = user;
    clearAllPageData();
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('contentSection').style.display = 'block';
    document.getElementById('mainNav').style.display = 'flex';
    document.getElementById('headerActions').style.display = 'flex';
    document.getElementById('userName').textContent = user ? user.username : '';
    const permLink = document.getElementById('navPermissions');
    const usersLink = document.getElementById('navUsers');
    if (permLink) permLink.style.display = (user && user.is_administrator) ? '' : 'none';
    if (usersLink) usersLink.style.display = (user && user.is_administrator) ? '' : 'none';
    showPage(getPageFromHash());
  }

  const VALID_PAGES = ['schools', 'children', 'stats', 'users', 'permissions'];

  function getPageFromHash() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    return VALID_PAGES.includes(hash) ? hash : 'schools';
  }

  function showPage(name) {
    if ((name === 'permissions' || name === 'users') && (!currentUser || !currentUser.is_administrator)) {
      name = 'schools';
    }
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    const page = document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1));
    const link = document.querySelector('.nav a[data-page="' + name + '"]');
    if (page) page.style.display = 'block';
    if (link) link.classList.add('active');
    window.scrollTo(0, 0);
    if (window.location.hash !== '#' + name) {
      window.history.replaceState(null, '', '#' + name);
    }
    if (name === 'schools') loadSchools();
    if (name === 'children') fillSchoolFilters().catch(() => {}).then(fillChildrenFilters).then(loadChildren);
    if (name === 'stats') loadStats();
    if (name === 'users') loadUsers();
    if (name === 'permissions') loadPermissionsPage();
  }

  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(this.getAttribute('data-page'));
    });
  });

  window.addEventListener('hashchange', function () {
    if (currentUser && document.getElementById('contentSection').style.display !== 'none') {
      showPage(getPageFromHash());
    }
  });

  document.getElementById('btnLogout').addEventListener('click', function () {
    clearAuth();
    showToast('Вы вышли из системы');
    showAuth();
  });

  document.getElementById('btnRefresh').addEventListener('click', function () {
    const btn = this;
    const page = getPageFromHash();
    if (document.getElementById('contentSection').style.display === 'none') return;
    btn.classList.add('loading');
    btn.disabled = true;
    const done = () => {
      btn.classList.remove('loading');
      btn.disabled = false;
    };
    const run = async () => {
      try {
        if (page === 'schools') await loadSchools();
        else if (page === 'children') {
          await fillSchoolFilters().catch(() => {});
          await fillChildrenFilters();
          await loadChildren();
        } else if (page === 'stats') await loadStats();
        else if (page === 'users') await loadUsers();
        else if (page === 'permissions') await loadPermissionsPage();
        showToast('Данные обновлены');
      } catch (e) {
        showToast(getPermissionErrorMsg(e, 'Ошибка обновления'), 'error');
      } finally {
        done();
      }
    };
    run();
  });

  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const data = await fetch(API_BASE + '/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }).then(r => r.json());
      if (data.access) {
        setTokens(data.access, data.refresh);
        showApp(data.user);
        showToast('Добро пожаловать!');
      } else {
        errEl.textContent = data.error || 'Ошибка входа';
      }
    } catch (err) {
      errEl.textContent = err.error || 'Ошибка соединения';
    }
  });

  document.getElementById('showRegister').addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector('.auth-card:not(#registerCard)').style.display = 'none';
    document.getElementById('registerCard').style.display = 'block';
  });

  document.getElementById('showLogin').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('registerCard').style.display = 'none';
    document.querySelector('.auth-card:not(#registerCard)').style.display = 'block';
  });

  document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errEl = document.getElementById('registerError');
    errEl.textContent = '';
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    if (password !== password2) {
      errEl.textContent = 'Пароли не совпадают';
      return;
    }
    const payload = {
      username: document.getElementById('regUsername').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      password: password,
      password2: password2,
    };
    try {
      const data = await api('/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data && data.access) {
        setTokens(data.access, data.refresh);
        showApp(data.user);
        showToast('Регистрация успешна');
      } else if (data && typeof data === 'object') {
        const msg = Object.values(data).flat().join(' ') || 'Ошибка регистрации';
        errEl.textContent = msg;
      }
    } catch (err) {
      if (err.data) {
        const msg = typeof err.data === 'object' ? Object.values(err.data).flat().join(' ') : err.data;
        errEl.textContent = msg || 'Ошибка регистрации';
      } else {
        errEl.textContent = 'Ошибка соединения';
      }
    }
  });

  function openModal(id) {
    document.getElementById(id).setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    document.getElementById(id).setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', function () {
      closeModal(this.getAttribute('data-close'));
    });
  });

  function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString('ru-RU');
  }

  let schoolsPage = 1;
  const PAGE_SIZE = 20;

  async function loadSchools(page = 1) {
    schoolsPage = page;
    const name = document.getElementById('filterSchoolName').value.trim();
    const director = document.getElementById('filterSchoolDirector').value.trim();
    const params = new URLSearchParams();
    if (name) params.set('search', name);
    if (director) params.set('director', director);
    params.set('page', String(page));
    params.set('page_size', String(PAGE_SIZE));
    const url = '/schools/?' + params.toString();
    try {
      const resp = await api(url);
      if (resp == null) return;
      const list = resp.data || [];
      const count = resp.count ?? 0;
      const tbody = document.getElementById('schoolsTableBody');
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Нет данных</td></tr>';
      } else {
        const canEditSchool = hasModelPermission('school', 'change');
        const canDeleteSchool = hasModelPermission('school', 'delete');
        tbody.innerHTML = list.map(s => `
        <tr>
          <td>${escapeHtml(s.short_name)}</td>
          <td>${escapeHtml(s.full_name)}</td>
          <td>${escapeHtml(s.director)}</td>
          <td>${escapeHtml(s.address)}</td>
          <td class="actions">
            ${canEditSchool ? '<button type="button" class="btn-icon btn-icon-edit btn-edit-school" data-id="' + s.id + '" title="Изменить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>' : ''}
            ${canDeleteSchool ? '<button type="button" class="btn-icon btn-icon-delete btn-delete-school" data-id="' + s.id + '" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>' : ''}
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.btn-edit-school').forEach(btn => {
        btn.addEventListener('click', () => editSchool(Number(btn.getAttribute('data-id'))));
      });
      tbody.querySelectorAll('.btn-delete-school').forEach(btn => {
        btn.addEventListener('click', () => deleteSchool(Number(btn.getAttribute('data-id'))));
      });
      }
      renderPagination('schoolsPagination', count, page, loadSchools);
    } catch (err) {
      const msg = getPermissionErrorMsg(err, 'Ошибка загрузки школ');
      const tbody = document.getElementById('schoolsTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">' + escapeHtml(msg) + '</td></tr>';
      const paginationEl = document.getElementById('schoolsPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      showToast(msg, 'error');
    }
  }

  function renderPagination(containerId, count, page, onPage) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (count === 0) {
      el.innerHTML = '<span class="pagination-info">Нет записей</span>';
      return;
    }
    if (count <= PAGE_SIZE) {
      el.innerHTML = '<span class="pagination-info">Показано ' + count + ' из ' + count + '</span>';
      return;
    }
    const totalPages = Math.ceil(count / PAGE_SIZE);
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, count);
    let html = '<span class="pagination-info">Показано ' + from + '–' + to + ' из ' + count + '</span>';
    html += '<div class="pagination-buttons">';
    if (page > 1) html += '<button type="button" class="btn btn-outline btn-sm" data-page="' + (page - 1) + '">← Назад</button>';
    html += ' <span class="pagination-page">Стр. ' + page + ' / ' + totalPages + '</span> ';
    if (page < totalPages) html += '<button type="button" class="btn btn-outline btn-sm" data-page="' + (page + 1) + '">Вперёд →</button>';
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => onPage(Number(btn.getAttribute('data-page'))));
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  document.getElementById('btnFilterSchools').addEventListener('click', () => loadSchools(1));
  document.getElementById('btnClearSchoolFilters').addEventListener('click', function () {
    document.getElementById('filterSchoolName').value = '';
    document.getElementById('filterSchoolDirector').value = '';
    loadSchools(1);
  });
  document.getElementById('btnAddSchool').addEventListener('click', function () {
    document.getElementById('schoolId').value = '';
    document.getElementById('schoolFullName').value = '';
    document.getElementById('schoolShortName').value = '';
    document.getElementById('schoolDirector').value = '';
    document.getElementById('schoolAddress').value = '';
    document.getElementById('modalSchoolTitle').textContent = 'Добавить школу';
    openModal('modalSchool');
  });

  document.getElementById('formSchool').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('schoolId').value;
    const payload = {
      full_name: document.getElementById('schoolFullName').value.trim(),
      short_name: document.getElementById('schoolShortName').value.trim(),
      director: document.getElementById('schoolDirector').value.trim(),
      address: document.getElementById('schoolAddress').value.trim(),
    };
    try {
      if (id) {
        await api('/schools/' + id + '/', { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Школа обновлена');
      } else {
        await api('/schools/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Школа добавлена');
      }
      closeModal('modalSchool');
      loadSchools();
    } catch (err) {
      showToast(err.data?.detail || (typeof err.data === 'object' ? JSON.stringify(err.data) : 'Ошибка'), 'error');
    }
  });

  async function editSchool(id) {
    try {
      const s = await api('/schools/' + id + '/');
      if (!s) return;
      document.getElementById('schoolId').value = s.id;
      document.getElementById('schoolFullName').value = s.full_name || '';
      document.getElementById('schoolShortName').value = s.short_name || '';
      document.getElementById('schoolDirector').value = s.director || '';
      document.getElementById('schoolAddress').value = s.address || '';
      document.getElementById('modalSchoolTitle').textContent = 'Редактировать школу';
      openModal('modalSchool');
    } catch (err) {
      showToast(getPermissionErrorMsg(err, 'Ошибка загрузки школы'), 'error');
    }
  }

  async function deleteSchool(id) {
    showConfirmModal('Удалить эту школу?', async function () {
      try {
        await api('/schools/' + id + '/', { method: 'DELETE' });
        showToast('Школа удалена');
        loadSchools();
      } catch (err) {
        showToast(err.data?.detail || 'Не удалось удалить (возможно, есть учащиеся)', 'error');
      }
    });
  }

  let schoolsCache = [];
  async function loadSchoolsForSelect() {
    const resp = await api('/schools/?page_size=500');
    if (resp && resp.data) {
      schoolsCache = resp.data;
    }
    return schoolsCache;
  }

  let childrenPage = 1;

  async function loadChildren(page = 1) {
    childrenPage = page;
    const schoolId = document.getElementById('filterChildSchool').value;
    const q = document.getElementById('filterChildSearch').value.trim();
    const familyStatus = document.getElementById('filterChildFamily').value;
    const healthStatus = document.getElementById('filterChildHealth').value;
    const params = new URLSearchParams();
    if (schoolId) params.set('school', schoolId);
    if (q) params.set('q', q);
    if (familyStatus) params.set('family_status', familyStatus);
    if (healthStatus) params.set('health_status', healthStatus);
    params.set('page', String(page));
    params.set('page_size', String(PAGE_SIZE));
    try {
      const resp = await api('/children/?' + params.toString());
      if (resp == null) return;
      const list = resp.data || [];
      const count = resp.count ?? 0;
      const tbody = document.getElementById('childrenTableBody');
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Нет данных</td></tr>';
      } else {
        const canEditChild = hasModelPermission('child', 'change');
        const canDeleteChild = hasModelPermission('child', 'delete');
        tbody.innerHTML = list.map(c => `
      <tr>
        <td>${escapeHtml(c.last_name + ' ' + c.first_name + ' ' + (c.patronymic || ''))}</td>
        <td>${c.education_class}</td>
        <td>${escapeHtml(c.school_name || '—')}</td>
        <td class="date-cell">${formatDate(c.birthday)}</td>
        <td>${escapeHtml(c.family_status || '—')}</td>
        <td>${escapeHtml(c.health_status || '—')}</td>
        <td class="actions">
          ${canEditChild ? '<button type="button" class="btn-icon btn-icon-edit btn-edit-child" data-id="' + c.id + '" title="Изменить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>' : ''}
          ${canDeleteChild ? '<button type="button" class="btn-icon btn-icon-delete btn-delete-child" data-id="' + c.id + '" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>' : ''}
        </td>
      </tr>
    `).join('');
        tbody.querySelectorAll('.btn-edit-child').forEach(btn => {
          btn.addEventListener('click', () => editChild(Number(btn.getAttribute('data-id'))));
        });
        tbody.querySelectorAll('.btn-delete-child').forEach(btn => {
          btn.addEventListener('click', () => deleteChild(Number(btn.getAttribute('data-id'))));
        });
      }
      renderPagination('childrenPagination', count, page, loadChildren);
    } catch (err) {
      const msg = getPermissionErrorMsg(err, 'Ошибка загрузки учащихся');
      const tbody = document.getElementById('childrenTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">' + escapeHtml(msg) + '</td></tr>';
      const paginationEl = document.getElementById('childrenPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      showToast(msg, 'error');
    }
  }

  async function fillSchoolFilters() {
    const selectFilter = document.getElementById('filterChildSchool');
    const selectForm = document.getElementById('childSchool');
    try {
      const schools = await loadSchoolsForSelect();
      const opts = '<option value="">Все школы</option>' + schools.map(s => '<option value="' + s.id + '">' + escapeHtml(s.short_name) + '</option>').join('');
      selectFilter.innerHTML = opts;
      selectForm.innerHTML = schools.map(s => '<option value="' + s.id + '">' + escapeHtml(s.short_name) + '</option>').join('');
    } catch (_) {
      selectFilter.innerHTML = '<option value="">Все школы</option>';
      selectForm.innerHTML = '';
    }
  }

  async function fillChildrenFilters() {
    try {
      const data = await api('/children/stats/');
      if (!data) return;
      const familySelect = document.getElementById('filterChildFamily');
      const healthSelect = document.getElementById('filterChildHealth');
      const familyOpts = '<option value="">Семья</option>' +
        (data.family_status_statistics || [])
          .filter(f => f.family_status)
          .map(f => '<option value="' + escapeHtml(f.family_status) + '">' + escapeHtml(f.family_status) + '</option>')
          .join('');
      const healthOpts = '<option value="">Здоровье</option>' +
        (data.health_status_statistics || [])
          .filter(h => h.health_status)
          .map(h => '<option value="' + escapeHtml(h.health_status) + '">' + escapeHtml(h.health_status) + '</option>')
          .join('');
      familySelect.innerHTML = familyOpts;
      healthSelect.innerHTML = healthOpts;
    } catch (_) {}
  }

  document.getElementById('btnFilterChildren').addEventListener('click', () => loadChildren(1));
  document.getElementById('btnClearChildFilters').addEventListener('click', function () {
    document.getElementById('filterChildSchool').value = '';
    document.getElementById('filterChildSearch').value = '';
    document.getElementById('filterChildFamily').value = '';
    document.getElementById('filterChildHealth').value = '';
    loadChildren(1);
  });
  document.getElementById('btnAddChild').addEventListener('click', async function () {
    await fillSchoolFilters();
    document.getElementById('childId').value = '';
    document.getElementById('childLastName').value = '';
    document.getElementById('childFirstName').value = '';
    document.getElementById('childPatronymic').value = '';
    document.getElementById('childBirthday').value = '';
    document.getElementById('childClass').value = '';
    document.getElementById('childAddress').value = '';
    document.getElementById('childHealth').value = '';
    document.getElementById('childFamily').value = '';
    document.getElementById('childNote').value = '';
    document.getElementById('modalChildTitle').textContent = 'Добавить учащегося';
    openModal('modalChild');
  });

  function birthdayToInputValue(birthdayStr) {
    if (!birthdayStr) return '';
    const d = new Date(birthdayStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  document.getElementById('formChild').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('childId').value;
    const birthday = document.getElementById('childBirthday').value;
    const payload = {
      first_name: document.getElementById('childFirstName').value.trim(),
      last_name: document.getElementById('childLastName').value.trim(),
      patronymic: document.getElementById('childPatronymic').value.trim() || '',
      birthday: birthday ? birthday + 'T00:00:00Z' : null,
      education_class: Number(document.getElementById('childClass').value),
      school: Number(document.getElementById('childSchool').value),
      address: document.getElementById('childAddress').value.trim(),
      health_status: document.getElementById('childHealth').value.trim() || '',
      family_status: document.getElementById('childFamily').value.trim() || '',
      note: document.getElementById('childNote').value.trim() || '',
    };
    try {
      if (id) {
        await api('/children/' + id + '/', { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Учащийся обновлён');
      } else {
        await api('/children/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Учащийся добавлен');
      }
      closeModal('modalChild');
      loadChildren();
    } catch (err) {
      showToast(err.data?.detail || (typeof err.data === 'object' ? JSON.stringify(err.data) : 'Ошибка'), 'error');
    }
  });

  async function editChild(id) {
    try {
      const c = await api('/children/' + id + '/');
      if (!c) return;
      await fillSchoolFilters();
      document.getElementById('childId').value = c.id;
      document.getElementById('childLastName').value = c.last_name || '';
      document.getElementById('childFirstName').value = c.first_name || '';
      document.getElementById('childPatronymic').value = c.patronymic || '';
      document.getElementById('childBirthday').value = birthdayToInputValue(c.birthday);
      document.getElementById('childClass').value = c.education_class ?? '';
      document.getElementById('childSchool').value = c.school ?? '';
      document.getElementById('childAddress').value = c.address || '';
      document.getElementById('childHealth').value = c.health_status || '';
      document.getElementById('childFamily').value = c.family_status || '';
      document.getElementById('childNote').value = c.note || '';
      document.getElementById('modalChildTitle').textContent = 'Редактировать учащегося';
      openModal('modalChild');
    } catch (err) {
      showToast(getPermissionErrorMsg(err, 'Ошибка загрузки учащегося'), 'error');
    }
  }

  async function deleteChild(id) {
    showConfirmModal('Удалить этого учащегося?', async function () {
      try {
        await api('/children/' + id + '/', { method: 'DELETE' });
        showToast('Учащийся удалён');
        loadChildren();
      } catch (err) {
        showToast(err.data?.detail || 'Ошибка удаления', 'error');
      }
    });
  }

  async function loadUsers() {
    try {
      const list = await api('/users/');
      const users = Array.isArray(list) ? list : (list?.data || list || []);
      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Нет пользователей</td></tr>';
      } else {
        tbody.innerHTML = users.map(u => `
          <tr>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.email || '—')}</td>
            <td>${escapeHtml(u.first_name || '—')}</td>
            <td>${escapeHtml(u.last_name || '—')}</td>
            <td class="actions">
              <button type="button" class="btn-icon btn-icon-edit btn-edit-user" data-id="${u.id}" title="Изменить">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-icon btn-icon-delete btn-delete-user" data-id="${u.id}" ${currentUser && currentUser.id === u.id ? 'disabled' : ''} title="${currentUser && currentUser.id === u.id ? 'Нельзя удалить себя' : 'Удалить'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </td>
          </tr>
        `).join('');
        tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
          btn.addEventListener('click', () => editUser(Number(btn.getAttribute('data-id'))));
        });
        tbody.querySelectorAll('.btn-delete-user:not([disabled])').forEach(btn => {
          btn.addEventListener('click', () => deleteUser(Number(btn.getAttribute('data-id'))));
        });
      }
    } catch (err) {
      const tbody = document.getElementById('usersTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Ошибка загрузки</td></tr>';
      showToast(err.data?.detail || 'Ошибка загрузки пользователей', 'error');
    }
  }

  document.getElementById('btnAddUser')?.addEventListener('click', function () {
    document.getElementById('userId').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userFirstName').value = '';
    document.getElementById('userLastName').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword2').value = '';
    document.getElementById('userPassword').required = true;
    document.getElementById('userPasswordRequired').style.display = '';
    document.getElementById('modalUserTitle').textContent = 'Добавить пользователя';
    openModal('modalUser');
  });

  document.getElementById('formUser')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const payload = {
      username: document.getElementById('userUsername').value.trim(),
      email: document.getElementById('userEmail').value.trim(),
      first_name: document.getElementById('userFirstName').value.trim(),
      last_name: document.getElementById('userLastName').value.trim(),
    };
    const password = document.getElementById('userPassword').value;
    const password2 = document.getElementById('userPassword2').value;
    if (id) {
      if (password || password2) {
        if (password !== password2) {
          showToast('Пароли не совпадают', 'error');
          return;
        }
        payload.password = password;
        payload.password2 = password2;
      }
    } else {
      payload.password = password;
      payload.password2 = password2;
    }
    try {
      if (id) {
        await api('/users/' + id + '/update/', { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Пользователь обновлён');
      } else {
        await api('/users/create/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Пользователь добавлен');
      }
      closeModal('modalUser');
      loadUsers();
    } catch (err) {
      const msg = typeof err.data === 'object' ? (err.data.error || Object.values(err.data).flat().join(' ')) : (err.data || 'Ошибка');
      showToast(msg, 'error');
    }
  });

  async function editUser(id) {
    try {
      const u = await api('/users/' + id + '/');
      if (!u) return;
      document.getElementById('userId').value = u.id;
      document.getElementById('userUsername').value = u.username || '';
      document.getElementById('userEmail').value = u.email || '';
      document.getElementById('userFirstName').value = u.first_name || '';
      document.getElementById('userLastName').value = u.last_name || '';
      document.getElementById('userPassword').value = '';
      document.getElementById('userPassword2').value = '';
      document.getElementById('userPassword').required = false;
      document.getElementById('userPasswordRequired').style.display = 'none';
      document.getElementById('modalUserTitle').textContent = 'Редактировать пользователя';
      openModal('modalUser');
    } catch (err) {
      showToast('Ошибка загрузки пользователя', 'error');
    }
  }

  async function deleteUser(id) {
    showConfirmModal('Удалить этого пользователя?', async function () {
      try {
        await api('/users/' + id + '/delete/', { method: 'DELETE' });
        showToast('Пользователь удалён');
        loadUsers();
      } catch (err) {
        showToast(err.data?.error || err.data?.detail || 'Ошибка удаления', 'error');
      }
    });
  }

  async function loadStats() {
    const grid = document.getElementById('statsGrid');
    try {
      const data = await api('/children/stats/');
      if (data == null) return;
      let html = `
        <div class="stat-card">
          <h4>Всего учащихся</h4>
          <div class="value">${data.total_children ?? 0}</div>
        </div>
      `;
      if (data.schools_statistics && data.schools_statistics.length) {
        html += `
          <div class="stat-card">
            <h4>По школам</h4>
            <ul class="stat-list">
              ${data.schools_statistics.map(s => '<li><span>' + escapeHtml(s.school_name) + '</span><span>' + s.children_count + '</span></li>').join('')}
            </ul>
          </div>
        `;
      }
      if (data.family_status_statistics && data.family_status_statistics.length) {
        html += `
          <div class="stat-card">
            <h4>По статусу семьи</h4>
            <ul class="stat-list">
              ${data.family_status_statistics.map(f => '<li><span>' + escapeHtml(f.family_status || '—') + '</span><span>' + f.count + '</span></li>').join('')}
            </ul>
          </div>
        `;
      }
      if (data.health_status_statistics && data.health_status_statistics.length) {
        html += `
          <div class="stat-card">
            <h4>По состоянию здоровья</h4>
            <ul class="stat-list">
              ${data.health_status_statistics.map(h => '<li><span>' + escapeHtml(h.health_status || '—') + '</span><span>' + h.count + '</span></li>').join('')}
            </ul>
          </div>
        `;
      }
      grid.innerHTML = html || '<div class="empty-state">Нет данных</div>';
    } catch (err) {
      const msg = getPermissionErrorMsg(err, 'Ошибка загрузки статистики');
      grid.innerHTML = '<div class="empty-state">' + escapeHtml(msg) + '</div>';
      showToast(msg, 'error');
    }
  }

  async function loadPermissionsPage() {
    await Promise.all([loadRoles(), loadPermissionsByModel()]);
  }

  async function loadRoles() {
    try {
      const list = await api('/roles/');
      const roles = Array.isArray(list) ? list : (list?.data || []);
      const tbody = document.getElementById('rolesTableBody');
      if (!roles.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Нет ролей</td></tr>';
      } else {
        const editSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        const deleteSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
        const usersSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>';
        tbody.innerHTML = roles.map(r => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.description || '—')}</td>
            <td>${r.permissions?.length ?? 0}</td>
            <td>${r.users_count ?? r.users_ids?.length ?? 0}</td>
            <td class="actions">
              <button type="button" class="btn-icon btn-icon-edit btn-edit-role" data-id="${r.id}" title="Изменить">${editSvg}</button>
              <button type="button" class="btn-icon btn-icon-users btn-role-users" data-id="${r.id}" title="Пользователи роли">${usersSvg}</button>
              <button type="button" class="btn-icon btn-icon-delete btn-delete-role" data-id="${r.id}" title="Удалить">${deleteSvg}</button>
            </td>
          </tr>
        `).join('');
        tbody.querySelectorAll('.btn-edit-role').forEach(btn => {
          btn.addEventListener('click', () => editRole(Number(btn.getAttribute('data-id'))));
        });
        tbody.querySelectorAll('.btn-role-users').forEach(btn => {
          btn.addEventListener('click', () => openRoleUsersModal(Number(btn.getAttribute('data-id'))));
        });
        tbody.querySelectorAll('.btn-delete-role').forEach(btn => {
          btn.addEventListener('click', () => deleteRole(Number(btn.getAttribute('data-id'))));
        });
      }
    } catch (err) {
      document.getElementById('rolesTableBody').innerHTML =
        '<tr><td colspan="5" class="empty-state">Ошибка загрузки</td></tr>';
      showToast(err.data?.detail || 'Ошибка загрузки ролей', 'error');
    }
  }

  async function loadPermissionsByModel() {
    try {
      const list = await api('/permissions/');
      const perms = Array.isArray(list) ? list : (list?.data || []);
      const byModel = {};
      perms.forEach(p => {
        const modelName = p.model_name || p.content_type_info?.model_name || '—';
        const label = p.content_type_info?.verbose_name || modelName;
        if (!byModel[label]) byModel[label] = [];
        byModel[label].push(p);
      });
      const container = document.getElementById('permissionsByModel');
      if (!Object.keys(byModel).length) {
        container.innerHTML = '<p class="empty-state">Нет разрешений. Нажмите «Инициализировать».</p>';
      } else {
        container.innerHTML = Object.entries(byModel).map(([label, items]) => `
          <div class="permission-model-group">
            <h4>${escapeHtml(label)}</h4>
            <ul>
              ${items.map(i => '<li>' + escapeHtml(i.name) + ' <span class="muted">(' + escapeHtml(i.codename) + ')</span></li>').join('')}
            </ul>
          </div>
        `).join('');
      }
    } catch (err) {
      document.getElementById('permissionsByModel').innerHTML =
        '<p class="empty-state">Ошибка загрузки разрешений</p>';
    }
  }

  document.getElementById('btnInitPermissions')?.addEventListener('click', async function () {
    try {
      const data = await api('/permission-manager/initialize_models/', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showToast(data?.status || 'Разрешения инициализированы');
      loadPermissionsPage();
    } catch (err) {
      showToast(err.data?.error || err.data?.detail || 'Ошибка инициализации', 'error');
    }
  });

  document.getElementById('btnAddRole')?.addEventListener('click', async function () {
    await openRoleModal();
  });

  async function openRoleModal(roleData = null) {
    const permissions = await api('/permissions/').then(r => Array.isArray(r) ? r : (r?.data || []));
    const permList = document.getElementById('rolePermissionsList');
    permList.innerHTML = permissions.map(p =>
      '<label><input type="checkbox" class="role-perm-cb" value="' + p.id + '"> ' +
      escapeHtml(p.name) + ' (' + escapeHtml(p.model_name || '') + ')</label>'
    ).join('');

    if (roleData) {
      document.getElementById('roleId').value = roleData.id;
      document.getElementById('roleName').value = roleData.name || '';
      document.getElementById('roleDescription').value = roleData.description || '';
      document.getElementById('roleIsGlobal').checked = !!roleData.is_global;
      (roleData.permissions || []).forEach(p => {
        const cb = permList.querySelector('.role-perm-cb[value="' + p.id + '"]');
        if (cb) cb.checked = true;
      });
      document.getElementById('modalRoleTitle').textContent = 'Редактировать роль';
    } else {
      document.getElementById('roleId').value = '';
      document.getElementById('roleName').value = '';
      document.getElementById('roleDescription').value = '';
      document.getElementById('roleIsGlobal').checked = false;
      document.getElementById('modalRoleTitle').textContent = 'Добавить роль';
    }
    openModal('modalRole');
  }

  async function openRoleUsersModal(roleId) {
    try {
      const [role, users] = await Promise.all([
        api('/roles/' + roleId + '/'),
        api('/users/').then(r => Array.isArray(r) ? r : (r?.data || [])),
      ]);
      if (!role) return;
      document.getElementById('roleUsersRoleId').value = roleId;
      document.getElementById('modalRoleUsersTitle').textContent = 'Пользователи роли: ' + escapeHtml(role.name || '');
      const userList = document.getElementById('roleUsersList');
      userList.innerHTML = users.map(u =>
        '<label><input type="checkbox" class="role-user-cb" value="' + u.id + '"> ' +
        escapeHtml(u.username) + '</label>'
      ).join('');
      const userIds = role.users_ids || [];
      userIds.forEach(uid => {
        const cb = userList.querySelector('.role-user-cb[value="' + uid + '"]');
        if (cb) cb.checked = true;
      });
      openModal('modalRoleUsers');
    } catch (err) {
      showToast(err.data?.detail || 'Ошибка загрузки', 'error');
    }
  }

  async function editRole(id) {
    try {
      const r = await api('/roles/' + id + '/');
      if (!r) return;
      await openRoleModal(r);
    } catch (err) {
      showToast('Ошибка загрузки роли', 'error');
    }
  }

  async function deleteRole(id) {
    showConfirmModal('Удалить эту роль?', async function () {
      try {
        await api('/roles/' + id + '/', { method: 'DELETE' });
        showToast('Роль удалена');
        loadRoles();
      } catch (err) {
        showToast(err.data?.detail || 'Ошибка удаления', 'error');
      }
    });
  }

  document.getElementById('formRole')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('roleId').value;
    const permChecks = document.querySelectorAll('#rolePermissionsList .role-perm-cb:checked');
    const payload = {
      name: document.getElementById('roleName').value.trim(),
      description: document.getElementById('roleDescription').value.trim(),
      is_global: document.getElementById('roleIsGlobal').checked,
      permissions_ids: Array.from(permChecks).map(cb => Number(cb.value)),
    };
    try {
      if (id) {
        await api('/roles/' + id + '/', { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Роль обновлена');
      } else {
        await api('/roles/', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Роль добавлена');
      }
      closeModal('modalRole');
      loadRoles();
    } catch (err) {
      showToast(err.data?.detail || (typeof err.data === 'object' ? JSON.stringify(err.data) : 'Ошибка'), 'error');
    }
  });

  document.getElementById('formRoleUsers')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const roleId = document.getElementById('roleUsersRoleId').value;
    const userChecks = document.querySelectorAll('#roleUsersList .role-user-cb:checked');
    const payload = { users: Array.from(userChecks).map(cb => Number(cb.value)) };
    try {
      await api('/roles/' + roleId + '/', { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Пользователи роли обновлены');
      closeModal('modalRoleUsers');
      loadRoles();
    } catch (err) {
      showToast(err.data?.detail || (typeof err.data === 'object' ? JSON.stringify(err.data) : 'Ошибка'), 'error');
    }
  });

  if (getToken()) {
    api('/profile/').then(profile => {
      if (profile) showApp(profile);
      else showAuth();
    }).catch(() => showAuth());
  } else {
    showAuth();
  }
})();
