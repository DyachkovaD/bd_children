# Инструкция по использованию API модуля управления правами доступа

## Обзор системы

Система предоставляет гибкое управление правами доступа для DRF приложения с поддержкой:
- **Глобальных разрешений** для моделей
- **Объектных разрешений** (per-object permissions)
- **Ролевой модели** доступа
- **Автоматического создания** CRUD разрешений

## 📋 Базовые понятия

### 1. Разрешения (Permissions)
- **Глобальные** - применяются ко всем объектам модели
- **Объектные** - применяются к конкретному объекту
- **Типы**: 
  - `view` - просмотр
  - `add` - добавление  
  - `change` - изменение
  - `delete` - удаление

### 2. Роли (UserRoles)
- Группируют набор разрешений
- Могут быть глобальными (применяются ко всем объектам)
- Назначаются пользователям

### 3. Конфигурация моделей (ModelPermissionConfig)
- Управляет включением/выключением системы разрешений для конкретных моделей

## 🔌 API Endpoints

### 1. Управление разрешениями

#### Получить все разрешения
```http
GET /api/permissions/
```

#### Получить разрешения для конкретной модели
```http
GET /api/permissions/?model=modelname
```

#### Создать разрешение
```http
POST /api/permissions/
{
    "name": "Просмотр школ",
    "codename": "view_school",
    "description": "Разрешение на просмотр школ",
    "content_type": 1
}
```

### 2. Управление ролями

#### Получить все роли
```http
GET /api/roles/
```

#### Создать роль
```http
POST /api/roles/
{
    "name": "Менеджер школ",
    "description": "Роль для управления школами",
    "is_global": true,
    "permissions_ids": [1, 2, 3]
}
```

#### Назначить роль пользователю
```http
PATCH /api/roles/{id}/
{
    "users": [user_id1, user_id2]
}
```

### 3. Управление объектными разрешениями

#### Выдать разрешение на объект
```http
POST /api/permission-manager/grant_object_permission/
{
    "user_id": 1,
    "permission_id": 1,
    "object_id": 5,
    "model_name": "school"
}
```

#### Отозвать разрешение на объект
```http
POST /api/permission-manager/revoke_object_permission/
{
    "user_id": 1,
    "permission_id": 1,
    "object_id": 5,
    "model_name": "school"
}
```

### 4. Получение информации о разрешениях

#### Получить разрешения пользователя
```http
GET /api/permission-manager/get_user_permissions/?user_id=1&model_name=school
```

#### Инициализировать разрешения для моделей
```http
POST /api/permission-manager/initialize_models/
{
    "app_label": "children"  # опционально
}
```

### 5. Конфигурация моделей

#### Получить конфигурацию всех моделей
```http
GET /api/model-configs/
```

#### Включить управление разрешениями для модели
```http
PATCH /api/model-configs/{id}/
{
    "is_managed": true,
    "auto_create_permissions": true
}
```

## 🚀 Практические сценарии использования

### Сценарий 1: Настройка ролевого доступа для менеджера школ

```python
# 1. Создаем роль менеджера школ
POST /api/roles/
{
    "name": "School Manager",
    "description": "Может управлять школами",
    "is_global": true,
    "permissions_ids": [1, 2, 3, 4]  # view, add, change, delete для schools
}

# 2. Назначаем роль пользователю
PATCH /api/roles/1/
{
    "users": [2]  # ID пользователя
}
```

### Сценарий 2: Выдача объектных разрешений

```python
# Пользователь может редактировать только конкретную школу
POST /api/permission-manager/grant_object_permission/
{
    "user_id": 3,
    "permission_id": 3,  # change_school разрешение
    "object_id": 15,     # ID конкретной школы
    "model_name": "school"
}
```

## ⚙️ Настройка моделей для работы с системой

### 1. Автоматическая инициализация
```python
# Запустить один раз для создания разрешений для моделей приложения children
POST /api/permission-manager/initialize_models/
```

### 2. Ручная настройка конкретной модели
```python
# Включить управление разрешениями для модели School
PATCH /api/model-configs/{content_type_id}/
{
    "is_managed": true,
    "auto_create_permissions": true
}
```

## 🔄 Миграция существующего приложения

### Шаг 1: Инициализация системы
```python
POST /api/permission-manager/initialize_models/
```

### Шаг 2: Настройка моделей
Включите `is_managed` для моделей, которые должны использовать систему разрешений.

### Шаг 3: Создание ролей
Создайте необходимые роли и назначьте им разрешения.

### Шаг 4: Назначение ролей пользователям
Назначьте роли существующим пользователям.


## 🎯 Пример полной настройки для модели School

