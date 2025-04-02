/**
 * Основной скрипт для клиентской части OnlySheet
 */

// Глобальные переменные
let currentUser = null;
let currentDocumentId = null;
let docEditor = null;

// Константы для API
const API_URL = '/api';
const AUTH_URL = `${API_URL}/auth`;
const DOCUMENTS_URL = `${API_URL}/documents`;

// DOM-элементы
const $authContainer = $('#authContainer');
const $documentsContainer = $('#documentsContainer');
const $editorContainer = $('#editorContainer');
const $adminControls = $('#adminControls');
const $documentsList = $('#documentsList');
const $loginForm = $('#loginForm');
const $loginError = $('#loginError');
const $userInfo = $('#userInfo');
const $createUserModal = $('#createUserModal');
const $createUserForm = $('#createUserForm');
const $createUserError = $('#createUserError');
const $uploadModal = $('#uploadModal');
const $uploadForm = $('#uploadForm');
const $uploadError = $('#uploadError');
const $backToListBtn = $('#backToListBtn');
const $currentDocumentTitle = $('#currentDocumentTitle');
const $documentEditor = $('#documentEditor');

/**
 * Инициализация приложения
 */
$(document).ready(function() {
  // Проверка авторизации
  checkAuth();
  
  // Обработчики событий
  initEventListeners();
  
  // Защита от копирования для неадминистраторов
  setupCopyProtection();
});

/**
 * Проверка авторизации пользователя
 */
function checkAuth() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    showLoginForm();
    return;
  }
  
  // Проверка валидности токена
  $.ajax({
    url: `${AUTH_URL}/verify`,
    type: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    success: function(response) {
      if (response.success) {
        currentUser = response.user;
        showDocumentsList();
      } else {
        logout();
      }
    },
    error: function() {
      logout();
    }
  });
}

/**
 * Инициализация обработчиков событий
 */
function initEventListeners() {
  // Форма авторизации
  $loginForm.on('submit', function(e) {
    e.preventDefault();
    login();
  });
  
  // Кнопка выхода
  $(document).on('click', '.logout-btn', function() {
    logout();
  });
  
  // Создание пользователя (админ)
  $('#createUserBtn').on('click', function() {
    $createUserModal.css('display', 'flex');
  });
  
  // Закрытие модальных окон
  $('.close-btn').on('click', function() {
    $(this).closest('.modal').hide();
  });
  
  // Форма создания пользователя
  $createUserForm.on('submit', function(e) {
    e.preventDefault();
    createUser();
  });
  
  // Кнопка загрузки файла
  $('#uploadBtn').on('click', function() {
    $uploadModal.css('display', 'flex');
  });
  
  // Форма загрузки файла
  $uploadForm.on('submit', function(e) {
    e.preventDefault();
    uploadDocument();
  });
  
  // Возврат к списку документов
  $backToListBtn.on('click', function() {
    closeEditor();
  });
  
  // Открытие документа при клике на карточку
  $(document).on('click', '.document-card', function() {
    const documentId = $(this).data('id');
    openDocument(documentId);
  });
}

/**
 * Авторизация пользователя
 */
function login() {
  const username = $('#username').val();
  const password = $('#password').val();
  
  if (!username || !password) {
    $loginError.text('Необходимо указать имя пользователя и пароль');
    return;
  }
  
  $.ajax({
    url: `${AUTH_URL}/login`,
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ username, password }),
    success: function(response) {
      if (response.success) {
        // Сохранение токена
        localStorage.setItem('token', response.token);
        currentUser = response.user;
        
        // Переход к списку документов
        showDocumentsList();
      } else {
        $loginError.text(response.message || 'Ошибка авторизации');
      }
    },
    error: function(xhr) {
      $loginError.text(xhr.responseJSON?.message || 'Ошибка сервера');
    }
  });
}

/**
 * Выход из аккаунта
 */
function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  closeEditor();
  showLoginForm();
}

