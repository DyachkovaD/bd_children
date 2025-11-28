# API приложения Children

## Базовый URL
Предполагается, что API доступно по базовому URL: `/api/`

## Школы (Schools)

### GET /api/schools/ - Получить список школ

**Пример запроса:**
```http
GET /api/schools/
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "full_name": "Средняя общеобразовательная школа №1 г. Москвы",
    "short_name": "СОШ №1",
    "director": "Иванова Мария Петровна",
    "address": "г. Москва, ул. Ленина, д. 10"
  },
  {
    "id": 2,
    "full_name": "Гимназия №2 г. Санкт-Петербурга",
    "short_name": "Гимназия №2",
    "director": "Петров Алексей Владимирович",
    "address": "г. Санкт-Петербург, Невский пр., д. 25"
  }
]
```

**Доступные фильтры:**
- `name` - точное совпадение названия школы
- `director` - частичное совпадение имени директора

**Примеры фильтрации:**
```http
GET /api/schools/?name=СОШ №1
GET /api/schools/?director=Иванова
```

### GET /api/schools/{id}/ - Получить школу по ID

**Пример запроса:**
```http
GET /api/schools/1/
```

**Пример ответа:**
```json
{
  "id": 1,
  "full_name": "Средняя общеобразовательная школа №1 г. Москвы",
  "short_name": "СОШ №1",
  "director": "Иванова Мария Петровна",
  "address": "г. Москва, ул. Ленина, д. 10"
}
```

### POST /api/schools/ - Создать новую школу

**Пример запроса:**
```http
POST /api/schools/
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "full_name": "Лицей №3 г. Казани",
  "short_name": "Лицей №3",
  "director": "Сидорова Ольга Николаевна",
  "address": "г. Казань, ул. Баумана, д. 15"
}
```

**Пример ответа:**
```json
{
  "id": 3,
  "full_name": "Лицей №3 г. Казани",
  "short_name": "Лицей №3",
  "director": "Сидорова Ольга Николаевна",
  "address": "г. Казань, ул. Баумана, д. 15"
}
```

### PATCH /api/schools/{id}/ - Частичное обновление школы

**Пример запроса:**
```http
PATCH /api/schools/1/
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "director": "Новый Директор Иванович",
  "address": "г. Москва, ул. Обновленная, д. 20"
}
```

**Пример ответа:**
```json
{
  "id": 1,
  "full_name": "Средняя общеобразовательная школа №1 г. Москвы",
  "short_name": "СОШ №1",
  "director": "Новый Директор Иванович",
  "address": "г. Москва, ул. Обновленная, д. 20"
}
```

### DELETE /api/schools/{id}/ - Удалить школу

**Пример запроса:**
```http
DELETE /api/schools/1/
```

## Учащиеся (Children)

### GET /api/children/ - Получить список учащихся

**Пример запроса:**
```http
GET /api/children/
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "first_name": "Иван",
    "last_name": "Петров",
    "patronymic": "Сергеевич",
    "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
    "health_status": "Здоров",
    "family_status": "Полная семья",
    "note": "Отличник",
    "education_class": 5,
    "birthday": "2012-05-15T00:00:00Z",
    "school": 1,
    "school_name": "СОШ №1"
  }
]
```

**Доступные фильтры:**
- `school` - ID школы
- `family_status` - статус семьи
- `health_status` - состояние здоровья
- `birth_year` - год рождения
- `birthday_from` - дата рождения от (формат: YYYY-MM-DD)
- `birthday_to` - дата рождения до (формат: YYYY-MM-DD)

**Примеры фильтрации:**
```http
GET /api/children/?school=1
GET /api/children/?family_status=Полная семья
GET /api/children/?health_status=Здоров
GET /api/children/?birth_year=2012
GET /api/children/?birthday_from=2010-01-01&birthday_to=2012-12-31
```

### GET /api/children/{id}/ - Получить учащегося по ID

**Пример запроса:**
```http
GET /api/children/1/
```

**Пример ответа:**
```json
{
  "id": 1,
  "first_name": "Иван",
  "last_name": "Петров",
  "patronymic": "Сергеевич",
  "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
  "health_status": "Здоров",
  "family_status": "Полная семья",
  "note": "Отличник",
  "education_class": 5,
  "birthday": "2012-05-15T00:00:00Z",
  "school": 1,
  "school_name": "СОШ №1"
}
```

### POST /api/children/ - Создать нового учащегося