```python
# 1. Инициализировать разрешения
POST /api/permission-manager/initialize_models/

# 2. Проверить созданные разрешения
GET /api/permissions/?model=school

# 3. Создать роль
POST /api/roles/
{
    "name": "School Administrator",
    "permissions_ids": [1, 2, 3, 4]  # IDs разрешений для school
}

# 4. Назначить роль пользователю
PATCH /api/roles/1/
{
    "users": [1, 2, 3]
}
```

## ⚠️ Важные замечания

1. **Администраторы Django** (is_staff/is_superuser) всегда имеют полный доступ
2. **Порядок проверки разрешений**: глобальные → объектные → ролевые
3. **Система создает разрешения только для приложения `children`** по умолчанию
4. **Для других приложений** нужно передать параметр `app_label` в инициализацию
5. **Идемпотентность**: функцию инициализации можно вызывать многократно

## 🛠️ Утилиты для разработки

### Получить все разрешения пользователя
```python
from permissions.utils import get_user_permissions

permissions = get_user_permissions(user, School)  # Для модели
permissions = get_user_permissions(user, School, school_obj)  # Для объекта
```

### Проверить конкретное разрешение
```python
from permissions.utils import check_permission

has_access = check_permission(user, 'change_school', School, school_obj)
```

# Страница раздачи разрешений - Руководство по реализации

## 🎯 Обзор функциональности

Страница раздачи разрешений позволяет администраторам управлять правами доступа пользователей через веб-интерфейс. Типичная страница включает:
- Список пользователей
- Список моделей и объектов
- Систему ролей
- Инструменты для выдачи/отзыва прав

## 📊 Структура данных для страницы

### Получение данных для интерфейса

#### 1. Получить всех пользователей
```http
GET /api/auth/users/  # Предполагая, что у вас есть endpoint для пользователей
```

#### 2. Получить все модели приложения children
```http
GET /api/content-types/
```

#### 3. Получить все разрешения
```http
GET /api/permissions/
```

#### 4. Получить все роли
```http
GET /api/roles/
```

## 🔧 API вызовы для функциональности страницы

### 1. Управление ролями пользователей

#### Назначить роль пользователю
```http
PATCH /api/roles/{role_id}/
{
    "users": [1, 2, 3],
    "permissions_ids": [1, 2, 3]
}
```

#### Получить роли конкретного пользователя
```http
GET /api/roles/?user_id=1
```

### 2. Управление объектными разрешениями

#### Выдать разрешение на объект
```http
POST /api/permission-manager/grant_object_permission/
{
    "user_id": 1,
    "permission_id": 3,
    "object_id": 15,
    "model_name": "school"
}
```

#### Отозвать разрешение на объект
```http
POST /api/permission-manager/revoke_object_permission/
{
    "user_id": 1,
    "permission_id": 3,
    "object_id": 15,
    "model_name": "school"
}
```

#### Получить все объектные разрешения пользователя
```http
GET /api/object-permissions/?user_id=1
```

### 3. Просмотр текущих разрешений

#### Получить все разрешения пользователя
```http
GET /api/permission-manager/get_user_permissions/?user_id=1&model_name=school
```

### Дополнительные API для удобства

#### Получить объектные разрешения с фильтрацией
```python
# Фильтрация по пользователю
GET api/object-permissions/?user_id=1
# Фильтрация по модели
GET api/object-permissions/?model_name=school
# В permissions/views.py
```

#### Получить роли пользователя

```python
GET api/roles/?user_id=1
```

# API модуля permissions - Полная документация

## 🔐 Аутентификация
Все запросы требуют аутентификации (JWT токен или Session)

---

## 👥 Users (Пользователи)

### GET /api/users/ - Список пользователей
**Запрос:**
```http
GET /api/users/
Authorization: Bearer <token>
```