/**
 * Отображение формы входа
 */
function showLoginForm() {
  $documentsContainer.hide();
  $editorContainer.hide();
  $authContainer.show();
  
  // Очистка формы
  $loginForm[0].reset();
  $loginError.text('');
}

/**
 * Отображение списка документов
 */
function showDocumentsList() {
  $authContainer.hide();
  $editorContainer.hide();
  $documentsContainer.show();
  
  // Отображение информации о пользователе
  $userInfo.html(`
    <span class="user-name">${currentUser.username} (${getUserRoleText(currentUser.role)})</span>
    <button class="logout-btn">Выход</button>
  `);
  
  // Отображение элементов управления для админа
  if (currentUser.role === 'admin') {
    $adminControls.show();
  } else {
    $adminControls.hide();
  }
  
  // Загрузка списка документов
  loadDocuments();
}

/**
 * Загрузка списка документов
 */
function loadDocuments() {
  const token = localStorage.getItem('token');
  
  $.ajax({
    url: DOCUMENTS_URL,
    type: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    success: function(response) {
      if (response.success) {
        renderDocuments(response.documents);
      } else {
        $documentsList.html(`<div class="error">Ошибка загрузки документов: ${response.message}</div>`);
      }
    },
    error: function() {
      $documentsList.html('<div class="error">Ошибка сервера при загрузке документов</div>');
    }
  });
}

/**
 * Отрисовка списка документов
 * @param {Array} documents - Массив документов
 */
function renderDocuments(documents) {
  if (!documents || documents.length === 0) {
    $documentsList.html('<div class="empty-list">Нет доступных документов</div>');
    return;
  }
  
  let html = '';
  
  documents.forEach(doc => {
    const date = new Date(doc.uploadedAt).toLocaleDateString();
    html += `
      <div class="document-card" data-id="${doc.id}">
        <h3>${doc.name}</h3>
        <div class="document-meta">Загружен: ${date}</div>
        <div class="document-type">${doc.fileType.toUpperCase()}</div>
      </div>
    `;
  });
  
  $documentsList.html(html);
}

/**
 * Открытие документа для редактирования
 * @param {string} documentId - ID документа
 */
function openDocument(documentId) {
  const token = localStorage.getItem('token');
  
  $.ajax({
    url: `${DOCUMENTS_URL}/${documentId}`,
    type: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    success: function(response) {
      if (response.success) {
        currentDocumentId = documentId;
        $currentDocumentTitle.text(response.document.name);
        
        // Скрытие списка и отображение редактора
        $documentsContainer.hide();
        $editorContainer.show();
        
        // Инициализация редактора ONLYOFFICE
        initEditor(response.document);
      } else {
        alert(response.message || 'Ошибка открытия документа');
      }
    },
    error: function(xhr) {
      alert(xhr.responseJSON?.message || 'Ошибка сервера');
    }
  });
}

/**
 * Инициализация редактора ONLYOFFICE
 * @param {Object} document - Объект документа
 */
function initEditor(document) {
  const config = {
    document: {
      fileType: document.fileType,
      key: document.key,
      title: document.name,
      url: `${window.location.origin}${DOCUMENTS_URL}/${document.id}/content`
    },
    documentType: 'spreadsheet',
    editorConfig: {
      mode: currentUser.role === 'viewer' ? 'view' : 'edit',
      lang: 'ru',
      callbackUrl: `${window.location.origin}${DOCUMENTS_URL}/${document.id}/callback`,
      user: {
        id: currentUser.id,
        name: currentUser.username
      },
      customization: {
        chat: true,
        comments: true,
        compactToolbar: false,
        downloadAs: currentUser.role === 'admin',
        feedback: false,
        forceSave: false,
        goback: false,
        help: true,
        hideRightMenu: currentUser.role !== 'admin',
        showReviewChanges: true,
        zoom: 100,
      },
      permissions: {
        comment: true,
        download: currentUser.role === 'admin',
        edit: currentUser.role !== 'viewer',
        print: true,
        review: currentUser.role !== 'viewer',
      }
    },
    events: {
      onAppReady: function() {
        console.log('ONLYOFFICE Document Editor инициализирован');
      },
      onDocumentStateChange: function(event) {
        console.log('Состояние документа изменено:', event.data);
      },
      onError: function(event) {
        console.error('Ошибка редактора:', event.data);
      }
    },
    token: document.token
  };
  
  docEditor = new DocsAPI.DocEditor('documentEditor', config);
}

