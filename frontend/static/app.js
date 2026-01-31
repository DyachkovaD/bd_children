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

  function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show ' + type;
    clearTimeout(el._toastTimer);
    el._toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3000);
  }

  function showAuth() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('contentSection').style.display = 'none';
    document.getElementById('mainNav').style.display = 'none';
    document.getElementById('headerActions').style.display = 'none';
  }

  function showApp(user) {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('contentSection').style.display = 'block';
    document.getElementById('mainNav').style.display = 'flex';
    document.getElementById('headerActions').style.display = 'flex';
    document.getElementById('userName').textContent = user ? user.username : '';
    showPage('schools');
  }

  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    const page = document.getElementById('page' + name.charAt(0).toUpperCase() + name.slice(1));
    const link = document.querySelector('.nav a[data-page="' + name + '"]');
    if (page) page.style.display = 'block';
    if (link) link.classList.add('active');
    if (name === 'schools') loadSchools();
    if (name === 'children') loadChildren();
    if (name === 'stats') loadStats();
  }

  document.querySelectorAll('.nav a').forEach(a => {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(this.getAttribute('data-page'));
    });
  });

  document.getElementById('btnLogout').addEventListener('click', function () {
    clearAuth();
    showToast('Вы вышли из системы');
    showAuth();
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

  async function loadSchools() {
    const name = document.getElementById('filterSchoolName').value.trim();
    const director = document.getElementById('filterSchoolDirector').value.trim();
    const params = new URLSearchParams();
    if (name) params.set('search', name);
    if (director) params.set('director', director);
    const query = params.toString();
    const url = '/schools/' + (query ? '?' + query : '');
    try {
      const list = await api(url);
      if (list == null) return;
      const tbody = document.getElementById('schoolsTableBody');
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Нет данных</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(s => `
        <tr>
          <td>${escapeHtml(s.short_name)}</td>
          <td>${escapeHtml(s.full_name)}</td>
          <td>${escapeHtml(s.director)}</td>
          <td>${escapeHtml(s.address)}</td>
          <td class="actions">
            <button type="button" class="btn btn-outline btn-edit-school" data-id="${s.id}">Изменить</button>
            <button type="button" class="btn btn-danger btn-delete-school" data-id="${s.id}">Удалить</button>
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.btn-edit-school').forEach(btn => {
        btn.addEventListener('click', () => editSchool(Number(btn.getAttribute('data-id'))));
      });
      tbody.querySelectorAll('.btn-delete-school').forEach(btn => {
        btn.addEventListener('click', () => deleteSchool(Number(btn.getAttribute('data-id'))));
      });
    } catch (err) {
      showToast(err.data?.detail || 'Ошибка загрузки школ', 'error');
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  document.getElementById('btnFilterSchools').addEventListener('click', loadSchools);
  document.getElementById('btnClearSchoolFilters').addEventListener('click', function () {
    document.getElementById('filterSchoolName').value = '';
    document.getElementById('filterSchoolDirector').value = '';
    loadSchools();
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
      showToast('Ошибка загрузки школы', 'error');
    }
  }

  async function deleteSchool(id) {
    if (!confirm('Удалить эту школу?')) return;
    try {
      await api('/schools/' + id + '/', { method: 'DELETE' });
      showToast('Школа удалена');
      loadSchools();
    } catch (err) {
      showToast(err.data?.detail || 'Не удалось удалить (возможно, есть учащиеся)', 'error');
    }
  }

  let schoolsCache = [];
  async function loadSchoolsForSelect() {
    const list = await api('/schools/');
    if (list) schoolsCache = list;
    return schoolsCache;
  }

  async function loadChildren() {
    const schoolId = document.getElementById('filterChildSchool').value;
    const q = document.getElementById('filterChildSearch').value.trim();
    let list;
    if (q) {
      list = await api('/children/search_by_name/?q=' + encodeURIComponent(q));
    } else if (schoolId) {
      list = await api('/children/by_school/?school_id=' + encodeURIComponent(schoolId));
    } else {
      list = await api('/children/');
    }
    if (list == null) return;
    const tbody = document.getElementById('childrenTableBody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Нет данных</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(c => `
      <tr>
        <td>${escapeHtml(c.last_name + ' ' + c.first_name + ' ' + (c.patronymic || ''))}</td>
        <td>${c.education_class}</td>
        <td>${escapeHtml(c.school_name || '—')}</td>
        <td class="date-cell">${formatDate(c.birthday)}</td>
        <td>${escapeHtml(c.family_status || '—')}</td>
        <td class="actions">
          <button type="button" class="btn btn-outline btn-edit-child" data-id="${c.id}">Изменить</button>
          <button type="button" class="btn btn-danger btn-delete-child" data-id="${c.id}">Удалить</button>
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

  async function fillSchoolFilters() {
    const selectFilter = document.getElementById('filterChildSchool');
    const selectForm = document.getElementById('childSchool');
    const schools = await loadSchoolsForSelect();
    const opts = '<option value="">Все школы</option>' + schools.map(s => '<option value="' + s.id + '">' + escapeHtml(s.short_name) + '</option>').join('');
    selectFilter.innerHTML = opts;
    selectForm.innerHTML = schools.map(s => '<option value="' + s.id + '">' + escapeHtml(s.short_name) + '</option>').join('');
  }

  document.getElementById('btnFilterChildren').addEventListener('click', loadChildren);
  document.getElementById('btnClearChildFilters').addEventListener('click', function () {
    document.getElementById('filterChildSchool').value = '';
    document.getElementById('filterChildSearch').value = '';
    loadChildren();
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
      showToast('Ошибка загрузки учащегося', 'error');
    }
  }

  async function deleteChild(id) {
    if (!confirm('Удалить этого учащегося?')) return;
    try {
      await api('/children/' + id + '/', { method: 'DELETE' });
      showToast('Учащийся удалён');
      loadChildren();
    } catch (err) {
      showToast(err.data?.detail || 'Ошибка удаления', 'error');
    }
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
      grid.innerHTML = '<div class="empty-state">Ошибка загрузки статистики</div>';
      showToast('Ошибка загрузки статистики', 'error');
    }
  }

  document.querySelector('.nav a[data-page="schools"]').classList.add('active');

  if (getToken()) {
    api('/profile/').then(profile => {
      if (profile) showApp(profile);
      else showAuth();
    }).catch(() => showAuth());
  } else {
    showAuth();
  }
})();