**Ответ:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "first_name": "Admin",
    "last_name": "User",
    "is_staff": true,
    "is_superuser": true,
    "is_active": true,
    "date_joined": "2023-01-15T10:00:00Z"
  },
  {
    "id": 2,
    "username": "manager",
    "email": "manager@example.com",
    "first_name": "School",
    "last_name": "Manager",
    "is_staff": false,
    "is_superuser": false,
    "is_active": true,
    "date_joined": "2023-02-20T14:30:00Z"
  }
]
```

### POST /api/users/ - Создать пользователя
**Запрос:**
```http
POST /api/users/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "first_name": "New",
  "last_name": "User",
  "password": "password123",
  "password_confirm": "password123"
}
```
**Ответ:**
```json
{
  "id": 3,
  "username": "newuser",
  "email": "newuser@example.com",
  "first_name": "New",
  "last_name": "User",
  "is_staff": false,
  "is_superuser": false,
  "is_active": true,
  "date_joined": "2023-12-01T12:00:00Z"
}
```

### PATCH /api/users/2/ - Обновить пользователя
**Запрос:**
```http
PATCH /api/users/2/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "first_name": "Updated",
  "last_name": "Manager",
  "is_active": true
}
```
**Ответ:**
```json
{
  "id": 2,
  "username": "manager",
  "email": "manager@example.com",
  "first_name": "Updated",
  "last_name": "Manager",
  "is_staff": false,
  "is_superuser": false,
  "is_active": true,
  "date_joined": "2023-02-20T14:30:00Z"
}
```

### GET /api/users/2/permissions/ - Получить разрешения пользователя
**Запрос:**
```http
GET /api/users/2/permissions/?model_name=school
Authorization: Bearer <token>
```
**Ответ:**
```json
{
  "user_id": 2,
  "username": "manager",
  "model": "school",
  "permissions": ["view_school", "change_school", "delete_school"]
}
```

---

## 🔑 Permissions (Разрешения)

### GET /api/permissions/ - Список разрешений
**Запрос:**
```http
GET /api/permissions/?model=school
Authorization: Bearer <token>
```
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Просмотр школ",
    "codename": "view_school",
    "description": "Право просматривать школы",
    "content_type": 1,
    "content_type_info": {
      "id": 1,
      "app_label": "children",
      "model_name": "school",
      "verbose_name": "Школа"
    },
    "model_name": "school"
  },
  {
    "id": 2,
    "name": "Добавление школ",
    "codename": "add_school",
    "description": "Право добавлять школы",
    "content_type": 1,
    "content_type_info": {
      "id": 1,
      "app_label": "children",
      "model_name": "school",
      "verbose_name": "Школа"
    },
    "model_name": "school"
  }
]
```

### POST /api/permissions/ - Создать разрешение
**Запрос:**
```http
POST /api/permissions/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "name": "Экспорт школ",
  "codename": "export_school",
  "description": "Право экспортировать данные школ",
  "content_type": 1
}
```
**Ответ:**
```json
{
  "id": 5,
  "name": "Экспорт школ",
  "codename": "export_school",
  "description": "Право экспортировать данные школ",
  "content_type": 1,
  "content_type_info": {
    "id": 1,
    "app_label": "children",
    "model_name": "school",
    "verbose_name": "Школа"
  },
  "model_name": "school"
}
```

---

## 👥 Roles (Роли)

