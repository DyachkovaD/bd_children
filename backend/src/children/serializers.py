from rest_framework import serializers
from .models import School, Child


class SchoolSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели School.

    Предоставляет полный набор полей для создания, обновления и отображения данных школы.
    """

    class Meta:
        model = School
        fields = '__all__'


class ChildSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Child (основной).

    Включает все поля модели плюс название школы для удобства отображения.
    Используется для операций списка и создания.
    """
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = Child
        fields = '__all__'
        read_only_fields = ('school_name',)


class ChildCreateSerializer(serializers.ModelSerializer):
    """
    Сериализатор для создания экземпляра модели Child
    """
    class Meta:
        model = Child
        fields = '__all__'
