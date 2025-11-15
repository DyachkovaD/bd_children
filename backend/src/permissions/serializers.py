from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from .models import Permission, ObjectPermission, UserRole, ModelPermissionConfig


class ContentTypeSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source='app_label')
    model_name = serializers.CharField(source='model')
    verbose_name = serializers.SerializerMethodField()

    class Meta:
        model = ContentType
        fields = ['id', 'app_label', 'model_name', 'verbose_name']

    def get_verbose_name(self, obj):
        try:
            return obj.model_class()._meta.verbose_name
        except:
            return obj.model


class PermissionSerializer(serializers.ModelSerializer):
    content_type_info = ContentTypeSerializer(source='content_type', read_only=True)
    model_name = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'description', 'content_type', 'content_type_info', 'model_name']


class ModelPermissionConfigSerializer(serializers.ModelSerializer):
    content_type_info = ContentTypeSerializer(source='content_type', read_only=True)
    model_name = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = ModelPermissionConfig
        fields = ['id', 'content_type', 'content_type_info', 'model_name', 'is_managed', 'auto_create_permissions']


class UserRoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)
    permissions_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    users_count = serializers.IntegerField(source='users.count', read_only=True)

    class Meta:
        model = UserRole
        fields = ['id', 'name', 'description', 'is_global', 'permissions',
                  'permissions_ids', 'users_count', 'users']

    def create(self, validated_data):
        permissions_ids = validated_data.pop('permissions_ids', [])
        role = UserRole.objects.create(**validated_data)

        if permissions_ids:
            permissions = Permission.objects.filter(id__in=permissions_ids)
            role.permissions.set(permissions)

        return role

    def update(self, instance, validated_data):
        permissions_ids = validated_data.pop('permissions_ids', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if permissions_ids is not None:
            permissions = Permission.objects.filter(id__in=permissions_ids)
            instance.permissions.set(permissions)

        return instance


class ObjectPermissionSerializer(serializers.ModelSerializer):
    permission_name = serializers.CharField(source='permission.name', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    object_repr = serializers.SerializerMethodField()
    model_name = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = ObjectPermission
        fields = ['id', 'permission', 'permission_name', 'user', 'username',
                  'content_type', 'model_name', 'object_id', 'object_repr', 'granted_at', 'granted_by']

    def get_object_repr(self, obj):
        return str(obj.content_object) if obj.content_object else f"Object {obj.object_id}"


class GrantObjectPermissionSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    permission_id = serializers.IntegerField()
    object_id = serializers.IntegerField()
    model_name = serializers.CharField()

    def validate(self, data):
        from django.contrib.contenttypes.models import ContentType

        # Проверяем существование пользователя
        try:
            user = User.objects.get(id=data['user_id'])
        except User.DoesNotExist:
            raise serializers.ValidationError("Пользователь не найден")

        # Проверяем существование разрешения
        try:
            permission = Permission.objects.get(id=data['permission_id'])
        except Permission.DoesNotExist:
            raise serializers.ValidationError("Разрешение не найдено")

        # Проверяем существование объекта
        try:
            content_type = ContentType.objects.get(model=data['model_name'])
            model_class = content_type.model_class()
            obj = model_class.objects.get(id=data['object_id'])
        except ContentType.DoesNotExist:
            raise serializers.ValidationError("Модель не найдена")
        except model_class.DoesNotExist:
            raise serializers.ValidationError("Объект не найден")

        data['user'] = user
        data['permission'] = permission
        data['content_type'] = content_type
        data['object'] = obj

        return data


class UserPermissionsSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    model_name = serializers.CharField(required=False)

    def validate(self, data):
        try:
            user = User.objects.get(id=data['user_id'])
            data['user'] = user
        except User.DoesNotExist:
            raise serializers.ValidationError("Пользователь не найден")

        if 'model_name' in data:
            try:
                content_type = ContentType.objects.get(model=data['model_name'])
                data['content_type'] = content_type
            except ContentType.DoesNotExist:
                raise serializers.ValidationError("Модель не найдена")

        return data