/**
 * Закрытие редактора и возврат к списку документов
 */
function closeEditor() {
  if (docEditor) {
    docEditor.destroyEditor();
    docEditor = null;
  }
  
  currentDocumentId = null;
  $editorContainer.hide();
  showDocumentsList();
}

/**
 * Создание нового пользователя (только для админа)
 */
function createUser() {
  const username = $('#newUsername').val();
  const password = $('#newPassword').val();
  const role = $('#userRole').val();
  
  if (!username || !password || !role) {
    $createUserError.text('Все поля обязательны для заполнения');
    return;
  }
  
  const token = localStorage.getItem('token');
  
  $.ajax({
    url: `${AUTH_URL}/users`,
    type: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    contentType: 'application/json',
    data: JSON.stringify({ username, password, role }),
    success: function(response) {
      if (response.success) {
        // Скрытие модального окна и очистка формы
        $createUserModal.hide();
        $createUserForm[0].reset();
        $createUserError.text('');
        
        // Уведомление об успехе
        alert(`Пользователь ${response.user.username} успешно создан`);
      } else {
        $createUserError.text(response.message || 'Ошибка создания пользователя');
      }
    },
    error: function(xhr) {
      $createUserError.text(xhr.responseJSON?.message || 'Ошибка сервера');
    }
  });
}

/**
 * Загрузка нового документа (только для админа)
 */
function uploadDocument() {
  const formData = new FormData($uploadForm[0]);
  const token = localStorage.getItem('token');
  
  $.ajax({
    url: `${DOCUMENTS_URL}/upload`,
    type: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    data: formData,
    processData: false,
    contentType: false,
    success: function(response) {
      if (response.success) {
        // Скрытие модального окна и очистка формы
        $uploadModal.hide();
        $uploadForm[0].reset();
        $uploadError.text('');
        
        // Обновление списка документов
        loadDocuments();
      } else {
        $uploadError.text(response.message || 'Ошибка загрузки документа');
      }
    },
    error: function(xhr) {
      $uploadError.text(xhr.responseJSON?.message || 'Ошибка сервера');
    }
  });
}

/**
 * Настройка защиты от копирования для неадминистраторов
 */
function setupCopyProtection() {
  // Применение класса для предотвращения выделения
  $(document).on('mousedown', function() {
    if (currentUser && currentUser.role !== 'admin') {
      $documentEditor.addClass('prevent-select');
    }
  });
  
  // Отключение контекстного меню для неадминистраторов
  $(document).on('contextmenu', function(e) {
    if (currentUser && currentUser.role !== 'admin') {
      e.preventDefault();
      return false;
    }
  });
  
  // Отключение горячих клавиш копирования
  $(document).on('keydown', function(e) {
    if (currentUser && currentUser.role !== 'admin') {
      // Ctrl+C, Ctrl+X, Ctrl+V
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x' || e.key === 'v')) {
        e.preventDefault();
        return false;
      }
    }
  });
}

/**
 * Получение текстового представления роли пользователя
 * @param {string} role - Роль пользователя
 * @returns {string} Текстовое представление роли
 */
function getUserRoleText(role) {
  switch (role) {
    case 'admin':
      return 'Администратор';
    case 'editor':
      return 'Редактор';
    case 'viewer':
      return 'Читатель';
    default:
      return role;
  }
}