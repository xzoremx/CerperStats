// =============================================
// CerperStats Admin Panel - JavaScript
// =============================================

// Estado global
let adminAuth = null;
let users = [];
let labs = [];
let editingUserId = null;
let deleteUserId = null;

// Elementos DOM
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const app = document.getElementById('app');
const userModal = document.getElementById('user-modal');
const deleteModal = document.getElementById('delete-modal');
const toast = document.getElementById('toast');

// =============================================
// Utilidades
// =============================================
function showToast(message, type = 'error') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(adminAuth ? { 'X-Admin-Auth': adminAuth } : {})
  };

  const response = await fetch(`/admin${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error desconocido');
  }

  return data;
}

// =============================================
// Autenticacion
// =============================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;

  if (!username || !password) {
    loginError.textContent = 'Ingrese usuario y contrasena';
    return;
  }

  adminAuth = btoa(`${username}:${password}`);

  try {
    const result = await apiCall('/users');

    if (result.ok) {
      loginModal.classList.remove('active');
      app.classList.remove('hidden');
      document.getElementById('admin-name').textContent = username;
      await loadData();
    }
  } catch (err) {
    adminAuth = null;
    let errorMsg = 'Error de autenticacion';

    if (err.message === 'not_admin') {
      errorMsg = 'El usuario no tiene permisos de administrador';
    } else if (err.message === 'invalid_admin_password') {
      errorMsg = 'Contrasena incorrecta';
    }

    loginError.textContent = errorMsg;
    setTimeout(() => { loginError.textContent = ''; }, 4000);
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  adminAuth = null;
  users = [];
  labs = [];
  app.classList.add('hidden');
  loginModal.classList.add('active');
  document.getElementById('admin-username').value = '';
  document.getElementById('admin-password').value = '';
});

// =============================================
// Cargar Datos
// =============================================
async function loadData() {
  try {
    const [usersResult, labsResult] = await Promise.all([
      apiCall('/users'),
      apiCall('/labs')
    ]);

    users = usersResult.data || [];
    labs = labsResult.data || [];

    updateStats();
    renderUsersTable();
    populateLabsSelect();
  } catch (err) {
    console.error('Error cargando datos:', err);
    showToast('Error cargando datos');
  }
}

function updateStats() {
  document.getElementById('total-users').textContent = users.length;
  document.getElementById('active-users').textContent = users.filter(u => u.activo).length;
  document.getElementById('admin-count').textContent = users.filter(u => u.rol === 'admin').length;
}

function populateLabsSelect() {
  const select = document.getElementById('user-lab');
  select.innerHTML = '<option value="">-- Sin asignar --</option>';

  labs.forEach(lab => {
    const option = document.createElement('option');
    option.value = lab.lab_key;
    option.textContent = lab.nombre || lab.lab_key;
    select.appendChild(option);
  });
}

// =============================================
// Tabla de Usuarios
// =============================================
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-12 text-center text-white/50">No hay usuarios registrados</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td class="font-semibold">${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.nombre_completo || '-')}</td>
      <td class="text-white/60">${escapeHtml(user.email || '-')}</td>
      <td><span class="badge badge-${user.rol}">${user.rol}</span></td>
      <td class="text-white/60">${escapeHtml(user.default_lab || '-')}</td>
      <td>
        <span class="badge ${user.activo ? 'badge-active' : 'badge-inactive'}">
          ${user.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="text-white/60">${formatDate(user.creado_en)}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn-icon edit" onclick="openEditUser(${user.id})" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          ${user.activo ? `
            <button class="btn-icon delete" onclick="openDeleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Desactivar">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// =============================================
// Modal de Usuario (Crear/Editar)
// =============================================
document.getElementById('add-user-btn').addEventListener('click', () => {
  openCreateUser();
});

function openCreateUser() {
  editingUserId = null;
  document.getElementById('modal-title').textContent = 'Nuevo Usuario';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-username').disabled = false;
  document.getElementById('user-password').required = true;
  document.getElementById('password-hint').textContent = '(min. 6) *';
  document.getElementById('activo-group').classList.add('hidden');
  document.getElementById('user-form-error').textContent = '';
  document.getElementById('save-user-btn').textContent = 'Crear Usuario';
  userModal.classList.add('active');
}

function openEditUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  editingUserId = userId;
  document.getElementById('modal-title').textContent = 'Editar Usuario';
  document.getElementById('user-id').value = userId;
  document.getElementById('user-username').value = user.username;
  document.getElementById('user-username').disabled = true;
  document.getElementById('user-password').value = '';
  document.getElementById('user-password').required = false;
  document.getElementById('password-hint').textContent = '(dejar vacio para mantener)';
  document.getElementById('user-nombre').value = user.nombre_completo || '';
  document.getElementById('user-email').value = user.email || '';
  document.getElementById('user-rol').value = user.rol || 'analista';
  document.getElementById('user-lab').value = user.default_lab || '';
  document.getElementById('user-activo').checked = user.activo;
  document.getElementById('activo-group').classList.remove('hidden');
  document.getElementById('user-form-error').textContent = '';
  document.getElementById('save-user-btn').textContent = 'Guardar Cambios';
  userModal.classList.add('active');
}

