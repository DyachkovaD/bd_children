"""
Диагностика прав пользователя.
Запуск: python manage.py check_user_permissions <username>
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType

from children.models import School
from permissions.models import Permission, UserRole, ModelPermissionConfig
from permissions.utils import get_user_permissions, check_permission


class Command(BaseCommand):
    help = 'Проверяет права пользователя для доступа к schools и children'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Имя пользователя')
        parser.add_argument('--fix', action='store_true', help='Показать рекомендации по исправлению')

    def handle(self, *args, **options):
        username = options['username']
        show_fix = options.get('fix', False)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stderr.write(self.style.ERROR(f'Пользователь "{username}" не найден'))
            return

        self.stdout.write(f'\n=== Диагностика прав для пользователя: {user.username} (id={user.id}) ===\n')

        # 1. Роли пользователя
        roles = user.custom_roles.all()
        self.stdout.write(f'Роли: {list(roles.values_list("name", flat=True)) or "Нет ролей"}')
        if not roles:
            self.stderr.write(self.style.WARNING('  -> Пользователь не привязан ни к одной роли!'))
            if show_fix:
                self.stdout.write('  Рекомендация: Разрешения → выберите роль → иконка пользователей → отметьте пользователя')

        # 2. Разрешения в ролях для School
        ct_school = ContentType.objects.get_for_model(School)
        school_perms_in_roles = set()
        for role in roles:
            perms = role.permissions.filter(content_type=ct_school).values_list('codename', flat=True)
            school_perms_in_roles.update(perms)
            if perms:
                self.stdout.write(f'  Роль "{role.name}": {list(perms)}')

        # 3. Проверка view_school
        has_view = check_permission(user, 'view_school', School)
        user_perms = get_user_permissions(user, School)
        self.stdout.write(f'\nРазрешения для School: {list(user_perms) or "пусто"}')
        self.stdout.write(f'Имеет view_school: {"Да" if has_view else self.style.ERROR("НЕТ")}')

        # 4. ModelPermissionConfig для School
        try:
            config = ModelPermissionConfig.objects.get(content_type=ct_school)
            self.stdout.write(f'\nModelPermissionConfig (school): is_managed={config.is_managed}')
        except ModelPermissionConfig.DoesNotExist:
            self.stderr.write(self.style.WARNING('ModelPermissionConfig для school не найден'))

        # 5. Существующие Permission для school
        perms_exist = Permission.objects.filter(content_type=ct_school).values_list('codename', flat=True)
        self.stdout.write(f'Разрешения в БД для school: {list(perms_exist)}')
        if 'view_school' not in perms_exist:
            self.stderr.write(self.style.WARNING('  -> view_school не создано! Выполните: POST /api/permission-manager/initialize_models/'))

        # Итог и рекомендации
        self.stdout.write('\n--- Итог ---')
        if has_view:
            self.stdout.write(self.style.SUCCESS('Пользователь ДОЛЖЕН иметь доступ к GET /api/schools/'))
        else:
            self.stderr.write(self.style.ERROR('Пользователь НЕ имеет доступа к GET /api/schools/'))
            if show_fix:
                self.stdout.write('\nРекомендации:')
                if not roles:
                    self.stdout.write('  1. Привяжите пользователя к роли (Разрешения → иконка пользователей у роли)')
                if 'view_school' not in school_perms_in_roles:
                    self.stdout.write('  2. Добавьте разрешение "Просмотр Школа" (view_school) в роль Сотрудник')
                if 'view_school' not in perms_exist:
                    self.stdout.write('  3. Нажмите "Инициализировать" на странице Разрешений')
