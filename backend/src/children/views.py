from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Count
from datetime import datetime

from permissions.permissions import ModelPermissionMixin
from .models import School, Child
from .serializers import SchoolSerializer, ChildSerializer, ChildCreateSerializer


class SchoolViewSet(ModelPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet для управления школами.

    Предоставляет полный CRUD функционал для модели School.
    Поддерживает поиск по названию школы и ФИО директора.
    """

    queryset = School.objects.all()
    serializer_class = SchoolSerializer

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
            queryset = queryset.filter(name__iexact=name)

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

    Доступные фильтры через query parameters:
    - school: фильтрация по ID школы (точное совпадение)
    - family_status: фильтрация по статусу семьи (точное совпадение)
    - health_status: фильтрация по состоянию здоровья (точное совпадение)
    - birth_year: фильтрация по году рождения
    - birthday_from: фильтрация по дате рождения (от указанной даты)
    - birthday_to: фильтрация по дате рождения (до указанной даты)
    """

    queryset = Child.objects.all()

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

    def get_queryset(self):
        """
        Переопределение queryset с поддержкой ручной фильтрации.
        """
        queryset = super().get_queryset()

        # Фильтрация по школе
        school_id = self.request.query_params.get('school')
        if school_id:
            queryset = queryset.filter(school_id=school_id)

        # Фильтрация по статусу семьи
        family_status = self.request.query_params.get('family_status')
        if family_status:
            queryset = queryset.filter(family_status__icontains=family_status)

        # Фильтрация по состоянию здоровья
        health_status = self.request.query_params.get('health_status')
        if health_status:
            queryset = queryset.filter(health_status__icontains=health_status)

        # Фильтрация по году рождения
        birth_year = self.request.query_params.get('birth_year')
        if birth_year:
            queryset = queryset.filter(birthday__year=birth_year)

        # Фильтрация по диапазону дат рождения
        birthday_from = self.request.query_params.get('birthday_from')
        birthday_to = self.request.query_params.get('birthday_to')

        if birthday_from:
            try:
                from_date = datetime.strptime(birthday_from, '%Y-%m-%d')
                queryset = queryset.filter(birthday__gte=from_date)
            except ValueError:
                pass

        if birthday_to:
            try:
                to_date = datetime.strptime(birthday_to, '%Y-%m-%d')
                queryset = queryset.filter(birthday__lte=to_date)
            except ValueError:
                pass

        return queryset

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
                'school_name': school.name,
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