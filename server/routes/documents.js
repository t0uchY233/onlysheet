const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config/config.json');

const router = express.Router();

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const documentsDir = path.join(__dirname, '../../documents');
    // Создание директории, если не существует
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    // Генерация уникального имени файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + fileExt);
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
  // Разрешенные типы файлов
  const allowedMimeTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Поддерживаются только файлы Excel (.xls, .xlsx)'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Путь к файлу с метаданными документов
const documentsMetadataPath = path.join(__dirname, '../db/documents.json');

/**
 * Получение списка документов
 */
router.get('/', async (req, res) => {
  try {
    // Получение метаданных документов
    const documents = getDocumentsMetadata();
    
    // Фильтрация документов в зависимости от роли пользователя
    const role = req.user.role;
    const userId = req.user.id;
    
    // Администратор видит все документы, другие пользователи - только назначенные им
    const filteredDocuments = (role === 'admin')
      ? documents
      : documents.filter(doc => doc.userAccess && doc.userAccess.includes(userId));
    
    return res.json({
      success: true,
      documents: filteredDocuments
    });
  } catch (error) {
    console.error('Ошибка при получении списка документов:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Получение документа по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const documents = getDocumentsMetadata();
    
    // Поиск документа по ID
    const document = documents.find(doc => doc.id === id);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Документ не найден'
      });
    }
    
    // Проверка прав доступа
    const role = req.user.role;
    const userId = req.user.id;
    
    if (role !== 'admin' && (!document.userAccess || !document.userAccess.includes(userId))) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для доступа к документу'
      });
    }
    
    // Генерация JWT токена для ONLYOFFICE Document Server
    const token = jwt.sign({
      document: {
        fileType: document.fileType,
        key: document.key,
      },
      permissions: {
        edit: role === 'admin' || role === 'editor',
        download: role === 'admin',
        review: true,
        fillForms: role === 'admin' || role === 'editor',
      },
      user: {
        id: req.user.id,
        name: req.user.username,
        group: req.user.role
      }
    }, config.jwt.secret, { expiresIn: '1h' });
    
    return res.json({
      success: true,
      document: {
        ...document,
        token
      }
    });
  } catch (error) {
    console.error('Ошибка при получении документа:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Загрузка нового документа (только для администраторов)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      // Удаление файла, если он был загружен
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для загрузки документов'
      });
    }
    
    // Проверка загруженного файла
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Файл не был загружен или его формат не поддерживается'
      });
    }
    
    // Создание метаданных документа
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const fileKey = crypto.randomBytes(16).toString('hex');
    
    const newDocument = {
      id: crypto.randomBytes(8).toString('hex'),
      name: req.body.name || path.basename(req.file.originalname, fileExt),
      path: req.file.filename,
      key: fileKey,
      fileType: fileExt === '.xlsx' ? 'xlsx' : 'xls',
      uploadedBy: req.user.id,
      uploadedAt: new Date().toISOString(),
      userAccess: [req.user.id], // По умолчанию доступен только загрузившему
    };
    
    // Сохранение метаданных
    const documents = getDocumentsMetadata();
    documents.push(newDocument);
    saveDocumentsMetadata(documents);
    
    return res.status(201).json({
      success: true,
      document: newDocument
    });
  } catch (error) {
    console.error('Ошибка при загрузке документа:', error);
    
    // Удаление файла при ошибке, если он был загружен
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Обновление доступа к документу (только для администраторов)
 */
router.put('/:id/access', async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для управления доступом'
      });
    }
    
    const { id } = req.params;
    const { userAccess } = req.body;
    
    if (!Array.isArray(userAccess)) {
      return res.status(400).json({
        success: false,
        message: 'userAccess должен быть массивом ID пользователей'
      });
    }
    
    // Обновление метаданных документа
    const documents = getDocumentsMetadata();
    const documentIndex = documents.findIndex(doc => doc.id === id);
    
    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Документ не найден'
      });
    }
    
    documents[documentIndex].userAccess = userAccess;
    saveDocumentsMetadata(documents);
    
    return res.json({
      success: true,
      document: documents[documentIndex]
    });
  } catch (error) {
    console.error('Ошибка при обновлении доступа:', error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

/**
 * Получение метаданных всех документов
 * @returns {Array} Массив метаданных документов
 */
function getDocumentsMetadata() {
  try {
    // Проверка существования файла
    if (!fs.existsSync(documentsMetadataPath)) {
      return [];
    }
    
    const data = fs.readFileSync(documentsMetadataPath, 'utf8');
    return JSON.parse(data).documents || [];
  } catch (error) {
    console.error('Ошибка при чтении метаданных документов:', error);
    return [];
  }
}

/**
 * Сохранение метаданных документов
 * @param {Array} documents - Массив метаданных документов
 */
function saveDocumentsMetadata(documents) {
  try {
    // Проверка существования директории
    const dbDir = path.dirname(documentsMetadataPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    fs.writeFileSync(documentsMetadataPath, JSON.stringify({ documents }, null, 2));
  } catch (error) {
    console.error('Ошибка при сохранении метаданных документов:', error);
  }
}

module.exports = router;