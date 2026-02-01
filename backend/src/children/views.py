from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Count
from django.http import HttpResponse
from datetime import datetime, date, timedelta

from permissions.permissions import ModelPermissionMixin
from .models import School, Child
from .serializers import SchoolSerializer, ChildSerializer, ChildCreateSerializer
from .pagination import DataPageNumberPagination
from .report_export import (
    REPORT_FIELDS,
    get_selected_headers,
    build_xlsx,
    build_docx,
)


class SchoolViewSet(ModelPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet для управления школами.

    Предоставляет полный CRUD функционал для модели School.
    Поддерживает поиск по названию школы и ФИО директора.
    Пагинация: page, page_size (max 100).
    """
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    pagination_class = DataPageNumberPagination

    def get_queryset(self):
        """
        Переопределение queryset с поддержкой ручной фильтрации.

        Returns:
        - QuerySet с примененными фильтрами
        """
        queryset = super().get_queryset()

        # Ручная фильтрация по названию (точное совпадение)
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(full_name__iexact=name)

        # Поиск по наименованию школы (полное или краткое, частичное совпадение)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(short_name__icontains=search)
            )

        # Ручная фильтрация по директору (частичное совпадение)
        director = self.request.query_params.get('director')
        if director:
            queryset = queryset.filter(director__icontains=director)

        return queryset

    @action(detail=True, methods=['get'])
    def children(self, request, pk=None):
        """
        Получить всех учащихся конкретной школы.

        Parameters:
        - pk: ID школы

        Returns:
        - Список учащихся, принадлежащих указанной школе
        """
        school = self.get_object()
        children = Child.objects.filter(school=school)
        serializer = ChildSerializer(children, many=True)
        return Response(serializer.data)


class ChildViewSet(ModelPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet для управления учащимися.

    Предоставляет полный CRUD функционал для модели Child.
    Поддерживает расширенную фильтрацию, поиск и сортировку.
    Пагинация: page, page_size (max 100).

    Доступные фильтры через query parameters:
    - school: фильтрация по ID школы (точное совпадение)
    - q: поиск по имени, фамилии или отчеству (частичное совпадение)
    - address: поиск по адресу (частичное вхождение)
    - note: поиск по примечанию (частичное вхождение)
    - family_status: фильтрация по статусу семьи (точное совпадение)
    - health_status: фильтрация по состоянию здоровья (точное совпадение)
    - birth_year: фильтрация по году рождения
    - birthday_from: фильтрация по дате рождения (от указанной даты)
    - birthday_to: фильтрация по дате рождения (до указанной даты)
    - age_from: минимальный возраст (полных лет)
    - age_to: максимальный возраст (полных лет)
    """
    queryset = Child.objects.all()
    pagination_class = DataPageNumberPagination

    def get_serializer_class(self):
        """
        Выбор сериализатора в зависимости от действия.

        Returns:
        - ChildDetailSerializer для детального просмотра (retrieve)
        - ChildSerializer для всех остальных действий
        """
        if self.action == 'create':
            return ChildCreateSerializer
        return ChildSerializer

    def _apply_filters(self, queryset, params):
        """
        Применяет фильтры к queryset. params — объект с методом .get() (query_params или dict).
        """
        def _get(key, default=''):
            val = params.get(key, default)
            return val.strip() if isinstance(val, str) else val

        school_id = params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)

        q = _get('q')
        if q:
            queryset = queryset.filter(
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(patronymic__icontains=q)
            )

        address = _get('address')
        if address:
            queryset = queryset.filter(address__icontains=address)

        note = _get('note')
        if note:
            queryset = queryset.filter(note__icontains=note)

        family_status = params.get('family_status')
        if family_status:
            queryset = queryset.filter(family_status__icontains=family_status)

        health_status = params.get('health_status')
        if health_status:
            queryset = queryset.filter(health_status__icontains=health_status)

        birth_year = params.get('birth_year')
        if birth_year:
            queryset = queryset.filter(birthday__year=birth_year)

        birthday_from = params.get('birthday_from')
        birthday_to = params.get('birthday_to')
        if birthday_from:
            try:
                from_date = datetime.strptime(
                    birthday_from if isinstance(birthday_from, str) else str(birthday_from),
                    '%Y-%m-%d'
                )
                queryset = queryset.filter(birthday__gte=from_date)
            except (ValueError, TypeError):
                pass
        if birthday_to:
            try:
                to_date = datetime.strptime(
                    birthday_to if isinstance(birthday_to, str) else str(birthday_to),
                    '%Y-%m-%d'
                )
                queryset = queryset.filter(birthday__lte=to_date)
            except (ValueError, TypeError):
                pass

        def _date_years_ago(years):
            t = date.today()
            try:
                return date(t.year - years, t.month, t.day)
            except ValueError:
                return date(t.year - years, 2, 28)

        age_from_val = params.get('age_from')
        if age_from_val is not None and age_from_val != '':
            try:
                age_from = int(age_from_val)
                if age_from >= 0:
                    max_birthday = _date_years_ago(age_from)
                    queryset = queryset.filter(birthday__date__lte=max_birthday)
            except (ValueError, TypeError):
                pass

        age_to_val = params.get('age_to')
        if age_to_val is not None and age_to_val != '':
            try:
                age_to = int(age_to_val)
                if age_to >= 0:
                    min_birthday = _date_years_ago(age_to + 1) + timedelta(days=1)
                    queryset = queryset.filter(birthday__date__gte=min_birthday)
            except (ValueError, TypeError):
                pass

        return queryset

    def get_queryset(self):
        """
        Переопределение queryset с поддержкой ручной фильтрации.
        """
        return self._apply_filters(super().get_queryset(), self.request.query_params)

    @action(detail=False, methods=['get'])
    def by_school(self, request):
        """
        Фильтрация учащихся по конкретной школе.

        Parameters (query parameters):
        - school_id: ID школы для фильтрации

        Returns:
        - Список учащихся указанной школы
        - Ошибка 400 если параметр school_id не указан

        Example:
        GET /api/children/by_school/?school_id=1
        """
        school_id = request.query_params.get('school_id')
        if school_id:
            children = Child.objects.filter(school_id=school_id)
            serializer = self.get_serializer(children, many=True)
            return Response(serializer.data)
        return Response(
            {"error": "Параметр school_id обязателен"},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['get'])
    def search_by_name(self, request):
        """
        Поиск учащихся по имени, фамилии или отчеству.

        Parameters (query parameters):
        - q: поисковый запрос (обязательный)

        Returns:
        - Список учащихся, у которых имя, фамилия или отчество содержат запрос
        - Ошибка 400 если параметр q не указан

        Example:
        GET /api/children/search_by_name/?q=Иван
        """
        query = request.query_params.get('q', '')
        if query:
            children = Child.objects.filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(patronymic__icontains=query)
            )
            serializer = self.get_serializer(children, many=True)
            return Response(serializer.data)
        return Response(
            {"error": "Параметр q обязателен для поиска"},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Получение статистики по учащимся.

        Returns:
        - Общая статистика: количество учащихся, распределение по школам и статусам
        """
        total_children = Child.objects.count()

        # Статистика по школам
        school_stats = []
        for school in School.objects.all():
            count = Child.objects.filter(school=school).count()
            school_stats.append({
                'school_id': school.id,
                'school_name': school.short_name,
                'children_count': count
            })

        # Статистика по статусу семьи
        family_status_stats = Child.objects.values('family_status').annotate(
            count=Count('id')
        )

        # Статистика по состоянию здоровья
        health_status_stats = Child.objects.values('health_status').annotate(
            count=Count('id')
        )

        return Response({
            'total_children': total_children,
            'schools_statistics': school_stats,
            'family_status_statistics': list(family_status_stats),
            'health_status_statistics': list(health_status_stats),
        })

    @action(detail=False, methods=['get'], url_path='report-fields')
    def report_fields(self, request):
        """
        Список полей для отчёта (ключ и подпись для выбора на фронте).

        Returns:
        - Список { key, label } для построения чекбоксов выбора полей.
        """
        return Response([
            {'key': key, 'label': label}
            for key, label in REPORT_FIELDS
        ])

    @action(detail=False, methods=['post'], url_path='report')
    def report(self, request):
        """
        Скачивание отчёта по учащимся (POST). Все параметры в теле запроса.

        Body (JSON):
        - format: xlsx или docx (обязательный)
        - fields: список ключей полей или строка через запятую (опционально; по умолчанию — все поля)
        - Фильтры (те же, что на странице «Учащиеся»): school, q, address, note,
          family_status, health_status, birth_year, birthday_from, birthday_to, age_from, age_to.
        """
        data = request.data or {}
        fmt = (data.get('format') or '').strip().lower()
        if fmt not in ('xlsx', 'docx'):
            return Response(
                {'error': 'Укажите format: "xlsx" или "docx"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        queryset = self._apply_filters(Child.objects.all(), data)
        serializer = self.get_serializer(queryset, many=True)
        rows_data = serializer.data
        fields_value = data.get('fields')
        if isinstance(fields_value, list):
            fields_param = ','.join(str(f).strip() for f in fields_value if f)
        else:
            fields_param = (fields_value or '').strip() if isinstance(fields_value, str) else ''
        selected_headers = get_selected_headers(fields_param)
        if not selected_headers:
            return Response(
                {'error': 'Выберите хотя бы одно поле для отчёта'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if fmt == 'xlsx':
            content = build_xlsx(rows_data, selected_headers)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = 'report_children.xlsx'
        else:
            content = build_docx(rows_data, selected_headers)
            content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            filename = 'report_children.docx'
        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response