**Пример запроса:**
```http
POST /api/children/
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "first_name": "Мария",
  "last_name": "Сидорова",
  "patronymic": "Александровна",
  "address": "г. Москва, ул. Пушкина, д. 25, кв. 10",
  "health_status": "Имеются хронические заболевания",
  "family_status": "Неполная семья",
  "note": "Требуется дополнительное внимание",
  "education_class": 4,
  "birthday": "2013-08-20T00:00:00Z",
  "school": 1
}
```

**Пример ответа:**
```json
{
  "id": 2,
  "first_name": "Мария",
  "last_name": "Сидорова",
  "patronymic": "Александровна",
  "address": "г. Москва, ул. Пушкина, д. 25, кв. 10",
  "health_status": "Имеются хронические заболевания",
  "family_status": "Неполная семья",
  "note": "Требуется дополнительное внимание",
  "education_class": 4,
  "birthday": "2013-08-20T00:00:00Z",
  "school": 1,
  "school_name": "СОШ №1"
}
```

### PATCH /api/children/{id}/ - Частичное обновление учащегося

**Пример запроса:**
```http
PATCH /api/children/1/
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "education_class": 6,
  "health_status": "Часто болеет",
  "note": "Переведен в 6 класс"
}
```

**Пример ответа:**
```json
{
  "id": 1,
  "first_name": "Иван",
  "last_name": "Петров",
  "patronymic": "Сергеевич",
  "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
  "health_status": "Часто болеет",
  "family_status": "Полная семья",
  "note": "Переведен в 6 класс",
  "education_class": 6,
  "birthday": "2012-05-15T00:00:00Z",
  "school": 1,
  "school_name": "СОШ №1"
}
```

### DELETE /api/children/{id}/ - Удалить учащегося

**Пример запроса:**
```http
DELETE /api/children/1/
```

## Дополнительные эндпоинты

### GET /api/schools/{id}/children/ - Получить учащихся конкретной школы

**Пример запроса:**
```http
GET /api/schools/1/children/
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "first_name": "Иван",
    "last_name": "Петров",
    "patronymic": "Сергеевич",
    "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
    "health_status": "Здоров",
    "family_status": "Полная семья",
    "note": "Отличник",
    "education_class": 5,
    "birthday": "2012-05-15T00:00:00Z",
    "school": 1,
    "school_name": "СОШ №1"
  }
]
```

### GET /api/children/by_school/ - Фильтрация учащихся по школе

**Пример запроса:**
```http
GET /api/children/by_school/?school_id=1
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "first_name": "Иван",
    "last_name": "Петров",
    "patronymic": "Сергеевич",
    "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
    "health_status": "Здоров",
    "family_status": "Полная семья",
    "note": "Отличник",
    "education_class": 5,
    "birthday": "2012-05-15T00:00:00Z",
    "school": 1,
    "school_name": "СОШ №1"
  }
]
```

### GET /api/children/search_by_name/ - Поиск учащихся по ФИО

**Пример запроса:**
```http
GET /api/children/search_by_name/?q=Иван
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "first_name": "Иван",
    "last_name": "Петров",
    "patronymic": "Сергеевич",
    "address": "г. Москва, ул. Ленина, д. 10, кв. 5",
    "health_status": "Здоров",
    "family_status": "Полная семья",
    "note": "Отличник",
    "education_class": 5,
    "birthday": "2012-05-15T00:00:00Z",
    "school": 1,
    "school_name": "СОШ №1"
  }
]
```

### GET /api/children/stats/ - Статистика по учащимся

**Пример запроса:**
```http
GET /api/children/stats/
```

**Пример ответа:**
```json
{
  "total_children": 150,
  "schools_statistics": [
    {
      "school_id": 1,
      "school_name": "СОШ №1",
      "children_count": 75
    },
    {
      "school_id": 2,
      "school_name": "Гимназия №2",
      "children_count": 75
    }
  ],
  "family_status_statistics": [
    {
      "family_status": "Полная семья",
      "count": 100
    },
    {
      "family_status": "Неполная семья",
      "count": 50
    }
  ],
  "health_status_statistics": [
    {
      "health_status": "Здоров",
      "count": 120
    },
    {
      "health_status": "Имеются хронические заболевания",
      "count": 30
    }
  ]
}
```

## Важные замечания

1. **Формат дат**: Все даты передаются в формате ISO 8601 (YYYY-MM-DDThh:mm:ssZ)
2. **Обязательные поля**: При создании школ и учащихся все поля, кроме `note`, являются обязательными
3. **Ошибки**: При некорректных запросах API возвращает соответствующие HTTP статусы (400, 404, 500) с описанием ошибки
4. **Пагинация**: В текущей реализации пагинация не настроена, возвращаются все записи
5. **Сортировка**: По умолчанию школы сортируются по полному названию, учащиеся - по фамилии