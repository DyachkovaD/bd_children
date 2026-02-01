from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from permissions.utils import is_administrator, get_user_permissions


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Сериализатор для регистрации пользователя.
    Обрабатывает создание пользователя с валидацией пароля и подтверждением.
    Поля:
        username (str): Обязательное. Не более 150 символов. Только буквы, цифры и @/./+/-/_.
        email (str): Обязательное. Должно быть уникальным.
        password (str): Обязательное. Должно соответствовать требованиям валидации пароля Django.
        password2 (str): Обязательное. Должно совпадать с полем password.
        first_name (str): Опциональное. Имя пользователя.
        last_name (str): Опциональное. Фамилия пользователя.
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'email': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"error": "Пароли не совпадают."})

        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"error": "Пользователь с таким email уже существует."})

        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"error": "Пользователь с таким именем уже существует."})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')


class UserUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для изменения пользователя (админ). Пароль опционален."""
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('username', 'email', 'first_name', 'last_name', 'password', 'password2')
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, attrs):
        if attrs.get('password') or attrs.get('password2'):
            if attrs.get('password') != attrs.get('password2'):
                raise serializers.ValidationError({"password2": "Пароли не совпадают."})
        instance = self.instance
        if instance:
            if 'email' in attrs and User.objects.filter(email=attrs['email']).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({"email": "Пользователь с таким email уже существует."})
            if 'username' in attrs and User.objects.filter(username=attrs['username']).exclude(pk=instance.pk).exists():
                raise serializers.ValidationError({"username": "Пользователь с таким именем уже существует."})
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        validated_data.pop('password2', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ProfileSerializer(serializers.ModelSerializer):
    """Сериализатор профиля с полем is_administrator и разрешениями по моделям."""
    is_administrator = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_administrator', 'permissions')

    def get_is_administrator(self, obj):
        return is_administrator(obj)

    def get_permissions(self, obj):
        """Возвращает разрешения пользователя для моделей school и child."""
        from children.models import School, Child
        return {
            'school': list(get_user_permissions(obj, School)),
            'child': list(get_user_permissions(obj, Child)),
        }