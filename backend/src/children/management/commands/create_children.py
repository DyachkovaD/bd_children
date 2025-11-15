# management/commands/create_test_data.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
import random
from children.models import School, Child


class Command(BaseCommand):
    help = 'Создает тестовые данные для школ и учеников'

    def handle(self, *args, **options):

        # Список для школ
        schools_data = [
            {
                'full_name': 'Средняя общеобразовательная школа №1 п.Ивня',
                'short_name': 'СОШ №1 п.Ивня',
                'director': 'Иванова Мария Петровна',
                'address': 'ул. Центральная, д. 15'
            },
            {
                'full_name': 'Средняя общеобразовательная школа №2 п.Ивня',
                'short_name': 'СОШ №2 п.Ивня',
                'director': 'Петров Алексей Владимирович',
                'address': 'ул. Школьная, д. 8'
            },
            {
                'full_name': 'Курасовская средняя общеобразовательная школа',
                'short_name': 'Курасовская СОШ',
                'director': 'Сидорова Ольга Николаевна',
                'address': 'пр. Победы, д. 25'
            }
        ]

        schools = []
        for school_data in schools_data:
            school, created = School.objects.get_or_create(**school_data)
            schools.append(school)
            self.stdout.write(
                self.style.SUCCESS(f'Создана школа: {school.short_name}')
            )

        # Списки для генерации случайных данных
        first_names = ['Александр', 'Алексей', 'Андрей', 'Анна', 'Артем',
                       'Василий', 'Виктория', 'Дарья', 'Дмитрий', 'Екатерина',
                       'Иван', 'Кирилл', 'Мария', 'Михаил', 'Наталья',
                       'Ольга', 'Павел', 'Сергей', 'Татьяна', 'Юлия']

        last_names = ['Иванов', 'Петров', 'Сидоров', 'Кузнецов', 'Смирнов',
                      'Васильев', 'Попов', 'Новиков', 'Федоров', 'Морозов',
                      'Волков', 'Алексеев', 'Лебедев', 'Семенов', 'Егоров']

        patronymics = ['Александрович', 'Алексеевич', 'Андреевич', 'Борисович',
                       'Владимирович', 'Дмитриевич', 'Иванович', 'Михайлович',
                       'Николаевич', 'Олегович', 'Сергеевич', 'Юрьевич']

        addresses = ['ул. Ленина, д. 10', 'ул. Мира, д. 25', 'пр. Гагарина, д. 8',
                     'ул. Советская, д. 15', 'ул. Молодежная, д. 3', 'ул. Садовая, д. 12']

        health_statuses = ['Здоров', 'Основная группа', 'Подготовительная группа',
                           'Специальная группа', 'Имеются хронические заболевания']

        family_statuses = ['Полная семья', 'Неполная семья', 'Многодетная семья',
                           'Опекунская семья', 'Приемная семья']

        notes = ['Отличник', 'Хорошист', 'Занимается спортом', 'Участвует в олимпиадах',
                 'Творчески развит', 'Активный участник мероприятий', '']

        # Создаем учеников для каждой школы
        for school in schools:
            for i in range(10):  # 10 учеников на школу
                # Генерируем случайную дату рождения (дети 7-17 лет)
                years_ago = random.randint(7, 17)
                birthday = timezone.now() - timedelta(days=365 * years_ago + random.randint(0, 365))

                child = Child.objects.create(
                    first_name=random.choice(first_names),
                    last_name=random.choice(last_names),
                    patronymic=random.choice(patronymics),
                    address=random.choice(addresses),
                    health_status=random.choice(health_statuses),
                    family_status=random.choice(family_statuses),
                    note=random.choice(notes),
                    education_class=random.randint(1, 11),  # Классы от 1 до 11
                    birthday=birthday,
                    school=school
                )

                self.stdout.write(
                    self.style.SUCCESS(f'Создан ученик: {child.last_name} {child.first_name} для школы {school.short_name}')
                )

        self.stdout.write(
            self.style.SUCCESS('Тестовые данные успешно созданы!')
        )
        self.stdout.write(
            self.style.SUCCESS(f'Создано школ: {School.objects.count()}')
        )
        self.stdout.write(
            self.style.SUCCESS(f'Создано учеников: {Child.objects.count()}')
        )