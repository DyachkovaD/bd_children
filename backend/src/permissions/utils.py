from django.contrib.contenttypes.models import ContentType
from .models import Permission, ModelPermissionConfig


def get_permission_codename(action, model):
    """Генерирует кодовое имя разрешения для модели и действия"""
    return f"{action}_{model._meta.model_name}"


def get_content_type_permission_codename(action, content_type):
    """Генерирует кодовое имя разрешения для ContentType и действия"""
    return f"{action}_{content_type.model}"


def create_model_permissions(model_class, config=None):
    """
    Создает стандартные CRUD разрешения для модели
    """
    content_type = ContentType.objects.get_for_model(model_class)
    model_name = model_class._meta.verbose_name

    permissions_data = [
        ('view', f'Просмотр {model_name}', f'Право просматривать {model_name}'),
        ('add', f'Добавление {model_name}', f'Право добавлять {model_name}'),
        ('change', f'Изменение {model_name}', f'Право изменять {model_name}'),
        ('delete', f'Удаление {model_name}', f'Право удалять {model_name}'),
    ]

    created_permissions = []
    for action, name, description in permissions_data:
        codename = get_permission_codename(action, model_class)
        # Проверяем, существует ли уже такое разрешение
        try:
            permission = Permission.objects.get(
                codename=codename,
                content_type=content_type
            )
            # Разрешение уже существует, добавляем в список
            created_permissions.append(permission)
        except Permission.DoesNotExist:
            # Создаем новое разрешение
            permission = Permission.objects.create(
                codename=codename,
                content_type=content_type,
                name=name,
                description=description
            )
            created_permissions.append(permission)

    # Создаем или обновляем конфигурацию модели
    if config is None:
        config, _ = ModelPermissionConfig.objects.get_or_create(
            content_type=content_type,
            defaults={'auto_create_permissions': True, 'is_managed': True}
        )

    return created_permissions


def get_user_permissions(user, model_class=None, obj=None):
    """
    Получает все разрешения пользователя для модели или объекта
    """
    from .models import ObjectPermission, UserRole

    permissions = set()

    # Разрешения из ролей
    for role in user.custom_roles.all():
        if model_class:
            content_type = ContentType.objects.get_for_model(model_class)
            role_perms = role.permissions.filter(content_type=content_type)
        else:
            role_perms = role.permissions.all()

        for perm in role_perms:
            permissions.add(perm.codename)

    # Разрешения на конкретные объекты
    if obj and user.is_authenticated:
        content_type = ContentType.objects.get_for_model(obj)
        object_perms = ObjectPermission.objects.filter(
            user=user,
            content_type=content_type,
            object_id=obj.id
        ).select_related('permission')

        for obj_perm in object_perms:
            permissions.add(obj_perm.permission.codename)

    return permissions


def check_permission(user, permission_codename, model_class=None, obj=None):
    """
    Проверяет наличие конкретного разрешения у пользователя
    """
    if user.is_superuser or user.is_staff:
        return True

    user_permissions = get_user_permissions(user, model_class, obj)
    return permission_codename in user_permissions


def get_managed_models():
    """
    Возвращает список моделей, для которых включено управление разрешениями
    """
    return ModelPermissionConfig.objects.filter(is_managed=True) \
        .select_related('content_type')


def initialize_all_models():
    """
    Инициализирует разрешения для всех зарегистрированных моделей
    """
    from django.apps import apps

    managed_models = []

    # Получаем конкретное приложение children
    try:
        children_app = apps.get_app_config('children')
        models_list = children_app.get_models()
    except LookupError:
        # Если приложение children не найдено, возвращаем пустой список
        print("Приложение 'children' не найдено")
        return managed_models

    for model in models_list:
        try:
            content_type = ContentType.objects.get_for_model(model)
            config, created = ModelPermissionConfig.objects.get_or_create(
                content_type=content_type,
                defaults={'is_managed': True, 'auto_create_permissions': True}
            )

            if config.auto_create_permissions and config.is_managed:
                create_model_permissions(model, config)
                managed_models.append(model._meta.verbose_name)
        except Exception as e:
            print(f"Ошибка при инициализации модели {model._meta.verbose_name}: {e}")
            continue

    return managed_models