### GET /api/roles/ - Список ролей
**Запрос:**
```http
GET /api/roles/
Authorization: Bearer <token>
```
**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Менеджер школ",
    "description": "Управление школами",
    "is_global": true,
    "permissions": [
      {
        "id": 1,
        "name": "Просмотр школ",
        "codename": "view_school"
      },
      {
        "id": 2,
        "name": "Изменение школ", 
        "codename": "change_school"
      }
    ],
    "permissions_ids": [1, 2],
    "users_count": 2,
    "users": [2, 3]
  }
]
```

### POST /api/roles/ - Создать роль
**Запрос:**
```http
POST /api/roles/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "name": "Просмотрщик",
  "description": "Только просмотр данных",
  "is_global": true,
  "permissions_ids": [1, 5]
}
```
**Ответ:**
```json
{
  "id": 2,
  "name": "Просмотрщик",
  "description": "Только просмотр данных",
  "is_global": true,
  "permissions": [
    {
      "id": 1,
      "name": "Просмотр школ",
      "codename": "view_school"
    },
    {
      "id": 5,
      "name": "Просмотр детей",
      "codename": "view_child"
    }
  ],
  "permissions_ids": [1, 5],
  "users_count": 0,
  "users": []
}
```

### PATCH /api/roles/1/ - Обновить роль
**Запрос:**
```http
PATCH /api/roles/1/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "name": "Старший менеджер школ",
  "permissions_ids": [1, 2, 3, 4],
  "users": [2, 3, 4]
}
```
**Ответ:**
```json
{
  "id": 1,
  "name": "Старший менеджер школ",
  "description": "Управление школами",
  "is_global": true,
  "permissions": [
    {
      "id": 1,
      "name": "Просмотр школ",
      "codename": "view_school"
    },
    {
      "id": 2,
      "name": "Изменение школ",
      "codename": "change_school"
    },
    {
      "id": 3,
      "name": "Добавление школ",
      "codename": "add_school"
    },
    {
      "id": 4,
      "name": "Удаление школ", 
      "codename": "delete_school"
    }
  ],
  "permissions_ids": [1, 2, 3, 4],
  "users_count": 3,
  "users": [2, 3, 4]
}
```

---

## 📋 Object Permissions (Объектные разрешения)

### GET /api/object-permissions/ - Список объектных разрешений
**Запрос:**
```http
GET /api/object-permissions/?user_id=2
Authorization: Bearer <token>
```
**Ответ:**
```json
[
  {
    "id": 1,
    "permission": 2,
    "permission_name": "Изменение школ",
    "user": 2,
    "username": "manager",
    "content_type": 1,
    "model_name": "school",
    "object_id": 5,
    "object_repr": "Школа №15",
    "granted_at": "2023-11-20T10:30:00Z",
    "granted_by": 1
  }
]
```

---

## ⚙️ Permission Manager

### POST /api/permission-manager/grant_object_permission/ - Выдать разрешение на объект
**Запрос:**
```http
POST /api/permission-manager/grant_object_permission/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "user_id": 2,
  "permission_id": 3,
  "object_id": 10,
  "model_name": "school"
}
```
**Ответ:**
```json
{
  "status": "Разрешение выдано"
}
```

### POST /api/permission-manager/revoke_object_permission/ - Отозвать разрешение на объект
**Запрос:**
```http
POST /api/permission-manager/revoke_object_permission/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "user_id": 2,
  "permission_id": 3,
  "object_id": 10,
  "model_name": "school"
}
```
**Ответ:**
```json
{
  "status": "Разрешение отозвано"
}
```

### GET /api/permission-manager/get_user_permissions/ - Получить разрешения пользователя
**Запрос:**
```http
GET /api/permission-manager/get_user_permissions/?user_id=2&model_name=school
Authorization: Bearer <token>
```
**Ответ:**
```json
{
  "user_id": 2,
  "username": "manager",
  "model": "school",
  "permissions": ["view_school", "change_school"]
}
```

### POST /api/permission-manager/initialize_models/ - Инициализировать разрешения
**Запрос:**
```http
POST /api/permission-manager/initialize_models/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "app_label": "children"
}
```
**Ответ:**
```json
{
  "status": "Модели инициализированы",
  "app_label": "children",
  "managed_models": ["Школа", "Ребенок"]
}
```

---

## 🗂️ Content Types

### GET /api/content-types/ - Список управляемых моделей
**Запрос:**
```http
GET /api/content-types/?app_label=children
Authorization: Bearer <token>
```
**Ответ:**
```json
[
  {
    "id": 1,
    "app_label": "children",
    "model_name": "school",
    "verbose_name": "Школа",
    "is_managed": true,
    "config_id": 1
  },
  {
    "id": 2,
    "app_label": "children",
    "model_name": "child",
    "verbose_name": "Ребенок", 
    "is_managed": true,
    "config_id": 2
  }
]
```

---

## ⚙️ Model Configs

### GET /api/model-configs/ - Конфигурации моделей
**Запрос:**
```http
GET /api/model-configs/
Authorization: Bearer <token>
```
**Ответ:**
```json
[
  {
    "id": 1,
    "content_type": 1,
    "content_type_info": {
      "id": 1,
      "app_label": "children",
      "model_name": "school",
      "verbose_name": "Школа"
    },
    "model_name": "school",
    "is_managed": true,
    "auto_create_permissions": true
  }
]
```

### PATCH /api/model-configs/1/ - Обновить конфигурацию
**Запрос:**
```http
PATCH /api/model-configs/1/
Authorization: Bearer <token>
Content-Type: application/json
```
**Тело:**
```json
{
  "is_managed": false,
  "auto_create_permissions": false
}
```
**Ответ:**
```json
{
  "id": 1,
  "content_type": 1,
  "content_type_info": {
    "id": 1,
    "app_label": "children",
    "model_name": "school",
    "verbose_name": "Школа"
  },
  "model_name": "school",
  "is_managed": false,
  "auto_create_permissions": false
}
```

---

## 🎯 Типичные сценарии использования

### 1. Назначить пользователю роль менеджера
```http
PATCH /api/roles/1/
{
  "users": [2, 3, 4]
}
```

### 2. Дать доступ к конкретной школе
```http
POST /api/permission-manager/grant_object_permission/
{
  "user_id": 2,
  "permission_id": 2,
  "object_id": 15,
  "model_name": "school"
}
```

### 3. Проверить права пользователя
```http
GET /api/users/2/permissions/?model_name=school
```

### 4. Создать новую роль
```http
POST /api/roles/
{
  "name": "Аналитик",
  "description": "Доступ к просмотру и экспорту",
  "is_global": true,
  "permissions_ids": [1, 5, 7]
}
```