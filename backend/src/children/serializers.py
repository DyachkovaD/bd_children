from datetime import date

from rest_framework import serializers
from .models import School, Child


def get_age_from_birthday(birthday):
    """Вычисляет полных лет на сегодня от даты рождения."""
    if not birthday:
        return None
    bd = birthday.date() if hasattr(birthday, 'date') else birthday
    if not hasattr(bd, 'year'):
        return None
    today = date.today()
    age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    return max(0, age)


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

    Включает все поля модели плюс название школы и возраст для удобства отображения.
    Используется для операций списка и создания.
    """
    school_name = serializers.CharField(source='school.short_name', read_only=True)
    age = serializers.SerializerMethodField()

    class Meta:
        model = Child
        fields = [
            'id', 'first_name', 'last_name', 'patronymic', 'address',
            'health_status', 'family_status', 'note', 'education_class',
            'birthday', 'school', 'school_name', 'age',
        ]
        read_only_fields = ('school_name', 'age')

    def get_age(self, obj):
        return get_age_from_birthday(obj.birthday)


class ChildCreateSerializer(serializers.ModelSerializer):
    """
    Сериализатор для создания экземпляра модели Child
    """
    class Meta:
        model = Child
        fields = '__all__'