function closeUserModal() {
  userModal.classList.remove('active');
  editingUserId = null;
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formError = document.getElementById('user-form-error');
  const saveBtn = document.getElementById('save-user-btn');

  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const nombre_completo = document.getElementById('user-nombre').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const rol = document.getElementById('user-rol').value;
  const default_lab = document.getElementById('user-lab').value || null;
  const activo = document.getElementById('user-activo').checked;

  if (!username || username.length < 3) {
    formError.textContent = 'El usuario debe tener al menos 3 caracteres';
    return;
  }

  if (!editingUserId && (!password || password.length < 6)) {
    formError.textContent = 'La contrasena debe tener al menos 6 caracteres';
    return;
  }

  if (editingUserId && password && password.length < 6) {
    formError.textContent = 'La contrasena debe tener al menos 6 caracteres';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    if (editingUserId) {
      const payload = { nombre_completo, email, rol, default_lab, activo };
      if (password) payload.password = password;

      await apiCall(`/users/${editingUserId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast('Usuario actualizado', 'success');
    } else {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          nombre_completo,
          email,
          rol,
          default_lab
        })
      });
      showToast('Usuario creado', 'success');
    }

    closeUserModal();
    await loadData();
  } catch (err) {
    let errorMsg = 'Error al guardar usuario';

    if (err.message === 'username_exists') {
      errorMsg = 'El nombre de usuario ya existe';
    } else if (err.message === 'password_too_short') {
      errorMsg = 'La contrasena es muy corta';
    }

    formError.textContent = errorMsg;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingUserId ? 'Guardar Cambios' : 'Crear Usuario';
  }
});

// =============================================
// Modal de Eliminacion
// =============================================
function openDeleteUser(userId, username) {
  deleteUserId = userId;
  document.getElementById('delete-username').textContent = username;
  deleteModal.classList.add('active');
}

function closeDeleteModal() {
  deleteModal.classList.remove('active');
  deleteUserId = null;
}

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
  if (!deleteUserId) return;

  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.textContent = 'Desactivando...';

  try {
    await apiCall(`/users/${deleteUserId}`, { method: 'DELETE' });
    showToast('Usuario desactivado', 'success');
    closeDeleteModal();
    await loadData();
  } catch (err) {
    showToast('Error al desactivar usuario');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Desactivar';
  }
});

// =============================================
// Event Listeners Globales
// =============================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (userModal.classList.contains('active')) closeUserModal();
    if (deleteModal.classList.contains('active')) closeDeleteModal();
  }
});

[userModal, deleteModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Hacer funciones globales para onclick
window.openEditUser = openEditUser;
window.openDeleteUser = openDeleteUser;
window.closeUserModal = closeUserModal;
window.closeDeleteModal = closeDeleteModal;
