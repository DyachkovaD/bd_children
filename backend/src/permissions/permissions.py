from rest_framework import permissions
from django.contrib.contenttypes.models import ContentType
from .utils import check_permission, get_permission_codename, is_administrator
from .models import ModelPermissionConfig


class CustomObjectPermission(permissions.BasePermission):
    """
    Кастомное разрешение для работы с объектами любой модели
    """

    def has_permission(self, request, view):
        # Разрешаем доступ только аутентифицированным пользователям
        if not request.user or not request.user.is_authenticated:
            return False

        # Администраторы Django имеют полный доступ
        if request.user.is_staff or request.user.is_superuser:
            return True

        # Получаем модель из view
        model_class = self._get_model_class(view)
        if not model_class:
            return False

        # Проверяем, управляется ли модель системой разрешений
        if not self._is_model_managed(model_class):
            return True  # Если модель не управляется - разрешаем доступ

        # Проверяем разрешения для действия
        action = self._get_action(view)
        permission_codename = get_permission_codename(action, model_class)

        return check_permission(request.user, permission_codename, model_class)

    def has_object_permission(self, request, view, obj):
        # Администраторы Django имеют полный доступ
        if request.user.is_staff or request.user.is_superuser:
            return True

        model_class = type(obj)

        # Проверяем, управляется ли модель системой разрешений
        if not self._is_model_managed(model_class):
            return True

        # Проверяем разрешения для конкретного объекта
        action = self._get_action(view)
        permission_codename = get_permission_codename(action, model_class)

        return check_permission(request.user, permission_codename, model_class, obj)

    def _get_model_class(self, view):
        """Получаем класс модели из view"""
        if hasattr(view, 'queryset'):
            return view.queryset.model
        elif hasattr(view, 'model'):
            return view.model
        elif hasattr(view, 'get_queryset'):
            return view.get_queryset().model
        return None

    def _get_action(self, view):
        """Определяем тип действия на основе view"""
        if hasattr(view, 'action'):
            if view.action in ['list', 'retrieve']:
                return 'view'
            elif view.action == 'create':
                return 'add'
            elif view.action in ['update', 'partial_update']:
                return 'change'
            elif view.action == 'destroy':
                return 'delete'
        return None

    def _is_model_managed(self, model_class):
        """Проверяет, управляется ли модель системой разрешений"""
        try:
            content_type = ContentType.objects.get_for_model(model_class)
            config = ModelPermissionConfig.objects.get(content_type=content_type)
            return config.is_managed
        except ModelPermissionConfig.DoesNotExist:
            return False


class HasModelPermission(permissions.BasePermission):
    """
    Разрешение, которое проверяет наличие конкретного разрешения для модели
    """

    def __init__(self, permission_codename=None, model_class=None):
        self.permission_codename = permission_codename
        self.model_class = model_class

    def has_permission(self, request, view):
        if request.user.is_staff or request.user.is_superuser:
            return True

        if not self.permission_codename:
            return False

        model_class = self.model_class
        if not model_class and hasattr(view, 'queryset'):
            model_class = view.queryset.model

        return check_permission(request.user, self.permission_codename, model_class)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True

        if not self.permission_codename:
            return False

        return check_permission(request.user, self.permission_codename, type(obj), obj)


class IsAdminOrHasModelPermission(HasModelPermission):
    """
    Комбинированное разрешение: администратор ИЛИ наличие разрешения
    """

    def has_permission(self, request, view):
        if request.user.is_staff or request.user.is_superuser:
            return True

        return super().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff or request.user.is_superuser:
            return True

        return super().has_object_permission(request, view, obj)


class ModelPermissionMixin:
    """
    Миксин для ViewSet, который автоматически настраивает разрешения
    """

    def get_permissions(self):
        """
        Динамически настраивает разрешения в зависимости от действия
        """
        permission_classes = []

        if self.action in ['list', 'retrieve']:
            permission_classes = [HasModelPermission('view_{model}')]
        elif self.action == 'create':
            permission_classes = [HasModelPermission('add_{model}')]
        elif self.action in ['update', 'partial_update']:
            permission_classes = [HasModelPermission('change_{model}')]
        elif self.action == 'destroy':
            permission_classes = [HasModelPermission('delete_{model}')]
        else:
            permission_classes = [CustomObjectPermission]

        # Заменяем плейсхолдер {model} на имя реальной модели
        model_name = self.queryset.model._meta.model_name
        for i, perm_instance in enumerate(permission_classes):
            if hasattr(perm_instance, 'permission_codename') and perm_instance.permission_codename:
                perm_class = type(perm_instance)
                permission_classes[i] = type(perm_class.__name__, (perm_class,), {
                    'permission_codename': perm_instance.permission_codename.format(model=model_name),
                    'model_class': self.queryset.model
                })

        return [permission() for permission in permission_classes]


class IsAdministrator(permissions.BasePermission):
    """Доступ только для пользователей с ролью Administrator (или staff/superuser)."""

    def has_permission(self, request, view):
        return is_administrator(request.user)

    def has_object_permission(self, request, view, obj):
        return is_administrator(request.user)


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Разрешение, которое позволяет доступ только администраторам для записи,
    или только для чтения не-администраторам
    """

    def has_permission(self, request, view):
        # Разрешаем безопасные методы (GET, HEAD, OPTIONS) для всех
        if request.method in permissions.SAFE_METHODS:
            return True

        # Для методов записи (POST, PUT, PATCH, DELETE) требуем права администратора
        return request.user and (request.user.is_staff or request.user.is_superuser)

    def has_object_permission(self, request, view, obj):
        # Разрешаем безопасные методы (GET, HEAD, OPTIONS) для всех
        if request.method in permissions.SAFE_METHODS:
            return True

        # Для методов записи (POST, PUT, PATCH, DELETE) требуем права администратора
        return request.user and (request.user.is_staff or request.user.is_superuser)


class IsAuthenticatedOrReadOnly(permissions.BasePermission):
    """
    Разрешение, которое позволяет доступ аутентифицированным пользователям для записи,
    или только для чтения неаутентифицированным пользователям
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated


class IsAdminUser(permissions.BasePermission):
    """
    Разрешение, которое позволяет доступ только администраторам
    """

    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)

    def has_object_permission(self, request, view, obj):
        return request.user and (request.user.is_staff or request.user.is_superuser)