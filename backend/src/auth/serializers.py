from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password


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