from django.db import models
from django.contrib.auth.models import User, Group
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class Permission(models.Model):
    """Базовая модель разрешения"""
    PERMISSION_TYPES = [
        ('view', 'Просмотр'),
        ('add', 'Добавление'),
        ('change', 'Изменение'),
        ('delete', 'Удаление'),
    ]

    name = models.CharField("Название разрешения", max_length=100)
    codename = models.CharField("Кодовое имя", max_length=100, unique=True)
    description = models.TextField("Описание", blank=True)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name="Тип контента",
        null=True,  # Разрешение может быть глобальным
        blank=True,
        related_name='permissions'
    )

    class Meta:
        verbose_name = "Разрешение"
        verbose_name_plural = "Разрешения"
        unique_together = ['codename', 'content_type']

    def __str__(self):
        if self.content_type:
            return f"{self.name} ({self.content_type.model})"
        return self.name


class ObjectPermission(models.Model):
    """Разрешение на конкретный объект"""
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, verbose_name="Разрешение")
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Пользователь")
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    granted_at = models.DateTimeField("Время выдачи", auto_now_add=True)
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True,
                                   related_name='granted_permissions', verbose_name="Кем выдано")

    class Meta:
        verbose_name = "Разрешение на объект"
        verbose_name_plural = "Разрешения на объекты"
        unique_together = ['permission', 'user', 'content_type', 'object_id']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.permission.name} - {self.content_object}"


class UserRole(models.Model):
    """Роли пользователей"""
    name = models.CharField("Название роли", max_length=100, unique=True)
    permissions = models.ManyToManyField(Permission, verbose_name="Разрешения", blank=True)
    users = models.ManyToManyField(User, verbose_name="Пользователи", blank=True, related_name='custom_roles')
    description = models.TextField("Описание", blank=True)
    is_global = models.BooleanField("Глобальная роль", default=False,
                                    help_text="Роль применяется ко всем объектам")

    class Meta:
        verbose_name = "Роль пользователя"
        verbose_name_plural = "Роли пользователей"

    def __str__(self):
        return self.name


class ModelPermissionConfig(models.Model):
    """Конфигурация разрешений для моделей"""
    content_type = models.OneToOneField(ContentType, on_delete=models.CASCADE, verbose_name="Модель")
    is_managed = models.BooleanField("Управление разрешениями", default=True,
                                     help_text="Включить управление разрешениями для этой модели")
    auto_create_permissions = models.BooleanField("Автосоздание разрешений", default=True,
                                                  help_text="Автоматически создавать CRUD разрешения")

    class Meta:
        verbose_name = "Конфигурация модели"
        verbose_name_plural = "Конфигурации моделей"

    def __str__(self):
        return f"Конфигурация для {self.content_type.model}"